export class CloseoutError extends Error {constructor(code){super(code);this.code=code}}
const deny=code=>{throw new CloseoutError(code)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.:/-]{8,256}$/.test(x);
const sha=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
export const CMP0_GATES=Object.freeze(['genesisAndAddressAuthority','canonicalSolidityContracts','testnetDeploymentManifest','realWorkerRegistration','realFundedJob','schedulerMatching','isolatedExecution','independentVerification','authorizedRewardAndVault','finalizedBeneficiaryPayout','refundAndDispute','stakeAndSlash','replicatedWorkerVerification','scientificDemonstrationCmp913','longDurationSoakCmp914','indexerReorgRecovery','walletAndComputeReadback','authorizationAndPrivacy','operationsAndIncidentResponse']);
export function assessCmp0Closeout(m){
 if(!m||m.schemaVersion!=='420-cmp-9-15-cmp0-v1'||!sha(m.releaseSha)||!id(m.chainId)||!id(m.deploymentManifest))deny('INVALID_RELEASE');
 if(!Array.isArray(m.gates)||m.gates.length!==CMP0_GATES.length||new Set(m.gates.map(g=>g?.name)).size!==CMP0_GATES.length||CMP0_GATES.some(name=>!m.gates.some(g=>g?.name===name)))deny('INVENTORY');
 for(const gate of m.gates)if(!gate||!CMP0_GATES.includes(gate.name)||!['PASS','FAIL','BLOCKED','PENDING'].includes(gate.status)||gate.status==='PASS'&&!id(gate.evidenceRef))deny('INVALID_EVIDENCE');
 const blocked=m.gates.filter(g=>g.status!=='PASS').map(g=>g.name);
 const live=m.environment==='FUNDED_LIVE_TESTNET'&&m.provenanceAuthenticated===true&&m.liveReceiptsVerified===true&&m.cmp913Qualified===true&&m.cmp914Qualified===true&&m.addressesValidated===true&&m.conservationVerified===true&&m.noOutstandingCriticalFindings===true;
 const independentlyReviewed=id(m.operatorSignoff)&&id(m.independentReviewer)&&m.operatorSignoff!==m.independentReviewer;
 const go=live&&independentlyReviewed&&blocked.length===0;
 return Object.freeze({schemaVersion:'420-cmp-9-15-cmp0-decision-v1',releaseSha:m.releaseSha,chainId:m.chainId,decision:go?'GO':'NO_GO',qualified:!!go,missing:blocked,liveEvidenceValidated:!!live,independentReviewComplete:!!independentlyReviewed,productionClaimsAuthorized:false});
}
export function defaultCmp0NoGo({releaseSha,chainId,deploymentManifest}){
 return assessCmp0Closeout({schemaVersion:'420-cmp-9-15-cmp0-v1',releaseSha,chainId,deploymentManifest,environment:'OFFLINE_FIXTURE',gates:CMP0_GATES.map(name=>({name,status:'BLOCKED'}))});
}
