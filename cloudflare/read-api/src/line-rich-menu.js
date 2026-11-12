import { LIFF_ENDPOINT_BASE, call, idTokenUser, stop } from './line-setup.js';
import { RICH_MENUS, RICH_MENU_PALETTES, RICH_MENU_SIZE, RICH_MENU_TEMPLATE, richMenuAreas } from './line-rich-menu-layout.js';
import { RICH_MENU_IMAGE_SHA256 } from './line-rich-menu-images.js';

// V3 stage 6: publishes the standard rich menus to a landlord's own OA.
// Setting the default menu is a separate step, so menus can first be tried on
// single users of an OA whose real tenants are already chatting.
const api = 'https://api.line.me';
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2,'0')).join('');
const now = () => new Date().toISOString();

async function menuImage(menu, palette, fetcher) {
  let response;
  try { response = await fetcher(LIFF_ENDPOINT_BASE+'assets/line-rich-menu/'+menu+'-'+palette+'.png',{ redirect:'follow', signal:AbortSignal.timeout(10000) }); }
  catch { stop('LINE_RICH_MENU_IMAGE_INVALID',502); }
  const bytes = response.ok ? await response.arrayBuffer() : new ArrayBuffer(0);
  if (hex(await crypto.subtle.digest('SHA-256',bytes)) !== RICH_MENU_IMAGE_SHA256[menu][palette]) stop('LINE_RICH_MENU_IMAGE_INVALID',502);
  return bytes;
}

async function deleteMenu(fetcher, token, menuId) {
  if (menuId) await call(fetcher,'DELETE',api+'/v2/bot/richmenu/'+menuId,{ token });
}

async function createMenu(fetcher, token, menu, liffId, image) {
  const created = await call(fetcher,'POST',api+'/v2/bot/richmenu',{ token, json:{
    size:RICH_MENU_SIZE, selected:true, name:'CMWebs '+menu+' '+RICH_MENU_TEMPLATE,
    chatBarText:RICH_MENUS[menu].chatBarText, areas:richMenuAreas(menu,liffId) } });
  const menuId = created.status === 200 ? String(created.data.richMenuId || '') : '';
  if (!menuId) stop('LINE_RICH_MENU_FAILED',502);
  const uploaded = await call(fetcher,'POST','https://api-data.line.me/v2/bot/richmenu/'+menuId+'/content',{ token, bytes:image, type:'image/png' });
  if (uploaded.status !== 200) { await deleteMenu(fetcher,token,menuId); stop('LINE_RICH_MENU_FAILED',502); }
  const check = await downloadedImage(fetcher,token,menuId,menu,image);
  if (!check) { await deleteMenu(fetcher,token,menuId); stop('LINE_RICH_MENU_IMAGE_INVALID',502); }
  return { menuId, check };
}

// Reads the image back from LINE: 'identical' when the bytes match what was
// uploaded, 're-encoded' when LINE stored another PNG of the same size or a
// JPEG; '' (refused) when it cannot be read or a PNG has another size.
async function downloadedImage(fetcher, token, menuId, menu, image) {
  let response;
  try {
    response = await fetcher('https://api-data.line.me/v2/bot/richmenu/'+menuId+'/content',
      { method:'GET', headers:{ Authorization:'Bearer '+token }, redirect:'manual', signal:AbortSignal.timeout(10000) });
  } catch { return ''; }
  if (response.status !== 200) return '';
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (hex(await crypto.subtle.digest('SHA-256',bytes)) === hex(await crypto.subtle.digest('SHA-256',image))) return 'identical';
  const png = bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50;
  if (!png) return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 ? 're-encoded' : '';
  const view = new DataView(bytes.buffer,bytes.byteOffset);
  return view.getUint32(16) === RICH_MENU_SIZE.width && view.getUint32(20) === RICH_MENU_SIZE.height ? 're-encoded' : '';
}

// The tabs switch through aliases, so each alias must point at the current menu.
async function pointAlias(fetcher, token, aliasId, menuId) {
  const updated = await call(fetcher,'POST',api+'/v2/bot/richmenu/alias/'+aliasId,{ token, json:{ richMenuId:menuId } });
  if (updated.status === 200) return true;
  const created = await call(fetcher,'POST',api+'/v2/bot/richmenu/alias',{ token, json:{ richMenuAliasId:aliasId, richMenuId:menuId } });
  return created.status === 200;
}

const menuRow = (db, workspaceId) => db.prepare('SELECT * FROM line_rich_menus WHERE workspace_id=?').bind(workspaceId).first();
const publicMenus = row => row ? { palette:row.palette, template:row.template, default_enabled:row.default_enabled === 1,
  has_previous_default:Boolean(row.previous_default_menu_id), updated_at:row.updated_at } : null;

// Creates both menus, moves anyone already linked and the default (when on) to
// them, then deletes the old pair. Safe to run again for a new palette or template.
export async function publishMenus(db, channel, secrets, input, fetcher) {
  if (!Object.hasOwn(RICH_MENU_PALETTES,input.palette)) stop('INVALID_LINE_CHANNEL');
  const token = secrets.messaging_access_token;
  const images = { tenant:await menuImage('tenant',input.palette,fetcher), landlord:await menuImage('landlord',input.palette,fetcher) };
  const first = await createMenu(fetcher,token,'tenant',channel.liff_id,images.tenant);
  const tenant = first.menuId;
  let second;
  try { second = await createMenu(fetcher,token,'landlord',channel.liff_id,images.landlord); }
  catch (error) { await deleteMenu(fetcher,token,tenant); throw error; }
  const landlord = second.menuId;
  const imageCheck = { tenant:first.check, landlord:second.check };
  for (const [menu, menuId] of [['tenant',tenant],['landlord',landlord]]) {
    if (!await pointAlias(fetcher,token,RICH_MENUS[menu].alias,menuId)) {
      await deleteMenu(fetcher,token,tenant); await deleteMenu(fetcher,token,landlord); stop('LINE_RICH_MENU_FAILED',502);
    }
  }
  const old = await menuRow(db,channel.workspace_id);
  const users = (await db.prepare('SELECT line_user_id,menu FROM line_rich_menu_users WHERE workspace_id=?').bind(channel.workspace_id).all()).results || [];
  for (const [menu, menuId] of [['tenant',tenant],['landlord',landlord]]) {
    const ids = users.filter(user => user.menu === menu).map(user => user.line_user_id);
    for (let start = 0; start < ids.length; start += 500) {
      const linked = await call(fetcher,'POST',api+'/v2/bot/richmenu/bulk/link',{ token, json:{ richMenuId:menuId, userIds:ids.slice(start,start+500) } });
      if (linked.status !== 200 && linked.status !== 202) {
        await deleteMenu(fetcher,token,tenant); await deleteMenu(fetcher,token,landlord); stop('LINE_RICH_MENU_FAILED',502);
      }
    }
  }
  if (old?.default_enabled === 1) {
    const moved = await call(fetcher,'POST',api+'/v2/bot/user/all/richmenu/'+tenant,{ token });
    if (moved.status !== 200) stop('LINE_RICH_MENU_FAILED',502);
  }
  await db.prepare(`INSERT INTO line_rich_menus(workspace_id,palette,template,tenant_menu_id,landlord_menu_id,previous_default_menu_id,default_enabled,updated_at)
      VALUES (?,?,?,?,?,NULL,0,?)
    ON CONFLICT(workspace_id) DO UPDATE SET palette=excluded.palette,template=excluded.template,tenant_menu_id=excluded.tenant_menu_id,
      landlord_menu_id=excluded.landlord_menu_id,updated_at=excluded.updated_at`)
    .bind(channel.workspace_id,input.palette,RICH_MENU_TEMPLATE,tenant,landlord,now()).run();
  if (old) { await deleteMenu(fetcher,token,old.tenant_menu_id); await deleteMenu(fetcher,token,old.landlord_menu_id); }
  return { menus:publicMenus(await menuRow(db,channel.workspace_id)), image_check:imageCheck };
}

async function link(db, channel, token, lineUserId, menu, fetcher) {
  const row = await menuRow(db,channel.workspace_id);
  if (!row) stop('LINE_RICH_MENU_NOT_PUBLISHED',409);
  if (menu === 'none') {
    const removed = await call(fetcher,'DELETE',api+'/v2/bot/user/'+lineUserId+'/richmenu',{ token });
    if (removed.status !== 200 && removed.status !== 404) stop('LINE_RICH_MENU_FAILED',502);
    await db.prepare('DELETE FROM line_rich_menu_users WHERE workspace_id=? AND line_user_id=?').bind(channel.workspace_id,lineUserId).run();
  } else {
    const linked = await call(fetcher,'POST',api+'/v2/bot/user/'+lineUserId+'/richmenu/'+row[menu+'_menu_id'],{ token });
    if (linked.status !== 200) stop(linked.status === 404 ? 'LINE_USER_NOT_FOUND' : 'LINE_RICH_MENU_FAILED',linked.status === 404 ? 404 : 502);
    await db.prepare(`INSERT INTO line_rich_menu_users(workspace_id,line_user_id,menu,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(workspace_id,line_user_id) DO UPDATE SET menu=excluded.menu,updated_at=excluded.updated_at`)
      .bind(channel.workspace_id,lineUserId,menu,now()).run();
  }
  return { menu };
}

// Apps Script has checked that this person is (or is no longer) a member.
export function linkMenu(db, channel, secrets, input, fetcher) {
  return link(db,channel,secrets.messaging_access_token,input.line_user_id,input.menu,fetcher);
}

// Lets the person holding a setup link try either menu on their own LINE.
export async function previewMenu(db, channel, secrets, input, fetcher) {
  const sub = await idTokenUser(channel,input.id_token,fetcher);
  return link(db,channel,secrets.messaging_access_token,sub,input.menu,fetcher);
}

async function currentDefault(fetcher, token) {
  const result = await call(fetcher,'GET',api+'/v2/bot/user/all/richmenu',{ token });
  if (result.status === 404) return '';
  if (result.status !== 200) stop('LINE_RICH_MENU_FAILED',502);
  return String(result.data.richMenuId || '');
}

async function restoreDefault(db, row, token, fetcher) {
  const current = await currentDefault(fetcher,token);
  const ours = [row.tenant_menu_id,row.landlord_menu_id];
  let restored = false;
  if (row.previous_default_menu_id) {
    restored = (await call(fetcher,'POST',api+'/v2/bot/user/all/richmenu/'+row.previous_default_menu_id,{ token })).status === 200;
  }
  if (!restored && ours.includes(current)) {
    const cleared = await call(fetcher,'DELETE',api+'/v2/bot/user/all/richmenu',{ token });
    if (cleared.status !== 200) stop('LINE_RICH_MENU_FAILED',502);
  }
  await db.prepare('UPDATE line_rich_menus SET default_enabled=0,previous_default_menu_id=NULL,updated_at=? WHERE workspace_id=?')
    .bind(now(),row.workspace_id).run();
  return restored;
}

// Turning the default on keeps a default the landlord had set by API, so
// turning it off (or suspending) puts it back. An OA Manager menu needs no
// saving: it shows again once no API default is set.
export async function setDefaultMenu(db, channel, secrets, input, fetcher) {
  const row = await menuRow(db,channel.workspace_id);
  if (!row) stop('LINE_RICH_MENU_NOT_PUBLISHED',409);
  const token = secrets.messaging_access_token;
  if (!input.enabled) return { restored_previous:await restoreDefault(db,row,token,fetcher), menus:publicMenus(await menuRow(db,channel.workspace_id)) };
  const current = await currentDefault(fetcher,token);
  const previous = row.previous_default_menu_id ||
    (current && current !== row.tenant_menu_id && current !== row.landlord_menu_id ? current : null);
  const set = await call(fetcher,'POST',api+'/v2/bot/user/all/richmenu/'+row.tenant_menu_id,{ token });
  if (set.status !== 200) stop('LINE_RICH_MENU_FAILED',502);
  await db.prepare('UPDATE line_rich_menus SET default_enabled=1,previous_default_menu_id=?,updated_at=? WHERE workspace_id=?')
    .bind(previous,now(),channel.workspace_id).run();
  return { menus:publicMenus(await menuRow(db,channel.workspace_id)) };
}

// Rollback: give back the earlier default, unlink everyone CMWebs linked (a
// deleted menu would otherwise linger until the chat is reopened), then
// delete CMWebs's menus.
export async function restoreMenus(db, channel, secrets, fetcher) {
  const row = await menuRow(db,channel.workspace_id);
  if (!row) return { restored_previous:false, menus:null };
  const token = secrets.messaging_access_token;
  const restored = await restoreDefault(db,row,token,fetcher);
  const users = ((await db.prepare('SELECT line_user_id FROM line_rich_menu_users WHERE workspace_id=?').bind(channel.workspace_id).all()).results || [])
    .map(user => user.line_user_id);
  for (let start = 0; start < users.length; start += 500) {
    const unlinked = await call(fetcher,'POST',api+'/v2/bot/richmenu/bulk/unlink',{ token, json:{ userIds:users.slice(start,start+500) } });
    if (unlinked.status !== 200 && unlinked.status !== 202) stop('LINE_RICH_MENU_FAILED',502);
  }
  for (const { alias } of Object.values(RICH_MENUS)) {
    const removed = await call(fetcher,'DELETE',api+'/v2/bot/richmenu/alias/'+alias,{ token });
    if (removed.status !== 200 && removed.status !== 404) stop('LINE_RICH_MENU_FAILED',502);
  }
  for (const menuId of [row.tenant_menu_id,row.landlord_menu_id]) {
    const removed = await call(fetcher,'DELETE',api+'/v2/bot/richmenu/'+menuId,{ token });
    if (removed.status !== 200 && removed.status !== 404) stop('LINE_RICH_MENU_FAILED',502);
  }
  await db.batch([db.prepare('DELETE FROM line_rich_menu_users WHERE workspace_id=?').bind(channel.workspace_id),
    db.prepare('DELETE FROM line_rich_menus WHERE workspace_id=?').bind(channel.workspace_id)]);
  return { restored_previous:restored, menus:null };
}

export async function menuStatus(db, channel) {
  return { menus:publicMenus(await menuRow(db,channel.workspace_id)) };
}
