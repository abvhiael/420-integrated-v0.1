export class SecurityQualificationError extends Error {constructor(code){super(code);this.code=code}}
const deny=code=>{throw new SecurityQualificationError(code)};
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_.:/-]{8,256}$/.test(x);
const sha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
export const CAMPAIGNS=Object.freeze(['externalContractAudit','workerSandboxAudit','maliciousWorkload','maliciousWorkerVerifierScheduler','collusion','sybilWorkers','fraudulentBenchmarksHardware','duplicateStolenReplayedResults','rewardFarming','denialOfService','datasetPoisoning','supplyChain','sandboxContainerEscape','keyCompromise','economicInsolvency','stakeSlashAbuse']);
export function assessCmp10(report){
 if(!report||report.schemaVersion!=='420-cmp-10-security-v1'||!sha(report.releaseSha)||!ref(report.chainId)||!ref(report.deploymentManifest))deny('INVALID_RELEASE');
 if(!Array.isArray(report.campaigns)||report.campaigns.length!==CAMPAIGNS.length||new Set(report.campaigns.map(c=>c?.name)).size!==CAMPAIGNS.length||CAMPAIGNS.some(name=>!report.campaigns.some(x=>x.name===name)))deny('INCOMPLETE_INVENTORY');
 for(const c of report.campaigns){if(!CAMPAIGNS.includes(c.name)||!['PASS','FAIL','BLOCKED','PENDING'].includes(c.status)||c.status==='PASS'&&(!ref(c.evidenceRef)||!ref(c.independentReviewer)))deny('INVALID_CAMPAIGN_EVIDENCE')}
 const blocked=report.campaigns.filter(c=>c.status!=='PASS').map(c=>c.name);
 const prereqs=report.environment==='INCENTIVIZED_PUBLIC_TESTNET'&&report.cmp0OperationalQualified===true&&report.realWorkloadsExecuted===true&&report.liveReceiptsAuthenticated===true&&report.vulnerabilityRemediationRequalified===true&&report.externalAuditIndependentlyVerified===true&&report.workerSandboxAuditIndependentlyVerified===true&&report.noOpenCriticalOrHighFindings===true&&ref(report.operatorSignoff)&&ref(report.independentReviewer)&&report.operatorSignoff!==report.independentReviewer;
 const go=prereqs&&blocked.length===0;
 return Object.freeze({schemaVersion:'420-cmp-10-security-decision-v1',releaseSha:report.releaseSha,chainId:report.chainId,decision:go?'GO':'NO_GO',qualified:!!go,blocked,authenticatedLivePrerequisites:!!prereqs,mainnetAuthorized:false});
}
export function blockedCmp10({releaseSha,chainId,deploymentManifest}){return assessCmp10({schemaVersion:'420-cmp-10-security-v1',releaseSha,chainId,deploymentManifest,environment:'OFFLINE_FIXTURE',campaigns:CAMPAIGNS.map(name=>({name,status:'BLOCKED'}))})}
