export class ScientificDemonstrationError extends Error {constructor(code){super(code);this.code=code;}}
const deny=code=>{throw new ScientificDemonstrationError(code)};
const ref=x=>typeof x==='string'&&/^[A-Za-z0-9_:./-]{8,256}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
const required=['fundedJob','scheduledWorker','isolatedExecution','acceptedResult','independentVerification','fundedSettlement','walletReadback','indexerReadback','computeUiReadback','reorgRecovery','privacyReview'];
export function checkScientificDemonstration(d){
 if(!d||d.schemaVersion!=='420-cmp-9-13-scientific-demonstration-v1'||d.environment!=='LIVE_FUNDED_TESTNET'||!hash(d.releaseCommitment)||!ref(d.releaseSha)||!ref(d.deploymentManifest)||!ref(d.chainId)||!ref(d.operatorSignoff)||!ref(d.independentReviewer)||d.operatorSignoff===d.independentReviewer)deny('LIVE_RELEASE_NOT_QUALIFIED');
 if(!d.generalPurposeComputeRetained||!d.realScientificWorkload||!d.privacyApproved||!d.governanceApproved||!d.actualFundingVerified)deny('SCIENTIFIC_PREREQUISITES');
 if(!Array.isArray(d.events)||d.events.length!==required.length)deny('MISSING_EVENT');
 const seen=new Set();
 for(const event of d.events){
  if(!required.includes(event?.kind)||seen.has(event.kind)||event.chainId!==d.chainId||event.finalized!==true||!hash(event.txHash)||!Number.isSafeInteger(event.blockNumber)||event.blockNumber<=0||!ref(event.independentlyVerifiedEvidenceRef))deny('INVALID_EVENT');
  seen.add(event.kind);
 }
 if(required.some(k=>!seen.has(k)))deny('MISSING_EVENT');
 if(!d.workload?.providerApproved||!ref(d.workload.project)||!ref(d.workload.workUnitReceipt)||!ref(d.workload.resultAcceptanceProof)||!ref(d.workload.workerExecutionReceipt)||!ref(d.workload.verifierReceipt))deny('SCIENTIFIC_SOURCE_MISSING');
 if(!d.funding?.canonicalVault||!d.funding?.conservationVerified||!ref(d.funding.fundedAmountUnits)||!ref(d.funding.paidAmountUnits)||d.funding.fundedAmountUnits!==d.funding.paidAmountUnits)deny('FUNDING_NOT_RECONCILED');
 for(const k of ['wrongUser','doubleClaim','expiredEvidence','maliciousWorker','maliciousVerifier','failedFunding','rollbackReorg','unsafeWorkload'])if(d.adversarial?.[k]!=='PASS')deny('ADVERSARIAL_MISSING');
 return Object.freeze({qualified:true,kind:'CMP-9.13',chainId:d.chainId,releaseSha:d.releaseSha,liveEvidenceRequired:true});
}
export function preliminaryDemonstrationStatus(){return Object.freeze({qualified:false,decision:'NO_GO',reason:'LIVE_FUNDED_TESTNET_AND_INDEPENDENT_RECEIPTS_REQUIRED'});}
