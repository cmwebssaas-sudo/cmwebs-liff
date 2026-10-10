/** Native repair dispatch. The original repair ticket and Workspace stay authoritative. */
const REPAIR_DISPATCH_SHEET_ = 'V2_repair_dispatch_events';
const REPAIR_DISPATCH_HEADERS_ = ['workspace_id', 'entity_id', 'event_id', 'request_id', 'actor_id', 'operation', 'payload_json', 'version', 'state_json', 'created_at'];

// Operator-only additive setup. Reads and HTTP actions never create the table.
function repairDispatchMigrate_() {
  const ss = runtimeSpreadsheet_();
  let sheet = ss.getSheetByName(REPAIR_DISPATCH_SHEET_);
  if (!sheet) { sheet = ss.insertSheet(REPAIR_DISPATCH_SHEET_); sheet.appendRow(REPAIR_DISPATCH_HEADERS_); }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(REPAIR_DISPATCH_HEADERS_)) throw new Error('DISPATCH_SCHEMA_MISMATCH');
  return { sheet: REPAIR_DISPATCH_SHEET_, columns: headers.length };
}

// Run from the verified original project's editor; never exposed as an API action.
function initializeRepairDispatchStorage() {
  return repairDispatchLock_(function() {
    const schema = repairDispatchMigrate_();
    const props = PropertiesService.getScriptProperties();
    const key = 'CMWEBS_REPAIR_PRIVATE_DRIVE_ROOT_FOLDER_ID';
    const existing = props.getProperty(key);
    const folder = existing ? DriveApp.getFolderById(existing) : DriveApp.createFolder('CMWebs Repair Private Attachments');
    folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('PRIVATE_FOLDER_REQUIRED');
    if (!existing) props.setProperty(key, folder.getId());
    const result = { sheet: schema.sheet, columns: schema.columns, private_folder_ready: true, existing_folder_reused: !!existing };
    console.log(JSON.stringify(result));
    return result;
  });
}

function repairDispatchRows_() {
  const sheet = runtimeSpreadsheet_().getSheetByName(REPAIR_DISPATCH_SHEET_);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (JSON.stringify(values[0]) !== JSON.stringify(REPAIR_DISPATCH_HEADERS_)) throw new Error('DISPATCH_SCHEMA_MISMATCH');
  return values.slice(1).filter(function(row) { return row[0]; }).map(function(row) {
    const result = {}; REPAIR_DISPATCH_HEADERS_.forEach(function(key, i) { result[key] = row[i]; }); return result;
  });
}

function repairDispatchState_(workspaceId, entityId) {
  const rows = repairDispatchRows_().filter(function(row) { return row.workspace_id === workspaceId && row.entity_id === entityId; });
  return rows.length ? JSON.parse(rows[rows.length - 1].state_json) : null;
}

function repairDispatchPartners_(workspaceId) {
  const latest = {};
  repairDispatchRows_().forEach(function(row) {
    if (row.workspace_id === workspaceId && String(row.entity_id).indexOf('partner:') === 0) latest[row.entity_id] = JSON.parse(row.state_json);
  });
  return Object.keys(latest).map(function(key) { return latest[key]; }).sort(function(a, b) { return a.priority - b.priority || a.name.localeCompare(b.name); });
}

function repairDispatchPayload_(request) {
  const result = {};
  ['ticket_id','operation','expected_version','mode','work_kind','work_summary','work_location','work_instructions','partner_id','fixed','amount','approved_amount','actual_amount','note','public_note','quote_id','executor_line_user_id','invitation_id','attachments','expires_hours','name','type','members','skills','priority','property_id','fixed_amount','fixed_work_kind','active','mime_type','file_name','content_fingerprint'].sort().forEach(function(key) {
    if (request[key] !== undefined && request[key] !== '') result[key] = request[key];
  });
  return JSON.stringify(result);
}

function repairDispatchDuplicate_(actor, request, entityId) {
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(String(request.request_id || ''))) throw new Error('REQUEST_ID_REQUIRED');
  const found = repairDispatchRows_().find(function(row) { return row.workspace_id === actor.workspace_id && row.request_id === request.request_id; });
  if (!found) return null;
  if (found.entity_id !== entityId || found.actor_id !== actor.actor_id || found.payload_json !== repairDispatchPayload_(request)) throw new Error('IDEMPOTENCY_CONFLICT');
  return JSON.parse(found.state_json);
}

function repairDispatchCommit_(actor, request, entityId, state) {
  const sheet = runtimeSpreadsheet_().getSheetByName(REPAIR_DISPATCH_SHEET_);
  if (!sheet) throw new Error('DISPATCH_SCHEMA_REQUIRED');
  state.last_request_id = request.request_id;
  if (String(entityId).indexOf('partner:') === 0) state.committed_request_ids = (state.committed_request_ids || []).concat([request.request_id]).slice(-100);
  const serialized = JSON.stringify(state);
  if (serialized.length > 45000) throw new Error('DISPATCH_HISTORY_LIMIT');
  const row = { workspace_id: actor.workspace_id, entity_id: entityId, event_id: Utilities.getUuid(), request_id: request.request_id, actor_id: actor.actor_id, operation: request.operation || 'partner_save', payload_json: repairDispatchPayload_(request), version: state.version, state_json: serialized, created_at: new Date() };
  sheet.appendRow(REPAIR_DISPATCH_HEADERS_.map(function(key) { return row[key]; }));
  return state;
}

function repairDispatchLock_(fn) {
  const lock = LockService.getScriptLock();
  let held = false;
  try { lock.waitLock(30000); held = true; return fn(); } finally { if (held) lock.releaseLock(); }
}

function repairDispatchRequireOwner_(actor) {
  if (actor.kind !== 'landlord' || ['owner','admin','manager'].indexOf(actor.role) < 0) throw new Error('PERMISSION_DENIED');
}

function repairDispatchText_(value, limit) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (text.length > (limit || 500)) throw new Error('TEXT_TOO_LONG');
  // Sheets appendRow treats leading '=' as a formula. Reject rather than store executable cells.
  if (/^[=+@]/.test(text)) throw new Error('UNSAFE_CELL_TEXT');
  return text;
}

function repairDispatchMoney_(value) {
  if (value === '' || value === undefined || value === null || typeof value === 'boolean' || !/^\d+$/.test(String(value))) throw new Error('AMOUNT_REQUIRED');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) throw new Error('AMOUNT_INVALID');
  return amount;
}

function repairDispatchPartnerSave_(actor, request) {
  request = Object.assign({}, request, {request_id:request.business_request_id || request.request_id});
  repairDispatchRequireOwner_(actor);
  return repairDispatchLock_(function() {
    repairDispatchRevalidateLandlord_(actor);
    repairDispatchRequireOwner_(actor);
    const prior = repairDispatchRows_().find(function(row) { return row.workspace_id === actor.workspace_id && row.request_id === request.request_id; });
    const id = request.partner_id || (prior && prior.entity_id) || 'partner:' + Utilities.getUuid();
    const duplicate = repairDispatchDuplicate_(actor, request, id);
    // New-partner retries locate the committed ID by the request, not a newly generated UUID.
    if (duplicate) return duplicate;
    if(!/^partner:[A-Za-z0-9_-]{1,100}$/.test(id))throw new Error('PARTNER_ID_INVALID');
    const old = repairDispatchState_(actor.workspace_id, id);
    if (request.partner_id && (!old || old.partner_id !== id)) throw new Error('PARTNER_NOT_FOUND');
    if (old && Number(request.expected_version) !== old.version) throw new Error('VERSION_CONFLICT');
    const name = repairDispatchText_(request.name, 100);
    if (!name || ['company','individual'].indexOf(request.type) < 0) throw new Error('PARTNER_INVALID');
    let members = request.members || [];
    if (typeof members === 'string') members = JSON.parse(members);
    if (!Array.isArray(members) || members.length > 30) throw new Error('MEMBERS_INVALID');
    const unique = {};
    members = members.map(function(member) {
      const uid = repairDispatchText_(member.line_user_id, 100);
      if (!uid || unique[uid] || ['manager','worker','contact'].indexOf(member.role) < 0) throw new Error('MEMBERS_INVALID');
      unique[uid] = true; return { line_user_id: uid, role: member.role };
    });
    let skills = request.skills || ['repair'];
    if (typeof skills === 'string') skills = JSON.parse(skills);
    if (!Array.isArray(skills) || !skills.length || skills.length > 20) throw new Error('SKILLS_INVALID');
    skills = skills.map(function(skill) { return repairDispatchText_(skill, 60); });
    if (skills.some(function(skill) { return !skill; })) throw new Error('SKILLS_INVALID');
    const priority = Number(request.priority || 1);
    if (!Number.isInteger(priority) || priority < 1 || priority > 100) throw new Error('PRIORITY_INVALID');
    const propertyId = repairDispatchText_(request.property_id, 100);
    if (repairDispatchPartners_(actor.workspace_id).some(function(p) { return p.partner_id !== id && p.active && p.property_id === propertyId && p.priority === priority && p.skills.some(function(skill) { return skills.indexOf(skill) >= 0; }); })) throw new Error('PRIORITY_CONFLICT');
    const state = { partner_id: id, workspace_id: actor.workspace_id, version: old ? old.version + 1 : 1, name: name, type: request.type, members: members, skills: skills, priority: priority, property_id: propertyId, fixed_work_kind: repairDispatchText_(request.fixed_work_kind || (skills.length === 1 ? skills[0] : ''), 60), fixed_amount: request.fixed_amount === undefined || request.fixed_amount === null || request.fixed_amount === '' ? null : repairDispatchMoney_(request.fixed_amount), active: request.active !== false && request.active !== 'false' };
    return repairDispatchCommit_(actor, request, id, state);
  });
}

function repairDispatchWorkspaceActive_(workspaceId) {
  const workspace = workspaceGetObjectsWithRow_(runtimeSpreadsheet_().getSheetByName(V2_WORKSPACE_SHEETS_.workspaces)).find(function(row) { return String(row.workspace_id) === workspaceId; });
  if (!workspace || !workspaceIsActiveStatus_(workspace.account_status || workspace.workspace_status || workspace.status || 'active')) throw new Error('WORKSPACE_ACCESS_DENIED');
}

function repairDispatchVendorAccess_(state, actor) {
  repairDispatchWorkspaceActive_(state.workspace_id);
  const invite = state.invitations.find(function(i) { return i.invitation_id === actor.invitation_id; });
  if (!invite || ['cancelled','declined','expired'].indexOf(invite.status) >= 0) throw new Error('INVITATION_INVALID');
  if (!state.assignment && Number(invite.expires_at) <= Date.now()) throw new Error('INVITATION_EXPIRED');
  const partner = repairDispatchState_(state.workspace_id, invite.partner_id);
  if (!partner || !partner.active) throw new Error('PARTNER_INACTIVE');
  const member = partner.members.find(function(m) { return m.line_user_id === actor.actor_id; });
  if (!member) throw new Error('VENDOR_ACCESS_DENIED');
  if (state.assignment && state.assignment.partner_id !== partner.partner_id) throw new Error('VENDOR_ACCESS_DENIED');
  return { invitation: invite, partner: partner, member: member };
}

function repairDispatchAct_(actor, request) {
  request = Object.assign({}, request, {request_id:request.business_request_id || request.request_id});
  return repairDispatchLock_(function() {
    if(actor.kind==='landlord')repairDispatchRevalidateLandlord_(actor);
    if (!actor.workspace_id || !actor.actor_id) throw new Error('AUTH_REQUIRED');
    const ticket = repairTicketFindTicketById_(request.ticket_id);
    if (!ticket || ticket.workspace_id !== actor.workspace_id) throw new Error('REPAIR_TICKET_NOT_FOUND');
    let state = repairDispatchState_(actor.workspace_id, request.ticket_id);
    const op = request.operation;
    if (actor.kind === 'vendor') {
      if (!state) throw new Error('INVITATION_INVALID');
      repairDispatchVendorAccess_(state, actor);
      if (['quote','decline','accept_invite','begin','finish'].indexOf(op) < 0) throw new Error('PERMISSION_DENIED');
    } else {
      if (['owner','admin','manager','maintenance'].indexOf(actor.role) < 0) throw new Error('PERMISSION_DENIED');
      if (['start','assign_self','invite','approve_quote','approve_extra','accept','cancel'].indexOf(op) >= 0) repairDispatchRequireOwner_(actor);
    }
    const duplicate = repairDispatchDuplicate_(actor, request, request.ticket_id);
    if (duplicate) return duplicate;
    if (!state) {
      if (op !== 'start' || ['completed','closed'].indexOf(ticket.status) >= 0) throw new Error('INVALID_STAGE');
      if (['self','vendor'].indexOf(request.mode) < 0) throw new Error('MODE_INVALID');
      if(request.mode==='vendor' && (!repairDispatchText_(request.work_summary) || !repairDispatchText_(request.work_location)))throw new Error('VENDOR_WORK_DETAILS_REQUIRED');
      state = { work_summary:repairDispatchText_(request.work_summary||ticket.title),work_location:repairDispatchText_(request.work_location),work_instructions:repairDispatchText_(request.work_instructions),workspace_id: actor.workspace_id, ticket_id: ticket.repair_ticket_id, version: 0, stage: request.mode === 'self' ? 'assigned' : 'sourcing', mode: request.mode, work_kind: repairDispatchText_(request.work_kind || 'repair',60), approved_amount: request.mode === 'self' ? repairDispatchMoney_(request.approved_amount) : null, actual_amount: null, assignment: request.mode === 'self' ? {kind:'self',actor_id:actor.actor_id} : null, invitations: [], quotes: [], completions: [], attachments: [], public_note: '', history: [] };
    } else {
      if (Number(request.expected_version) !== state.version) throw new Error('VERSION_CONFLICT');
      if (['completed','cancelled'].indexOf(state.stage) >= 0) throw new Error('INVALID_STAGE');
      const vendorAccess = actor.kind === 'vendor' ? repairDispatchVendorAccess_(state, actor) : null;
      if (vendorAccess && ['quote','accept_invite','decline'].indexOf(op) >= 0 && vendorAccess.member.role !== 'manager') throw new Error('PERMISSION_DENIED');
      if (vendorAccess && ['begin','finish'].indexOf(op) >= 0 && (!state.assignment || state.assignment.executor_line_user_id !== actor.actor_id || ['manager','worker'].indexOf(vendorAccess.member.role) < 0)) throw new Error('EXECUTOR_REQUIRED');
      if(op==='assign_self'){
        if(['sourcing','awaiting_approval'].indexOf(state.stage)<0||state.assignment)throw new Error('INVALID_STAGE');
        state.mode='self';state.approved_amount=repairDispatchMoney_(request.approved_amount);state.assignment={kind:'self',actor_id:actor.actor_id};state.stage='assigned';
        state.invitations.forEach(function(i){i.status='cancelled';});
      } else if (op === 'invite') {
        if (['sourcing','awaiting_approval'].indexOf(state.stage) < 0 || state.assignment) throw new Error('INVALID_STAGE');
        const partner = repairDispatchState_(actor.workspace_id, request.partner_id);
        if (!partner || !partner.active || partner.skills.indexOf(state.work_kind) < 0 || (partner.property_id && partner.property_id !== ticket.property_id)) throw new Error('PARTNER_INACTIVE');
        if (!partner.members.some(function(m) { return m.role === 'manager'; })) throw new Error('PARTNER_MANAGER_REQUIRED');
        if (state.invitations.some(function(i) { return i.partner_id === partner.partner_id && ['pending','quoted'].indexOf(i.status) >= 0 && i.expires_at > Date.now(); })) throw new Error('INVITATION_EXISTS');
        const fixed = request.fixed === true || request.fixed === 'true';
        if (fixed && (partner.fixed_amount === null || partner.fixed_work_kind !== state.work_kind)) throw new Error('FIXED_AGREEMENT_REQUIRED');
        const hours = Number(request.expires_hours || 24);
        if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error('EXPIRY_INVALID');
        state.invitations.push({ invitation_id:Utilities.getUuid(), partner_id:partner.partner_id, partner_name:partner.name, agreement_version:partner.version, fixed_amount:fixed ? partner.fixed_amount : null, expires_at:Date.now()+hours*3600000, status:'pending', notification_status:'manual_required' });
      } else if (op === 'quote' || op === 'decline' || op === 'accept_invite') {
        if (!vendorAccess || state.assignment || ['sourcing','awaiting_approval'].indexOf(state.stage) < 0 || ['pending','quoted'].indexOf(vendorAccess.invitation.status) < 0) throw new Error('INVALID_STAGE');
        if (op === 'decline') { vendorAccess.invitation.status = 'declined'; }
        if (op === 'quote') {
          if (vendorAccess.invitation.fixed_amount !== null) throw new Error('FIXED_PRICE_INVITATION');
          state.quotes.push({quote_id:Utilities.getUuid(),partner_id:vendorAccess.partner.partner_id,invitation_id:actor.invitation_id,amount:repairDispatchMoney_(request.amount),note:repairDispatchText_(request.note),created_at:Date.now(),expires_at:vendorAccess.invitation.expires_at});
          vendorAccess.invitation.status='quoted'; state.stage='awaiting_approval';
        }
        if (op === 'accept_invite') {
          if (vendorAccess.invitation.fixed_amount === null) throw new Error('QUOTE_REQUIRED');
          state.assignment={kind:'vendor',partner_id:vendorAccess.partner.partner_id,executor_line_user_id:actor.actor_id};state.approved_amount=vendorAccess.invitation.fixed_amount;state.stage='assigned';vendorAccess.invitation.status='accepted';
        }
      } else if (op === 'approve_quote') {
        if (state.stage !== 'awaiting_approval') throw new Error('INVALID_STAGE');
        const quote=state.quotes.find(function(q){return q.quote_id === request.quote_id;});
        if (!quote || quote.expires_at <= Date.now()) throw new Error('QUOTE_EXPIRED');
        const invite=state.invitations.find(function(i){return i.invitation_id===quote.invitation_id;});
        const partner=repairDispatchState_(actor.workspace_id,quote.partner_id);
        const newer=state.quotes.filter(function(q){return q.partner_id===quote.partner_id;}).slice(-1)[0];
        if (!partner || !partner.active || !invite || invite.status!=='quoted' || newer.quote_id!==quote.quote_id) throw new Error('QUOTE_SUPERSEDED');
        const executor=partner.members.find(function(m){return m.line_user_id===request.executor_line_user_id && m.role!=='contact';});
        if (!executor) throw new Error('EXECUTOR_REQUIRED');
        state.assignment={kind:'vendor',partner_id:partner.partner_id,executor_line_user_id:executor.line_user_id,quote_id:quote.quote_id};state.approved_amount=quote.amount;state.stage='assigned';invite.status='accepted';
      } else if (op === 'begin') {
        if (state.stage!=='assigned') throw new Error('INVALID_STAGE');state.stage='in_progress';
      } else if (op === 'finish') {
        if (state.stage!=='in_progress') throw new Error('INVALID_STAGE');
        const note=repairDispatchText_(request.note);if(!note)throw new Error('COMPLETION_NOTE_REQUIRED');
        const amount=repairDispatchMoney_(request.actual_amount);
        let attachments=request.attachments||[];if(typeof attachments==='string')attachments=JSON.parse(attachments);
        if(!Array.isArray(attachments)||attachments.length>10||attachments.some(function(id){return !state.attachments.some(function(a){return a.attachment_id===id;});}))throw new Error('ATTACHMENT_INVALID');
        state.completions.push({note:note,actual_amount:amount,attachment_ids:attachments,actor_id:actor.actor_id,created_at:Date.now()});state.actual_amount=amount;state.stage='awaiting_acceptance';
      } else if (op === 'approve_extra') {
        if(state.stage!=='awaiting_acceptance'||state.actual_amount<=state.approved_amount)throw new Error('INVALID_STAGE');state.approved_amount=state.actual_amount;
      } else if (op === 'rework') {
        if(state.stage!=='awaiting_acceptance')throw new Error('INVALID_STAGE');if(!repairDispatchText_(request.note))throw new Error('REWORK_REASON_REQUIRED');state.stage='in_progress';
      } else if (op === 'accept') {
        if(state.stage!=='awaiting_acceptance')throw new Error('INVALID_STAGE');if(state.actual_amount>state.approved_amount)throw new Error('EXTRA_APPROVAL_REQUIRED');state.stage='completed';
      } else if (op === 'cancel') { if(!repairDispatchText_(request.note))throw new Error('CANCEL_REASON_REQUIRED');state.stage='cancelled'; }
      else throw new Error('INVALID_OPERATION');
    }
    if(state.assignment)state.invitations.forEach(function(i){if(i.partner_id!==state.assignment.partner_id && ['pending','quoted'].indexOf(i.status)>=0)i.status='cancelled';});
    if(request.public_note!==undefined && actor.kind==='landlord')state.public_note=repairDispatchText_(request.public_note);
    state.version++;state.last_request_id=request.request_id;
    state.history.push({operation:op,request_id:request.request_id,actor_id:actor.actor_id,created_at:Date.now(),note:repairDispatchText_(request.note)});
    return repairDispatchCommit_(actor,request,request.ticket_id,state);
  });
}

function repairDispatchStatus_(state) {
  return {sourcing:'open',awaiting_approval:'open',assigned:'in_progress',in_progress:'in_progress',awaiting_acceptance:'awaiting_confirmation',completed:'closed',cancelled:'closed'}[state.stage];
}

function repairDispatchVendorView_(state, ticket, actor) {
  const access=repairDispatchVendorAccess_(state,actor);
  return { ticket_id:state.ticket_id, invitation_id:actor.invitation_id, title:state.work_summary, work_location:state.assignment?state.work_location:undefined, work_instructions:state.assignment?state.work_instructions:undefined, own_latest_quote:state.quotes ? state.quotes.filter(function(q){return q.partner_id===access.partner.partner_id;}).slice(-1)[0] : undefined, work_kind:state.work_kind, stage:state.stage, version:state.version, role:access.member.role, invitation_status:access.invitation.status, fixed_amount:access.invitation.fixed_amount, approved_amount:state.assignment ? state.approved_amount : null, actual_amount:state.assignment ? state.actual_amount : null, is_executor:!!state.assignment && state.assignment.executor_line_user_id===actor.actor_id && ['manager','worker'].indexOf(access.member.role)>=0, last_request_id: state.last_request_id, committed_request_ids:state.history.filter(function(e){return e.actor_id===actor.actor_id;}).map(function(e){return e.request_id;}), attachments:state.attachments.filter(function(a){return a.actor_id===actor.actor_id;}).map(function(a){return {attachment_id:a.attachment_id,name:a.name};}), public_note:state.public_note };
}

function repairDispatchRoute_(action, request) {
  try {
    if(action.indexOf('vendor_repair_')===0){
      const verified=tenantLiffSigningVerifyIdTokenClaims_(request.id_token||'');
      if(!verified||!verified.success)return verified||{success:false,code:'AUTH_REQUIRED'};
      if(action==='vendor_repair_identity_init')return {success:true,data:{line_user_id:String(verified.data.sub||'')}};
      const invitationId=String(request.invitation_id||'');
      const rows=repairDispatchRows_().filter(function(row){return String(row.entity_id).indexOf('partner:')!==0;});
      const latest={};rows.forEach(function(row){latest[row.workspace_id+'|'+row.entity_id]=JSON.parse(row.state_json);});
      const state=Object.keys(latest).map(function(key){return latest[key];}).find(function(s){return s.invitations.some(function(i){return i.invitation_id===invitationId;});});
      if(!state)throw new Error('INVITATION_INVALID');
      const actor={kind:'vendor',actor_id:String(verified.data.sub||''),workspace_id:state.workspace_id,invitation_id:invitationId};
      repairDispatchVendorAccess_(state,actor);
      const ticket=repairTicketFindTicketById_(state.ticket_id);
      if(action==='vendor_repair_dispatch_init')return {success:true,data:repairDispatchVendorView_(state,ticket,actor)};
      if(action==='vendor_repair_attachment_download')return {success:true,data:repairDispatchAttachmentDownload_(actor,state,request)};
      if(action==='vendor_repair_attachment_upload')return {success:true,data:repairDispatchVendorView_(repairDispatchAttachmentUpload_(actor,{...request,ticket_id:state.ticket_id}),ticket,actor)};
      const updated=repairDispatchAct_(actor,{...request,ticket_id:state.ticket_id});
      return {success:true,data:repairDispatchVendorView_(updated,ticket,actor)};
    }
    const principal=resolveLandlordRepairRoutePrincipal_(request);
    if(!principal||!principal.success)return principal;
    const data=principal.data;
    const actor={kind:'landlord',actor_id:data.user && data.user.user_id || data.user_id,workspace_id:data.workspace && data.workspace.workspace_id || data.workspace_id,role:data.membership && data.membership.role || data.role};
    repairDispatchRevalidateLandlord_(actor);
    const wrap=function(value){return {success:true,data:Object.assign({},value,{current_membership:{role:actor.role}})};};
    if(action==='landlord_repair_partner_save')return wrap(repairDispatchPartnerSave_(actor,request));
    const ticket=repairTicketFindTicketById_(request.ticket_id);
    if(!ticket||ticket.workspace_id!==actor.workspace_id)throw new Error('REPAIR_TICKET_NOT_FOUND');
    const state=repairDispatchState_(actor.workspace_id,ticket.repair_ticket_id);
    if(action==='landlord_repair_dispatch_init')return wrap({ticket:repairTicketToLandlordProjection_(ticket),dispatch:state,partners:repairDispatchPartners_(actor.workspace_id)});
    if(action==='landlord_repair_attachment_upload')return wrap(repairDispatchAttachmentUpload_(actor,request));
    if(action==='landlord_repair_attachment_download')return wrap(repairDispatchAttachmentDownload_(actor,state,request));
    return wrap(repairDispatchAct_(actor,request));
  }catch(error){const code=/^[A-Z][A-Z_]{2,80}$/.test(String(error.message))?error.message:'DISPATCH_RESULT_UNKNOWN';return {success:false,code:code,message:repairDispatchErrorText_(code)};}
}

function repairDispatchErrorText_(code) {
  return {VERSION_CONFLICT:'資料已更新，請重新讀取後再操作。',EXTRA_APPROVAL_REQUIRED:'實際費用超過核准費用，請先核准追加費用。',INVALID_STAGE:'此階段無法執行操作。',PERMISSION_DENIED:'目前身份沒有此操作權限。',DISPATCH_SCHEMA_REQUIRED:'派工資料表尚未完成設定。',PARTNER_INACTIVE:'合作對象已停用或不符合工種。',EXECUTOR_REQUIRED:'請指定有效施工者；只有受派施工者能回報。',INVITATION_EXPIRED:'邀請已過期，請房東重新邀請。',IDEMPOTENCY_CONFLICT:'此提交編號已用於其他內容，請先核對已保存結果。'}[code]||'操作未完成（'+code+'），請核對資料後重試。';
}

function repairDispatchAttachmentUpload_(actor, input) {
  const bytes=Utilities.base64Decode(String(input.base64||''));
  const mime=String(input.mime_type||'');
  if(bytes.length<8||bytes.length>3*1024*1024)throw new Error('FILE_SIZE_INVALID');
  const unsigned=bytes.map(function(b){return (b+256)%256;});
  const valid=mime==='image/png' && [137,80,78,71,13,10,26,10].every(function(b,i){return unsigned[i]===b;}) || mime==='image/jpeg' && unsigned[0]===255 && unsigned[1]===216 && unsigned[2]===255;
  if(!valid)throw new Error('FILE_SIGNATURE_INVALID');
  const request={...input,request_id:input.business_request_id||input.request_id,operation:'attachment_upload',content_fingerprint:ldComputeSha256Hex_(bytes)};
  return repairDispatchLock_(function(){
    if(actor.kind==='landlord')repairDispatchRevalidateLandlord_(actor);
    const ticket=repairTicketFindTicketById_(request.ticket_id);
    if(!ticket||ticket.workspace_id!==actor.workspace_id)throw new Error('ATTACHMENT_ACCESS_DENIED');
    const state=repairDispatchState_(actor.workspace_id,request.ticket_id);
    if(!state)throw new Error('INVALID_STAGE');
    if(actor.kind==='vendor'){
      const access=repairDispatchVendorAccess_(state,actor);
      if(!state.assignment||state.assignment.executor_line_user_id!==actor.actor_id||['manager','worker'].indexOf(access.member.role)<0)throw new Error('EXECUTOR_REQUIRED');
    }else if(['owner','admin','manager','maintenance'].indexOf(actor.role)<0)throw new Error('PERMISSION_DENIED');
    const duplicate=repairDispatchDuplicate_(actor,request,request.ticket_id);if(duplicate)return duplicate;
    if(state.stage!=='in_progress')throw new Error('INVALID_STAGE');
    if(Number(request.expected_version)!==state.version)throw new Error('VERSION_CONFLICT');
    if(state.attachments.length>=30)throw new Error('ATTACHMENT_LIMIT');
    const folderId=PropertiesService.getScriptProperties().getProperty('CMWEBS_REPAIR_PRIVATE_DRIVE_ROOT_FOLDER_ID');
    if(!folderId)throw new Error('REPAIR_PRIVATE_FOLDER_REQUIRED');
    const name=repairDispatchText_(input.file_name||'施工照片',100).replace(/[\\/]/g,'_');
    const file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes,mime,name));
    try{
      file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
      state.attachments.push({attachment_id:Utilities.getUuid(),file_id:file.getId(),name:name,mime_type:mime,size:bytes.length,actor_id:actor.actor_id});
      state.version++;state.last_request_id=request.request_id;state.history.push({operation:'attachment_upload',request_id:request.request_id,actor_id:actor.actor_id,created_at:Date.now(),note:''});
      return repairDispatchCommit_(actor,request,request.ticket_id,state);
    }catch(error){
      // If append committed but its response failed, retain the referenced private file.
      const committed=repairDispatchState_(actor.workspace_id,request.ticket_id);
      if(committed && committed.attachments.some(function(a){return a.file_id===file.getId();}))return committed;
      try{file.setTrashed(true);}catch(_){}throw error;
    }
  });
}

function repairDispatchAttachmentDownload_(actor, suppliedState, request) {
  if(actor.kind==='landlord')repairDispatchRevalidateLandlord_(actor);
  if(!suppliedState||suppliedState.workspace_id!==actor.workspace_id)throw new Error('ATTACHMENT_ACCESS_DENIED');
  const state=repairDispatchState_(actor.workspace_id,suppliedState.ticket_id);
  if(!state)throw new Error('ATTACHMENT_ACCESS_DENIED');
  if(actor.kind==='vendor')repairDispatchVendorAccess_(state,actor);
  else if(actor.kind!=='landlord'||['owner','admin','manager','maintenance','viewer','accountant'].indexOf(actor.role)<0)throw new Error('PERMISSION_DENIED');
  const attachment=state.attachments.find(function(a){return a.attachment_id===request.attachment_id;});
  if(!attachment||actor.kind==='vendor' && attachment.actor_id!==actor.actor_id)throw new Error('ATTACHMENT_ACCESS_DENIED');
  const blob=DriveApp.getFileById(attachment.file_id).getBlob();
  return {name:attachment.name,mime_type:attachment.mime_type,base64:Utilities.base64Encode(blob.getBytes())};
}

function repairDispatchIsAction_(action) {
  return ['landlord_repair_dispatch_init','landlord_repair_dispatch_update','landlord_repair_partner_save','landlord_repair_attachment_upload','landlord_repair_attachment_download','vendor_repair_identity_init','vendor_repair_dispatch_init','vendor_repair_dispatch_update','vendor_repair_attachment_upload','vendor_repair_attachment_download'].indexOf(action)>=0;
}


function repairDispatchRevalidateLandlord_(actor) {
  if(actor.kind!=='landlord'||!actor.actor_id||!actor.workspace_id)throw new Error('AUTH_REQUIRED');
  const ss=runtimeSpreadsheet_();
  const user=workspaceGetObjectsWithRow_(ss.getSheetByName(V2_WORKSPACE_SHEETS_.users)).find(function(row){return String(row.user_id)===actor.actor_id;});
  const member=workspaceGetObjectsWithRow_(ss.getSheetByName(V2_WORKSPACE_SHEETS_.members)).find(function(row){return String(row.user_id)===actor.actor_id && String(row.workspace_id)===actor.workspace_id;});
  const workspace=workspaceGetObjectsWithRow_(ss.getSheetByName(V2_WORKSPACE_SHEETS_.workspaces)).find(function(row){return String(row.workspace_id)===actor.workspace_id;});
  if(!user||!member||!workspace||!workspaceIsActiveStatus_(user.account_status||user.status||'active')||!workspaceIsActiveStatus_(member.member_status||'active')||!workspaceIsActiveStatus_(workspace.account_status||workspace.workspace_status||workspace.status||'active'))throw new Error('WORKSPACE_ACCESS_DENIED');
  actor.role=String(member.role).toLowerCase();
  if(['owner','admin','manager','accountant','maintenance','viewer'].indexOf(actor.role)<0)throw new Error('PERMISSION_DENIED');
}
