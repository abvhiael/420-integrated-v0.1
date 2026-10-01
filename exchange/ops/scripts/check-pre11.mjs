import fs from 'node:fs';import path from 'node:path';
const repo=path.resolve(import.meta.dirname,'../../..');
const runtime=JSON.parse(fs.readFileSync(path.join(repo,'exchange/web/runtime-config.json'),'utf8'));
const readiness=JSON.parse(fs.readFileSync(path.join(repo,'exchange/pretestnet-readiness.json'),'utf8'));
const contractReadiness=JSON.parse(fs.readFileSync(path.join(repo,'contracts/config/exchange/pretestnet-readiness-v1.json'),'utf8'));
if(JSON.stringify(readiness)!==JSON.stringify(contractReadiness))throw new Error('PRE-11 readiness manifests diverge');
if(readiness.schema!=='420-exchange-pretestnet-readiness-v1'||!['PRE-11','PRE-12'].includes(readiness.step)||!Array.isArray(readiness.liveGates)||readiness.liveGates.length<1)throw new Error('PRE-11/PRE-12 readiness manifest invalid');
for(const gate of readiness.liveGates){
  if(gate.resolved!==false||gate.requiredState!=='DISABLED_PRETESTNET')throw new Error('PRE-11/PRE-12 unresolved live gate must remain OFF: '+gate.id);
  for(const key of ['owner','requiredEndpointAccountConfiguration','expectedEvidence','rollbackProcedure'])if(!gate[key]||(Array.isArray(gate[key])&&gate[key].length===0))throw new Error('PRE-12 live gate handoff field missing '+key+': '+gate.id);
  if(runtime.execution?.[gate.id]!==gate.requiredState)throw new Error('runtime live gate mismatch: '+gate.id);
}
const headers=JSON.parse(fs.readFileSync(path.join(repo,'exchange/web/security-headers.json'),'utf8'));
const csp=headers['Content-Security-Policy']??'';
for(const marker of ["default-src 'self'","script-src 'self'","object-src 'none'","frame-ancestors 'none'","base-uri 'none'"])if(!csp.includes(marker))throw new Error('CSP missing '+marker);
if(csp.includes("'unsafe-eval'"))throw new Error('CSP must not allow unsafe-eval');
for(const file of [
 'exchange/shared/http-security.mjs',
 'exchange/scripts/package-pretestnet.mjs',
 'exchange/ops/test/security.test.mjs',
 'exchange/ops/test/operations.test.mjs',
 'docs/420EXCHANGE-PRE-11-OPERATIONS-RUNBOOK.md'
])if(!fs.existsSync(path.join(repo,file)))throw new Error('PRE-11 missing '+file);
for(const [file,markers] of Object.entries({
 'exchange/web/test/executable-quote-intake.test.js':['endpoint','replay'],
 'exchange/web/test/pre06-guarded-swap-orchestrator.test.js':['stale','approval'],
 'exchange/web/test/pre09-bridge-lifecycle.test.js':['replay','wrong beneficiary'],
 'exchange/quote-service/test/authentication.test.js':['forged','replay'],
})){
 const text=fs.readFileSync(path.join(repo,file),'utf8').toLowerCase();
 for(const marker of markers)if(!text.includes(marker))throw new Error('PRE-11 retained threat coverage missing '+marker+' in '+file);
}
console.log('420Exchange PRE-11 static/security/readiness checks passed');
