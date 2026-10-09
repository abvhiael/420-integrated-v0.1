export class SoakError extends Error {constructor(code){super(code);this.code=code;}}
const fail=x=>{throw new SoakError(x)};
export const REQUIRED=['ingestionContinuity','rateLimitBackoff','restartAndBackfill','sourceCorrection','indexerReorg','sourceKeyRotation','attesterRevocation','recoveryAndRestore','budgetExhaustion','emergencyPause','emergencyRollback','scientificDemonstration','computeOperationalSoak','cmp0Closeout','cmp10Security'];
const validRef=x=>typeof x==='string'&&/^[a-zA-Z0-9.:_/-]{8,256}$/.test(x);
export function assessS10({environment,releaseSha,chainId,checks=[],operator,reviewer,previousS09Qualified=false}={}){
 if(!['OFFLINE_FIXTURE','LIVE_TESTNET'].includes(environment)||!validRef(releaseSha)||!validRef(chainId))fail('INVALID_ENVIRONMENT');
 if(!Array.isArray(checks)||checks.length!==REQUIRED.length||new Set(checks.map(c=>c?.name)).size!==REQUIRED.length)fail('MISSING_CHECKS');
 const rows=REQUIRED.map(name=>{const x=checks.find(v=>v.name===name);if(!x||!['PASS','FAIL','PENDING','BLOCKED'].includes(x.status)||x.status==='PASS'&&!validRef(x.evidenceRef))fail('INVALID_CHECK');return {name,status:x.status,evidenceRef:x.evidenceRef??null};});
 const blocked=rows.filter(x=>x.status!=='PASS').map(x=>x.name);
 const isLive=environment==='LIVE_TESTNET';
 const signedOff=validRef(operator)&&validRef(reviewer)&&operator!==reviewer;
 const qualified=isLive&&previousS09Qualified===true&&blocked.length===0&&signedOff;
 return Object.freeze({schemaVersion:'420-cmp-s10-go-no-go-v1',releaseSha,chainId,environment,decision:qualified?'GO':'NO_GO',qualified,missing:blocked,previousS09Qualified:previousS09Qualified===true,independentReviewComplete:!!signedOff,simulationOnly:!isLive});
}
export function blockedS10(releaseSha,chainId){return assessS10({environment:'OFFLINE_FIXTURE',releaseSha,chainId,checks:REQUIRED.map(name=>({name,status:'BLOCKED'}))});}
