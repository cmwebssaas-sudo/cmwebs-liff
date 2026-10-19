import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readdir,copyFile,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readComparisonSnapshot,verifyReadComparison} from '../scripts/generate-read-comparison.mjs';
const root=new URL('../',import.meta.url);
test('actual comparison sources stay fixed through flag/cache releases and invalidate on source/contract changes',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'cmwebs-comparison-'));
  try {
    await copyFile(new URL('package.json',root),join(temp,'package.json'));
    for(const name of await readdir(root)) if(/\.(html|js|css)$/.test(name)) await copyFile(new URL(name,root),join(temp,name));
    for(const dir of ['assets','apps-script','cloudflare/read-api/src','cloudflare/read-api/migrations','scripts'])
      await cp(new URL(dir,root),join(temp,dir),{recursive:true,filter:source=>!source.endsWith('.clasp.json')});
    for(const name of ['schema.json','read-source-manifest.json','shadow-fields.json','shadow-clock-fields.json','package.json','package-lock.json','wrangler.toml','read-comparison-manifest.json']) {
      await mkdir(join(temp,'cloudflare/read-api'),{recursive:true});
      await copyFile(new URL('cloudflare/read-api/'+name,root),join(temp,'cloudflare/read-api',name));
    }
    const before=await readComparisonSnapshot(temp);
    for(const name of ['landlord-api.js','landlord-auth.js','liff-request-auth.js','landlord-home.html','landlord-rooms.html',
      'apps-script/程式碼.js','apps-script/V2_READ_AUTHORIZATION.js','apps-script/V2_LINE_IDENTITY.js',
      'apps-script/V2_LANDLORD_EMAIL_AUTH.js','apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js',
      'cloudflare/read-api/src/read-runtime.js','cloudflare/read-api/src/shadow-windows.js','cloudflare/read-api/shadow-clock-fields.json',
      'cloudflare/read-api/wrangler.toml','assets/js/cmwebs-asset-valuation.js','assets/css/cmwebs-asset-valuation.css',
      'assets/platform-member/manifest.json'])
      assert.ok(Object.hasOwn(before.sources,name),name);
    const central=join(temp,'frontend-release.js'),old=await readFile(central,'utf8');
    const asset=old.match(/CMWEBS_RELEASE_VERSION\s*=\s*'([^']+)'/)[1];
    await writeFile(central,old.replace(asset,'assets-flag-only').replace("rooms: 'off'","rooms: 'on'"));
    for(const name of await readdir(temp)) if(/\.(html|js|css)$/.test(name)&&name!=='frontend-release.js') {
      const path=join(temp,name);await writeFile(path,(await readFile(path,'utf8')).replaceAll('?v='+asset,'?v=assets-flag-only'));
    }
    assert.deepEqual(await readComparisonSnapshot(temp),before);
    await verifyReadComparison(temp);
    for(const name of ['landlord-api.js','landlord-home.html','apps-script/V2_LINE_IDENTITY.js','cloudflare/read-api/src/read-runtime.js','cloudflare/read-api/wrangler.toml','assets/js/cmwebs-asset-valuation.js','assets/platform-member/manifest.json']) {
      const path=join(temp,name),source=await readFile(path,'utf8');
      const changed=name.endsWith('.toml')?source.replace('2026-10-06','2026-10-07'):
        name.endsWith('.json')?source.replace('billing-CuiUG3N0.js','billing-B-Fmz4BD.js'):
        source+'\n// Changed calculation or authorization source\n';
      await writeFile(path,changed);
      assert.notEqual((await readComparisonSnapshot(temp)).comparison_version,before.comparison_version);
      await assert.rejects(()=>verifyReadComparison(temp));
      await writeFile(path,source);
    }
    await writeFile(central,(await readFile(central,'utf8')).replace("CMWEBS_READ_API_URL = ''","CMWEBS_READ_API_URL = 'https://changed.invalid'"));
    assert.notEqual((await readComparisonSnapshot(temp)).comparison_version,before.comparison_version);
  } finally {await rm(temp,{recursive:true,force:true});}
});
