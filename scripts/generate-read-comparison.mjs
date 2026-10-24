import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '../cloudflare/read-api/node_modules/acorn/dist/acorn.mjs';
const here=fileURLToPath(new URL('../',import.meta.url));
const manifestPath='cloudflare/read-api/read-comparison-manifest.json';
const names=['CMWEBS_RELEASE_VERSION','CMWEBS_READ_COMPARISON_VERSION','CMWEBS_READ_API_URL','CMWEBS_READ_PATH'];
const routes=['home','revenue','tenants','rooms','arrears','properties'];
function centralDefinitions(source) {
  const ast=parse(source,{ecmaVersion:'latest'}),definitions={};
  for(const statement of ast.body) {
    const node=statement.expression,left=node?.left;
    if(statement.type!=='ExpressionStatement'||node?.type!=='AssignmentExpression'||node.operator!=='='||
      left?.type!=='MemberExpression'||left.computed||left.object.name!=='window'||
      !names.includes(left.property.name)||definitions[left.property.name]) throw Error('Unexpected central read configuration');
    definitions[left.property.name]=node.right;
  }
  if(Object.keys(definitions).length!==names.length) throw Error('Missing central read configuration');
  for(const name of names.filter(name=>name!=='CMWEBS_READ_PATH'))
    if(definitions[name].type!=='Literal'||typeof definitions[name].value!=='string') throw Error('Configuration must be literal');
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(definitions.CMWEBS_RELEASE_VERSION.value)) throw Error('Invalid asset version');
  const flags=definitions.CMWEBS_READ_PATH;
  if(flags.type!=='ObjectExpression'||flags.properties.length!==routes.length) throw Error('Invalid read flags');
  const seen=new Set();
  for(const property of flags.properties) {
    const name=property.key.name||property.key.value;
    if(property.type!=='Property'||property.computed||property.kind!=='init'||!routes.includes(name)||seen.has(name)||
      property.value.type!=='Literal'||!['off','shadow','on'].includes(property.value.value)) throw Error('Invalid read flags');
    seen.add(name);
  }
  return definitions;
}
function replaceNodes(source,replacements) {
  for(const [node,value] of replacements.sort((a,b)=>b[0].start-a[0].start)) source=source.slice(0,node.start)+value+source.slice(node.end);
  return source;
}
async function walk(root,dir,filter) {
  const paths=[];
  for(const entry of await readdir(join(root,dir),{withFileTypes:true})) {
    const path=join(dir,entry.name);
    if(entry.isDirectory()) paths.push(...await walk(root,path,filter));
    else if(entry.isFile()&&filter(path)) paths.push(path);
  }
  return paths;
}
export async function readComparisonSnapshot(root=here) {
  root=resolve(root);
  const central=await readFile(join(root,'frontend-release.js'),'utf8'),definitions=centralDefinitions(central);
  const asset=definitions.CMWEBS_RELEASE_VERSION.value;
  const assetPattern=new RegExp('([?&]v=)'+asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=["\'&\\s>])','g');
  const files=(await readdir(root)).filter(name=>/\.(html|js|css)$/.test(name));
  files.push(...await walk(root,'assets',path=>/\.(html|js|css|json)$/.test(path)),
    ...await walk(root,'apps-script',path=>path.endsWith('.js')||path==='apps-script/appsscript.json'),
    ...await walk(root,'cloudflare/read-api/src',path=>path.endsWith('.js')),
    ...await walk(root,'cloudflare/read-api/migrations',path=>path.endsWith('.sql')),
    ...(await readdir(join(root,'scripts'))).filter(name=>/^generate-(read|shadow)-.*\.mjs$/.test(name)).map(name=>'scripts/'+name),
    'package.json',...['schema.json','read-source-manifest.json','shadow-fields.json','shadow-clock-fields.json','package.json','package-lock.json','wrangler.toml'].map(name=>'cloudflare/read-api/'+name));
  const sources={};
  for(const path of [...new Set(files)].sort()) {
    let source=await readFile(join(root,path),'utf8');
    if(path==='frontend-release.js') source=replaceNodes(source,[
      [definitions.CMWEBS_RELEASE_VERSION,"'ASSET_VERSION'"],
      [definitions.CMWEBS_READ_COMPARISON_VERSION,"'COMPARISON_VERSION'"],
      [definitions.CMWEBS_READ_PATH,JSON.stringify(Object.fromEntries(routes.map(route=>[route,'FLAG'])))]]);
    else if(/^[^/]+\.(html|js|css)$/.test(path)||path.startsWith('assets/')) source=source.replace(assetPattern,'$1ASSET_VERSION');
    sources[path]=createHash('sha256').update(source).digest('hex');
  }
  const digest=createHash('sha256').update('cmwebs-read-comparison-v1\n'+JSON.stringify(sources)).digest('hex');
  return {format:'cmwebs-read-comparison-v1',comparison_version:'read-'+digest,sources};
}
export async function verifyReadComparison(root=here) {
  const expected=await readComparisonSnapshot(root),actual=JSON.parse(await readFile(join(root,manifestPath),'utf8'));
  const definition=centralDefinitions(await readFile(join(root,'frontend-release.js'),'utf8'));
  if(JSON.stringify(actual)!==JSON.stringify(expected)||definition.CMWEBS_READ_COMPARISON_VERSION.value!==expected.comparison_version)
    throw Error('Read comparison sources changed: regenerate identity and restart the affected real observation');
  return expected;
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) {
    const result=await verifyReadComparison();console.log('PASS: comparison identity matches '+Object.keys(result.sources).length+' source files.');
  } else {
    const result=await readComparisonSnapshot();
    await writeFile(join(here,manifestPath),JSON.stringify(result,null,2)+'\n');
    const path=join(here,'frontend-release.js'),source=await readFile(path,'utf8');
    await writeFile(path,replaceNodes(source,[[centralDefinitions(source).CMWEBS_READ_COMPARISON_VERSION,JSON.stringify(result.comparison_version)]]));
    console.log('Generated comparison identity for '+Object.keys(result.sources).length+' source files.');
  }
}
