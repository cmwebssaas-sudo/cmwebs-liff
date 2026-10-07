// Loopback-only preview of the real renderer: synthetic occupancy, public
// listing photos. No login, API calls, business writes or actual sharing.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const photos=['ba489b5d-3015-48e4-8a4e-f874cda97327','00287f23-572b-407e-99f2-9b4d120a026f'].map(id=>'https://dalino88.z3house.com/api/public/media/'+id);
const rooms=[
  {room_id:'preview-501',room_name:'501',property_name:'版面示範（非正式資料）',room_status:'vacant',effective_status:'upcoming',account_status:'active',rent_amount:19000,room_website_url:'https://dalino88.z3house.com/spaces/1f-store/',room_website_cover:{url:photos[0],photos,status:'available'}},
  {room_id:'preview-vacant',room_name:'空房示範',property_name:'版面示範（非正式資料）',room_status:'vacant',effective_status:'vacant',account_status:'active',rent_amount:7500}
];
function html() {
  const source=readFileSync(new URL('landlord-rooms.html',root),'utf8');
  if(source.split('    loadPage(true);').length!==2) throw Error('Startup changed; review isolation');
  return source.replace(/<script src="[^"]+"><\/script>/g,'')
    .replace('    loadPage(true);',`PAGE_DATA={rooms:${JSON.stringify(rooms)}};render();
      document.getElementById('workspaceHeading').textContent='本機圖卡預覽・尚未發布';
      document.addEventListener('click',function(e){const a=e.target.closest('a');if(a){e.preventDefault();showToast('預覽不會導向正式網站');}},true);
      async function shareRoomWebsite(button){showToast('預覽：點擊分享圖示，不會實際發送');}
      async function saveRoomWebsite(button){button.closest('.room-website-editor').querySelector('.room-website-result').textContent='預覽不儲存資料';}
      function goPage(){showToast('本機預覽不導向其他頁面');}
      function desktopLogout(){showToast('本機預覽沒有登入正式帳號');}
      async function loadPage(){render();}`);
}
createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'||path==='/landlord-rooms.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html());return;}
  if(path==='/landlord-responsive.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync(new URL('landlord-responsive.css',root)));return;}
  res.writeHead(404);res.end();
}).listen(0,'127.0.0.1',function(){console.log('Preview: http://127.0.0.1:'+this.address().port+'/landlord-rooms.html');});
