// V3 stage 6: the one standard rich menu, shared by every landlord. It has
// two tabs that switch between each other: 房客服務 and 房東管理. Landlords
// pick a palette; labels, pages and positions are the same for everyone.
// v2 (owner's format, 2026-11-12): tab bar 300 high with two 1250-wide tabs,
// then 3×2 buttons of 833/833/834 × 693.
export const RICH_MENU_TEMPLATE = 'v2';
export const RICH_MENU_SIZE = { width:2500, height:1686 };
export const RICH_MENU_TAB_HEIGHT = 300;
export const RICH_MENU_COLUMNS = [0,833,1666,2500];
// tone: [page 1 top, bottom], [page 2 top, bottom]; page 1 light, page 2 a bit
// darker. primary: the first button's gradient. ocean is the reference look.
export const RICH_MENU_PALETTES = {
  ocean:{ tone:[['#F4F7FB','#EBF0F7'],['#D2E0F5','#C6D7F0']], primary:['#2B85FF','#006BFF'], icon:'#006BFF', iconBg:'#EAF2FF', primarySub:'#DCEBFF', shadow:'0,60,140', glow:'0,107,255' },
  forest:{ tone:[['#F4F8F5','#EBF2EC'],['#D3E6D8','#C6DECD']], primary:['#43A06E','#2A7A4F'], icon:'#2A7A4F', iconBg:'#E6F2EA', primarySub:'#DDF0E4', shadow:'20,90,50', glow:'42,122,79' },
  terracotta:{ tone:[['#FBF6F2','#F5EDE6'],['#F1DCCD','#EBD0BE']], primary:['#E0845A','#C25E33'], icon:'#C25E33', iconBg:'#FBEDE5', primarySub:'#FBE3D6', shadow:'150,70,30', glow:'194,94,51' },
  charcoal:{ tone:[['#F5F6F7','#ECEEF0'],['#DADDE1','#CED2D7']], primary:['#5A636D','#353C44'], icon:'#353C44', iconBg:'#EDEFF1', primarySub:'#DFE3E7', shadow:'30,40,50', glow:'53,60,68' }
};
// Each tab is its own rich menu, reached through an alias. Tenants and people
// who have not bound yet open on the tenant tab (the default menu); landlords
// and team members are linked to the landlord tab.
export const RICH_MENUS = {
  // [label, page, English caption, icon]; the icon and caption only appear in the image.
  tenant:{ tab:'房客服務', icon:'home', alias:'cmwebs-tenant', chatBarText:'選單', items:[
    ['我的帳單','tenant-bills.html','MY BILLS','bill'],['回報付款','tenant-payment-report.html','PAYMENT','card'],
    ['報修與訊息','tenant-message.html','REPAIRS','chat'],['我的合約','tenant-contract.html','MY LEASE','lease'],
    ['綁定帳號','tenant-bind.html','LINK ACCOUNT','link'],['租屋首頁','tenant-home.html','HOME','home']] },
  landlord:{ tab:'房東管理', icon:'key', alias:'cmwebs-landlord', chatBarText:'選單', items:[
    ['租管首頁','landlord-home.html','DASHBOARD','grid'],['帳款','landlord-arrears.html','BILLING','coin'],
    ['房客','landlord-tenants.html','TENANTS','people'],['房源','landlord-rooms.html','PROPERTIES','building'],
    ['房客訊息','landlord-messages.html','MESSAGES','chat'],['更多','landlord-more.html','MORE','dots']] }
};
export const RICH_MENU_ORDER = ['tenant','landlord'];
export const RICH_MENU_SWITCH_DATA = 'cmwebs-tab:';

export function richMenuAreas(menu, liffId) {
  const width = RICH_MENU_SIZE.width, top = RICH_MENU_TAB_HEIGHT, row = (RICH_MENU_SIZE.height - top) / 2;
  const tabs = RICH_MENU_ORDER.map((name, index) => ({
    bounds:{ x:index * width / 2, y:0, width:width / 2, height:top },
    action:{ type:'richmenuswitch', label:RICH_MENUS[name].tab, richMenuAliasId:RICH_MENUS[name].alias, data:RICH_MENU_SWITCH_DATA+name } }));
  const columns = RICH_MENU_COLUMNS;
  const buttons = RICH_MENUS[menu].items.map(([label, page], index) => {
    const column = index % 3;
    return { bounds:{ x:columns[column], y:top + Math.floor(index / 3) * row, width:columns[column+1]-columns[column], height:row },
      action:{ type:'uri', label, uri:'https://liff.line.me/'+liffId+'/'+page } };
  });
  return [...tabs, ...buttons];
}
