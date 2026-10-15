import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createReadServices } from '../../../cloudflare/read-api/src/read-runtime.js';

export const fixture = JSON.parse(readFileSync(new URL('./operations.json',import.meta.url),'utf8'));
export const dataset = Object.fromEntries(Object.entries(fixture).filter(([key])=>key!=='now'));
export function richDataset() {
  const input=structuredClone(dataset);
  input.V2_bills[1].bill_month=new Date('2026-10-01T00:00:00+08:00');
  input.V2_bills[1].due_date=new Date('2026-10-10T00:00:00+08:00');
  for(const row of input.V2_contracts) Object.assign(row,{
    identity_document_url:'https://synthetic.invalid/private-doc',contract_file_url:'https://synthetic.invalid/private-file',
    tenant_signature_artifact_id:'SYNTHETIC_PRIVATE_SIGNATURE',terms_snapshot_json:'SYNTHETIC_PRIVATE_TERMS',
    contract_content:'SYNTHETIC_PRIVATE_CONTENT'
  });
  for(const row of input.V2_contract_requests) Object.assign(row,{
    requested_terms_snapshot_json:'SYNTHETIC_PRIVATE_REQUEST_TERMS',identity_document_mode:'required'
  });
  input.V2_landlord_tenant_list_view=[{tenant_id:'SYNTHETIC_T1',workspace_id:'SYNTHETIC_W1',
    landlord_id:'SYNTHETIC_L1',tenant_name:'synthetic view tenant',tenant_phone:'0912345678',
    tenant_line_user_id:'SYNTHETIC_TENANT_LINE',room_list:'合成房間',updated_at:'2026-10-11'}];
  return input;
}
export const access = {
  success:true,workspace:dataset.V2_workspaces[0],user:dataset.V2_users[0],membership:dataset.V2_workspace_members[0],
  principal:dataset.V2_landlords[0],principals:[dataset.V2_landlords[0]],
  principal_landlord_id:'SYNTHETIC_L1',principal_line_user_id:'SYNTHETIC_LINE1',
  line_user_id:'SYNTHETIC_LINE1',permissions:{can_manage_team:true,can_edit_bank_account:true,
    can_approve_payment:true,can_edit_contract:true,can_terminate_contract:true,can_delete_data:true,can_export_data:true}
};
export const cases = [
  {route:'home',fn:'getWorkspaceLandlordHomeBootstrapByLineUid_',args:['SYNTHETIC_LINE1','home']},
  {route:'actions',fn:'getWorkspaceLandlordHomeBootstrapByLineUid_',args:['SYNTHETIC_LINE1','actions','summary']},
  {route:'revenue',fn:'getLandlordRevenueDashboardByLineUid_',args:['SYNTHETIC_LINE1',{from_month:'2026-09',to_month:'2026-10',as_of:'2026-10-12'}]},
  {route:'tenants',fn:'getWorkspaceLandlordTenantsNativeByLineUid_',args:['SYNTHETIC_LINE1','summary']},
  {route:'rooms',fn:'getLandlordRoomCenterInitByLineUid_',args:['SYNTHETIC_LINE1',true]},
  {route:'arrears',fn:'getWorkspaceLandlordArrearsNativeByLineUid_',args:['SYNTHETIC_LINE1']},
  {route:'properties',fn:'getLandlordPropertiesInitByLineUid_',args:['SYNTHETIC_LINE1',true]}
];
export function originalGas(input=dataset,serverAccess=access,options={}) {
  // Independent oracle: Node's native Date in the deployed GAS project zone.
  process.env.TZ='Asia/Taipei';
  const oracleNow=options.now??Date.parse(fixture.now);
  class NativeGasClock extends Date {
    constructor(...args){super(...(args.length?args:[oracleNow]));}
    static now(){return oracleNow;}
  }
  const services=createReadServices(input,serverAccess,{now:oracleNow,...options,dateConstructor:NativeGasClock});
  const ctx=vm.createContext({...services,console});
  const manifest=JSON.parse(readFileSync(new URL('../../../cloudflare/read-api/read-source-manifest.json',import.meta.url),'utf8'));
  for(const file of Object.keys(manifest.sources)) vm.runInContext(readFileSync(new URL('../../../'+file,import.meta.url),'utf8'),ctx,{filename:file});
  // Replace IO after loading the unmodified source; keep every business function.
  Object.assign(ctx,services);
  return ctx;
}
export const plain = value=>JSON.parse(JSON.stringify(value));
export function projectedDataset(input=dataset) {
  const c=vm.createContext({Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    computeDigest:(_,text)=>[...createHash('sha256').update(text).digest()]}});
  for(const file of ['V2_READ_REPLICA_SCHEMA','V2_READ_REPLICA_SYNC']) vm.runInContext(readFileSync(new URL('../../../apps-script/'+file+'.js',import.meta.url),'utf8'),c);
  const schema=JSON.parse(readFileSync(new URL('../../../cloudflare/read-api/schema.json',import.meta.url),'utf8'));
  const sourceContext={roomBridgeSupported:!Object.hasOwn(input,'V3_listing_integrations')&&!Object.hasOwn(input,'V3_listing_integration_snapshots')};
  return Object.fromEntries(Object.keys(schema).map(table=>[table,(input[table]||[]).map((row,index)=>plain(c.readReplicaProjectRow_(table,row,index+2,sourceContext).fields))]));
}
