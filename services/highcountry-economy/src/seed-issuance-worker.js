import {randomUUID} from 'node:crypto';
import {keccak256} from './keccak.js';
import {SettlementError} from './buds-ledger.js';
import {address} from './finalized-rpc.js';
import {seedPackState} from './seed-packs.js';
const MARKET_DOMAIN=keccak256(Buffer.from('HC.EMERGENCY.MARKET'));
const fail=m=>{throw new SettlementError(m);};
// Immutable uint64 lot IDs make post-broadcast/pre-record crashes safe: registry rejects duplicates.
export class SeedIssuanceWorker {
 constructor({packs,reader,rpc,signerRpc,operator,clock=()=>Date.now()}){
  if(!packs||typeof reader?.issuance!=='function'||typeof rpc?.header!=='function'||typeof rpc?.unrestricted!=='function'||typeof signerRpc?.request!=='function')fail('seed issuance deployment required');
  Object.assign(this,{packs,store:packs.store,identity:packs.identity,reader,rpc,signerRpc,operator:address(operator),clock});
 }
 async tick(token,packId){
  await this.identity.requireTrustedIssuer(token,'seed-packs');const issuer=await this.identity.registeredPrincipal(token),now=this.clock(),leaseToken=randomUUID();
  const claim=await this.store.transact(s=>{
   this.packs.guard(s,token,issuer,true);seedPackState(s);s.seedIssuanceJobs??=new Map();
   const intent=s.seedLotIntents.get(packId);if(!intent)fail('prepared seed intent required');
   if(intent.status==='issued')return {resolved:true};
   const job=s.seedIssuanceJobs.get(packId)??{attempts:0,leaseUntil:0,txHash:null};
   if(job.leaseUntil>now)return {busy:true};
   job.leaseToken=leaseToken;job.leaseUntil=now+60000;s.seedIssuanceJobs.set(packId,job);return {intent:structuredClone(intent),job:structuredClone(job)};
  });
  if(claim.resolved)return {status:'issued'};if(claim.busy)return {status:'leased'};
  const release=async txHash=>this.store.transact(s=>{const job=s.seedIssuanceJobs.get(packId);if(job?.leaseToken===leaseToken){job.leaseUntil=0;if(txHash)job.txHash=txHash;}});
  try{
   const evidence=await this.reader.issuance(claim.intent);
   if(evidence){
    await this.store.transact(s=>{this.packs.guard(s,token,issuer,true);const current=s.seedLotIntents.get(packId);if(current.metadataHash!==claim.intent.metadataHash)fail('seed intent changed');current.status='issued';current.evidence=evidence;current.issuedAt=this.clock();s.seedPacks.get(packId).status='opened';});
    await release();return {status:'issued',evidence};
   }
   if(claim.job.txHash){await release();return {status:'awaiting-finality',txHash:claim.job.txHash};}
   // Check session, recipient binding and immutable reservation again immediately before signing.
   await this.store.transact(s=>{
    this.packs.guard(s,token,issuer,true);const job=s.seedIssuanceJobs.get(packId);if(job.leaseToken!==leaseToken||job.leaseUntil<=this.clock())fail('seed dispatch lease lost');if(job.attempts>=50)fail('seed dispatch attempts exhausted');job.attempts++;const current=s.seedLotIntents.get(packId),account=s.runtimeAccounts?.get(current.owner),binding=s.runtimeWallets?.get(current.owner);
    if(!account||binding?.wallet!==current.wallet||binding.profile!==current.ownerProfile||binding.game!==this.identity.gameId||binding.chainId!==this.identity.chainId||(s.runtimeEpochs?.get(current.owner)??0)!==current.ownerEpoch||JSON.stringify(current)!==JSON.stringify(claim.intent))fail('seed recipient authority changed');
   });
   const i=claim.intent;
   if(i.openingEvidence){const opening=await this.store.transact(s=>structuredClone(s.seedOpenings?.get(packId)));if(!opening||!this.packs.openingVerifier)fail('canonical opening verifier required for seed dispatch');const proof=await this.packs.openingVerifier.read(opening);if(!proof?.fulfilled||proof.requestId!==i.openingEvidence.requestId||proof.entropy!==i.openingEvidence.entropy||proof.proofHash!==i.openingEvidence.proofHash)fail('seed opening proof no longer canonical');}
   if(await this.identity.rpc.playerProfile(this.identity.gameId,i.wallet)!==i.ownerProfile)fail('seed recipient profile changed');
   if(Number(BigInt(await this.signerRpc.request('eth_chainId',[])))!==this.rpc.chainId)fail('seed signer wrong chain');
   if(!await this.rpc.unrestricted(MARKET_DOMAIN))fail('seed issuance market restricted');
   const h=await this.rpc.header(),transaction={from:this.operator,to:address(this.rpc.contracts.seeds.address),data:i.calldata};
   // Canonical SeedRegistry enforces actual scoped register capabilities; the worker separately checks market emergency state.
   await this.rpc.request('eth_call',[transaction,{blockHash:h.hash,requireCanonical:true}]);
   const txHash=await this.signerRpc.request('eth_sendTransaction',[transaction]);
   if(typeof txHash!=='string'||!/^0x[0-9a-f]{64}$/i.test(txHash))fail('invalid seed submission');
   await release(txHash);return {status:'submitted',txHash};
  }catch(e){await release();throw e;}
 }
}
