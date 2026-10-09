import { createHmac, timingSafeEqual } from 'node:crypto';

const fail = code => { throw Object.assign(new Error(code), { code }); };

function receivedAt(value) {
  const time = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isSafeInteger(time) || time < 0) fail('INVALID_TIME');
  return new Date(time).toISOString();
}

function eventTime(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_WEBHOOK_EVENT');
  return value;
}

/** Verify the exact bytes received from LINE before parsing JSON. */
export function verifyWebhook(rawBody, signature, secret) {
  if (typeof rawBody !== 'string' || typeof signature !== 'string' || !signature ||
      typeof secret !== 'string' || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const actual = Buffer.from(signature, 'base64');
  const expectedBytes = Buffer.from(expected, 'base64');
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}

function normalizedEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      typeof event.webhookEventId !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(event.webhookEventId) ||
      !['follow', 'unfollow'].includes(event.type) || !event.source || event.source.type !== 'user' ||
      typeof event.source.userId !== 'string' || !event.source.userId.trim() || event.source.userId.length > 256) {
    fail('INVALID_WEBHOOK_EVENT');
  }
  const provider_id = typeof event.provider_id === 'string' && event.provider_id.trim()
    ? event.provider_id.trim() : typeof event.providerId === 'string' && event.providerId.trim()
      ? event.providerId.trim() : 'unknown';
  return { id: event.webhookEventId, type: event.type, timestamp: eventTime(event.timestamp),
    provider_id, subject: event.source.userId };
}

/** Apply signed webhook events as an idempotent, append-only local state transition.
 * Follow never creates a membership; it only records whether a verified identity can
 * receive a push. Older events are retained for audit but cannot overwrite newer state.
 */
export function applyWebhookEvents(state, events, now) {
  if (!state || !Array.isArray(events)) fail('INVALID_WEBHOOK_EVENT');
  const received_at = receivedAt(now);
  const next = structuredClone(state);
  next.line_presence ??= [];
  next.line_webhook_events ??= [];
  for (const raw of events) {
    const event = normalizedEvent(raw);
    if (next.line_webhook_events.some(row => row.id === event.id)) continue;
    next.line_webhook_events.push({ id: event.id, provider_id: event.provider_id, subject: event.subject,
      type: event.type, event_timestamp: event.timestamp, received_at });
    const current = next.line_presence.find(row => row.provider_id === event.provider_id && row.subject === event.subject);
    if (current && current.event_timestamp >= event.timestamp) continue;
    const row = current || { provider_id: event.provider_id, subject: event.subject };
    row.following = event.type === 'follow'; row.event_timestamp = event.timestamp;
    row.event_id = event.id; row.updated_at = received_at;
    if (!current) next.line_presence.push(row);
  }
  return next;
}
