/**
 * ============================================================================
 * Cash on Delivery (COD) orders for the printed question sets
 * ============================================================================
 * 1. /api/cod/otp      : an OTP is sent by SMS to the phone number of the order (sms.js)
 * 2. /api/cod/order    : the order is placed only with the right OTP. The delivery district is
 *                        compared with the phone's current location (browser geolocation);
 *                        far away / unknown locations get a flag the admin sees in the order list.
 *                        Every order gets a secret access code (e.g. 7KQM-X2PD). It is only shown
 *                        to the admin, who prints it and sends it inside the question-set packet.
 * 3. /api/cod/redeem   : after delivery the user types the code on the website (logged in) and
 *                        the plan is switched on: NORMAL = all sets online, view only;
 *                        PREMIUM = all sets + download / print.
 * Admin: /api/admin/accounts/orders (list, status change, mark location as checked).
 * Orders live in the accounts state, so they are saved together with users and payments.
 */

const crypto = require('node:crypto');
const { sendSms } = require('./sms');
const { DISTRICTS, districtById, distanceKm, inBangladesh } = require('./bd-districts');

const OTP_TTL = 5 * 60000;
const OTP_RESEND = 60000;
const OTP_MAX_TRIES = 5;
const OPEN_STATUSES = ['NEW', 'CONFIRMED', 'SHIPPED'];
const STATUSES = ['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
// No 0/O, 1/I/L: the code is typed from paper
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const DEFAULT_COD_SETTINGS = {
  codEnabled: true,
  codPlans: [
    {
      id: 'cod_normal', tier: 'NORMAL', nameBn: 'সাধারণ প্যাকেজ', price: 499, days: 180,
      featuresBn: 'ছাপানো প্রশ্নসেট + ওয়েবসাইট ও অ্যাপে সব সেট দেখা ও পরীক্ষা দেওয়া (ডাউনলোড / প্রিন্ট নেই)'
    },
    {
      id: 'cod_premium', tier: 'PREMIUM', nameBn: 'প্রিমিয়াম প্যাকেজ', price: 799, days: 180,
      featuresBn: 'ছাপানো প্রশ্নসেট + সব সেট দেখা ও পরীক্ষা + যেকোনো প্রশ্নসেট ডাউনলোড ও প্রিন্ট'
    }
  ],
  codDelivery: { insideDhaka: 60, outsideDhaka: 120 },
  // Farther than this from the chosen district town = "location far, call and verify"
  codFarKm: 60
};

function createCodRoutes(ctx) {
  const { state, saveNow, send, fail, normalizePhone, applyPlan, publicUser, clientIp, tooManyAttempts, noteAttempt, newId, smsConfig } = ctx;
  const otps = new Map(); // phone -> { hash, expiresAt, sentAt, tries }
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of otps) if (v.expiresAt < now) otps.delete(k);
  }, 10 * 60000).unref();

  const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const s = () => state().settings;
  const orders = () => state().orders;

  function newCode() {
    const taken = new Set(orders().map(o => o.accessCode));
    for (;;) {
      const bytes = crypto.randomBytes(8);
      let c = '';
      for (const b of bytes) c += CODE_ALPHABET[b % CODE_ALPHABET.length];
      const code = `${c.slice(0, 4)}-${c.slice(4)}`;
      if (!taken.has(code)) return code;
    }
  }
  const normalizeCode = raw => {
    const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : null;
  };

  function nextOrderNo() {
    const st = state();
    st.orderSeq = (Number(st.orderSeq) || 1000) + 1;
    return `SH${st.orderSeq}`;
  }

  function deliveryCharge(districtId) {
    const d = s().codDelivery || DEFAULT_COD_SETTINGS.codDelivery;
    return districtId === 'dhaka' ? Number(d.insideDhaka) || 0 : Number(d.outsideDhaka) || 0;
  }

  // Compare the phone's location with the district town of the address
  function checkLocation(geo, district) {
    if (!geo) return { status: 'UNKNOWN', reasonBn: 'ইউজার লোকেশন দেয়নি' };
    const lat = Number(geo.lat);
    const lng = Number(geo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 'UNKNOWN', reasonBn: 'লোকেশন পড়া যায়নি' };
    const p = { lat, lng };
    const km = Math.round(distanceKm(p, district));
    const accuracyKm = Math.round((Number(geo.accuracy) || 0) / 1000);
    if (!inBangladesh(p)) return { status: 'FAR', distanceKm: km, accuracyKm, reasonBn: 'লোকেশন বাংলাদেশের বাইরে' };
    const limit = Number(s().codFarKm) || DEFAULT_COD_SETTINGS.codFarKm;
    if (km > limit) return { status: 'FAR', distanceKm: km, accuracyKm, reasonBn: `ঠিকানার জেলা থেকে প্রায় ${String(km).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d])} কিমি দূরে` };
    return { status: 'OK', distanceKm: km, accuracyKm, reasonBn: 'ঠিকানার কাছাকাছি' };
  }

  function publicOrderForUser(o) {
    return {
      id: o.id, orderNo: o.orderNo, planNameBn: o.planNameBn, tier: o.tier, total: o.total,
      status: o.status, createdAt: o.createdAt, redeemed: Boolean(o.redeemedAt)
    };
  }

  function publicOrderForAdmin(o) {
    const u = o.redeemedBy ? state().users.find(x => x.id === o.redeemedBy) : null;
    return {
      ...o,
      ip: undefined,
      redeemedUser: u ? { id: u.id, name: u.name, phone: u.phone } : null,
      samePhoneOrders: orders().filter(x => x.phone === o.phone && x.id !== o.id).length
    };
  }

  function publicConfig() {
    const st = s();
    const sms = smsConfig();
    return {
      enabled: st.codEnabled !== false,
      otpReady: Boolean(sms && !sms.error),
      plans: st.codPlans,
      delivery: st.codDelivery,
      districts: DISTRICTS.map(d => ({ id: d.id, nameBn: d.nameBn }))
    };
  }

  // ---------------------------------------------------------------------------
  async function handle(req, res, pathname, searchParams, body, user, isAdminReq) {
    const method = req.method;

    if (pathname === '/api/cod/config' && method === 'GET') {
      send(res, 200, { status: 'SUCCESS', ...publicConfig() });
      return true;
    }

    // ---- 1. Send OTP ----
    if (pathname === '/api/cod/otp' && method === 'POST') {
      if (s().codEnabled === false) return fail(res, 403, 'COD_OFF', 'ক্যাশ অন ডেলিভারি এখন বন্ধ আছে।');
      const phone = normalizePhone(body.phone);
      if (!phone) return fail(res, 400, 'BAD_PHONE', 'সঠিক মোবাইল নম্বর দিন (যেমন ০১৭XXXXXXXX)।');
      const cfg = smsConfig();
      if (!cfg || cfg.error) {
        if (cfg && cfg.error) console.error(`[cod] SMS: ${cfg.error}`);
        return fail(res, 503, 'SMS_OFF', 'OTP পাঠানোর ব্যবস্থা এখনো চালু হয়নি। একটু পরে চেষ্টা করুন।');
      }
      const prev = otps.get(phone);
      if (prev && Date.now() - prev.sentAt < OTP_RESEND) {
        return fail(res, 429, 'WAIT', 'একটু আগেই OTP পাঠানো হয়েছে। ১ মিনিট পর আবার চাইতে পারবেন।');
      }
      const ip = clientIp(req);
      if (tooManyAttempts(`otp:${phone}`, 4) || tooManyAttempts(`otpip:${ip}`, 12)) {
        return fail(res, 429, 'TOO_MANY', 'অনেকবার OTP চাওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।');
      }
      noteAttempt(`otp:${phone}`);
      noteAttempt(`otpip:${ip}`);
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
      try {
        await sendSms(cfg, phone, `Sonar Horin order OTP: ${code}. 5 minute e meyad shesh. Kauke ei code diben na.`);
      } catch (e) {
        console.error('[cod] SMS send failed:', e.message);
        return fail(res, 502, 'SMS_FAIL', 'OTP পাঠানো যায়নি। নম্বরটি ঠিক আছে কিনা দেখে আবার চেষ্টা করুন।');
      }
      otps.set(phone, { hash: sha256(`${phone}:${code}`), expiresAt: Date.now() + OTP_TTL, sentAt: Date.now(), tries: 0 });
      send(res, 200, { status: 'SUCCESS', phone, expiresInSec: OTP_TTL / 1000 });
      return true;
    }

    // ---- 2. Place the order (OTP checked here) ----
    if (pathname === '/api/cod/order' && method === 'POST') {
      const st = s();
      if (st.codEnabled === false) return fail(res, 403, 'COD_OFF', 'ক্যাশ অন ডেলিভারি এখন বন্ধ আছে।');
      const plan = (st.codPlans || []).find(p => p.id === body.planId);
      const name = String(body.name || '').trim().slice(0, 80);
      const phone = normalizePhone(body.phone);
      const district = districtById(String(body.districtId || ''));
      const area = String(body.area || '').trim().slice(0, 100);
      const address = String(body.address || '').trim().slice(0, 300);
      if (!plan) return fail(res, 400, 'BAD_PLAN', 'প্যাকেজ বাছাই করুন।');
      if (name.length < 2) return fail(res, 400, 'BAD_NAME', 'আপনার নাম লিখুন।');
      if (!phone) return fail(res, 400, 'BAD_PHONE', 'সঠিক মোবাইল নম্বর দিন।');
      if (!district) return fail(res, 400, 'BAD_DISTRICT', 'জেলা বাছাই করুন।');
      if (area.length < 2) return fail(res, 400, 'BAD_AREA', 'থানা / উপজেলা লিখুন।');
      if (address.length < 6) return fail(res, 400, 'BAD_ADDRESS', 'বাসা / গ্রাম / রোডসহ পুরো ঠিকানা লিখুন।');

      const otp = otps.get(phone);
      if (!otp || otp.expiresAt < Date.now()) return fail(res, 400, 'OTP_EXPIRED', 'OTP এর মেয়াদ শেষ। নতুন OTP নিন।');
      if (otp.tries >= OTP_MAX_TRIES) {
        otps.delete(phone);
        return fail(res, 429, 'OTP_LOCKED', 'অনেকবার ভুল OTP দেওয়া হয়েছে। নতুন OTP নিন।');
      }
      const given = sha256(`${phone}:${String(body.otp || '').replace(/\D/g, '')}`);
      if (!crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(otp.hash, 'hex'))) {
        otp.tries += 1;
        return fail(res, 400, 'BAD_OTP', 'OTP সঠিক নয়। SMS এ পাওয়া ৬ সংখ্যার কোডটি দিন।');
      }
      if (orders().filter(o => o.phone === phone && OPEN_STATUSES.includes(o.status)).length >= 3) {
        return fail(res, 429, 'TOO_MANY_ORDERS', 'এই নম্বরে ৩টি অর্ডার ডেলিভারির অপেক্ষায় আছে। প্রয়োজনে আমাদের সাথে যোগাযোগ করুন।');
      }
      otps.delete(phone);

      const geo = body.geo && typeof body.geo === 'object' ? {
        lat: Number(body.geo.lat), lng: Number(body.geo.lng), accuracy: Math.round(Number(body.geo.accuracy) || 0)
      } : null;
      const charge = deliveryCharge(district.id);
      const now = new Date().toISOString();
      const order = {
        id: newId('ord'),
        orderNo: nextOrderNo(),
        planId: plan.id,
        planNameBn: plan.nameBn,
        tier: plan.tier === 'NORMAL' ? 'NORMAL' : 'PREMIUM',
        days: plan.days,
        price: plan.price,
        deliveryCharge: charge,
        total: plan.price + charge,
        name,
        phone,
        phoneVerifiedAt: now,
        districtId: district.id,
        districtBn: district.nameBn,
        area,
        address,
        noteBn: String(body.note || '').trim().slice(0, 300),
        geo: geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng) ? geo : null,
        geoErrorBn: geo ? '' : String(body.geoError || '').slice(0, 100),
        location: checkLocation(geo, district),
        locationVerifiedAt: null,
        accessCode: newCode(),
        status: 'NEW',
        userId: user ? user.id : null,
        redeemedAt: null,
        redeemedBy: null,
        createdAt: now,
        history: [{ at: now, status: 'NEW', by: 'customer' }],
        ip: clientIp(req)
      };
      orders().push(order);
      await saveNow();
      send(res, 200, {
        status: 'SUCCESS',
        order: publicOrderForUser(order),
        messageBn: 'অর্ডার নেওয়া হয়েছে। আপনার অ্যাক্সেস কোড প্রশ্নসেটের সাথে প্যাকেটে আসবে। প্রশ্নসেট হাতে পেয়ে টাকা দিন, তারপর ওয়েবসাইটে লগইন করে কোডটি দিন।'
      });
      return true;
    }

    // ---- Orders of the logged-in user (by account or by the account's phone) ----
    if (pathname === '/api/cod/mine' && method === 'GET') {
      if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'আগে লগইন করুন।');
      const list = orders().filter(o => o.userId === user.id || o.phone === user.phone).slice(-20).reverse();
      send(res, 200, { status: 'SUCCESS', orders: list.map(publicOrderForUser) });
      return true;
    }

    // ---- 3. Enter the access code from the packet ----
    if (pathname === '/api/cod/redeem' && method === 'POST') {
      if (!user) return fail(res, 401, 'LOGIN_REQUIRED', 'কোড দিতে আগে লগইন বা নতুন অ্যাকাউন্ট খুলুন।');
      const ip = clientIp(req);
      if (tooManyAttempts(`rd:${user.id}`) || tooManyAttempts(`rdip:${ip}`, 20)) {
        return fail(res, 429, 'TOO_MANY', 'অনেকবার ভুল কোড দেওয়া হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।');
      }
      const code = normalizeCode(body.code);
      const order = code && orders().find(o => o.accessCode === code);
      if (!order || order.status === 'CANCELLED') {
        noteAttempt(`rd:${user.id}`);
        noteAttempt(`rdip:${ip}`);
        return fail(res, 400, 'BAD_CODE', 'কোডটি সঠিক নয়। প্রশ্নসেটের সাথে পাওয়া ৮ অক্ষরের কোডটি দেখে আবার লিখুন।');
      }
      if (order.redeemedAt) {
        const mine = order.redeemedBy === user.id;
        return fail(res, 409, 'CODE_USED', mine ? 'এই কোডটি আপনার অ্যাকাউন্টে আগেই চালু করা হয়েছে।' : 'এই কোডটি অন্য একটি অ্যাকাউন্টে ব্যবহার করা হয়েছে।');
      }
      const now = new Date().toISOString();
      applyPlan(user, { days: order.days, tier: order.tier });
      order.redeemedAt = now;
      order.redeemedBy = user.id;
      // Code is only in the packet, so using it means the packet arrived
      if (order.status !== 'DELIVERED') {
        order.status = 'DELIVERED';
        order.history.push({ at: now, status: 'DELIVERED', by: 'code' });
      }
      await saveNow();
      send(res, 200, {
        status: 'SUCCESS',
        user: publicUser(user),
        tier: order.tier,
        messageBn: order.tier === 'PREMIUM'
          ? 'প্রিমিয়াম প্যাকেজ চালু হয়েছে। সব সেট দেখা, পরীক্ষা, ডাউনলোড ও প্রিন্ট এখন খোলা।'
          : 'সাধারণ প্যাকেজ চালু হয়েছে। সব সেট দেখা ও পরীক্ষা দেওয়া এখন খোলা।'
      });
      return true;
    }

    // ---- Admin ----
    if (pathname.startsWith('/api/admin/accounts/orders')) {
      if (!isAdminReq) return fail(res, 401, 'ADMIN_ONLY', 'অ্যাডমিন কী সঠিক নয়।');

      if (pathname === '/api/admin/accounts/orders' && method === 'GET') {
        const f = searchParams.get('status') || 'OPEN';
        const q = String(searchParams.get('q') || '').trim().toUpperCase();
        const all = orders();
        let list = all.filter(o => f === 'ALL'
          || (f === 'OPEN' && OPEN_STATUSES.includes(o.status))
          || (f === 'FAR' && OPEN_STATUSES.includes(o.status) && o.location.status !== 'OK' && !o.locationVerifiedAt)
          || o.status === f);
        if (q) {
          const digits = q.replace(/\D/g, '');
          list = list.filter(o => o.orderNo.includes(q) || o.accessCode.replace('-', '').includes(q.replace(/[^A-Z0-9]/g, '')) || (digits.length >= 4 && o.phone.includes(digits)) || o.name.toUpperCase().includes(q));
        }
        const counts = { OPEN: all.filter(o => OPEN_STATUSES.includes(o.status)).length };
        STATUSES.forEach(st => { counts[st] = all.filter(o => o.status === st).length; });
        counts.FAR = all.filter(o => OPEN_STATUSES.includes(o.status) && o.location.status !== 'OK' && !o.locationVerifiedAt).length;
        send(res, 200, { status: 'SUCCESS', counts, orders: list.slice(-300).reverse().map(publicOrderForAdmin) });
        return true;
      }

      let m = pathname.match(/^\/api\/admin\/accounts\/orders\/([\w-]+)\/status$/);
      if (m && method === 'POST') {
        const o = orders().find(x => x.id === m[1]);
        if (!o) return fail(res, 404, 'NOT_FOUND', 'অর্ডার পাওয়া যায়নি।');
        const next = String(body.status || '');
        if (!STATUSES.includes(next)) return fail(res, 400, 'BAD_STATUS', 'সঠিক অবস্থা বাছাই করুন।');
        if (o.redeemedAt && next === 'CANCELLED') return fail(res, 409, 'REDEEMED', 'কোড ইতিমধ্যে ব্যবহার হয়েছে, এই অর্ডার বাতিল করা যাবে না।');
        o.status = next;
        o.history.push({ at: new Date().toISOString(), status: next, by: 'admin', noteBn: String(body.noteBn || '').slice(0, 300) });
        if (body.noteBn) o.adminNoteBn = String(body.noteBn).slice(0, 300);
        await saveNow();
        send(res, 200, { status: 'SUCCESS', order: publicOrderForAdmin(o) });
        return true;
      }

      m = pathname.match(/^\/api\/admin\/accounts\/orders\/([\w-]+)\/location-ok$/);
      if (m && method === 'POST') {
        const o = orders().find(x => x.id === m[1]);
        if (!o) return fail(res, 404, 'NOT_FOUND', 'অর্ডার পাওয়া যায়নি।');
        o.locationVerifiedAt = new Date().toISOString();
        o.history.push({ at: o.locationVerifiedAt, status: o.status, by: 'admin', noteBn: 'ফোনে ঠিকানা যাচাই করা হয়েছে' });
        await saveNow();
        send(res, 200, { status: 'SUCCESS', order: publicOrderForAdmin(o) });
        return true;
      }
      return fail(res, 404, 'NOT_FOUND', 'রুট পাওয়া যায়নি।');
    }
    return false;
  }

  // Admin settings form: COD part
  function applySettings(body) {
    const st = s();
    if (Array.isArray(body.codPlans)) {
      const plans = body.codPlans.map(p => ({
        id: String(p.id || '').replace(/[^\w-]/g, '').slice(0, 30),
        tier: p.tier === 'NORMAL' ? 'NORMAL' : 'PREMIUM',
        nameBn: String(p.nameBn || '').trim().slice(0, 40),
        price: Math.round(Number(p.price)),
        days: Math.round(Number(p.days)),
        featuresBn: String(p.featuresBn || '').trim().slice(0, 200)
      }));
      if (!plans.length || plans.some(p => !p.id || !p.nameBn || !(p.price > 0) || !(p.days > 0))) {
        return 'প্রতিটি ক্যাশ অন ডেলিভারি প্যাকেজের নাম, দাম ও দিন সঠিকভাবে দিন।';
      }
      st.codPlans = plans;
    }
    if (body.codDelivery && typeof body.codDelivery === 'object') {
      const a = Math.round(Number(body.codDelivery.insideDhaka));
      const b = Math.round(Number(body.codDelivery.outsideDhaka));
      if (!(a >= 0 && b >= 0)) return 'ডেলিভারি চার্জ সঠিকভাবে দিন।';
      st.codDelivery = { insideDhaka: a, outsideDhaka: b };
    }
    if (body.codFarKm !== undefined) {
      const km = Math.round(Number(body.codFarKm));
      if (!(km >= 5 && km <= 500)) return 'দূরত্বের সীমা ৫ থেকে ৫০০ কিমির মধ্যে দিন।';
      st.codFarKm = km;
    }
    if (body.codEnabled !== undefined) st.codEnabled = Boolean(body.codEnabled);
    return null;
  }

  return { handle, applySettings, publicConfig, checkLocation, normalizeCode };
}

module.exports = { createCodRoutes, DEFAULT_COD_SETTINGS };
