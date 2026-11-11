// V3 stage 6: the one standard rich menu, shared by every landlord. It has
// two tabs that switch between each other: 房客服務 and 房東管理. Landlords
// pick a palette; labels, pages and positions are the same for everyone.
export const RICH_MENU_TEMPLATE = 'v1';
export const RICH_MENU_SIZE = { width:2500, height:1686 };
export const RICH_MENU_TAB_HEIGHT = 250;
// accent: the first card and icons; background: the card area; tabBar: the
// inactive tab.
export const RICH_MENU_PALETTES = {
  forest:{ accent:'#2f6b4f', background:'#f3f6f1', tabBar:'#e1e9df', ink:'#23392e', muted:'#7b8f82' },
  ocean:{ accent:'#2563c9', background:'#f2f6fb', tabBar:'#dfe8f4', ink:'#1f2f45', muted:'#7d8ca1' },
  terracotta:{ accent:'#b4552f', background:'#faf5ef', tabBar:'#efe4d8', ink:'#3d2a20', muted:'#9a8476' },
  charcoal:{ accent:'#3b4248', background:'#f5f5f3', tabBar:'#e4e4e1', ink:'#26292c', muted:'#868b8f' }
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
  const width = RICH_MENU_SIZE.width, top = RICH_MENU_TAB_HEIGHT;
  const tabs = RICH_MENU_ORDER.map((name, index) => ({
    bounds:{ x:index * width / 2, y:0, width:width / 2, height:top },
    action:{ type:'richmenuswitch', label:RICH_MENUS[name].tab, richMenuAliasId:RICH_MENUS[name].alias, data:RICH_MENU_SWITCH_DATA+name } }));
  const columns = [0,833,1667,2500], rows = [top,top+718,RICH_MENU_SIZE.height];
  const buttons = RICH_MENUS[menu].items.map(([label, page], index) => {
    const column = index % 3, row = Math.floor(index / 3);
    return { bounds:{ x:columns[column], y:rows[row], width:columns[column+1]-columns[column], height:rows[row+1]-rows[row] },
      action:{ type:'uri', label, uri:'https://liff.line.me/'+liffId+'/'+page } };
  });
  return [...tabs, ...buttons];
}
