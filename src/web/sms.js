/**
 * SMS sender for OTP codes (Cash on Delivery order verification).
 * Pick the company with SMS_PROVIDER:
 *   bulksmsbd  -> https://bulksmsbd.net   (SMS_API_KEY, SMS_SENDER_ID)
 *   smsnetbd   -> https://sms.net.bd      (SMS_API_KEY, optional SMS_SENDER_ID)
 *   console    -> no SMS, the code is only written to the server log (testing only)
 * Without SMS_PROVIDER the OTP step answers "SMS service is off" instead of letting
 * orders through unverified.
 */

function smsConfig() {
  const provider = String(process.env.SMS_PROVIDER || '').trim().toLowerCase();
  if (!provider) return null;
  if (provider === 'console') return { provider };
  const apiKey = process.env.SMS_API_KEY || '';
  if (!['bulksmsbd', 'smsnetbd'].includes(provider)) return { provider, error: `Unknown SMS_PROVIDER "${provider}"` };
  if (!apiKey) return { provider, error: 'SMS_API_KEY is not set' };
  if (provider === 'bulksmsbd' && !process.env.SMS_SENDER_ID) return { provider, error: 'SMS_SENDER_ID is not set' };
  return { provider, apiKey, senderId: process.env.SMS_SENDER_ID || '' };
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
  if (cfg.provider === 'smsnetbd') {
    const form = new URLSearchParams({ api_key: cfg.apiKey, msg: message, to: intl(phone) });
    if (cfg.senderId) form.set('sender_id', cfg.senderId);
    const res = await fetch('https://api.sms.net.bd/sendsms', { method: 'POST', body: form, signal: AbortSignal.timeout(15000) });
    const data = await res.json().catch(() => ({}));
    if (Number(data.error) === 0) return { ok: true };
    throw new Error(`sms.net.bd: ${data.msg || res.status}`);
  }
  throw new Error(`Unknown SMS provider ${cfg.provider}`);
}

module.exports = { smsConfig, sendSms };
