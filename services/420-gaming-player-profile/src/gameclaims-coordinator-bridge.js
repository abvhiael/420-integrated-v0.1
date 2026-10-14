// R05.4 bridge: compose canonical GameClaims reads with R05.3's durable coordinator.
// A separate finality authority MUST certify a pinned canonical block before application.
// No indexer boolean or service-supplied "finalized" value is considered proof.
import { DurableMigrationCoordinator420 } from './migration-coordinator.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hex=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const addr=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&!/^0x0+$/.test(x);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**64n;
export function createR054MigrationCoordinator420({operatorPool,claims,sourceForMigration,canonicalFinality,receiptFinality}={}){
 if(!claims||typeof claims.verifyConsumedBound!=='function'||typeof claims.receiptState!=='function'||
  typeof sourceForMigration!=='function'||typeof canonicalFinality!=='function'||
  typeof receiptFinality!=='function')fail('r054-bridge-configuration');
 const verifyBoundClaim=async key=>{
  const source=await sourceForMigration(Object.freeze({...key}));
  if(!source||source.accountId!==key.accountId||source.gameId!==key.gameId||
   source.migrationId!==key.migrationId||source.claimId!==key.claimId||
   !uint(source.chainId)||!addr(source.registry)||!hex(source.sourceCommitment)||
   !hex(source.payloadHash)||!hex(source.guestStateCommitment)||
   !hex(source.evidenceDigest))fail('r054-source-invalid');
  const observed=await claims.verifyConsumedBound({
   claimId:key.claimId,targetWallet:source.targetWallet,growerId:source.targetGrower,
   guestStateCommitment:source.guestStateCommitment,payloadHash:source.payloadHash
  });
  if(observed.ready!==true||observed.canonicalFinality!=='UNVERIFIED'||
   observed.targetWallet!==source.targetWallet||observed.gameId!==key.gameId||
   observed.payloadHash!==source.payloadHash||observed.growerId!==source.targetGrower)
   fail('r054-chain-evidence-mismatch');
  // This independent verifier is a separately-owned R05.7 boundary. Fail closed until configured.
  const verified=await canonicalFinality(Object.freeze({key:{...key},source:{...source},observed:{...observed}}));
  if(verified?.accepted!==true||!hex(verified.blockHash)||!hex(verified.evidenceDigest)||
   verified.chainId!==source.chainId||verified.registry!==source.registry||
   verified.claimId!==key.claimId||verified.targetWallet!==source.targetWallet||
   verified.payloadHash!==source.payloadHash||verified.growerId!==source.targetGrower)
   fail('r054-finality-unverified');
  return {...source,evidenceDigest:verified.evidenceDigest};
 };
 const verifyReceipt=async ({accountId,gameId,migrationId,expected})=>{
  const state=await claims.receiptState({
   claimId:String(expected.claim_id),growerId:String(expected.target_grower),
   guestStateCommitment:expected.source_commitment,payloadHash:expected.payload_hash
  });
  if(state.status==='NOT_APPLIED')return {state:'PENDING',txHash:null,blockHash:null,receiptDigest:null};
  if(state.status!=='APPLIED_UNFINALIZED')fail('r054-unrecognized-receipt');
  const final=await receiptFinality(Object.freeze({accountId,gameId,migrationId,expected:{...expected},observed:{...state}}));
  if(!['FINALIZED','REORG','MISMATCH','RETRY'].includes(final?.state))fail('r054-invalid-finality');
  if(final.state==='RETRY')return {state:'RETRY',txHash:null,blockHash:null,receiptDigest:null};
  if(![final.txHash,final.blockHash,final.receiptDigest].every(hex))fail('r054-receipt-evidence-invalid');
  return {state:final.state,txHash:final.txHash,blockHash:final.blockHash,receiptDigest:final.receiptDigest};
 };
 return new DurableMigrationCoordinator420({operatorPool,verifyBoundClaim,verifyReceipt});
}
