import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,mkdir,readFile,writeFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('schema generation appends migrations once and preserves every previously provisioned SQL byte',async()=>{
  const root=await mkdtemp(join(tmpdir(),'cmwebs-read-migration-'));
  try {
    for(const path of ['scripts','apps-script','cloudflare/read-api/migrations']) await mkdir(join(root,path),{recursive:true});
    const script='scripts/generate-read-replica-schema.mjs';
    await writeFile(join(root,script),await readFile(new URL('../'+script,import.meta.url)));
    const schemaPath='cloudflare/read-api/schema.json';
    const schema=JSON.parse(await readFile(new URL('../'+schemaPath,import.meta.url),'utf8'));
    const migrations=new URL('../cloudflare/read-api/migrations/',import.meta.url),before={};
    for(const file of (await readdir(migrations)).filter(file=>file.endsWith('.sql'))) {
      before[file]=await readFile(new URL(file,migrations),'utf8');
      await writeFile(join(root,'cloudflare/read-api/migrations',file),before[file]);
    }
    schema.V2_users.fields.push('created_at');
    await writeFile(join(root,schemaPath),JSON.stringify(schema));
    const run=()=>execFileSync(process.execPath,[join(root,script)],{stdio:'pipe'});
    run();run();
    const files=(await readdir(join(root,'cloudflare/read-api/migrations'))).sort();
    assert.deepEqual(files,[...Object.keys(before).sort(),'0004_read_projection.sql']);
    for(const [file,contents] of Object.entries(before)) assert.equal(await readFile(join(root,'cloudflare/read-api/migrations',file),'utf8'),contents,file);
    assert.match(await readFile(join(root,'cloudflare/read-api/migrations/0004_read_projection.sql'),'utf8'),/ALTER TABLE "V2_users" ADD COLUMN "created_at" TEXT;/);
    schema.V2_users.fields=schema.V2_users.fields.filter(field=>field!=='email_verified_at');
    await writeFile(join(root,schemaPath),JSON.stringify(schema));
    assert.throws(run,error=>String(error.stderr).includes('Removal requires an explicit migration'));
  } finally {await rm(root,{recursive:true,force:true});}
});
