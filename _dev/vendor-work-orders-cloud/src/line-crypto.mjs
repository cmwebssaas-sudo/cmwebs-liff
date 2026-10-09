const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch { return null; }
}

async function key(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signLineWebhook(rawBody, secret) {
  if (typeof rawBody !== 'string' || typeof secret !== 'string' || !secret) throw new TypeError('secret is required');
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(rawBody));
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyLineWebhook(rawBody, signature, secret) {
  if (typeof rawBody !== 'string' || typeof signature !== 'string' || !signature || typeof secret !== 'string' || !secret) return false;
  const actual = base64ToBytes(signature);
  if (!actual) return false;
  return crypto.subtle.verify('HMAC', await key(secret), actual, encoder.encode(rawBody));
}
