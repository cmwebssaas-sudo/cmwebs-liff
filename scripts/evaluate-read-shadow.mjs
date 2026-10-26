import { readFile } from 'node:fs/promises';
import { evaluateShadowWindows } from '../cloudflare/read-api/src/shadow-windows.js';
const [path,epoch,release,page]=process.argv.slice(2);
if(!path||!epoch||!release) throw Error('Usage: node scripts/evaluate-read-shadow.mjs private-export.json expected-epoch expected-comparison-version [page]');
const input=JSON.parse(await readFile(path,'utf8'));
const result=evaluateShadowWindows(input,{now:Date.now(),epoch,release,page});
console.log(JSON.stringify(result,null,2));
process.exitCode=result.eligible?0:1;
