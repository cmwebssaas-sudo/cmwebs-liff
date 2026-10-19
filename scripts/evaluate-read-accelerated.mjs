import {readFile} from 'node:fs/promises';
import {evaluateAcceleratedShadow} from './read-accelerated-shadow.mjs';
const args=process.argv.slice(2);
if(args.length!==4||args.some(v=>!v)){
 console.error('Usage: node scripts/evaluate-read-accelerated.mjs private-export.json expected-epoch expected-comparison-version page');
 process.exitCode=2;
}else{
 try{
  const [path,epoch,release,page]=args,input=JSON.parse(await readFile(path,'utf8'));
  const result=evaluateAcceleratedShadow(input,{now:Date.now(),epoch,release,page});
  console.log(JSON.stringify(result,null,2));process.exitCode=result.shadowEligible?0:1;
 }catch{
  console.error('Invalid observation input');process.exitCode=2;
 }
}
