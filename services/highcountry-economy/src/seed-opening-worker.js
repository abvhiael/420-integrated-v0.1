import {randomUUID} from 'node:crypto';
import {SettlementError} from './buds-ledger.js';
import {address,calldata} from './finalized-rpc.js';
import {seedOpeningState} from './seed-openings.js';
const fail=m=>{throw new SettlementError(m);};
export class SeedOpeningWorker {
 constructor({openings,signerRpc,operator,clock=()=>Date.now()}){if(!openings||typeof signerRpc?.request!=='function')fail('opening signer required');Object.assign(this,{openings,store:openings.store,identity:openings.identity,rpc:openings.reader.rpc,signerRpc,operator:address(operator),clock});}
 async tick(token,packId){
  await this.identity.requireTrustedIssuer(token,'seed-packs');const issuer=await this.identity.registeredPrincipal(token),lease=randomUUID(),now=this.clock();
  const claim=await this.store.transact(s=>{this.openings.packs.guard(s,token,issuer,true);seedOpeningState(s);const intent=s.seedOpenings.get(packId);if(!intent)fail('committed opening required');if(intent.status==='fulfilled')return {resolved:true};const job=s.seedOpeningJobs.get(packId)??{leaseUntil:0,attempts:{request:0,fulfill:0},hashes:{}};if(job.leaseUntil>now)return {busy:true};job.lease=lease;job.leaseUntil=now+60000;s.seedOpeningJobs.set(packId,job);return {intent:structuredClone(intent),job:structuredClone(job)};});
  if(claim.resolved)return {status:'fulfilled'};if(claim.busy)return {status:'leased'};
  const release=async()=>this.store.transact(s=>{const j=s.seedOpeningJobs.get(packId);if(j?.lease===lease)j.leaseUntil=0;});
  try{
   const evidence=await this.openings.reader.read(claim.intent);
   const state=await this.openings.apply(claim.intent,evidence,s=>this.openings.packs.guard(s,token,issuer,true));
   if(state.status==='fulfilled'){await release();return {status:'fulfilled',outcome:state.outcome};}
   if(evidence&&!evidence.routerReady){await release();return {status:'awaiting-original-proof',requestId:evidence.requestId};}
   const phase=evidence?'fulfill':'request',data=phase==='request'?claim.intent.calldata:calldata('fulfillOpening(bytes32)',claim.intent.openingKey),target=this.openings.reader.binding.contract;
   const oldHash=claim.job.hashes[phase];
   if(oldHash){
    const h=await this.rpc.header(),receipt=await this.rpc.request('eth_getTransactionReceipt',[oldHash]);
    if(!receipt||BigInt(receipt.blockNumber)>BigInt(h.number)){await release();return {status:'awaiting-finality',phase,txHash:oldHash};}
    const block=await this.rpc.request('eth_getBlockByNumber',[receipt.blockNumber,false]);
    if(receipt.transactionHash?.toLowerCase()!==oldHash.toLowerCase()||block?.hash?.toLowerCase()!==receipt.blockHash?.toLowerCase())fail('opening transaction receipt anchor mismatch');
    if(receipt.status!=='0x0')fail('successful opening submission missing canonical phase state');
    const tx=await this.rpc.request('eth_getTransactionByHash',[oldHash]);
    if(!tx||address(tx.from)!==this.operator||address(tx.to)!==target||tx.input!==data||BigInt(tx.value??'0x0')!==0n)fail('opening failed transaction binding mismatch');
    const last=await this.rpc.request('eth_getBlockByNumber',[h.number,false]);if(last?.hash!==h.hash)fail('opening failure proof reorg');
    await this.store.transact(s=>{this.openings.packs.guard(s,token,issuer,true);const j=s.seedOpeningJobs.get(packId);if(j.lease!==lease)fail('opening lease lost');j.failures??=[];j.failures.push({phase,txHash:oldHash,blockHash:receipt.blockHash});delete j.hashes[phase];});
   }
   await this.store.transact(s=>{this.openings.packs.guard(s,token,issuer,true);const j=s.seedOpeningJobs.get(packId),i=s.seedOpenings.get(packId);if(j.lease!==lease||j.leaseUntil<=this.clock()||i.commitment!==claim.intent.commitment)fail('opening dispatch changed');if(j.attempts[phase]>=50)fail('opening dispatch attempts exhausted');
    if(phase==='request'){const b=s.runtimeWallets?.get(i.owner);if(!s.runtimeAccounts?.has(i.owner)||b?.wallet!==i.wallet||b.profile!==i.ownerProfile||(s.runtimeEpochs?.get(i.owner)??0)!==i.ownerEpoch)fail('opening recipient authority changed');}j.attempts[phase]++;});
   if(phase==='request'&&await this.identity.rpc.playerProfile(this.identity.gameId,claim.intent.wallet)!==claim.intent.ownerProfile)fail('opening profile changed');
   if(Number(BigInt(await this.signerRpc.request('eth_chainId',[])))!==this.rpc.chainId)fail('opening signer wrong chain');
   const h=await this.rpc.header(),transaction={from:this.operator,to:target,data};await this.rpc.request('eth_call',[transaction,{blockHash:h.hash,requireCanonical:true}]);
   const txHash=await this.signerRpc.request('eth_sendTransaction',[transaction]);if(typeof txHash!=='string'||!/^0x[0-9a-f]{64}$/i.test(txHash))fail('invalid opening submission');
   await this.store.transact(s=>{this.openings.packs.guard(s,token,issuer,true);const j=s.seedOpeningJobs.get(packId);if(j.lease===lease)j.hashes[phase]=txHash;});await release();return {status:'submitted',phase,txHash};
  }catch(e){await release();throw e;}
 }
}
