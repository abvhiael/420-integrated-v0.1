// R05.7 adapters for retained R05.4/R05.3 migration coordinator.
// Indexed/optimistic adapter results are NEVER accepted as independent proof.
const deny=x=>{throw Object.assign(new Error(x),{code:x});};
const H=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const U=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)>0n&&BigInt(x)<2n**64n;
const claim=x=>'0x'+BigInt(x).toString(16).padStart(64,'0');
export function createR057MigrationFinalityHooks420({canonical,chainId,registry}={}){
 if(typeof canonical?.migrationBinding!=='function'||typeof canonical?.migrationTransaction!=='function'||
  !U(chainId)||typeof registry!=='string'||!/^0x[0-9a-f]{40}$/.test(registry))
  deny('r057-hooks-config');
 const canonicalFinality=async({key,source,observed}={})=>{
  if(!key||!source||!observed||!U(key.claimId)||source.claimId!==key.claimId||
   source.chainId!==chainId||source.registry!==registry||
   source.targetWallet!==observed.targetWallet||source.payloadHash!==observed.payloadHash||
   source.targetGrower!==observed.growerId||
   observed.canonicalFinality!=='UNVERIFIED')deny('r057-hook-source-mismatch');
  const proof=await canonical.migrationBinding({claimId:claim(key.claimId),
   targetWallet:source.targetWallet,growerId:source.targetGrower,
   guestStateCommitment:source.guestStateCommitment,payloadHash:source.payloadHash});
  if(proof?.accepted!==true||proof.chainId!==chainId||!H(proof.blockHash)||
   !H(proof.evidenceDigest)||proof.claimId!==claim(key.claimId)||
   proof.targetWallet!==source.targetWallet||proof.growerId!==source.targetGrower||
   proof.payloadHash!==source.payloadHash)deny('r057-hook-proof-invalid');
  return Object.freeze({accepted:true,chainId,registry,claimId:key.claimId,
   targetWallet:source.targetWallet,payloadHash:source.payloadHash,
   growerId:source.targetGrower,blockHash:proof.blockHash,
   evidenceDigest:proof.evidenceDigest});
 };
 const receiptFinality=async({expected,observed}={})=>{
  if(!expected||!observed||observed.status!=='APPLIED_UNFINALIZED'||
   !U(String(expected.claim_id))||!U(String(expected.target_grower))||
   !H(expected.payload_hash)||!H(expected.source_commitment))
    deny('r057-receipt-source-invalid');
  // Without a submitted transaction the receipt cannot be bound to its chain log.
  // Do not infer finality from a state flag or a possibly unfinalized eth_call.
  if(!H(expected.receipt_tx))return Object.freeze({state:'RETRY'});
  const proof=await canonical.migrationTransaction({txHash:expected.receipt_tx,
   claimId:claim(String(expected.claim_id)),growerId:String(expected.target_grower),
   guestStateCommitment:expected.source_commitment,payloadHash:expected.payload_hash});
  if(proof?.accepted!==true||proof.state!=='FINALIZED'||proof.txHash!==expected.receipt_tx||
   !H(proof.blockHash)||!H(proof.receiptDigest))deny('r057-receipt-unverified');
  return Object.freeze({state:'FINALIZED',txHash:proof.txHash,
   blockHash:proof.blockHash,receiptDigest:proof.receiptDigest});
 };
 return Object.freeze({canonicalFinality,receiptFinality});
}
