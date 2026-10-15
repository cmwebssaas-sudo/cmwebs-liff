import schema from '../schema.json' with {type:'json'};
import { createReadCalculator } from './read-calculator.js';
import { createReplicaRuntime } from './read-runtime.js';
import { resolveReadAccess } from './read-access.js';

const text=value=>String(value??'').trim();
const unique=values=>[...new Set(values.map(text).filter(Boolean))];
const column=field=>`trim(COALESCE(json_extract("${field}",'$'),''))`;
const blankWorkspace=`upper(${column('workspace_id')}) = ''`;
function failure(code='READ_REPLICA_UNAVAILABLE'){throw Object.assign(new Error(code),{code});}
const escapedOrControl=/[\\\u0000-\u001f]/;
function decodeCell(value) {
  // Common replica strings have no escapes. Keep strict JSON.parse for numbers,
  // containers, escaped strings and every malformed or non-string input.
  if(value==='null')return null;
  if(value==='true')return true;
  if(value==='false')return false;
  if(value==='0')return 0;
  if(typeof value==='string'&&value.charCodeAt(0)===34&&value.indexOf('"',1)===value.length-1&&!escapedOrControl.test(value))return value.slice(1,-1);
  return JSON.parse(value);
}

// Stored fields are JSON text; SQL NULL means absent, while JSON "null" is an
// own null value. Avoid intermediate entry/pair/filter/map arrays at capacity.
export function decodeReplicaRows(rows) {
  return rows.map(row=>{
    const decoded={};
    for(const field of Object.keys(row)) {
      const value=row[field];
      if(value===null)continue;
      const parsed=decodeCell(value);
      if(field==='__proto__')Object.defineProperty(decoded,field,{value:parsed,enumerable:true,writable:true,configurable:true});
      else decoded[field]=parsed;
    }
    return decoded;
  });
}

// Pack the same static projection into one SQL result column per row. This
// avoids D1 constructing an intermediate object with every schema field.
// SQL NULL stays a null cell (absent); JSON text "null" stays a string cell
// until decoding (an own null value). No source fields or rows are omitted.
export function packedSelection(fields) {
  return 'json_array('+fields.map(field=>'"'+field.replaceAll('"','""')+'"').join(',')+') AS replica_values';
}
export function decodePackedRows(rows,fields) {
  return rows.map(row=>{
    const values=JSON.parse(row.replica_values);
    if(!Array.isArray(values)||values.length!==fields.length) throw new Error('Packed replica row shape');
    const decoded={};
    for(let index=0;index<fields.length;index++) {
      if(values[index]===null) continue;
      const field=fields[index],value=decodeCell(values[index]);
      if(field==='__proto__')Object.defineProperty(decoded,field,{value,enumerable:true,writable:true,configurable:true});
      else decoded[field]=value;
    }
    return decoded;
  });
}

// All identifiers below come from the static schema or server-loaded rows.
// Client values are always bound parameters. No operational table is scanned
// into JS before access is resolved, and explicitly foreign Workspace rows
// never qualify through a matching legacy landlord/property/room identifier.
export function createReadDatasetLoader(database,options={}) {
  const db=database.withSession('first-primary');
  function statement(table,where,params=[]) {
    const fields=schema[table]?.fields;
    if(!fields||!where) failure();
    return db.prepare(`SELECT ${packedSelection(fields)} FROM "${table}" WHERE ${where} ORDER BY CAST(replica_source_row AS INTEGER),row_key LIMIT 10001`).bind(...params);
  }
  function decode(result,fields) {
    if(!result?.success||!Array.isArray(result.results)||result.results.length>10000) failure();
    return decodePackedRows(result.results,fields);
  }
  async function select(table,where,params=[]) {
    return decode(await statement(table,where,params).all(),schema[table].fields);
  }
  function merge(table,rows) {
    const key=schema[table].key;
    return [...new Map(rows.map(row=>[row[key],row])).values()].sort((a,b)=>Number(a.replica_source_row)-Number(b.replica_source_row)||String(a[key]).localeCompare(String(b[key])));
  }
  function valueSelections(field,values,extra='1=1',extraParams=[]) {
    const workspaceField=field==='workspace_id';
    const ids=unique(values).map(value=>workspaceField?value.toUpperCase():value),selections=[];
    for(let offset=0;offset<ids.length;offset+=80) {
      const chunk=ids.slice(offset,offset+80);
      selections.push([`${workspaceField?'upper('+column(field)+')':column(field)} IN (${chunk.map(()=>'?').join(',')}) AND (${extra})`,[...chunk,...extraParams]]);
    }
    return selections;
  }
  async function byValues(table,field,values,extra='1=1',extraParams=[]) {
    const found=[];
    for(const [where,params] of valueSelections(field,values,extra,extraParams)) found.push(...await select(table,where,params));
    return merge(table,found);
  }
  // Preserve statement and group order. Only queries whose server-derived
  // inputs are already known enter a batch; dependent stages still await.
  // Bound transient result size to 80 statements per SDK call, not 80 keys.
  async function selectGroups(groups) {
    const statements=groups.flatMap(({table,selections})=>selections.map(([where,params])=>({fields:schema[table].fields,query:statement(table,where,params)}))),rows=[];
    for(let offset=0;offset<statements.length;offset+=80) {
      const batch=statements.slice(offset,offset+80),results=await db.batch(batch.map(entry=>entry.query));
      if(!Array.isArray(results)||results.length!==batch.length) failure();
      rows.push(...results.map((result,index)=>decode(result,batch[index].fields)));
    }
    let offset=0;
    return groups.map(({table,selections})=>{
      const result=merge(table,rows.slice(offset,offset+selections.length).flat());
      offset+=selections.length;return result;
    });
  }
  return {
    async checkReplica() {
      const now=options.now??Date.now(),tables=Object.keys(schema);
      const results=await db.batch(tables.map(table=>db.prepare(`SELECT source_version,completed_at,
        EXISTS (SELECT 1 FROM sync_runs AS pending WHERE pending.sheet=? AND pending.status='receiving'
          AND pending.source_version > completed.source_version) AS pending
        FROM sync_runs AS completed WHERE completed.sheet=? AND completed.mode='snapshot'
          AND completed.status='completed' ORDER BY completed.source_version DESC LIMIT 1`).bind(table,table)));
      for(const result of results) {
        const row=result.results?.[0];
        if(!result.success||!row||row.pending) failure('READ_SYNC_INCOMPLETE');
        const completed=Date.parse(row.completed_at);
        if(!Number.isFinite(completed)||completed>now+300000||now-completed>26*3600000) failure('READ_SYNC_STALE');
      }
    },
    async findSession(hash) {
      const rows=await byValues('V2_landlord_email_sessions','session_token_hash',[hash]);
      if(rows.length>1) failure('AUTH_REQUIRED');
      return rows[0]||null;
    },
    async resolveAccess(identity) {
      const users=await byValues('V2_users',identity.kind==='line'?'line_user_id':'user_id',
        [identity.kind==='line'?identity.line_user_id:identity.user_id]);
      if(users.length!==1) failure('AUTH_REQUIRED');
      const actor=users[0];
      const members=await byValues('V2_workspace_members','user_id',[actor.user_id]);
      const workspaces=await byValues('V2_workspaces','workspace_id',unique(members.map(row=>row.workspace_id)));
      const preliminary={V2_users:users,V2_workspace_members:members,V2_workspaces:workspaces};
      const runtime=createReplicaRuntime(preliminary,options);
      const helper=createReadCalculator(runtime);
      const context=helper.workspaceResolveContextByLineUid_(runtime.runtimeSpreadsheet_(),text(actor.line_user_id));
      const workspace=context.activeWorkspace;
      if(!workspace) failure('WORKSPACE_REQUIRED');
      const workspaceId=text(workspace.workspace_id).toUpperCase();
      const workspaceMembers=await select('V2_workspace_members',`upper(${column('workspace_id')}) = ?`,[workspaceId]);
      const ownerIds=workspaceMembers.filter(row=>text(row.role).toLowerCase()==='owner'&&helper.workspaceIsActiveStatus_(row.member_status||'active')).map(row=>row.user_id);
      const principalUsers=await byValues('V2_users','user_id',unique([actor.user_id,workspace.created_by_user_id,...ownerIds]));
      const ids=unique([workspace.created_by_user_id,...ownerIds]);
      const ownerLines=unique(principalUsers.filter(row=>ids.includes(text(row.user_id))).map(row=>row.line_user_id));
      const conditions=[`upper(${column('workspace_id')}) = ?`],params=[workspaceId];
      for(const [field,values] of [['user_id',ids],['landlord_user_id',ids],['line_user_id',ownerLines],['landlord_line_user_id',ownerLines]]) {
        if(values.length>80) failure();
        if(values.length){conditions.push(`(${blankWorkspace} AND ${column(field)} IN (${values.map(()=>'?').join(',')}))`);params.push(...values);}
      }
      if(params.length>90) failure();
      const landlords=await select('V2_landlords',conditions.join(' OR '),params);
      const allMembers=[...new Map([...members,...workspaceMembers].map(row=>[row.membership_id,row])).values()]
        .sort((a,b)=>Number(a.replica_source_row)-Number(b.replica_source_row));
      const data={...preliminary,V2_users:principalUsers,V2_workspace_members:allMembers,V2_landlords:landlords};
      return resolveReadAccess(data,identity,options);
    },
    async loadDataset(access) {
      if(access?.success!==true) failure('AUTH_REQUIRED');
      const workspaceId=text(access.workspace.workspace_id).toUpperCase();
      const data=Object.fromEntries(Object.keys(schema).map(table=>[table,[]]));
      data.V2_workspaces=[access.workspace];
      data.V2_workspace_members=await select('V2_workspace_members',`upper(${column('workspace_id')}) = ?`,[workspaceId]);
      data.V2_landlords=access.principals;
      const relationships={landlord_id:unique(access.principals.map(row=>row.landlord_id)),
        landlord_line_user_id:unique(access.principals.map(row=>row.line_user_id)),
        line_user_id:unique(access.principals.map(row=>row.line_user_id))};
      function safeParents(table) {
        const params=[];
        function foreignRow(alias) {
          params.push(workspaceId);
          const value=`upper(trim(COALESCE(json_extract(${alias}.workspace_id,'$'),'')))`;
          return `(${value} <> '' AND ${value} <> ?)`;
        }
        function foreignProperty(id) {return `EXISTS (SELECT 1 FROM V2_properties AS parent_property WHERE trim(COALESCE(json_extract(parent_property.property_id,'$'),'')) = ${id} AND ${foreignRow('parent_property')})`;}
        function foreignRoom(id) {return `EXISTS (SELECT 1 FROM V2_rooms AS parent_room WHERE trim(COALESCE(json_extract(parent_room.room_id,'$'),'')) = ${id} AND (${foreignRow('parent_room')} OR ${foreignProperty("trim(COALESCE(json_extract(parent_room.property_id,'$'),''))")}))`;}
        function foreignContract(id) {return `EXISTS (SELECT 1 FROM V2_contracts AS parent_contract WHERE trim(COALESCE(json_extract(parent_contract.contract_id,'$'),'')) = ${id} AND (${foreignRow('parent_contract')} OR ${foreignProperty("trim(COALESCE(json_extract(parent_contract.property_id,'$'),''))")} OR ${foreignRoom("trim(COALESCE(json_extract(parent_contract.room_id,'$'),''))")}))`;}
        const clauses=[];
        for(const [field,test] of [['property_id',foreignProperty],['room_id',foreignRoom],['contract_id',foreignContract]]) {
          if(schema[table].fields.includes(field)) clauses.push('NOT '+test(`trim(COALESCE(json_extract("${table}"."${field}",'$'),''))`));
        }
        return {sql:clauses.length?clauses.join(' AND '):'1=1',params};
      }
      function scopedGroups(table) {
        const fields=schema[table].fields;
        const groups=[{table,selections:[[ `upper(${column('workspace_id')}) = ?`,[workspaceId] ]]}];
        const anchors=safeParents(table);
        for(const [field,ids] of Object.entries(relationships)) if(fields.includes(field)) groups.push({table,selections:valueSelections(field,ids,blankWorkspace+' AND '+anchors.sql,anchors.params)});
        return groups;
      }
      async function scopedTables(tables) {
        const plans=tables.map(table=>scopedGroups(table)),groups=await selectGroups(plans.flat());
        let offset=0;
        for(let index=0;index<tables.length;index++) {
          data[tables[index]]=merge(tables[index],groups.slice(offset,offset+plans[index].length).flat());
          offset+=plans[index].length;
        }
      }
      await scopedTables(['V2_properties']);
      relationships.property_id=unique(data.V2_properties.map(row=>row.property_id));
      await scopedTables(['V2_rooms']);
      relationships.room_id=unique(data.V2_rooms.map(row=>row.room_id));
      await scopedTables(['V2_contracts']);
      relationships.contract_id=unique(data.V2_contracts.map(row=>row.contract_id));
      await scopedTables(Object.keys(schema).filter(table=>!['V2_users','V2_workspaces','V2_workspace_members','V2_landlords','V2_properties','V2_rooms','V2_contracts','V2_landlord_email_sessions'].includes(table)));
      const userIds=unique([access.user.user_id,...Object.values(data).flatMap(rows=>rows.flatMap(row=>[row.user_id,row.tenant_user_id,row.owner_user_id,row.landlord_user_id]))]);
      const lineIds=unique(Object.values(data).flatMap(rows=>rows.flatMap(row=>[row.line_user_id,row.tenant_line_user_id,row.landlord_line_user_id])));
      const users=(await selectGroups([{table:'V2_users',selections:valueSelections('user_id',userIds)},{table:'V2_users',selections:valueSelections('line_user_id',lineIds)}])).flat();
      data.V2_users=[...new Map(users.map(row=>[row.user_id,row])).values()].sort((a,b)=>Number(a.replica_source_row)-Number(b.replica_source_row));
      return data;
    }
  };
}
