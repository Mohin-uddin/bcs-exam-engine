/**
 * ============================================================================
 * Online payment gateways: SSLCommerz and AamarPay (bKash, Nagad, Rocket, Upay, cards)
 * ============================================================================
 * Flow (same for both):
 *   1. init():    our server asks the gateway for a checkout page, user is redirected there
 *   2. callback:  gateway sends the user back (success / fail / cancel) and, for SSLCommerz,
 *                 also POSTs an IPN server-to-server
 *   3. verify():  we never trust the callback body; we ask the gateway's validation API
 *                 and check status, amount, currency and our tran_id before unlocking
 *
 * Environment:
 *   PAYMENT_GATEWAY            sslcommerz | aamarpay   (unset = no online payment)
 *   PAYMENT_SANDBOX            true (default) | false   use false only with live credentials
 *   SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD
 *   AAMARPAY_STORE_ID, AAMARPAY_SIGNATURE_KEY
 *   PUBLIC_URL                 e.g. https://medha.onrender.com (callback URLs; else taken from the request)
 */

const env = process.env;

const HOSTS = {
  sslcommerz: { sandbox: 'https://sandbox.sslcommerz.com', live: 'https://securepay.sslcommerz.com' },
  aamarpay: { sandbox: 'https://sandbox.aamarpay.com', live: 'https://secure.aamarpay.com' }
};

function gatewayConfig() {
  const provider = String(env.PAYMENT_GATEWAY || '').toLowerCase();
  if (!HOSTS[provider]) return null;
  const sandbox = String(env.PAYMENT_SANDBOX || 'true').toLowerCase() !== 'false';
  const base = env.PAYMENT_GATEWAY_BASE_URL || HOSTS[provider][sandbox ? 'sandbox' : 'live'];
  if (provider === 'sslcommerz') {
    if (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD) return { provider, sandbox, base, error: 'SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD সেট করা নেই' };
    return { provider, sandbox, base, storeId: env.SSLCOMMERZ_STORE_ID, secret: env.SSLCOMMERZ_STORE_PASSWORD };
  }
  if (!env.AAMARPAY_STORE_ID || !env.AAMARPAY_SIGNATURE_KEY) return { provider, sandbox, base, error: 'AAMARPAY_STORE_ID / AAMARPAY_SIGNATURE_KEY সেট করা নেই' };
  return { provider, sandbox, base, storeId: env.AAMARPAY_STORE_ID, secret: env.AAMARPAY_SIGNATURE_KEY };
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gateway returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Create a checkout session. Returns { url } to redirect the user to.
 * payment: { tranId, amount, planNameBn }, user: { name, phone }, urls: { success, fail, cancel, ipn }
 */
async function init(cfg, payment, user, urls) {
  const email = env.CONTACT_EMAIL || 'customer@example.com';
  if (cfg.provider === 'sslcommerz') {
    const form = new URLSearchParams({
      store_id: cfg.storeId,
      store_passwd: cfg.secret,
      total_amount: String(payment.amount),
      currency: 'BDT',
      tran_id: payment.tranId,
      success_url: urls.success,
      fail_url: urls.fail,
      cancel_url: urls.cancel,
      ipn_url: urls.ipn,
      shipping_method: 'NO',
      num_of_item: '1',
      product_name: `Premium ${payment.planNameBn}`,
      product_category: 'Education',
      product_profile: 'non-physical-goods',
      cus_name: user.name,
      cus_email: email,
      cus_add1: 'Bangladesh',
      cus_city: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: user.phone
    });
    const data = await fetchJson(`${cfg.base}/gwprocess/v4/api.php`, { method: 'POST', body: form });
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) throw new Error(data.failedreason || 'SSLCommerz session তৈরি হয়নি');
    return { url: data.GatewayPageURL, sessionKey: data.sessionkey || null };
  }

  // AamarPay JSON API
  const data = await fetchJson(`${cfg.base}/jsonpost.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: cfg.storeId,
      signature_key: cfg.secret,
      tran_id: payment.tranId,
      amount: String(payment.amount),
      currency: 'BDT',
      desc: `Premium ${payment.planNameBn}`,
      cus_name: user.name,
      cus_email: email,
      cus_phone: user.phone,
      cus_add1: 'Bangladesh',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      success_url: urls.success,
      fail_url: urls.fail,
      cancel_url: urls.cancel,
      type: 'json'
    })
  });
  if (String(data.result) !== 'true' || !data.payment_url) {
    throw new Error(typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : 'AamarPay session তৈরি হয়নি');
  }
  return { url: data.payment_url, sessionKey: null };
}

/**
 * Ask the gateway whether this payment is really paid.
 * body: the callback / IPN fields (only used to find val_id for SSLCommerz).
 * Returns { paid, amount, currency, gatewayTxnId, cardType, raw }.
 */
async function verify(cfg, payment, body) {
  if (cfg.provider === 'sslcommerz') {
    let valId = body.val_id;
    if (!valId) {
      // No callback body (admin "check again"): look the payment up by our tran_id
      const tq = new URLSearchParams({ tran_id: payment.tranId, store_id: cfg.storeId, store_passwd: cfg.secret, format: 'json' });
      const list = await fetchJson(`${cfg.base}/validator/api/merchantTransIDvalidationAPI.php?${tq}`);
      const hit = (list.element || []).find(e => e.status === 'VALID' || e.status === 'VALIDATED');
      if (!hit) return { paid: false, reason: 'no valid transaction for this tran_id', raw: { found: list.no_of_trans_found || 0 } };
      valId = hit.val_id;
    }
    const q = new URLSearchParams({ val_id: valId, store_id: cfg.storeId, store_passwd: cfg.secret, format: 'json', v: '1' });
    const data = await fetchJson(`${cfg.base}/validator/api/validationserverAPI.php?${q}`);
    return {
      paid: (data.status === 'VALID' || data.status === 'VALIDATED') && data.tran_id === payment.tranId,
      amount: Number(data.amount),
      currency: data.currency_type || data.currency,
      gatewayTxnId: data.bank_tran_id || valId,
      cardType: data.card_type || '',
      raw: { status: data.status, val_id: valId, risk_level: data.risk_level }
    };
  }

  const q = new URLSearchParams({ request_id: payment.tranId, store_id: cfg.storeId, signature_key: cfg.secret, type: 'json' });
  const data = await fetchJson(`${cfg.base}/api/v1/trxcheck/request.php?${q}`);
  return {
    paid: data.pay_status === 'Successful' && data.mer_txnid === payment.tranId,
    amount: Number(data.amount_original || data.amount),
    currency: data.currency_merchant || data.currency || 'BDT',
    gatewayTxnId: data.pg_txnid || data.bank_trxid || '',
    cardType: data.payment_type || '',
    raw: { pay_status: data.pay_status, status_code: data.status_code }
  };
}

// Our tran_id from a callback body
const tranIdOf = (provider, body) => provider === 'sslcommerz' ? body.tran_id : (body.mer_txnid || body.tran_id);

module.exports = { gatewayConfig, init, verify, tranIdOf };
