export class LongSoakError extends Error { constructor(code){super(code);this.code=code;} }
const deny=c=>{throw new LongSoakError(c)};
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_.:/-]{8,256}$/.test(x);
export const SCENARIOS=Object.freeze(['sustainedIngestion','rateLimitRecovery','workerRestart','schedulerFailover','indexerReorg','indexerRebuild','sourceCorrections','attesterRevocation','walletReconciliation','fundingConservation','emergencyPause','incidentRecovery','telemetryCoverage']);
export function validateSoakEvidence(e) {
 if(!e||e.schemaVersion!=='420-cmp-9-14-soak-v1'||!ref(e.releaseSha)||!ref(e.deploymentManifest)||!ref(e.chainId)||!Number.isSafeInteger(e.startedAt)||!Number.isSafeInteger(e.endedAt)||e.endedAt<=e.startedAt)deny('RUN_METADATA');
 if(!Array.isArray(e.scenarios)||e.scenarios.length!==SCENARIOS.length||new Set(e.scenarios.map(x=>x?.name)).size!==SCENARIOS.length)deny('SCENARIO_INVENTORY');
 const rows=SCENARIOS.map(name=>e.scenarios.find(x=>x.name===name));
 for(const row of rows)if(!row||!['PASS','FAIL','BLOCKED','PENDING'].includes(row.status)||row.status==='PASS'&&!ref(row.evidenceRef))deny('SCENARIO_EVIDENCE');
 const duration=e.endedAt-e.startedAt;
 const authenticated=e.environment==='FUNDED_LIVE_TESTNET'&&e.provenanceValidated===true&&e.cmp913LiveQualified===true&&e.finalizedReceiptsValidated===true&&e.fundingConservationValidated===true&&ref(e.operatorSignoff)&&ref(e.independentReview)&&e.operatorSignoff!==e.independentReview;
 const min=24*60*60*1000;
 const missing=rows.filter(x=>x.status!=='PASS').map(x=>x.name);
 const go=authenticated&&duration>=min&&missing.length===0;
 return Object.freeze({schemaVersion:'420-cmp-9-14-assessment-v1',releaseSha:e.releaseSha,chainId:e.chainId,decision:go?'GO':'NO_GO',qualified:!!go,durationMs:duration,minimumDurationMs:min,missing,provenanceVerified:!!authenticated});
}
export function offlineNoGo(){return Object.freeze({decision:'NO_GO',qualified:false,reason:'ACTUAL_FUNDED_TESTNET_SOAK_AND_INDEPENDENT_REVIEW_REQUIRED'});}
