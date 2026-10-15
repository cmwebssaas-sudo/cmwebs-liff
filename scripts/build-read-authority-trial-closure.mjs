// Local canonical dependency preparation only. No API executable, public entry,
// Google operation, scope grant or deployable manifest is generated here.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../cloudflare/read-api/package.json',import.meta.url));
const {parse}=require('acorn');
const modules=['V2_RUNTIME_SNAPSHOT','V2_WORKSPACES','V2_WORKSPACE_LANDLORD_ACCESS',
  'V2_LANDLORD_EMAIL_AUTH','V2_LINE_IDENTITY','V2_READ_REPLICA_SCHEMA',
  'V2_READ_REPLICA_SYNC','V2_READ_AUTHORIZATION'];
const sha=text=>createHash('sha256').update(text).digest('hex');
function walk(node,visit){
  if(!node||typeof node!=='object')return;visit(node);
  for(const [key,value] of Object.entries(node)){
    if(key==='start'||key==='end')continue;
    if(Array.isArray(value))for(const child of value)walk(child,visit);
    else if(value&&typeof value==='object')walk(value,visit);
  }
}
export function buildAuthorityTrialClosure(root=new URL('../',import.meta.url)){
  const globals=new Map(),records=[],sourcePins={};
  for(const name of modules){
    const path='apps-script/'+name+'.js',source=readFileSync(new URL(path,root),'utf8');
    sourcePins[path]=sha(source);
    for(const node of parse(source,{ecmaVersion:'latest',sourceType:'script'}).body){
      const names=node.type==='FunctionDeclaration'?[node.id.name]:node.type==='VariableDeclaration'?
        node.declarations.map(d=>{if(d.id.type!=='Identifier')throw Error('Unsupported canonical declaration');return d.id.name;}):[];
      const record={path,source,node,names};records.push(record);
      for(const id of names){if(globals.has(id))throw Error('Duplicate canonical global');globals.set(id,record);}
    }
  }
  const queue=['readAuthorizationConfirm_'],selected=new Set();
  while(queue.length){
    const name=queue.pop(),record=globals.get(name);if(!record)throw Error('Missing canonical dependency');
    if(selected.has(record))continue;selected.add(record);
    walk(record.node,node=>{
      if(node.type==='Identifier'&&globals.has(node.name))queue.push(node.name);
      if((node.type==='CallExpression'||node.type==='NewExpression')&&node.callee.type==='Identifier'&&
        ['eval','Function'].includes(node.callee.name))throw Error('Dynamic canonical execution unsupported');
    });
  }
  const declarations=records.filter(record=>selected.has(record)).map(record=>({
    path:record.path,kind:record.node.type,names:record.names.slice(),start:record.node.start,end:record.node.end,
    sha256:sha(record.source.slice(record.node.start,record.node.end))
  }));
  const publicFunctions=declarations.filter(d=>d.kind==='FunctionDeclaration').flatMap(d=>d.names).filter(n=>!n.endsWith('_'));
  if(publicFunctions.length)throw Error('Public canonical entry not allowed in trial closure');
  const source=records.filter(record=>selected.has(record)).map(record=>record.source.slice(record.node.start,record.node.end)).join('\n\n')+'\n';
  return {status:'LOCAL_CLOSURE_NOT_DEPLOYABLE',source,sourceSha256:sha(source),sourcePins,declarations,
    allSourceGlobals:[...globals.keys()],publicFunctions,
    limits:['Conservative identifier closure can retain dormant write/schema/native fallback branches.',
      'Requires a separately reviewed guarded entry and fail-closed readonly adapter before any deployment.',
      'Does not prove Google scopes, library access/resource sharing, atomicity or latency.']};
}
