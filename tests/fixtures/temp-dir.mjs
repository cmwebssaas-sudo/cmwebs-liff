import {after} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Directories made here are removed when the test file ends, whether its tests pass or fail.
const made=[];
const clean=()=>{for(const dir of made.splice(0))rmSync(dir,{recursive:true,force:true});};
after(clean);process.once('exit',clean);
export function tempDir(prefix){const dir=mkdtempSync(join(tmpdir(),prefix));made.push(dir);return dir;}
