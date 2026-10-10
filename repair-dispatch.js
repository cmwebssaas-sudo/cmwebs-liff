(function () {
  'use strict';
  const labels={assign_self:'改為自行處理',start:'開始派工',invite:'邀請合作對象',quote:'提交報價',decline:'婉拒邀請',accept_invite:'接受固定價派工',approve_quote:'核准報價並指派',begin:'開始施工',finish:'回報完工',approve_extra:'核准追加費用',accept:'驗收通過',rework:'退回補修',cancel:'取消派工'};
  const stages={sourcing:'尋找合作對象',awaiting_approval:'待核准報價',assigned:'已指派，待開工',in_progress:'施工中',awaiting_acceptance:'待房東驗收',completed:'已驗收結案',cancelled:'已取消'};
  const html=value=>String(value===undefined||value===null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function actions(s,vendor,role){
    if(!s)return vendor?[]: ['owner','admin','manager'].includes(role)?['start']:[];
    if(vendor){
      if(['sourcing','awaiting_approval'].includes(s.stage)&&role==='manager'&&['pending','quoted'].includes(s.invitation_status))return s.fixed_amount===null?['quote','decline']:['accept_invite','decline'];
      if(s.is_executor && s.stage==='assigned')return ['begin'];
      if(s.is_executor && s.stage==='in_progress')return ['finish'];
      return [];
    }
    const owner=['owner','admin','manager'].includes(role);
    if(['completed','cancelled'].includes(s.stage))return [];
    const out=s.stage==='assigned'?['begin']:s.stage==='in_progress'?['finish']:s.stage==='awaiting_acceptance'?(owner?[s.actual_amount>s.approved_amount?'approve_extra':'accept','rework']:['rework']):owner?['invite','assign_self']:[];
    if(owner)out.push('cancel');return out;
  }
  function isCommitted(state,id){return !!state && (state.last_request_id===id || (state.committed_request_ids||[]).includes(id) || (state.history||[]).some(e=>e.request_id===id));}
  function mount(container,options){
    let record=null, pending=null, selectedPartner=null, lastFocus=document.activeElement;
    const vendor=!!options.vendor;
    const request=(action,params)=>options.request(action,params);
    function message(text){container.querySelector('[data-feedback]').textContent=text;}
    function field(name){const e=container.querySelector('[name="'+name+'"]');return e?e.value:'';}
    function input(name,label,value,type){return '<label class="rd-field">'+html(label)+'<input name="'+name+'" type="'+(type||'text')+'" value="'+html(value)+'" '+(type==='number'?'min="0" step="1"':'')+'></label>';}
    function render(){
      selectedPartner=null;
      const s=vendor?record:record.dispatch;
      const t=vendor?record:record.ticket;
      const role=vendor?s.role:(record.current_membership && record.current_membership.role)||options.role||'viewer';
      const amount=v=>v===null||v===undefined?'未核准':Number(v).toLocaleString('zh-TW')+' 元';
      let body='<h2>'+html(t.title||'報修派工')+'</h2><p class="rd-stage">'+html(s?stages[s.stage]:['completed','closed'].includes(t.status)?'原報修已結案':'尚未派工')+'</p>';
      if(s)body+='<p>核准費用：'+amount(s.approved_amount)+'　實際費用：'+amount(s.actual_amount)+'</p>';
      if(!s && !['completed','closed'].includes(t.status))body+='<label class="rd-field">處理方式<select name="mode"><option value="self">自行處理</option><option value="vendor">合作廠商</option></select></label>'+input('approved_amount','自行處理核准費用',0,'number')+input('work_kind','工種（維修 repair／清潔 cleaning／其他填名稱）','repair')+input('work_summary','廠商可見的工作摘要（請移除房客個資）',t.title||'')+input('work_location','派工後可見的作業位置','')+input('work_instructions','派工後可見的作業指引','');
      const legacyClosed=!s && !vendor && ['completed','closed'].includes(t.status);
      const available=legacyClosed?[]:actions(s,vendor,role);
      if(!vendor && available.includes('invite')){
        const partners=record.partners.filter(p=>p.active&&p.skills.includes(s.work_kind)&&(!p.property_id||p.property_id===t.property_id));
        body+='<label class="rd-field">合作對象（依優先順位）<select name="partner_id">'+partners.map(p=>'<option value="'+html(p.partner_id)+'">'+html(p.priority+'. '+p.name)+'</option>').join('')+'</select></label><label class="rd-field">派工方式<select name="fixed"><option value="false">先報價核准</option><option value="true">按已約定固定價派工</option></select></label>'+input('expires_hours','回覆期限（小時）',24,'number');
        if(!partners.length)body+='<p>尚無符合工種的合作對象。可在下方新增，或改為自行處理。</p>';
      }
      if(vendor && s.work_location)body+='<p>作業位置：'+html(s.work_location)+'<br>作業指引：'+html(s.work_instructions)+'</p>';
      if(vendor && s.own_latest_quote)body+='<p>最近提交的報價：'+amount(s.own_latest_quote.amount)+'　'+html(s.own_latest_quote.note)+'</p>';
      if(available.includes('assign_self'))body+=input('approved_amount','改為自行處理的核准費用',0,'number');
      if(available.includes('quote'))body+=input('amount','報價總額（含工資、材料及稅費）','','number');
      if(available.includes('finish'))body+=input('actual_amount','實際總費用',s.actual_amount===null?s.approved_amount:s.actual_amount,'number')+'<label class="rd-field">私有施工照片（JPEG／PNG，每張最多 3 MiB）<input type="file" name="photo" accept="image/jpeg,image/png"></label><button type="button" data-upload>上傳照片</button>';
      if(available.some(op=>['quote','finish','rework','cancel','decline'].includes(op)))body+='<label class="rd-field">工作說明／補修或取消原因<textarea name="note" maxlength="500"></textarea></label>';
      if(!vendor && s && !['completed','cancelled'].includes(s.stage))body+='<label class="rd-field">房客可見的處理摘要<textarea name="public_note" maxlength="500">'+html(s.public_note)+'</textarea></label>';
      if(!vendor && s && s.stage==='awaiting_approval')body+=s.quotes.map(q=>{
        const p=record.partners.find(p=>p.partner_id===q.partner_id);
        return '<section class="rd-quote"><strong>'+html(p?p.name:'已停用合作對象')+'</strong><p>'+amount(q.amount)+'　'+html(q.note)+'</p><label class="rd-field">受派施工者<select name="executor_'+html(q.quote_id)+'">'+(p?p.members.filter(m=>m.role!=='contact'):[]).map(m=>'<option value="'+html(m.line_user_id)+'">'+html(m.role+' '+m.line_user_id.slice(-6))+'</option>').join('')+'</select></label><button type="button" data-quote="'+html(q.quote_id)+'">核准這份報價並指派</button></section>';
      }).join('');
      body+='<div class="rd-actions">'+available.map(op=>'<button type="button" data-operation="'+op+'">'+labels[op]+'</button>').join('')+'</div>';
      if(s && s.attachments && s.attachments.length)body+='<h3>私有施工照片</h3><div class="rd-actions">'+s.attachments.map(a=>'<button type="button" data-download="'+html(a.attachment_id)+'">預覽 '+html(a.name)+'</button>').join('')+'</div><div data-preview></div>';
      if(!vendor && s){
        if(s.invitations.length)body+='<h3>邀請與回覆</h3>'+s.invitations.map(i=>{
          const link=new URL('tenant-bind.html',window.location.href);link.searchParams.set('repair_invitation_id',i.invitation_id);
          return '<p>'+html(i.partner_name)+'：'+html({pending:'待回覆',quoted:'已報價',accepted:'已接單',declined:'已婉拒',cancelled:'已取消'}[i.status]||i.status)+'<br><a target="_blank" rel="noopener" href="'+html(link.href)+'">開啟廠商邀請</a> <button type="button" data-share="'+html(link.href)+'">分享邀請</button><small>需人工分享；分享不代表送達或接單。</small></p>';
        }).join('');
        body+='<details><summary>工作與驗收歷史</summary>'+s.history.map(e=>'<p>'+html(labels[e.operation]||e.operation)+' · '+html(new Date(e.created_at).toLocaleString('zh-TW'))+'<br>'+html(e.note)+'</p>').join('')+'</details>';
      }
      if(!vendor && ['owner','admin','manager'].includes(role)){
        body+='<details><summary>管理合作公司／個人</summary><label class="rd-field">編輯既有合作對象<select name="edit_partner"><option value="">新增合作對象</option>'+record.partners.map(p=>'<option value="'+html(p.partner_id)+'">'+html(p.name+(p.active?'':'（停用）'))+'</option>').join('')+'</select></label><button type="button" data-edit-partner>載入設定</button>'+input('partner_name','名稱','')+'<label class="rd-field">合作類型<select name="partner_type"><option value="company">公司</option><option value="individual">個人</option></select></label>'+input('skills','工種，以逗號分隔','repair')+input('priority','優先順位',1,'number')+input('fixed_amount','固定價（無約定留空）','','number')+input('fixed_work_kind','固定價適用工種','')+'<label class="rd-field">成員（每行 LINE UID,manager／worker／contact）<textarea name="members" rows="3"></textarea></label><label class="rd-field">合作狀態<select name="partner_active"><option value="true">啟用</option><option value="false">停用</option></select></label><button type="button" data-save-partner>保存合作對象</button></details>';
      }
      container.innerHTML='<div class="rd-content">'+(options.close?'<button type="button" data-close aria-label="關閉派工">關閉</button>':'')+body+'<p data-feedback role="status" aria-live="polite"></p><button type="button" data-refresh>重新讀取／核對提交結果</button></div>';
      container.querySelectorAll('[data-operation]').forEach(el=>el.onclick=()=>write(el.dataset.operation));
      container.querySelectorAll('[data-quote]').forEach(el=>el.onclick=()=>write('approve_quote',{quote_id:el.dataset.quote,executor_line_user_id:field('executor_'+el.dataset.quote)}));
      container.querySelectorAll('[data-download]').forEach(el=>el.onclick=()=>download(el.dataset.download));
      container.querySelectorAll('[data-share]').forEach(el=>el.onclick=async()=>{try{if(window.navigator.share)await window.navigator.share({title:'工作邀請',url:el.dataset.share});else{await window.navigator.clipboard.writeText(el.dataset.share);message('邀請網址已複製，請分享給已登記成員。');}}catch(error){message(error.message||'分享未完成。');}});
      const closer=container.querySelector('[data-close]');if(closer)closer.onclick=()=>{if(pending){message('提交結果尚未確認，請先重新讀取核對。');return;}container.remove();if(lastFocus)lastFocus.focus();};
      const edit=container.querySelector('[data-edit-partner]');if(edit)edit.onclick=()=>{selectedPartner=record.partners.find(p=>p.partner_id===field('edit_partner'))||null;const p=selectedPartner||{name:'',type:'company',skills:['repair'],priority:1,active:true,members:[]};[['partner_name',p.name],['partner_type',p.type],['skills',p.skills.join(',')],['priority',p.priority],['fixed_amount',p.fixed_amount??''],['fixed_work_kind',p.fixed_work_kind||''],['members',p.members.map(m=>m.line_user_id+','+m.role).join('\n')],['partner_active',String(p.active)]].forEach(([n,v])=>{container.querySelector('[name="'+n+'"]').value=v;});};
      const save=container.querySelector('[data-save-partner]');if(save)save.onclick=savePartner;
      const upload=container.querySelector('[data-upload]');if(upload)upload.onclick=uploadPhoto;
      container.querySelector('[data-refresh]').onclick=refresh;
    }
    function key(){return 'repair_'+Date.now()+'_'+Math.random().toString(36).slice(2);}
    function base(){return vendor?{invitation_id:options.invitationId}:{ticket_id:options.ticketId};}
    function lock(on){container.querySelectorAll('button,input,select,textarea').forEach(el=>{if(!el.hasAttribute('data-refresh'))el.disabled=on;});}
    async function read(){return request((vendor?'vendor':'landlord')+'_repair_dispatch_init',base());}
    async function refresh(){try{const next=await read();const state=vendor?next:next.dispatch;if(pending){if(isCommitted(state,pending.id)||(!vendor && pending.partner && next.partners.some(p=>isCommitted(p,pending.id)))){const draft=pending.draft;pending=null;record=next;render();if(draft)Object.entries(draft).forEach(([n,v])=>{const e=container.querySelector('[name="'+n+'"]');if(e)e.value=v;});message('權威讀回已確認保存成功。');}else{message('提交結果仍未確認，請稍後重新讀取；不要重送。');}}else{record=next;render();}}catch(error){message(error.message||'讀取失敗，請重新登入後再核對。');}}
    async function submit(action,params,partner){if(pending)return;const id=key();const draft=action.endsWith('attachment_upload')?{note:field('note'),actual_amount:field('actual_amount'),public_note:field('public_note')}:null;pending={id,partner:!!partner,draft};let submitted=false;lock(true);message('正在保存，請勿重複提交。');try{await request(action,{...base(),...params,request_id:id});submitted=true;const next=await read();pending=null;record=next;render();if(draft)Object.entries(draft).forEach(([n,v])=>{const e=container.querySelector('[name="'+n+'"]');if(e)e.value=v;});message('已保存並讀回確認。');if(options.onChange)options.onChange();}catch(error){if(!submitted && error.code && !['WORKSPACE_ACCESS_ERROR','INTERNAL_ERROR','DISPATCH_RESULT_UNKNOWN'].includes(error.code)){pending=null;lock(false);message(error.message);return;}message('回應未確認，正在核對保存結果。');await refresh();}}
    function write(operation,extra){const s=vendor?record:record.dispatch;const params={operation,expected_version:s?s.version:0};const names={start:['mode','approved_amount','work_kind','work_summary','work_location','work_instructions'],assign_self:['approved_amount'],invite:['partner_id','fixed','expires_hours'],quote:['amount','note'],finish:['actual_amount','note'],rework:['note'],cancel:['note'],decline:['note']};(names[operation]||[]).forEach(n=>params[n]=field(n));if(operation==='finish')params.attachments=JSON.stringify((s.attachments||[]).map(a=>a.attachment_id));if(!vendor && s)params.public_note=field('public_note');if(['accept','approve_extra','cancel','approve_quote'].includes(operation)&&!window.confirm(labels[operation]+'？請核對工作與費用。'))return;submit((vendor?'vendor':'landlord')+'_repair_dispatch_update',{...params,...extra});}
    function savePartner(){const params={name:field('partner_name'),type:field('partner_type'),skills:JSON.stringify(field('skills').split(',').map(s=>s.trim()).filter(Boolean)),members:JSON.stringify(field('members').split('\n').filter(s=>s.trim()).map(s=>{const a=s.split(',');return {line_user_id:a[0].trim(),role:(a[1]||'contact').trim()};})),priority:field('priority'),fixed_amount:field('fixed_amount'),fixed_work_kind:field('fixed_work_kind'),active:field('partner_active'),property_id:record.ticket.property_id||''};if(selectedPartner){params.partner_id=selectedPartner.partner_id;params.expected_version=selectedPartner.version;}submit('landlord_repair_partner_save',params,true);}
    async function uploadPhoto(){const s=vendor?record:record.dispatch;const file=container.querySelector('[name="photo"]').files[0];if(!file){message('請選擇照片。');return;}if(!['image/jpeg','image/png'].includes(file.type)||file.size>3*1024*1024){message('只接受 JPEG／PNG，最多 3 MiB。');return;}try{const bytes=await file.arrayBuffer();let binary='';new Uint8Array(bytes).forEach(b=>binary+=String.fromCharCode(b));await submit((vendor?'vendor':'landlord')+'_repair_attachment_upload',{expected_version:s.version,file_name:file.name,mime_type:file.type,base64:window.btoa(binary)});}catch(error){message(error.message);}}
    async function download(id){try{const data=await request((vendor?'vendor':'landlord')+'_repair_attachment_download',{...base(),attachment_id:id});if(!['image/png','image/jpeg'].includes(data.mime_type))throw Error('附件格式不受支援');const preview=container.querySelector('[data-preview]');preview.innerHTML='';const img=document.createElement('img');img.src='data:'+data.mime_type+';base64,'+data.base64;img.alt=data.name;img.style.maxWidth='100%';preview.appendChild(img);}catch(error){message(error.message);}}
    container.innerHTML='<div class="rd-content"><p data-feedback role="status">讀取派工資料中…</p></div>';
    read().then(data=>{record=data;render();container.querySelector('button,input')?.focus();}).catch(error=>{container.innerHTML='<div class="rd-content"><p>'+html(error.message)+'</p><button type="button" data-retry>重新讀取</button>'+(options.close?'<button type="button" data-close>關閉</button>':'')+'</div>';container.querySelector('[data-retry]').onclick=()=>mount(container,options);const c=container.querySelector('[data-close]');if(c)c.onclick=()=>container.remove();});
    return {refresh};
  }
  window.CMWebsRepairDispatch={actions,isCommitted,mount};
})();
