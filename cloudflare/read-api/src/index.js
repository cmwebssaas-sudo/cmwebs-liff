import { sync } from './sync.js';
import { isReadRoute, readFailure } from './read-routes.js';

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', ...headers }
  });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/sync') return sync(request,env);
    if (isReadRoute(new URL(request.url).pathname)) return readFailure('READ_AUTH_NOT_READY');
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
