// R05.7: pinned, independently witnessed canonical RPC; never trust adapter 'finalized' flags.
// This reads only known contracts at a single finalized hash. No wallet keys or writes.
import {createHash} from 'node:crypto';
import {FinalizedRpc,calldata,words,address} from '../../highcountry-economy/src/finalized-rpc.js';
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
   typeof independentWitness!=='function')deny('r057-config-invalid');
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
  if(r.length<9||E(r[0])!==attestationId||E(r[2])!==profileId||E(r[1])!==this.#game||
   !B(r.at(-1))||B(r.at(-2)))deny('r057-attestation-mismatch');
  const active=await this.#call(a,'crossGame','isActive(bytes32)',[attestationId]);
  if(active.length!==1||!B(active[0]))deny('r057-attestation-inactive');
  return Object.freeze({accepted:true,kind:'ATTESTATION',chainId:this.#chain,blockHash:a.hash,
   evidenceDigest:D({id:attestationId,profileId,blockHash:a.hash,r,active})});
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
 async reward({name,signature,args,expectedWords}={}){
  if(!['mission','progression','harvest'].includes(name)||typeof signature!=='string'||
   !Array.isArray(args)||!Array.isArray(expectedWords)||!expectedWords.length||
   !expectedWords.every(H))deny('r057-reward-request-invalid');
  return this.#read({kind:'REWARD',name,signature,args,verify:r=>
   r.length===expectedWords.length&&r.every((word,i)=>E(word)===expectedWords[i])});
 }
}
export function createR057CanonicalVerifier420({url,chainId,gameId,contracts,independentWitness,fetchImpl}={}){
 const rpc=new FinalizedRpc({url,chainId:Number(chainId),contracts,fetchImpl});
 return new CanonicalGamingFinality420({rpc,chainId,gameId,contracts,independentWitness});
}
