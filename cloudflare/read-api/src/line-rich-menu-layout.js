// V3 stage 6: the one standard rich menu layout. Landlords pick a palette;
// labels, pages and positions are the same for everyone.
export const RICH_MENU_TEMPLATE = 'v1';
export const RICH_MENU_SIZE = { width:2500, height:843 };
export const RICH_MENU_PALETTES = {
  forest:{ background:'#24513e', line:'#3d6e58', text:'#ffffff' },
  ocean:{ background:'#1f4e79', line:'#386894', text:'#ffffff' },
  terracotta:{ background:'#8f4429', line:'#a85f43', text:'#ffffff' },
  charcoal:{ background:'#2f3437', line:'#4a5054', text:'#ffffff' }
};
// Two rows of three. Tenants and people who have not bound yet see the tenant
// menu as the default; landlords and team members get theirs per user.
export const RICH_MENUS = {
  tenant:{ chatBarText:'租屋服務', items:[
    ['首頁','tenant-home.html'],['我的帳單','tenant-bills.html'],['回報付款','tenant-payment-report.html'],
    ['報修與訊息','tenant-message.html'],['我的合約','tenant-contract.html'],['綁定帳號','tenant-bind.html']] },
  landlord:{ chatBarText:'房東管理', items:[
    ['租管首頁','landlord-home.html'],['帳款','landlord-arrears.html'],['房客','landlord-tenants.html'],
    ['房源','landlord-rooms.html'],['房客訊息','landlord-messages.html'],['更多','landlord-more.html']] }
};
export function richMenuAreas(items, liffId) {
  const columns = [0,833,1667,2500], rows = [0,421,843];
  return items.map(([label, page], index) => {
    const column = index % 3, row = Math.floor(index / 3);
    return { bounds:{ x:columns[column], y:rows[row], width:columns[column+1]-columns[column], height:rows[row+1]-rows[row] },
      action:{ type:'uri', label, uri:'https://liff.line.me/'+liffId+'/'+page } };
  });
}
