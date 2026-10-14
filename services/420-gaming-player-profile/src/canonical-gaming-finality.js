// R05.7: pinned, independently witnessed canonical RPC; never trust adapter 'finalized' flags.
// This reads only known contracts at a single finalized hash. No wallet keys or writes.
import {createHash} from 'node:crypto';
import {createIndependentFinalityWitness420} from './independent-finality-witness.js';
import {FinalizedRpc,calldata,words} from '../../highcountry-economy/src/finalized-rpc.js';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const H=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&x!=='0x'+'0'.repeat(64);
const A=x=>typeof x==='string'&&/^0x[0-9a-f]{40}$/.test(x)&&x!=='0x'+'0'.repeat(40);
const U=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**64n;
const N=x=>BigInt('0x'+x);
const B=x=>N(x)===1n;
const E=x=>'0x'+x;
const D=x=>'0x'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
export class CanonicalGamingFinality420 {
 #rpc;#chain;#game;#contracts;#witness;
 constructor({rpc,chainId,gameId,contracts,independentWitness}={}){
  if(typeof rpc?.request!=='function'||typeof rpc?.call!=='function'||!U(chainId)||chainId==='0'||
   !H(gameId)||!contracts||!['games','identity','entitlements','crossGame','claims','bridge','migration'].every(k=>A(contracts[k]?.address)&&H(contracts[k]?.codeHash))||
   typeof independentWitness!=='function'||
   new Set(Object.values(contracts).map(c=>c.address)).size!==Object.values(contracts).length)
   deny('r057-config-invalid');
  this.#rpc=rpc;this.#chain=chainId;this.#game=gameId;
  this.#contracts=Object.freeze(structuredClone(contracts));this.#witness=independentWitness;
 }
 async #anchor(){
  if(String(BigInt(await this.#rpc.request('eth_chainId',[])))!==this.#chain)deny('r057-chain-mismatch');
  const block=await this.#rpc.request('eth_getBlockByNumber',['finalized',false]);
  if(!H(block?.hash)||typeof block?.number!=='string'||!/^0x(0|[1-9a-f][0-9a-f]*)$/.test(block.number))
   deny('r057-finalized-head-invalid');
  const verified=await this.#witness(Object.freeze({chainId:this.#chain,blockHash:block.hash,
   blockNumber:String(BigInt(block.number))}));
  if(verified!==true)deny('r057-independent-witness-missing');
  return Object.freeze({hash:block.hash,number:block.number,tag:{blockHash:block.hash,requireCanonical:true}});
 }
 async #call(anchor,name,signature,args=[]){
  const spec=this.#contracts[name];
  if(!spec)deny('r057-unapproved-contract');
  const code=await this.#rpc.request('eth_getCode',[spec.address,anchor.tag]);
  if(!/^0x([0-9a-f]{2})+$/.test(code??''))deny('r057-code-unavailable');
  // Reuse exact Ethereum Keccak implementation, never SHA3 or a mutable provider label.
  const {keccak256}=await import('../../highcountry-economy/src/keccak.js');
  if(keccak256(Buffer.from(code.slice(2),'hex'))!==spec.codeHash)deny('r057-codehash-mismatch');
  const result=await this.#rpc.request('eth_call',[{to:spec.address,data:calldata(signature,...args)},anchor.tag]);
  const check=await this.#rpc.request('eth_getBlockByNumber',[anchor.number,false]);
  if(check?.hash!==anchor.hash)deny('r057-finalized-anchor-reorg');
  return words(result);
 }
 async #read({kind,name,signature,args,verify}){
  const a=await this.#anchor();
  const row=await this.#call(a,name,signature,args);
  if(verify(row)!==true)deny('r057-canonical-state-mismatch');
  return Object.freeze({accepted:true,kind,chainId:this.#chain,gameId:this.#game,
   blockHash:a.hash,blockNumber:String(BigInt(a.number)),evidenceDigest:D({kind,chainId:this.#chain,
    gameId:this.#game,blockHash:a.hash,contract:this.#contracts[name].address,args,row})});
 }
 async claim({claimId,targetWallet,guestStateCommitment,payloadHash}={}){
  if(!H(claimId)||!A(targetWallet)||!H(guestStateCommitment)||!H(payloadHash))deny('r057-claim-invalid');
  return this.#read({kind:'CLAIM',name:'claims',signature:'claim(bytes32)',args:[claimId],
   verify:r=>r.length===9&&E(r[0])===claimId&&E(r[1])===this.#game&&
    '0x'+r[2].slice(24)===targetWallet&&E(r[3])===guestStateCommitment&&
    E(r[4])===payloadHash&&B(r[6])&&!B(r[7])&&B(r[8])});
 }
 async ownership({wallet,profileId}={}){
  if(!A(wallet)||!H(profileId))deny('r057-owner-invalid');
  return this.#read({kind:'OWNERSHIP',name:'identity',signature:'profileIdOf(bytes32,address)',
   args:[this.#game,wallet],verify:r=>r.length===1&&E(r[0])===profileId});
 }
 async entitlement({entitlementId,profileId,entitlementType,contentId}={}){
  if(![entitlementId,profileId,entitlementType,contentId].every(H))deny('r057-entitlement-invalid');
  const a=await this.#anchor();
  const r=await this.#call(a,'entitlements','entitlement(bytes32)',[entitlementId]);
  // Entitlement tuple: id, profileId, gameId, type, content, validFrom, validUntil, revoked, exists.
  if(r.length!==9||E(r[0])!==entitlementId||E(r[1])!==profileId||E(r[2])!==this.#game||
   E(r[3])!==entitlementType||E(r[4])!==contentId||B(r[7])||!B(r[8]))deny('r057-entitlement-mismatch');
  const active=await this.#call(a,'entitlements','isActive(bytes32)',[entitlementId]);
  if(active.length!==1||!B(active[0]))deny('r057-entitlement-inactive');
  return Object.freeze({accepted:true,kind:'ENTITLEMENT',chainId:this.#chain,blockHash:a.hash,
   evidenceDigest:D({id:entitlementId,profileId,blockHash:a.hash,r,active})});
 }
 async attestation({attestationId,profileId}={}){
  if(!H(attestationId)||!H(profileId))deny('r057-attestation-invalid');
  const a=await this.#anchor();
  const r=await this.#call(a,'crossGame','attestation(bytes32)',[attestationId]);
  // Strictly require a real matching record and independently confirmed active state.
  if(r.length!==9||E(r[0])!==attestationId||E(r[2])!==profileId||E(r[1])!==this.#game||
   !B(r.at(-1))||B(r.at(-2)))deny('r057-attestation-mismatch');
  const active=await this.#call(a,'crossGame','isActive(bytes32)',[attestationId]);
  if(active.length!==1||!B(active[0]))deny('r057-attestation-inactive');
  return Object.freeze({accepted:true,kind:'ATTESTATION',chainId:this.#chain,blockHash:a.hash,
   evidenceDigest:D({id:attestationId,profileId,blockHash:a.hash,r,active})});
 }
 async migrationBinding({claimId,targetWallet,growerId,guestStateCommitment,payloadHash}={}){
  if(!H(claimId)||!A(targetWallet)||!U(growerId)||growerId==='0'||
    !H(guestStateCommitment)||!H(payloadHash))deny('r057-migration-invalid');
  const a=await this.#anchor();
  const claim=await this.#call(a,'claims','claim(bytes32)',[claimId]);
  if(claim.length!==9||E(claim[0])!==claimId||E(claim[1])!==this.#game||
    '0x'+claim[2].slice(24)!==targetWallet||E(claim[3])!==guestStateCommitment||
    E(claim[4])!==payloadHash||!B(claim[6])||B(claim[7])||!B(claim[8]))
    deny('r057-migration-claim-mismatch');
  const bound=await this.#call(a,'bridge','growerProfileIdOfMigrationClaim(bytes32)',[claimId]);
  if(bound.length!==1||N(bound[0])!==BigInt(growerId))deny('r057-migration-unbound');
  const ready=await this.#call(a,'migration','isReadyToApply(bytes32,uint64,bytes32,bytes32)',
   [claimId,growerId,guestStateCommitment,payloadHash]);
  if(ready.length!==1||!B(ready[0]))deny('r057-migration-unready');
  const profile=await this.#call(a,'identity','profileIdOf(bytes32,address)',[this.#game,targetWallet]);
  if(profile.length!==1||N(profile[0])===0n)deny('r057-migration-no-owner');
  return Object.freeze({accepted:true,chainId:this.#chain,claimId,targetWallet,growerId,
   payloadHash,gameId:this.#game,blockHash:a.hash,blockNumber:String(BigInt(a.number)),
   evidenceDigest:D({claimId,targetWallet,growerId,payloadHash,guestStateCommitment,profile,
    blockHash:a.hash,claim,bound,ready})});
 }
 async migrationTransaction({txHash,claimId,growerId,guestStateCommitment,payloadHash}={}){
  if(!H(txHash)||!H(claimId)||!U(growerId)||growerId==='0'||
   !H(guestStateCommitment)||!H(payloadHash))deny('r057-transaction-invalid');
  const a=await this.#anchor();
  const receipt=await this.#rpc.request('eth_getTransactionReceipt',[txHash]);
  if(!receipt||receipt.transactionHash!==txHash||receipt.status!=='0x1'||
    !H(receipt.blockHash)||!/^0x(0|[1-9a-f][0-9a-f]*)$/.test(receipt.blockNumber??'')||
    BigInt(receipt.blockNumber)>BigInt(a.number)||!Array.isArray(receipt.logs))
    deny('r057-transaction-unfinalized');
  const block=await this.#rpc.request('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(block?.hash!==receipt.blockHash)deny('r057-transaction-reorg');
  if(await this.#witness({chainId:this.#chain,blockHash:receipt.blockHash,
   blockNumber:String(BigInt(receipt.blockNumber))})!==true)deny('r057-receipt-witness-denied');
  const {keccak256}=await import('../../highcountry-economy/src/keccak.js');
  const topic=keccak256(Buffer.from('MigrationApplied(bytes32,uint64,bytes32,bytes32)'));
  const matched=receipt.logs.filter(log=>log?.address===this.#contracts.migration.address&&
   Array.isArray(log.topics)&&log.topics.length===3&&log.topics[0]===topic&&
   log.topics[1]===claimId&&BigInt(log.topics[2])===BigInt(growerId)&&
   log.data==='0x'+guestStateCommitment.slice(2)+payloadHash.slice(2));
  if(matched.length!==1)deny('r057-migration-receipt-log-invalid');
  const confirmed=await this.receipt({claimId,growerId,guestStateCommitment,payloadHash});
  if(!confirmed.accepted)deny('r057-transaction-state-mismatch');
  return Object.freeze({accepted:true,state:'FINALIZED',txHash,blockHash:receipt.blockHash,
   receiptDigest:D({txHash,blockHash:receipt.blockHash,claimId,growerId,
    guestStateCommitment,payloadHash}),evidenceDigest:confirmed.evidenceDigest});
 }
 async receipt({claimId,growerId,guestStateCommitment,payloadHash}={}){
  if(!H(claimId)||!U(growerId)||growerId==='0'||!H(guestStateCommitment)||!H(payloadHash))
   deny('r057-receipt-invalid');
  const a=await this.#anchor(),r=await this.#call(a,'migration','appliedMigration(bytes32)',[claimId]);
  if(r.length!==5||N(r[0])!==BigInt(growerId)||E(r[1])!==guestStateCommitment||
   E(r[2])!==payloadHash||N(r[3])===0n||!B(r[4]))deny('r057-receipt-unfinalized');
  return Object.freeze({accepted:true,kind:'MIGRATION_APPLIED',chainId:this.#chain,
   blockHash:a.hash,evidenceDigest:D({claimId,growerId,guestStateCommitment,payloadHash,blockHash:a.hash,r})});
 }
 async missionReward({wallet,missionId,amount}={}){
  if(!A(wallet)||!H(missionId)||!U(String(amount)))deny('r057-reward-invalid');
  const anchor=await this.#anchor();
  const p=await this.#call(anchor,'identity','profileIdOf(bytes32,address)',[this.#game,wallet]);
  if(p.length!==1||N(p[0])===0n)deny('r057-reward-owner-missing');
  const m=await this.#call(anchor,'mission','mission(address,bytes32)',[wallet,missionId]);
  if(m.length!==9||N(m[0])!==3n||N(m[4])===0n||N(m[8])!==BigInt(amount))
   deny('r057-mission-unqualified');
  return Object.freeze({accepted:true,kind:'MISSION_REWARD',blockHash:anchor.hash,
   chainId:this.#chain,evidenceDigest:D({wallet,missionId,amount,m,profile:p,blockHash:anchor.hash})});
 }
 async progressionReward({wallet,trackId,amount}={}){
  if(!A(wallet)||!H(trackId)||!U(String(amount)))deny('r057-reward-invalid');
  const a=await this.#anchor();
  const p=await this.#call(a,'identity','profileIdOf(bytes32,address)',[this.#game,wallet]);
  if(p.length!==1||N(p[0])===0n)deny('r057-reward-owner-missing');
  const progress=await this.#call(a,'progression','progress(address,bytes32)',[wallet,trackId]);
  const track=await this.#call(a,'progression','track(bytes32)',[trackId]);
  if(progress.length!==2||track.length!==6||N(progress[1])!==1n||
   N(track[4])!==BigInt(amount))deny('r057-progression-unqualified');
  return Object.freeze({accepted:true,kind:'PROGRESSION_REWARD',blockHash:a.hash,
   chainId:this.#chain,evidenceDigest:D({wallet,trackId,amount,progress,track,profile:p,blockHash:a.hash})});
 }

}
export function createR057CanonicalVerifier420({url,independentUrl,chainId,gameId,contracts,fetchImpl}={}){
 if(typeof url!=='string'||typeof independentUrl!=='string'||url===independentUrl||
  !/^https:\/\//.test(url)||!/^https:\/\//.test(independentUrl))
  deny('r057-independent-endpoint-required');
 const rpc=new FinalizedRpc({url,chainId:Number(chainId),contracts,fetchImpl});
 const independentWitness=createIndependentFinalityWitness420({url:independentUrl,
  chainId:Number(chainId),fetchImpl});
 return new CanonicalGamingFinality420({rpc,chainId,gameId,contracts,independentWitness});
}
