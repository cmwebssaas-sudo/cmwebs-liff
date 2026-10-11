import { createReadCalculator } from './read-calculator.js';
import { createReadServices } from './read-runtime.js';
import { loadPublicRoomResources } from './public-room-resources.js';

const routes={
  '/v1/home':{fn:'getWorkspaceLandlordHomeBootstrapByLineUid_',query:['section','read_view']},
  '/v1/revenue':{fn:'getLandlordRevenueDashboardByLineUid_',query:['range','property_id','from_month','to_month','as_of']},
  '/v1/tenants':{fn:'getWorkspaceLandlordTenantsNativeByLineUid_',query:['read_view']},
  '/v1/rooms':{fn:'getLandlordRoomCenterInitByLineUid_',query:['include_archived']},
  '/v1/arrears':{fn:'getWorkspaceLandlordArrearsNativeByLineUid_',query:[]},
  '/v1/properties':{fn:'getLandlordPropertiesInitByLineUid_',query:['include_archived']}
};
export const isReadRoute=pathname=>Object.hasOwn(routes,pathname);
export function readFailure(code,status=503,headers={}) {
  return Response.json({success:false,code,message:'讀取服務目前無法使用',data:null},
    {status,headers:{'cache-control':'no-store',...headers}});
}

// C3 supplies verified access and a scoped D1 loader. This API is not an
// authentication mechanism; neither production env bindings nor query fields
// can supply access. The production dispatcher stays closed until C3 exists.
export async function serveReadRoute(request,context) {
  const url=new URL(request.url),route=routes[url.pathname];
  if(!route) return readFailure('NOT_FOUND',404);
  if(request.method!=='GET') return readFailure('METHOD_NOT_ALLOWED',405,{allow:'GET'});
  for(const key of url.searchParams.keys()) {
    if(!route.query.includes(key)||url.searchParams.getAll(key).length!==1) return readFailure('INVALID_READ_QUERY',400);
  }
  const q=url.searchParams;
  if(q.has('include_archived')&&!['0','1'].includes(q.get('include_archived'))) return readFailure('INVALID_READ_QUERY',400);
  if(q.has('read_view')&&q.get('read_view')!=='summary') return readFailure('READ_VIEW_REQUIRED',400);
  const section=q.get('section')||'home';
  if(url.pathname==='/v1/home'&&!['home','actions'].includes(section)) return readFailure('INVALID_READ_QUERY',400);
  if((url.pathname==='/v1/tenants'||url.pathname==='/v1/home'&&section==='actions')&&q.get('read_view')!=='summary') return readFailure('READ_VIEW_REQUIRED',400);
  if(context?.access?.success!==true||typeof context.loadDataset!=='function') return readFailure('READ_AUTH_NOT_READY');
  try {
    const dataset=await context.loadDataset(context.access);
    if(url.pathname==='/v1/rooms'&&(dataset.V2_rooms||[]).some(row=>row.replica_room_bridge_supported!==true)) return readFailure('READ_DEPENDENCY_UNSUPPORTED');
    let calculator=createReadCalculator(createReadServices(dataset,context.access,context.options));
    if(url.pathname==='/v1/rooms') {
      const publicResources=await loadPublicRoomResources((dataset.V2_rooms||[]).map(row=>row.room_website_url),calculator,context.options);
      calculator=createReadCalculator(createReadServices(dataset,context.access,{...context.options,publicResources}));
    }
    const uid=context.access.line_user_id;
    const args=url.pathname==='/v1/home'?[uid,section,q.get('read_view')]:
      url.pathname==='/v1/tenants'?[uid,'summary']:
      url.pathname==='/v1/revenue'?[uid,Object.fromEntries(q)]:
      ['/v1/rooms','/v1/properties'].includes(url.pathname)?[uid,q.get('include_archived')==='1']:[uid];
    const result=calculator[route.fn](...args);
    return Response.json(result,{headers:{'cache-control':'no-store'}});
  } catch { return readFailure('READ_REPLICA_UNAVAILABLE'); }
}
