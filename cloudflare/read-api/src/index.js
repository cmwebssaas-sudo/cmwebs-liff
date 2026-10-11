import { sync } from './sync.js';
import { isReadRoute, readFailure } from './read-routes.js';
import { createReadHttpHandler } from './read-http.js';
const read=createReadHttpHandler();

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers }
  });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/sync') return sync(request,env);
    if (isReadRoute(new URL(request.url).pathname)) {
      if(!env.READ_AUTHORITY_URL||!env.LINE_LOGIN_CHANNEL_ID||!env.READ_REPLICA_SYNC_SECRET) return readFailure('READ_AUTH_NOT_READY');
      return read(request,env);
    }
    if (new URL(request.url).pathname !== '/health') {
      return json({ success: false, error: 'NOT_FOUND' }, 404);
    }
    if (request.method !== 'GET') {
      return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, { allow: 'GET' });
    }
    try {
      const result = await env.DB.prepare('SELECT 1 AS ready').first();
      if (result?.ready !== 1) throw new Error('Unavailable');
      return json({ success: true, data: { service: 'cmwebs-read-api', database: 'ready' } });
    } catch {
      return json({ success: false, error: 'READ_REPLICA_UNAVAILABLE' }, 503);
    }
  }
};
