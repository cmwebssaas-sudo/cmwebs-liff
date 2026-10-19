import {richDataset} from './runtime.mjs';

// Synthetic correctness/capacity fixture, never a formal Sheet or account.
// W1:20×25 rooms, first250 leased, next250 vacant;500 bills TOTAL across2 months.
export function capacityDataset(){
 const input=richDataset(),workspace='SYNTHETIC_W1',landlord='SYNTHETIC_L1';
 const seed=Object.fromEntries(Object.entries(input).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.find(r=>r.workspace_id===workspace)||v[0]]));
 const foreign=Object.fromEntries(Object.entries(input).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.filter(r=>r.workspace_id==='SYNTHETIC_W2')]));
 const properties=[],rooms=[],tenants=[],contracts=[],bills=[],payments=[],users=[];
 const id=(kind,i)=>'SYNTHETIC_500_'+kind+'_'+String(i).padStart(4,'0');
 for(let i=1;i<=20;i++)properties.push({...seed.V2_properties,property_id:id('P',i),property_name:'合成物件'+i,account_status:'active'});
 for(let i=1;i<=500;i++){
  const property=id('P',Math.ceil(i/25)),room=id('R',i),tenant=id('T',i),contract=id('C',i),user=id('U',i),occupied=i<=250;
  rooms.push({...seed.V2_rooms,room_id:room,property_id:property,room_name:String(i).padStart(4,'0'),account_status:'active',
   room_status:occupied?'occupied':'vacant',current_contract_id:occupied?contract:'',current_tenant_id:occupied?tenant:'',rent_amount:10000,management_fee:500});
  if(!occupied)continue;
  users.push({...input.V2_users[0],user_id:user,role:'tenant',name:'合成房客'+i,line_user_id:id('LINE',i),phone:'0900000000'});
  tenants.push({...seed.V2_tenants,tenant_id:tenant,user_id:user,tenant_user_id:user,tenant_name:'合成房客'+i,
   room_id:room,property_id:property,current_contract_id:contract,account_status:'active'});
  contracts.push({...seed.V2_contracts,contract_id:contract,tenant_id:tenant,tenant_user_id:user,room_id:room,property_id:property,
   start_date:'2026-01-01',end_date:'2026-12-31',contract_status:'active',rent_amount:10000,management_fee:500,
   contract_family_id:contract,renewal_sequence:0,previous_contract_id:''});
  for(const month of [9,10]){
   const bill=id('B'+month,i),kind=i%4,paid=kind===2?5000:kind===3?10500:0;
   bills.push({...seed.V2_bills,bill_id:bill,tenant_id:tenant,contract_id:contract,room_id:room,property_id:property,
    bill_month:new Date(`2026-${String(month).padStart(2,'0')}-01T00:00:00+08:00`),
    due_date:new Date(`2026-${String(month).padStart(2,'0')}-10T00:00:00+08:00`),
    bill_status:kind===0?'cancelled':kind===3?'paid':'issued',payment_status:kind===3?'paid':kind===2?'partial':'unpaid',
    total_amount:10500,paid_amount:paid});
   if(paid)payments.push({...seed.V2_payments,payment_id:id('PAY'+month,i),bill_id:bill,amount:paid,
    payment_status:'confirmed',payment_date:`2026-${String(month).padStart(2,'0')}-11`});
  }
 }
 for(const [table,rows] of Object.entries({V2_properties:properties,V2_rooms:rooms,V2_tenants:tenants,V2_contracts:contracts,V2_bills:bills,V2_payments:payments}))
  input[table]=[...rows,...foreign[table]];
 input.V2_users=[...input.V2_users,...users];
 input.V2_property_owners=properties.map((p,i)=>({...seed.V2_property_owners,property_owner_id:id('OWNER',i+1),property_id:p.property_id}));
 const first={workspace_id:workspace,landlord_id:landlord,tenant_id:id('T',1),contract_id:id('C',1),room_id:id('R',1),property_id:id('P',1)};
 input.V2_contract_requests=[{...seed.V2_contract_requests,...first,request_id:id('REQUEST',1)}];
 input.V2_payment_reports=[{...seed.V2_payment_reports,...first,report_id:id('REPORT',1),bill_id:id('B10',1),reported_amount:10500}];
 input.V2_tenant_messages=[{...seed.V2_tenant_messages,...first,message_id:id('MESSAGE',1)}];
 input.V2_contract_invites=[{...seed.V2_contract_invites,...first,invite_id:id('INVITE',1)}];
 // The capacity case uses canonical native views. Legacy-view behavior remains
 // independently covered by the original rich parity fixture.
 delete input.V2_landlord_tenant_list_view;
 // Non-key source order tests real replica_source_row ordering at capacity.
 for(const rows of Object.values(input))if(Array.isArray(rows))rows.reverse();
 return input;
}
