import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture(day='2026-10-07') {
  class Clock extends Date { constructor(...args) { super(...(args.length?args:[day+'T12:00:00+08:00'])); } }
  const room={room_id:'R1',room_name:'501',property_id:'P1',workspace_id:'W1',account_status:'active',room_status:'vacant',current_contract_id:'C1',current_tenant_id:'T1',rent_amount:19000};
  const tenant={tenant_id:'T1',tenant_name:'PRIVATE',workspace_id:'W1',property_id:'P1',room_id:'R1',current_contract_id:'C1',account_status:'active'};
  const contract={contract_id:'C1',workspace_id:'W1',property_id:'P1',room_id:'R1',tenant_id:'T1',start_date:'2026-10-15',end_date:'2028-10-14',contract_status:'upcoming',signing_mode:'paper_backfill',contract_origin:'paper_backfill'};
  const rows={V2_contracts:[contract],V2_tenants:[tenant]};
  const c=vm.createContext({Date:Clock,Utilities:{formatDate:date=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(date)}});
  for(const file of ['V2_PROPERTY_ROOM_MANAGEMENT','V2_LANDLORD_ROOM_CENTER']) vm.runInContext(fs.readFileSync('apps-script/'+file+'.js','utf8'),c);
  Object.assign(c,{
    propertyRoomRequireReadSchema_:()=>{},workspaceLandlordResolveAccess_:()=>({success:true,workspace:{workspace_id:'W1'},principal_landlord_id:'L1',principals:[{landlord_id:'L1'}]}),
    runtimeSpreadsheet_:()=>({getSheetByName:name=>({name})}),
    propertyRoomGetWorkspaceProperties_:()=>[],propertyRoomGetWorkspaceRooms_:()=>[room],
    workspaceGetObjectsWithRow_:sheet=>(rows[sheet.name]||[]),
    landlordRoomCenterZ3houseByRoom_:()=>({}),landlordRoomWebsiteCovers_:()=>({}),
    workspaceResult_:(success,code,message,data)=>({success,code,message,data})
  });
  return {c,room,tenant,contract,rows,read(){const r=c.getLandlordRoomCenterInitByLineUid_('U',false);assert.equal(r.success,true,r.message);return r.data.rooms[0];}};
}
test('room center follows canonical future, active and expired occupancy without leaking private records or writing',()=>{
  for(const [day,status] of [['2026-10-07','upcoming'],['2026-10-15','occupied'],['2028-10-15','needs_review']]) {
    const f=fixture(day),before=JSON.stringify([f.room,f.rows]);const room=f.read();
    assert.equal(room.effective_status,status,day);
    assert.equal(room.room_status,'vacant','preserve stored status');
    assert.doesNotMatch(JSON.stringify(room),/PRIVATE|tenant_id|contract_id|start_date|end_date/);
    assert.equal(JSON.stringify([f.room,f.rows]),before);
  }
});
test('room center respects association, duplicate and workspace guards rather than hardcoding room 501',()=>{
  for(const mutate of [f=>{f.tenant.current_contract_id='wrong';},f=>{f.rows.V2_contracts.push({...f.contract});},f=>{f.rows.V2_tenants.push({...f.tenant});},f=>{f.contract.workspace_id='OTHER';}]) {
    const f=fixture();mutate(f);assert.equal(f.read().effective_status,'needs_review');
  }
  const f=fixture();f.room.room_name='602';assert.equal(f.read().effective_status,'upcoming');
  delete f.room.current_contract_id;delete f.room.current_tenant_id;f.rows.V2_contracts=[];assert.equal(f.read().effective_status,'vacant');
});
test('room card labels and filters use effective occupancy, not stale vacant flags',()=>{
  const html=fs.readFileSync('landlord-rooms.html','utf8');
  const c=vm.createContext({text:v=>String(v??''),document:{getElementById:()=>({value:''})},FILTER:'occupied'});
  vm.runInContext(html.slice(html.indexOf('    function roomOccupancy('),html.indexOf('    function roomCard(')),c);
  const room={account_status:'active',room_status:'vacant',effective_status:'upcoming'};
  assert.equal(c.statusLabel(room),'已出租・待起租');assert.equal(c.matches(room),true);
  c.FILTER='vacant';assert.equal(c.matches(room),false);
  room.effective_status='needs_review';assert.equal(c.statusLabel(room),'入住狀態待確認');assert.equal(c.matches(room),false);
});
