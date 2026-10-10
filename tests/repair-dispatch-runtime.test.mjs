import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const repairTicketSource=readFileSync(new URL('../apps-script/V2_REPAIR_TICKETS.js',import.meta.url),'utf8');
const dispatchPath=new URL('../apps-script/V2_REPAIR_DISPATCH.js',import.meta.url);
const dispatchSource=existsSync(dispatchPath)?readFileSync(dispatchPath,'utf8'):'';
function createSheet(options) {
  const values = [];
  return {
    appendRow(row) {
      if (options && options.beforeAppend) options.beforeAppend(row, values);
      values.push(row.slice());
    },
    getDataRange() {
      return { getValues: () => values.length ? values.map(row => row.slice()) : [[]] };
    },
    getLastColumn() {
      return values.length ? values[0].length : 0;
    },
    getLastRow() {
      return values.length;
    },
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues() {
          return values.slice(row - 1, row - 1 + height).map(source => {
            const copy = source.slice(column - 1, column - 1 + width);
            while (copy.length < width) copy.push('');
            return copy;
          });
        },
        setValue(value) {
          while (values.length < row) values.push([]);
          while (values[row - 1].length < column) values[row - 1].push('');
          values[row - 1][column - 1] = value;
        },
        setValues(rows) {
          rows.forEach((source, rowIndex) => {
            while (values.length < row + rowIndex) values.push([]);
            while (values[row - 1 + rowIndex].length < column - 1 + source.length) {
              values[row - 1 + rowIndex].push('');
            }
            source.forEach((value, columnIndex) => {
              values[row - 1 + rowIndex][column - 1 + columnIndex] = value;
            });
          });
        }
      };
    }
  };
}

function createRuntime(options = {}) {
  const sheets = {};
  let uuid = 0;
  const context = {
    Date,
    Error,
    JSON,
    Math,
    Object,
    String,
    LockService: options.LockService || {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    Utilities: { getUuid: () => `uuid-${++uuid}` },
    runtimeSpreadsheet_() {
      return {
        getSheetByName(name) {
          return sheets[name] || null;
        },
        insertSheet(name) {
          const sheet = createSheet(options);
          sheets[name] = sheet;
          return sheet;
        }
      };
    }
  };
  vm.runInNewContext(repairTicketSource, context, {
    filename: 'V2_REPAIR_TICKETS.js'
  });
  vm.runInNewContext(dispatchSource, context, { filename: 'V2_REPAIR_DISPATCH.js' });
  assert.equal(typeof context.repairDispatchMigrate_, 'function', 'native dispatch persistence must exist');
  context.repairDispatchRevalidateLandlord_ = () => {}; // Workspace auth is an external boundary for storage/workflow tests.
  context.repairDispatchWorkspaceActive_ = () => {}; // Workspace status is tested at the route/auth boundary.
  context.repairDispatchMigrate_();
  const ticket = context.repairTicketCreateFromMessage_({message_id:'M1',message_title:'漏水',message_body:'私人訊息'}, {workspace_id:'W1',room_id:'R1',tenant_id:'T1',lease_id:'L1'});
  return { context, sheets, ticket };
}


const owner={workspace_id:'W1',actor_id:'OWNER',role:'owner',kind:'landlord'};
function setup(){const r=createRuntime(); let seq=0; r.act=(operation,input={},actor=owner)=>r.context.repairDispatchAct_(actor,{ticket_id:r.ticket.repair_ticket_id,operation,request_id:'req-'+(++seq),...input});return r;}
test('self repair requires completion and acceptance, rejects excess cost until approval',()=>{const r=setup();let s=r.act('start',{mode:'self',approved_amount:1000});assert.equal(s.stage,'assigned');s=r.act('begin',{expected_version:s.version});assert.equal(s.stage,'in_progress');assert.throws(()=>r.act('accept',{expected_version:s.version}),/INVALID_STAGE/);s=r.act('finish',{expected_version:s.version,actual_amount:1200,note:'已更換管線'});assert.equal(s.stage,'awaiting_acceptance');assert.throws(()=>r.act('accept',{expected_version:s.version}),/EXTRA_APPROVAL_REQUIRED/);s=r.act('approve_extra',{expected_version:s.version});s=r.act('rework',{expected_version:s.version,note:'仍有漏水'});assert.equal(s.stage,'in_progress');s=r.act('finish',{expected_version:s.version,actual_amount:1200,note:'複查完成'});s=r.act('accept',{expected_version:s.version});assert.equal(s.stage,'completed');assert.equal(s.completions.length,2);assert.throws(()=>r.act('begin',{expected_version:s.version}),/INVALID_STAGE/);});
test('quote invitations use live membership and executor checks and expose no tenant data',()=>{const r=setup();const p=r.context.repairDispatchPartnerSave_(owner,{request_id:'partner1',name:'維修公司',type:'company',members:[{line_user_id:'V1',role:'manager'},{line_user_id:'V2',role:'worker'}],skills:['repair'],priority:1,active:true});let s=r.act('start',{mode:'vendor',work_summary:'設備維修',work_location:'合成作業位置'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id});const inv=s.invitations[0];let v={workspace_id:'W1',actor_id:'V1',kind:'vendor',invitation_id:inv.invitation_id};s=r.act('quote',{expected_version:s.version,amount:1500,note:'管線工資'},v);assert.equal(s.stage,'awaiting_approval');assert.throws(()=>r.act('begin',{expected_version:s.version},v),/INVALID_STAGE|EXECUTOR_REQUIRED/);s=r.act('approve_quote',{expected_version:s.version,quote_id:s.quotes[0].quote_id,executor_line_user_id:'V2'});assert.throws(()=>r.act('begin',{expected_version:s.version},v),/EXECUTOR_REQUIRED/);v.actor_id='V2';s=r.act('begin',{expected_version:s.version},v);s=r.act('finish',{expected_version:s.version,actual_amount:1500,note:'修復完成'},v);const view=r.context.repairDispatchVendorView_(s,r.ticket,v);assert.equal(view.tenant_name_snapshot,undefined);assert.equal(view.description,undefined);assert.equal(view.quotes,undefined);assert.throws(()=>r.act('accept',{expected_version:s.version},v),/PERMISSION_DENIED/);s=r.act('accept',{expected_version:s.version});assert.equal(s.stage,'completed');});
test('journal commits once and rejects stale state, forged scope and changed idempotent payload',()=>{const r=setup();const req={ticket_id:r.ticket.repair_ticket_id,operation:'start',mode:'self',approved_amount:0,request_id:'same'};const s=r.context.repairDispatchAct_(owner,req);const count=r.sheets.V2_repair_dispatch_events.getLastRow();assert.equal(r.context.repairDispatchAct_(owner,req).version,s.version);assert.equal(r.sheets.V2_repair_dispatch_events.getLastRow(),count);assert.throws(()=>r.context.repairDispatchAct_(owner,{...req,approved_amount:2}),/IDEMPOTENCY_CONFLICT/);assert.throws(()=>r.act('begin',{expected_version:0}),/VERSION_CONFLICT/);assert.throws(()=>r.act('begin',{expected_version:s.version},{...owner,workspace_id:'W2'}),/NOT_FOUND/);assert.throws(()=>r.act('accept',{expected_version:s.version},{...owner,role:'maintenance'}),/PERMISSION_DENIED/);});
test('fixed agreement snapshots survive edits; cancelled invitation and disabled partner cannot act',()=>{const r=setup();let p=r.context.repairDispatchPartnerSave_(owner,{request_id:'part1',name:'清潔',type:'individual',members:[{line_user_id:'V1',role:'manager'}],skills:['cleaning'],fixed_amount:600,priority:1,active:true});let s=r.act('start',{mode:'vendor',work_kind:'cleaning',work_summary:'清潔',work_location:'合成作業位置'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id,fixed:true});const inv=s.invitations[0];p=r.context.repairDispatchPartnerSave_(owner,{...p,request_id:'part2',expected_version:p.version,fixed_amount:900});const v={workspace_id:'W1',actor_id:'V1',kind:'vendor',invitation_id:inv.invitation_id};s=r.act('accept_invite',{expected_version:s.version},v);assert.equal(s.approved_amount,600);p=r.context.repairDispatchPartnerSave_(owner,{...p,request_id:'part3',expected_version:p.version,active:false});assert.throws(()=>r.act('begin',{expected_version:s.version},v),/PARTNER_INACTIVE/);});
test('tenant status tracks dispatch without leaking partner and costs',()=>{const r=setup();let s=r.act('start',{mode:'self',approved_amount:700});s=r.act('begin',{expected_version:s.version});s=r.act('finish',{expected_version:s.version,actual_amount:700,note:'內部施工證據',public_note:'修復完畢，待驗收'});const view=r.context.repairTicketToTenantProjection_(r.ticket,{workspace_id:'W1',room_id:'R1',tenant_id:'T1'});assert.equal(view.status,'awaiting_confirmation');assert.equal(view.public_note,'修復完畢，待驗收');assert.equal(view.approved_amount,undefined);assert.equal(view.completions,undefined);});

test('append failure leaves no assigned projection and a retry commits once',()=>{const r=setup();const sh=r.sheets.V2_repair_dispatch_events;const append=sh.appendRow;let fail=true;sh.appendRow=row=>{if(fail){fail=false;throw Error('disk unavailable');}append(row);};assert.throws(()=>r.act('start',{mode:'self',approved_amount:0}),/disk unavailable/);assert.equal(r.context.repairDispatchState_('W1',r.ticket.repair_ticket_id),null);const s=r.act('start',{mode:'self',approved_amount:0});assert.equal(s.version,1);});
test('private photo validates bytes, stays inaccessible to other actors and deduplicates upload',()=>{const r=setup();let s=r.act('start',{mode:'self',approved_amount:0});s=r.act('begin',{expected_version:s.version});let count=0;const files={};r.context.ldComputeSha256Hex_=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');r.context.PropertiesService={getScriptProperties:()=>({getProperty:()=> 'PRIVATE-REPAIR-FOLDER'})};r.context.Utilities.base64Decode=raw=>Array.from(Buffer.from(raw,'base64'));r.context.Utilities.base64Encode=bytes=>Buffer.from(bytes).toString('base64');r.context.Utilities.newBlob=(bytes,mime,name)=>({bytes,mime,name});r.context.DriveApp={Access:{PRIVATE:'private'},Permission:{NONE:'none'},getFolderById:()=>({createFile:blob=>{const id='file'+(++count);const file={getId:()=>id,setSharing(a,b){assert.equal(a,'private');assert.equal(b,'none');},getBlob:()=>({getBytes:()=>blob.bytes,getContentType:()=>blob.mime})};files[id]=file;return file;}}),getFileById:id=>files[id]};const input={ticket_id:r.ticket.repair_ticket_id,expected_version:s.version,request_id:'upload1',mime_type:'image/png',file_name:'完工.png',base64:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')};const out=r.context.repairDispatchAttachmentUpload_(owner,input);assert.equal(out.version,s.version+1);assert.equal(count,1);assert.equal(r.context.repairDispatchAttachmentUpload_(owner,input).version,out.version);assert.equal(count,1);const data=r.context.repairDispatchAttachmentDownload_(owner,out,{attachment_id:out.attachments[0].attachment_id});assert.equal(data.mime_type,'image/png');assert.throws(()=>r.context.repairDispatchAttachmentDownload_({...owner,workspace_id:'W2'},out,{attachment_id:out.attachments[0].attachment_id}),/ACCESS_DENIED/);assert.throws(()=>r.context.repairDispatchAttachmentUpload_(owner,{...input,request_id:'upload2',expected_version:out.version,base64:Buffer.from('fake PNG').toString('base64')}),/FILE_SIGNATURE_INVALID/);});
test('business request identity survives transport IDs and later actions',()=>{const r=setup();const input={ticket_id:r.ticket.repair_ticket_id,operation:'start',mode:'self',approved_amount:0,request_id:'transport1',business_request_id:'business1'};let s=r.context.repairDispatchAct_(owner,input);s=r.act('begin',{expected_version:s.version});assert.equal(s.history[0].request_id,'business1');const count=r.sheets.V2_repair_dispatch_events.getLastRow();const previous=r.context.repairDispatchAct_(owner,{...input,request_id:'transport2'});assert.equal(previous.version,1);assert.equal(r.sheets.V2_repair_dispatch_events.getLastRow(),count);});
test('revalidate actual member role after acquiring lock rather than trusting the old owner role',()=>{const r=setup();r.context.repairDispatchRevalidateLandlord_=actor=>{actor.role='viewer';};assert.throws(()=>r.act('start',{mode:'self',approved_amount:0},{...owner}),/PERMISSION_DENIED/);assert.equal(r.sheets.V2_repair_dispatch_events.getLastRow(),1);});
test('contacts cannot quote and expired invitations cannot accept',()=>{const r=setup();const p=r.context.repairDispatchPartnerSave_(owner,{request_id:'part1',name:'公司',type:'company',members:[{line_user_id:'V1',role:'manager'},{line_user_id:'C1',role:'contact'}],skills:['repair'],priority:1,active:true});let s=r.act('start',{mode:'vendor',work_summary:'設備維修',work_location:'合成作業位置'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id});const inv=s.invitations[0];assert.throws(()=>r.act('quote',{expected_version:s.version,amount:1,note:'x'},{kind:'vendor',actor_id:'C1',workspace_id:'W1',invitation_id:inv.invitation_id}),/PERMISSION_DENIED/);const stored=JSON.parse(r.sheets.V2_repair_dispatch_events.getDataRange().getValues().at(-1)[8]);stored.invitations[0].expires_at=1;const sh=r.sheets.V2_repair_dispatch_events;sh.getRange(sh.getLastRow(),9).setValue(JSON.stringify(stored));assert.throws(()=>r.act('quote',{expected_version:s.version,amount:1,note:'x'},{kind:'vendor',actor_id:'V1',workspace_id:'W1',invitation_id:inv.invitation_id}),/INVITATION_EXPIRED/);});
test('no available contractor can switch to self without duplicating repair or reviving invitations',()=>{const r=setup();const p=r.context.repairDispatchPartnerSave_(owner,{request_id:'partner-switch',name:'公司',type:'company',members:[{line_user_id:'V1',role:'manager'}],skills:['repair'],priority:1,active:true});let s=r.act('start',{mode:'vendor',work_summary:'檢查設備',work_location:'合成作業位置'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id});const inv=s.invitations[0];s=r.act('assign_self',{expected_version:s.version,approved_amount:500});assert.equal(s.ticket_id,r.ticket.repair_ticket_id);assert.equal(s.stage,'assigned');assert.equal(s.assignment.kind,'self');assert.throws(()=>r.act('quote',{expected_version:s.version,amount:500},{kind:'vendor',actor_id:'V1',workspace_id:'W1',invitation_id:inv.invitation_id}),/INVITATION_INVALID/);});
test('invitation summary is landlord approved; precise location is restricted to the assigned vendor',()=>{const r=setup();const p=r.context.repairDispatchPartnerSave_(owner,{request_id:'partner-location',name:'公司',type:'company',members:[{line_user_id:'V1',role:'manager'}],skills:['repair'],priority:1,active:true});let s=r.act('start',{mode:'vendor',work_summary:'冷氣維修',work_location:'合成指定位置',work_instructions:'先聯絡管理員'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id});const v={kind:'vendor',actor_id:'V1',workspace_id:'W1',invitation_id:s.invitations[0].invitation_id};let view=r.context.repairDispatchVendorView_(s,r.ticket,v);assert.equal(view.title,'冷氣維修');assert.equal(view.work_location,undefined);s=r.act('quote',{expected_version:s.version,amount:300,note:'報價'},v);s=r.act('approve_quote',{expected_version:s.version,quote_id:s.quotes[0].quote_id,executor_line_user_id:'V1'});view=r.context.repairDispatchVendorView_(s,r.ticket,v);assert.equal(view.work_location,'合成指定位置');assert.equal(view.work_instructions,'先聯絡管理員');});
test('assigned worker downgraded to contact loses begin and completion capabilities immediately',()=>{const r=setup();let p=r.context.repairDispatchPartnerSave_(owner,{request_id:'role1',name:'公司',type:'company',members:[{line_user_id:'V1',role:'manager'},{line_user_id:'V2',role:'worker'}],skills:['repair'],active:true});let s=r.act('start',{mode:'vendor',work_summary:'檢查',work_location:'合成位置'});s=r.act('invite',{expected_version:s.version,partner_id:p.partner_id});const manager={kind:'vendor',actor_id:'V1',workspace_id:'W1',invitation_id:s.invitations[0].invitation_id};s=r.act('quote',{expected_version:s.version,amount:100},manager);s=r.act('approve_quote',{expected_version:s.version,quote_id:s.quotes[0].quote_id,executor_line_user_id:'V2'});r.context.repairDispatchPartnerSave_(owner,{...p,request_id:'role2',expected_version:p.version,members:[{line_user_id:'V1',role:'manager'},{line_user_id:'V2',role:'contact'}]});const worker={...manager,actor_id:'V2'};assert.equal(r.context.repairDispatchVendorView_(s,r.ticket,worker).is_executor,false);assert.throws(()=>r.act('begin',{expected_version:s.version},worker),/EXECUTOR_REQUIRED/);assert.throws(()=>r.act('finish',{expected_version:s.version,actual_amount:100,note:'完成'},worker),/EXECUTOR_REQUIRED/);r.context.ldComputeSha256Hex_=()=> 'fingerprint';r.context.Utilities.base64Decode=()=>[137,80,78,71,13,10,26,10];assert.throws(()=>r.context.repairDispatchAttachmentUpload_(worker,{ticket_id:r.ticket.repair_ticket_id,request_id:'revoked-upload',expected_version:s.version,mime_type:'image/png',file_name:'photo.png',base64:'valid'}),/EXECUTOR_REQUIRED/);});
