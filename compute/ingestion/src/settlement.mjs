export class SettlementError extends Error{constructor(code){super(code);this.code=code}}
const reject=c=>{throw new SettlementError(c)};
const hex=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const amt=v=>typeof v==='string'&&/^[1-9][0-9]{0,35}$/.test(v);
const addr=v=>typeof v==='string'&&/^0x[0-9a-fA-F]{40}$/.test(v);
const stages=['SOURCE_VERIFIED','CANONICAL_ATTESTED','CLAIM_CONSUMED','REWARD_ACCOUNTED','VAULT_FUNDED','SETTLED_FINALIZED'];
export function inspectSettlement({chainId,source,attestation,guard,reward,funding,transfer,policyApproved=false,treasuryApproved=false}){
 if(typeof chainId!=='string'||!/^[0-9]+$/.test(chainId))reject('CHAIN');
 if(policyApproved!==true||treasuryApproved!==true)reject('GOVERNANCE_PENDING');
 const all=[source,attestation,guard,reward,funding,transfer];
 for(const [i,x] of all.entries()){
  if(!x||x.chainId!==chainId||x.finalized!==true||!hex(x.txHash)||!Number.isSafeInteger(x.blockNumber)||x.blockNumber<=0)reject('UNFINALIZED_'+stages[i]);
 }
 if(source.providerApproved!==true||source.ownershipVerified!==true||source.revoked||!hex(source.canonicalWorkCommitment))reject('SOURCE_UNVERIFIED');
 const work=source.canonicalWorkCommitment;
 if(attestation.canonicalWorkCommitment!==work||attestation.trusted!==true||attestation.revoked===true||attestation.expired===true||!hex(attestation.attestationId))reject('ATTESTATION');
 if(guard.canonicalWorkCommitment!==work||guard.consumed!==true||!hex(guard.claimKey)||guard.authorizedConsumer!==true)reject('GUARD');
 if(reward.canonicalWorkCommitment!==work||!hex(reward.rewardId)||!addr(reward.beneficiary)||!amt(reward.amountUnits)||reward.policyApproved!==true)reject('ACCOUNTING');
 if(funding.vaultId!==reward.vaultId||!hex(funding.vaultId)||!amt(funding.fundedUnits)||BigInt(funding.fundedUnits)<BigInt(reward.amountUnits)||funding.canonicalVault===false)reject('UNFUNDED');
 if(transfer.rewardId!==reward.rewardId||transfer.beneficiary?.toLowerCase()!==reward.beneficiary.toLowerCase()||transfer.amountUnits!==reward.amountUnits||transfer.vaultId!==reward.vaultId||transfer.success!==true)reject('SETTLEMENT');
 const receiptIds=new Set(all.map(x=>x.txHash));if(receiptIds.size!==all.length)reject('REUSED_TRANSACTION');
 return Object.freeze({schemaVersion:'420-cmp-s08-settlement-evidence-v1',chainId,canonicalWorkCommitment:work,attestationId:attestation.attestationId,claimKey:guard.claimKey,rewardId:reward.rewardId,beneficiary:reward.beneficiary.toLowerCase(),amountUnits:reward.amountUnits,fullyReconciled:true,proofType:'EXTERNAL_DEPLOYMENT_RECEIPTS_REQUIRED',stages:stages.map((stage,i)=>({stage,txHash:all[i].txHash,blockNumber:all[i].blockNumber})),authoritative:false,canInitiateTransfer:false});
}
export function planSettlement({policyApproved=false,treasuryApproved=false}={}){
 if(policyApproved!==true||treasuryApproved!==true)reject('GOVERNANCE_PENDING');
 reject('LIVE_CHAIN_EVIDENCE_REQUIRED');
}
