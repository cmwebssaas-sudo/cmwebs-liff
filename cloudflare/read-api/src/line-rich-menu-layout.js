// V3 stage 6: the one standard rich menu, shared by every landlord. It has
// two tabs that switch between each other: 房客服務 and 房東管理. Landlords
// pick a palette; labels, pages and positions are the same for everyone.
export const RICH_MENU_TEMPLATE = 'v1';
export const RICH_MENU_SIZE = { width:2500, height:1686 };
export const RICH_MENU_TAB_HEIGHT = 250;
export const RICH_MENU_PALETTES = {
  forest:{ background:'#24513e', line:'#3d6e58', text:'#ffffff', tab:'#e9efe9', tabText:'#24513e' },
  ocean:{ background:'#1f4e79', line:'#386894', text:'#ffffff', tab:'#e7eef5', tabText:'#1f4e79' },
  terracotta:{ background:'#8f4429', line:'#a85f43', text:'#ffffff', tab:'#f4ebe6', tabText:'#8f4429' },
  charcoal:{ background:'#2f3437', line:'#4a5054', text:'#ffffff', tab:'#eceeef', tabText:'#2f3437' }
};
// Each tab is its own rich menu, reached through an alias. Tenants and people
// who have not bound yet open on the tenant tab (the default menu); landlords
// and team members are linked to the landlord tab.
export const RICH_MENUS = {
  tenant:{ tab:'房客服務', alias:'cmwebs-tenant', chatBarText:'選單', items:[
    ['首頁','tenant-home.html'],['我的帳單','tenant-bills.html'],['回報付款','tenant-payment-report.html'],
    ['報修與訊息','tenant-message.html'],['我的合約','tenant-contract.html'],['綁定帳號','tenant-bind.html']] },
  landlord:{ tab:'房東管理', alias:'cmwebs-landlord', chatBarText:'選單', items:[
    ['租管首頁','landlord-home.html'],['帳款','landlord-arrears.html'],['房客','landlord-tenants.html'],
    ['房源','landlord-rooms.html'],['房客訊息','landlord-messages.html'],['更多','landlord-more.html']] }
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
