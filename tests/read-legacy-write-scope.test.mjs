import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

test('write-mode legacy filtering reads parent maps once per filter and sees subsequent changes',()=>{
  const rows=Array.from({length:10},(_,i)=>({bill_id:'B'+i,landlord_id:'L1',room_id:'R1',workspace_id:''}));
  const data={V2_properties:[{property_id:'P1',workspace_id:'W1'}],
    V2_rooms:[{room_id:'R1',property_id:'P1',workspace_id:'W1'}],V2_contracts:[],V2_bills:rows};
  let parentReads=0;
  const ss={getId:()=> 'synthetic-sheet',getSheetByName:name=>({name})};
  const ctx=vm.createContext({Date,SpreadsheetApp:{getActiveSpreadsheet:()=>ss},
    workspaceText_:value=>String(value||'').trim(),
    workspaceGetObjectsWithRow_:sheet=>{
      if(['V2_properties','V2_rooms','V2_contracts'].includes(sheet.name)) parentReads++;
      return data[sheet.name]||[];
    }});
  for(const name of ['V2_RUNTIME_SNAPSHOT','V2_WORKSPACE_LANDLORD_ACCESS','V2_PROPERTY_ROOM_MANAGEMENT'])
    vm.runInContext(readFileSync(new URL('../apps-script/'+name+'.js',import.meta.url),'utf8'),ctx);
  ctx.runtimeSnapshotBegin_('landlord_room_save');
  assert.equal(ctx.runtimeSnapshotIsReadEnabled_(),false);
  const access={workspace:{workspace_id:'W1'},principals:[{landlord_id:'L1'}]};
  const filter=()=>ctx.propertyRoomGetWorkspaceRows_(ss.getSheetByName('V2_bills'),access,['landlord_id']);
  assert.equal(filter().length,10);
  assert.equal(parentReads,3);
  data.V2_properties[0].workspace_id='W2';
  assert.equal(filter().length,0);
  assert.equal(parentReads,6);
  data.V2_bills=rows.map(row=>({...row,workspace_id:'W1'}));
  assert.equal(filter().length,10);
  assert.equal(parentReads,6);
  assert.equal(ctx.runtimeSnapshotIsReadEnabled_(),false);
  data.V2_properties[0].workspace_id='W1';
  data.V2_rooms=Array.from({length:10},(_,i)=>({room_id:'R'+i,property_id:'P1',landlord_id:'L1',workspace_id:''}));
  const beforeRooms=parentReads;
  assert.equal(ctx.propertyRoomGetWorkspaceRooms_(ss,access,true).length,10);
  // Property/room source reads plus exactly one three-table parent map.
  assert.equal(parentReads-beforeRooms,5);
  data.V2_properties[0].workspace_id='W2';
  const beforeForeign=parentReads;
  assert.equal(ctx.propertyRoomGetWorkspaceRooms_(ss,access,true).length,0);
  assert.equal(parentReads-beforeForeign,5);
  data.V2_rooms=data.V2_rooms.map(row=>({...row,workspace_id:'W1'}));
  const beforeExplicit=parentReads;
  assert.equal(ctx.propertyRoomGetWorkspaceRooms_(ss,access,true).length,10);
  assert.equal(parentReads-beforeExplicit,2);
});
