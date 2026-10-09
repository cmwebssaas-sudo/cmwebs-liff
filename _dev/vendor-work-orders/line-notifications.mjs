import { createHash } from 'node:crypto';

const lineActorId = (providerId, subject) => `line-${createHash('sha256').update(JSON.stringify([providerId, subject])).digest('hex')}`;
const neutralMessage = message => {
  const match = /^Work order (repair|cleaning|other): update available\.$/.exec(String(message || ''));
  const trade = { repair: '維修', cleaning: '清潔', other: '其他工種' }[match?.[1]];
  return trade ? `${trade}工單有新進度，請登入工作台查看。` : '工單有新進度，請登入工作台查看。';
};
const result = (status, reason, retryKey) => ({ status, ...(reason ? { reason } : {}), ...(retryKey ? { retryKey } : {}) });

function authorizedSubject(entry, state, config, subject) {
  if (entry.provider_id !== config.providerId || !config.allowlistedSubjects?.includes(subject)) return false;
  const presence = state.line_presence?.find(row => row.provider_id === config.providerId && row.subject === subject);
  if (!presence?.following) return false;
  if (entry.recipient_type !== 'line_subject' || typeof entry.partner_id !== 'string' || !entry.partner_id) return false;
  const actor_id = lineActorId(config.providerId, subject);
  return state.partner_memberships?.some(member => member.actor_id === actor_id && member.workspace_id === entry.workspace_id &&
      member.partner_id === entry.partner_id && member.active === true) &&
    state.partners?.some(partner => partner.id === entry.partner_id && partner.active === true) &&
    state.workspace_partners?.some(row => row.workspace_id === entry.workspace_id && row.partner_id === entry.partner_id && row.active === true);
}

/** Deliver one already-committed, neutral local notice to one verified LINE subject.
 * This function never expands an audience and never creates a retry key after a timeout.
 */
export async function dispatchLineNotification({ entry, state, config, transport }) {
  const retryKey = `line:${entry?.id || 'unknown'}`;
  if (!config?.enabled) return result('disabled', 'notification_disabled', retryKey);
  const subject = entry?.recipient_id;
  if (typeof subject !== 'string' || !authorizedSubject(entry, state, config, subject)) return result('skipped', 'not_authorized', retryKey);
  if (!transport || typeof transport.push !== 'function') return result('failed', 'transport_unavailable', retryKey);
  const payload = { to: subject, message: neutralMessage(entry.message), retryKey };
  try {
    await transport.push(payload);
    return result('accepted', undefined, retryKey);
  } catch (error) {
    if (error?.code === 'TIMEOUT' || error?.name === 'TimeoutError' || error?.timeout === true) return result('unknown', 'transport_timeout', retryKey);
    return result('failed', 'transport_rejected', retryKey);
  }
}
