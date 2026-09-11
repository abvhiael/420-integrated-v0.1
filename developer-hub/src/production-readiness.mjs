const STATUS=new Set(['PASS','FAIL','BLOCKED']);
export class ProductionReadinessError420 extends Error{constructor(message){super(message);this.name='ProductionReadinessError420';}}
function assert420(condition,message){if(!condition)throw new ProductionReadinessError420(message);}
function plain420(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function bool420(value,name){assert420(typeof value==='boolean',`${name} must be boolean`);return value;}
function status420(value,name){assert420(STATUS.has(value),`${name} must be PASS, FAIL or BLOCKED`);return value;}
export function createProductionReadiness420({qualification,ciHandoff,releaseReadiness}){
  assert420(plain420(qualification),'DEVHUB-18 qualification report is required');
  assert420(qualification.canonicalAuthority===false,'qualification must remain noncanonical');
  assert420(qualification.securityCertification===false,'qualification must not claim security certification');
  assert420(plain420(ciHandoff),'DEVHUB-18 CI handoff is required');
  assert420(ciHandoff.canonicalAuthority===false,'CI handoff must remain noncanonical');
  assert420(plain420(releaseReadiness),'release readiness evidence is required');
  const checks=[];
  checks.push({id:'devhub18-qualification',status:qualification.result==='PASS'&&qualification.qualifiedForDeveloperRelease===true?'PASS':qualification.result==='FAIL'?'FAIL':'BLOCKED',detail:`DEVHUB-18 result=${qualification.result??'unknown'}`});
  checks.push({id:'exact-head-ci-handoff',status:ciHandoff.releaseEvidenceReady===true?'PASS':'BLOCKED',detail:`candidate=${ciHandoff.commitSha??'unknown'}`});
  const releaseChecks=Array.isArray(releaseReadiness.checks)?releaseReadiness.checks:[];
  assert420(releaseChecks.length>0,'release readiness checks are required');
  for(const item of releaseChecks){assert420(plain420(item),'release readiness check is invalid');status420(item.status,`release check ${item.name??'unknown'}`);}
  const explicitFail=releaseChecks.some(item=>item.status==='FAIL');
  const explicitBlocked=releaseChecks.some(item=>item.status==='BLOCKED');
  const releaseReady=bool420(releaseReadiness.public_testnet_ready,'public_testnet_ready');
  checks.push({id:'core-release-readiness',status:explicitFail?'FAIL':releaseReady&&!explicitBlocked?'PASS':'BLOCKED',detail:`public_testnet_ready=${releaseReady}`});
  const result=checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status!=='PASS')?'BLOCKED':'READY';
  return Object.freeze({schemaVersion:'1.0.0',result,readyForProductionLaunch:result==='READY',publicTestnetReady:releaseReady,canonicalAuthority:false,securityCertification:false,checks:Object.freeze(checks),securityRule:'DEVHUB-19 consumes qualification and release evidence; it cannot manufacture production readiness, protocol authority, audit status, finality, governance approval, Registry legitimacy, or Wallet capability'});
}
export function createProductionReadinessView420(){return Object.freeze({title:'production launch readiness',canonicalAuthority:false,securityCertification:false,requiredInputs:Object.freeze(['DEVHUB-18 qualification report','DEVHUB-18 exact-head CI handoff','release/readiness.json']),states:Object.freeze(['READY','BLOCKED','FAIL']),securityRule:'production readiness is evidence-driven and fail-closed; tooling presence alone never makes a release ready'});}
