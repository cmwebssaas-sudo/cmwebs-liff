import {continuityFixture,session,ui,good,debit,settle,prepare,hash,compact} from './readonly-continuity.mjs';
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';
export {session,ui,good,debit,settle,prepare,hash,compact};
export const successorDecision='d5dfef1f8870664508a58fdf62922b5754b3c391374d2e365622cf94e8272a32';
export const diagnosticOps=()=>['inventory','claim','snapshot'].map(operation=>({id:'continuity76-diagnostic-'+operation,key:'N:preparation',actor:'publisher',target:'original-settings',operation,units:1,preparation:true}));
export async function successorFixture(){
 const s=await continuityFixture(),h=session(s),pin=path=>({path,sha256:hash(readFileSync(path))});let at=s.time;
 const ops=['session','inventory','claim','navigate','snapshot'].map(n=>ui(n,{id:'continuity-settings-'+n,operation:n==='session'?'claim':n}));
 try{good(await h.ready);good(await prepare(h,ops,at,29,'original-settings-guard'));for(const op of ops.filter(o=>o.operation!=='navigate')){at=(await debit(h,op,at)).lastAt;good(await settle(h,op.id,op.operation!=='snapshot',at));}}finally{await h.close();}
 const journal=s.path+'.simple-readonly-continuity.json',claim=s.path+'.simple-readonly-continuity-claim.json',stop=s.path+'.simple-readonly-continuity-stop.json',registry=join(s.root,hash(JSON.stringify(s.cfg.epoch))+'.simple-readonly-continuity.json');
 const flow=join(s.home,'reviewed-fixed-flow.mjs'),terminal=join(s.home,'terminal76.json'),approval=join(s.home,'successor-approval.json');s.put(flow,'// synthetic readonly fixed flow');at+=1000;
 s.put(terminal,compact({source:'post-return-local-terminal-evidence',at:new Date(at).toISOString(),actualAwaitedRunReturned:true,runResult:'STOPPED_VERIFY_LEDGER',reviewedFlowSha256:pin(flow).sha256,journalSha256:pin(journal).sha256,registrySha256:pin(registry).sha256,latestCheckpointMatches:true,pendingNull:true,allEventsSettled:true,noMutation:true,noRpc:true,lockReleased:true,exactHolderChildAbsent:true,combinedSpent:76,lifecycle:'HARD_STOP',resumeAuthorized:false}));
 s.put(approval,compact({source:'direct-human-approval',decisionSha256:successorDecision,ownerAnswer:'同意最小例外，保留76及232上限',importedSpent:76,importedMainSpent:53,importedUiSpent:23,combinedLimit:232,maximumDiagnosticPrimitives:3,recordedAt:at,executionStarted:false}));
 s.cfg.readonlySuccessor={decisionHash:successorDecision,approval:pin(approval),journal:pin(journal),claim:pin(claim),stop:pin(stop),registry:pin(registry),terminal:pin(terminal),flow:pin(flow)};
 s.cfg.now=at;s.cfg.ownerNonce='e'.repeat(64);s.time=at;s.successor=()=>JSON.parse(readFileSync(s.path+'.simple-readonly-diagnostic.json'));s.retained76=Object.fromEntries([journal,claim,stop,registry,terminal].map(p=>[p,readFileSync(p)]));return s;
}
