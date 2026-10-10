import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('generated admin manifest hashes match executable public entry exported from Core',()=>{
 const manifest=JSON.parse(readFileSync('assets/platform-admin/manifest.json','utf8'));assert.equal(manifest.format,1);assert.match(manifest.source_commit,/^[a-f0-9]{40}$/);const context={document:{createElement:()=>({}),head:{appendChild(){}}},console};vm.createContext(context);let scripts=0;
 for(const asset of manifest.assets){assert.match(asset.path,/^assets\/platform-admin\/[A-Za-z0-9_.-]+\.(js|css)$/);const bytes=readFileSync(asset.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);if(asset.path.endsWith('.js')){scripts++;vm.runInContext(bytes.toString(),context);}}
 assert.equal(scripts,1);assert.equal(typeof context.CMWebsCommercialAdmin?.startCommercialAdmin,'function');
});
