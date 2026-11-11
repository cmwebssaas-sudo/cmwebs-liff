import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { encryptChannelSecrets, lineChannels } from '../src/line-channels.js';
import { RICH_MENU_IMAGE_SHA256 } from '../src/line-rich-menu-images.js';
import { RICH_MENUS, RICH_MENU_PALETTES } from '../src/line-rich-menu-layout.js';

const signing = 'synthetic-line-registry-secret';
const key = Buffer.alloc(32,7).toString('base64');
const liffId = '1000000001-AbCdEfGh', owner = 'U'+'d'.repeat(32), member = 'U'+'e'.repeat(32);
const secrets = { messaging_channel_secret:'synthetic-a', messaging_access_token:'synthetic-b', line_login_channel_secret:'synthetic-c' };
const assets = new URL('../../../assets/line-rich-menu/', import.meta.url);

test('committed menu images match the hashes the Worker checks', async () => {
  for (const menu of Object.keys(RICH_MENUS)) {
    for (const palette of Object.keys(RICH_MENU_PALETTES)) {
      const bytes = await readFile(new URL(menu+'-'+palette+'.png', assets));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),RICH_MENU_IMAGE_SHA256[menu][palette],menu+'-'+palette);
      assert.ok(bytes.length < 1024*1024);
    }
  }
});

function fakeLine({ apiDefault = '', tamper = false } = {}) {
  const state = { menus:new Map(), defaultMenu:apiDefault, links:new Map(), unlinked:[], calls:[], next:1 };
  const json = (body, status = 200) => Response.json(body,{ status });
  state.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'cmwebssaas-sudo.github.io') {
      const bytes = await readFile(new URL(parsed.pathname.split('/').pop(), assets));
      return new Response(tamper ? Buffer.concat([bytes,Buffer.from('x')]) : bytes);
    }
    const path = parsed.pathname, method = init.method;
    state.calls.push(method+' '+path);
    if (init.headers?.Authorization !== 'Bearer synthetic-b' && path !== '/oauth2/v2.1/verify') return json({},401);
    if (path === '/oauth2/v2.1/verify') {
      const form = Object.fromEntries(new URLSearchParams(init.body));
      return form.id_token === 'phone-token' ? json({ aud:form.client_id, sub:owner }) : json({},400);
    }
    if (path === '/v2/bot/richmenu' && method === 'POST') {
      const id = 'richmenu-'+String(state.next++).padStart(32,'0');
      state.menus.set(id,{ body:JSON.parse(init.body), image:null }); return json({ richMenuId:id });
    }
    let match;
    if ((match = /^\/v2\/bot\/richmenu\/([^/]+)\/content$/.exec(path))) {
      state.menus.get(match[1]).image = init.headers['content-type']; return json({});
    }
    if ((match = /^\/v2\/bot\/richmenu\/([^/]+)$/.exec(path)) && method === 'DELETE') {
      if (!state.menus.delete(match[1])) return json({},404);
      for (const [user, menu] of state.links) if (menu === match[1]) state.links.delete(user);
      if (state.defaultMenu === match[1]) state.defaultMenu = '';
      return json({});
    }
    if (path === '/v2/bot/richmenu/bulk/unlink') {
      JSON.parse(init.body).userIds.forEach(user => { state.links.delete(user); state.unlinked.push(user); }); return json({},202);
    }
    if (path === '/v2/bot/richmenu/bulk/link') {
      const body = JSON.parse(init.body); body.userIds.forEach(user => state.links.set(user,body.richMenuId)); return json({},202);
    }
    if (path === '/v2/bot/user/all/richmenu') {
      if (method === 'GET') return state.defaultMenu ? json({ richMenuId:state.defaultMenu }) : json({},404);
      state.defaultMenu = ''; return json({});
    }
    if ((match = /^\/v2\/bot\/user\/all\/richmenu\/(.+)$/.exec(path))) {
      if (!state.menus.has(match[1]) && !match[1].startsWith('landlord-own-')) return json({},400);
      state.defaultMenu = match[1]; return json({});
    }
    if ((match = /^\/v2\/bot\/user\/(U[0-9a-f]{32})\/richmenu(?:\/(.+))?$/.exec(path))) {
      if (method === 'DELETE') { state.links.delete(match[1]); return json({}); }
      state.links.set(match[1],match[2]); return json({});
    }
    return json({},404);
  };
  return state;
}

async function withChannel(status, run) {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules:true, script:'export default { fetch() { return new Response(null); } }',
    compatibilityDate:'2026-10-06', d1Databases:{ DB:randomUUID() } }));
  try {
    const db = await mf.getD1Database('DB');
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL('../migrations/'+file, import.meta.url), 'utf8');
      const statements = sql.replace(/^--.*$/gm,'').split(';').map(s => s.trim()).filter(Boolean);
      if (statements.length) await db.batch(statements.map(s => db.prepare(s)));
    }
    await db.prepare(`INSERT INTO line_channels(workspace_id,line_login_channel_id,liff_id,messaging_channel_id,webhook_key,status,encrypted_secrets,updated_at)
      VALUES ('W_A','1000000001',?,'2000000001',?,?,?,'t')`).bind(liffId,'a'.repeat(32),status,await encryptChannelSecrets(secrets,key,'W_A')).run();
    const env = { DB:db, LINE_REGISTRY_SIGNING_SECRET:signing, LINE_CHANNEL_SECRET_KEY:key };
    const send = async (payload, line) => {
      const body = JSON.stringify({ workspace_id:'W_A', ...payload }), timestamp = String(Math.floor(Date.now()/1000)), nonce = randomUUID();
      const signature = createHmac('sha256',signing).update(timestamp+'\n'+nonce+'\n'+body).digest('hex');
      const response = await lineChannels(new Request('https://read.test/internal/line-channels',{ method:'POST', body,
        headers:{ 'X-CMWebs-Timestamp':timestamp, 'X-CMWebs-Nonce':nonce, 'X-CMWebs-Signature':signature } }),env,line.fetch);
      const text = await response.text();
      assert.doesNotMatch(text,/synthetic-[abc]/);
      return { status:response.status, body:JSON.parse(text) };
    };
    await run(db, send);
  } finally { await mf.dispose(); }
}
const ids = line => [...line.menus.keys()];

test('publishing creates both menus pointing at the landlord LIFF without touching the default', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine({ apiDefault:'' });
    const result = await send({ action:'publish_menus', palette:'forest' },line);
    assert.equal(result.status,200);
    assert.deepEqual({ ...result.body.data.menus, updated_at:null },{ palette:'forest', template:'v1', default_enabled:false, has_previous_default:false, updated_at:null });
    assert.equal(line.menus.size,2);
    for (const { body, image } of line.menus.values()) {
      assert.equal(image,'image/png');
      assert.equal(body.areas.length,6);
      for (const area of body.areas) assert.match(area.action.uri,new RegExp('^https://liff\\.line\\.me/'+liffId+'/(tenant|landlord)-[a-z-]+\\.html$'));
    }
    assert.equal(line.defaultMenu,'');
    assert.ok(!line.calls.some(call => call.includes('/user/all/')));
  });
});

test('a tampered image is refused before any menu is created', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine({ tamper:true });
    assert.equal((await send({ action:'publish_menus', palette:'forest' },line)).body.code,'LINE_RICH_MENU_IMAGE_INVALID');
    assert.equal(line.menus.size,0);
    assert.equal((await send({ action:'publish_menus', palette:'purple' },line)).body.code,'INVALID_LINE_CHANNEL');
  });
});

test('menus can be tried on one LINE account before the default changes', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine({ apiDefault:'landlord-own-menu' });
    assert.equal((await send({ action:'preview_menu', id_token:'phone-token', menu:'landlord' },line)).body.code,'LINE_RICH_MENU_NOT_PUBLISHED');
    await send({ action:'publish_menus', palette:'ocean' },line);
    const [tenant, landlord] = ids(line);
    await send({ action:'preview_menu', id_token:'phone-token', menu:'landlord' },line);
    assert.equal(line.links.get(owner),landlord);
    await send({ action:'preview_menu', id_token:'phone-token', menu:'tenant' },line);
    assert.equal(line.links.get(owner),tenant);
    assert.equal((await send({ action:'preview_menu', id_token:'forged', menu:'tenant' },line)).body.code,'LINE_ID_TOKEN_INVALID');
    await send({ action:'preview_menu', id_token:'phone-token', menu:'none' },line);
    assert.equal(line.links.has(owner),false);
    assert.equal(line.defaultMenu,'landlord-own-menu');
  });
});

test('the default keeps the landlord API menu and gives it back when switched off', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine({ apiDefault:'landlord-own-menu' });
    await send({ action:'publish_menus', palette:'forest' },line);
    const [tenant] = ids(line);
    const on = await send({ action:'set_default_menu', enabled:true },line);
    assert.equal(line.defaultMenu,tenant);
    assert.equal(on.body.data.menus.has_previous_default,true);
    await send({ action:'set_default_menu', enabled:true },line);
    assert.equal((await db.prepare('SELECT previous_default_menu_id AS p FROM line_rich_menus').first()).p,'landlord-own-menu');
    const off = await send({ action:'set_default_menu', enabled:false },line);
    assert.equal(off.body.data.restored_previous,true);
    assert.equal(line.defaultMenu,'landlord-own-menu');
  });
});

test('with only an OA Manager menu, switching off clears the API default so that menu shows again', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine();
    await send({ action:'publish_menus', palette:'forest' },line);
    await send({ action:'set_default_menu', enabled:true },line);
    const off = await send({ action:'set_default_menu', enabled:false },line);
    assert.equal(off.body.data.restored_previous,false);
    assert.equal(line.defaultMenu,'');
  });
});

test('a new palette relinks members, moves the default and deletes the old menus', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine();
    await send({ action:'publish_menus', palette:'forest' },line);
    await send({ action:'link_menu', line_user_id:member, menu:'landlord' },line);
    await send({ action:'set_default_menu', enabled:true },line);
    const old = ids(line);
    await send({ action:'publish_menus', palette:'charcoal' },line);
    const [tenant, landlord] = ids(line);
    assert.equal(line.menus.size,2);
    assert.ok(!old.includes(tenant) && !old.includes(landlord));
    assert.equal(line.links.get(member),landlord);
    assert.equal(line.defaultMenu,tenant);
    assert.equal((await db.prepare('SELECT palette FROM line_rich_menus').first()).palette,'charcoal');
  });
});

test('restore removes CMWebs menus everywhere and gives back the earlier default', async () => {
  await withChannel('active', async (db, send) => {
    const line = fakeLine({ apiDefault:'landlord-own-menu' });
    await send({ action:'publish_menus', palette:'forest' },line);
    await send({ action:'link_menu', line_user_id:member, menu:'landlord' },line);
    await send({ action:'set_default_menu', enabled:true },line);
    await db.prepare("UPDATE line_channels SET status='suspended'").run();
    const restored = await send({ action:'restore_menus' },line);
    assert.equal(restored.body.data.restored_previous,true);
    assert.equal(line.menus.size,0);
    assert.equal(line.links.size,0);
    assert.deepEqual(line.unlinked,[member]);
    assert.equal(line.defaultMenu,'landlord-own-menu');
    assert.equal((await db.prepare('SELECT count(*) AS n FROM line_rich_menus').first()).n,0);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM line_rich_menu_users').first()).n,0);
  });
});

test('channels that are not active cannot publish or switch the default on', async () => {
  await withChannel('verifying', async (db, send) => {
    const line = fakeLine();
    assert.equal((await send({ action:'publish_menus', palette:'forest' },line)).body.code,'LINE_CHANNEL_INVALID_STATUS');
    assert.equal((await send({ action:'set_default_menu', enabled:true },line)).body.code,'LINE_CHANNEL_INVALID_STATUS');
    assert.equal((await send({ action:'link_menu', line_user_id:'bad', menu:'landlord' },line)).body.code,'INVALID_LINE_CHANNEL');
    assert.equal(line.calls.length,0);
  });
});
