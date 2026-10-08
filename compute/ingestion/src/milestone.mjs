export class MilestoneError extends Error {constructor(code){super(code);this.code=code;}}
const deny=c=>{throw new MilestoneError(c)};
const H=/^0x[0-9a-fA-F]{64}$/;
const good=x=>typeof x==='string'&&x.length>3&&x.length<256;
const verifyLane=(lane,chainId)=>{
 if(!lane||!good(lane.provider)||!good(lane.projectId)||!good(lane.sourceIdentity)||!good(lane.participantBinding)||!good(lane.providerPermissionRef)||!good(lane.workUnitReceipt)||!good(lane.evidenceVerifier)||!good(lane.attesterIdentity))deny('PROVIDER_PROOF_MISSING');
 if(lane.chainId!==chainId||lane.providerIdentityApproved!==true||lane.participantControlProven!==true||lane.sourceWorkAccepted!==true||lane.attestationVerified!==true||lane.claimConsumedExactlyOnce!==true||lane.payoutFinalized!==true||lane.walletReconciled!==true||lane.indexerReconciled!==true||lane.computeUiReconciled!==true)deny('LIVE_CHAIN_NOT_QUALIFIED');
 for(const name of ['sourceReceiptDigest','attestationTx','consumeTx','rewardTx','fundingTx','payoutTx'])if(!H.test(lane[name]))deny('LIVE_RECEIPT_MISSING');
 if(!Number.isSafeInteger(lane.amountUnits)||lane.amountUnits<=0||lane.paidUnits!==lane.amountUnits)deny('PAYOUT_MISMATCH');
 if(!good(lane.deploymentManifest)||!good(lane.sourceEvidenceArchive)||lane.finalizedBlock<=0)deny('DEPLOYMENT_EVIDENCE_MISSING');
 return true;
};
export function verifyS09Milestone(m){
 if(!m||m.schemaVersion!=='420-cmp-s09-live-milestone-v1'||m.environment!=='FUNDED_PUBLIC_TESTNET'||!good(m.releaseSha)||!good(m.chainId)||m.governanceApproved!==true||m.actualVaultFundingVerified!==true||!good(m.governanceDecisionRef)||!good(m.treasuryFundingRef)||!good(m.operatorSignoff)||!good(m.independentReviewer)||m.operatorSignoff===m.independentReviewer)deny('MILESTONE_NOT_AUTHORIZED');
 if(!Array.isArray(m.lanes)||m.lanes.length!==2)deny('TWO_PROVIDERS_REQUIRED');
 const providers=m.lanes.map(x=>x?.provider);if(providers[0]===providers[1]||!providers.includes('FOLDING_AT_HOME')||!providers.includes('BOINC'))deny('TWO_PROVIDERS_REQUIRED');
 for(const lane of m.lanes)verifyLane(lane,m.chainId);
 for(const key of ['wrongUser','duplicateWork','staleRescoring','sourceOutage','failedSettlement','rollbackRecovery','maliciousAttester','fundingExhaustion','reorgRecovery'])if(m.adversarial?.[key]!=='PASS')deny('ADVERSARIAL_MISSING');
 if(!good(m.actualSourceValidationReport)||!good(m.exactReleaseWorkflowRun)||!good(m.indexerReadbackRef)||!good(m.walletReadbackRef)||!good(m.computeReadbackRef))deny('INDEPENDENT_RECONCILIATION_MISSING');
 return {qualified:true,releaseSha:m.releaseSha,chainId:m.chainId,providerCount:2,liveMilestone:true};
}
