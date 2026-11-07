/**
 * SMS sender for OTP codes (Cash on Delivery order verification).
 * Pick the company with SMS_PROVIDER:
 *   greenweb   -> https://greenweb.com.bd  (SMS_API_KEY = token)
 *   bulksmsbd  -> https://bulksmsbd.net   (SMS_API_KEY, SMS_SENDER_ID)
 *   smsnetbd   -> https://sms.net.bd      (SMS_API_KEY, optional SMS_SENDER_ID)
 *   android    -> your own Android phone + SIM with the free "SMS Gateway for Android" app
 *                 (https://sms-gate.app). The phone sends the OTP from its SIM, so the cost is
 *                 only the SIM's SMS pack. SMS_GATEWAY_USER / SMS_GATEWAY_PASSWORD from the app
 *                 (Cloud server). SMS_GATEWAY_URL only for the app's "Local server" mode.
 *   console    -> no SMS, the code is only written to the server log (testing only)
 * The same can be typed in /admin -> "OTP SMS" instead (saved in the database).
 * Without any of them the OTP step answers "SMS service is off" instead of letting
 * orders through unverified.
 */

const GATEWAY_URL = () => (process.env.SMS_GATEWAY_URL || 'https://api.sms-gate.app/3rdparty/v1').replace(/\/+$/, '');
const PROVIDERS = ['android', 'greenweb', 'bulksmsbd', 'smsnetbd'];

// Check one set of values: { provider, user, password, apiKey, senderId }
function build(v) {
  const provider = String(v.provider || '').trim().toLowerCase();
  if (provider === 'console') return { provider };
  if (!PROVIDERS.includes(provider)) return { provider, error: `Unknown SMS provider "${provider}"` };
  if (provider === 'android') {
    if (!v.user || !v.password) return { provider, error: 'Username / Password of the phone app is missing' };
    return { provider, user: v.user, password: v.password, url: GATEWAY_URL() };
  }
  if (!v.apiKey) return { provider, error: 'API key / token is missing' };
  if (provider === 'bulksmsbd' && !v.senderId) return { provider, error: 'Sender ID is missing' };
  return { provider, apiKey: v.apiKey, senderId: v.senderId || '' };
}

// saved: SMS settings typed by the admin in /admin (so it can be set up from a phone).
// SMS_PROVIDER in the server environment wins when it is set.
function smsConfig(saved) {
  const provider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
  if (provider) {
    return build({
      provider,
      user: process.env.SMS_GATEWAY_USER, password: process.env.SMS_GATEWAY_PASSWORD,
      apiKey: process.env.SMS_API_KEY, senderId: process.env.SMS_SENDER_ID
    });
  }
  if (!saved || !saved.provider) {
    // Older saved value: phone app login only
    if (saved && saved.user && saved.password) return { ...build({ ...saved, provider: 'android' }), fromAdmin: true };
    return null;
  }
  return { ...build(saved), fromAdmin: true };
}

// 01XXXXXXXXX -> 8801XXXXXXXXX
const intl = phone => `88${phone}`;

async function sendSms(cfg, phone, message) {
  if (cfg.provider === 'console') {
    console.log(`[sms:console] to ${phone}: ${message}`);
    return { ok: true };
  }
  if (cfg.provider === 'bulksmsbd') {
    const url = new URL('https://bulksmsbd.net/api/smsapi');
    url.search = new URLSearchParams({
      api_key: cfg.apiKey, type: 'text', number: intl(phone), senderid: cfg.senderId, message
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    // 202 = "SMS Submitted Successfully"
    if (Number(data.response_code) === 202) return { ok: true };
    throw new Error(`bulksmsbd: ${data.error_message || data.success_message || res.status}`);
  }
  if (cfg.provider === 'greenweb') {
    const url = new URL('https://api.bdbulksms.net/api.php');
    url.search = new URLSearchParams({ token: cfg.apiKey, to: phone, message, json: '1' }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* plain text answer */ }
    const row = Array.isArray(data) ? data[0] : data;
    if ((row && String(row.status).toUpperCase() === 'SENT') || /^\s*Ok\b/i.test(text)) return { ok: true };
    throw new Error(`greenweb: ${(row && (row.statusmsg || row.status)) || text.slice(0, 200) || res.status}`);
  }
  if (cfg.provider === 'smsnetbd') {
    const form = new URLSearchParams({ api_key: cfg.apiKey, msg: message, to: intl(phone) });
    if (cfg.senderId) form.set('sender_id', cfg.senderId);
    const res = await fetch('https://api.sms.net.bd/sendsms', { method: 'POST', body: form, signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    if (Number(data.error) === 0) return { ok: true };
    throw new Error(`sms.net.bd: ${data.msg || res.status}`);
  }
  if (cfg.provider === 'android') {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString('base64')}`
    };
    const to = [`+88${phone}`];
    const post = body => fetch(`${cfg.url}/message`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    let res = await post({ textMessage: { text: message }, phoneNumbers: to });
    // Older app versions only know the plain "message" field
    if (res.status === 400) res = await post({ message, phoneNumbers: to });
    // 202 = queued on the phone; the phone sends it as soon as it is online
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => '');
    throw new Error(`android gateway: ${res.status} ${text.slice(0, 200)}`);
  }
  throw new Error(`Unknown SMS provider ${cfg.provider}`);
}

module.exports = { smsConfig, sendSms, PROVIDERS };
