import {readdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const integration=new Set(['platform-core-subscription.roundtrip.test.mjs','commercial-subscription.roundtrip.test.mjs']);
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')&&!integration.has(name)).sort().map(name=>'tests/'+name);
console.log('Unit suite; mandatory Core/PG integration suites run in pinned Core CI.');
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',cwd:new URL('..',import.meta.url)});process.exitCode=result.status??1;
