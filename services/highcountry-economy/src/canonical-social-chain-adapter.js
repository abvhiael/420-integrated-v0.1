import {SettlementError} from './buds-ledger.js';
import {address,calldata,words} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
const fail=m=>{throw new SettlementError(m);};
const hash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
const bytes=x=>typeof x==='string'&&/^0x([0-9a-fA-F]{2})+$/.test(x);
const b32=x=>{if(!hash(x)||BigInt(x)===0n)fail('bytes32 identifier required');return x.toLowerCase();};
const enc=(sig,args)=>calldata(sig,...args);
export const SOC5A_ENABLED_ACTIONS=Object.freeze(['organization.create','organization.invite','organization.invitation.revoke','organization.join','organization.leave','organization.remove','organization.leader.propose','organization.leader.accept','cooperative.create','cooperative.enroll','cooperative.withdraw']);
const ENABLED=new Set(SOC5A_ENABLED_ACTIONS);
const TABLE=SOC5A_ABI;
export const SOC5A_ABI=Object.freeze({
 'organization.create':{contract:'organizations',sig:'create(bytes32,bytes32)',fields:['id','metadataHash'],check:'create'},
 'organization.invite':{contract:'organizations',sig:'invite(bytes32,address,bool)',fields:['organization','account'],extra:true,check:'admin'},
 'organization.invitation.revoke':{contract:'organizations',sig:'invite(bytes32,address,bool)',fields:['organization','account'],extra:false,check:'admin'},
 'organization.join':{contract:'organizations',sig:'join(bytes32)',fields:['organization'],check:'invited'},
 'organization.leave':{contract:'organizations',sig:'requestLeave(bytes32)',fields:['organization'],check:'member'},
 'organization.remove':{contract:'organizations',sig:'remove(bytes32,address)',fields:['organization','account'],check:'admin'},
 'organization.leader.propose':{contract:'organizations',sig:'proposeAdmin(bytes32,address)',fields:['organization','candidate'],check:'admin'},
 'organization.leader.accept':{contract:'organizations',sig:'acceptAdmin(bytes32)',fields:['organization'],check:'successor'},
 'cooperative.create':{contract:'cooperatives',sig:'create(bytes32,bytes32)',fields:['id','organization'],check:'admin'},
 'cooperative.enroll':{contract:'cooperatives',sig:'enroll(bytes32)',fields:['cooperative'],check:'orgMember'},
 'cooperative.withdraw':{contract:'cooperatives',sig:'withdraw(bytes32)',fields:['cooperative'],check:'enrolled'},
 'cooperative.propose':{contract:'governance',sig:'propose(bytes32,bytes32,bytes32,bytes32)',fields:['cooperative','action','scope','value'],check:'enrolled'},
 'cooperative.vote':{contract:'governance',sig:'vote(bytes32,bool)',fields:['proposal'],extra:'support',check:'voter'},
 'cooperative.proposal.cancel':{contract:'governance',sig:'cancel(bytes32)',fields:['proposal'],check:'proposer'},
 'cooperative.execute':{contract:'executor',sig:'execute(bytes32)',fields:['proposal'],check:'executable'}
});
// Recover the signer of the actual serialized Ethereum transaction locally.
// RPC eth_getTransactionByHash is NOT acceptable as pre-broadcast signature evidence.
export async function recoverSignedSocialEnvelope(raw){
 if(!bytes(raw))fail('wallet signed raw transaction required');
 const {parseTransaction,recoverTransactionAddress}=await import('viem');
 let parsed,from;
 try{parsed=parseTransaction(raw);from=await recoverTransactionAddress({serializedTransaction:raw});}
 catch{fail('invalid cryptographic transaction signature');}
 if(!parsed?.to||parsed.chainId===undefined||parsed.nonce===undefined||!from)fail('incomplete signed transaction');
 return {from,to:parsed.to,input:parsed.data??'0x',chainId:parsed.chainId,value:parsed.value??0n,nonce:parsed.nonce};
}
export class CanonicalSocialChainAdapter {
 constructor({rpc,contracts,scope,emergencyDomain,organizationEmergencyDomain,cooperativeEmergencyDomain,verifySignedEnvelope=recoverSignedSocialEnvelope}){
  if(typeof rpc?.request!=='function'||typeof rpc?.call!=='function'||!contracts||!hash(emergencyDomain)||!hash(organizationEmergencyDomain)||!hash(cooperativeEmergencyDomain)||typeof verifySignedEnvelope!=='function')fail('pinned social chain and signed envelope verifier required');
  for(const key of ['organizations','cooperatives','governance','executor'])
   if(!rpc.contracts[key]?.codeHash||address(rpc.contracts[key].address)!==address(contracts[key]))fail('unpinned social contract');
  Object.assign(this,{rpc,contracts,scope,emergencyDomain,organizationEmergencyDomain,cooperativeEmergencyDomain,verifySignedEnvelope});
 }
 async read(name,sig,...args){return words((await this.rpc.call(name,enc(sig,args))).result);}
 async permission({wallet,action,payload}){
  wallet=address(wallet);const op=TABLE[action];if(!op||!ENABLED.has(action))return {allowed:false};
  const params=op.fields.map(k=>k==='account'||k==='candidate'?address(payload[k]):b32(payload[k]));
  if(op.extra===true||op.extra===false)params.push(op.extra?1:0);
  if(op.extra==='support')params.push(payload.support===true||payload.support==='true'?1:0);
  let allowed=false;
  try{
   if(!await this.rpc.unrestricted(this.emergencyDomain))return {allowed:false};
   const domain=op.contract==='organizations'?this.organizationEmergencyDomain:this.cooperativeEmergencyDomain;
   if(BigInt('0x'+(await this.read(op.contract,'r04DomainOpen(bytes32)',domain))[0])!==1n)return {allowed:false};
   const id=payload.organization??payload.cooperative??payload.id;
   const org=id?b32(id):null;
   if(op.check==='create'){
    if(action==='organization.create')allowed=BigInt('0x'+(await this.read('organizations','organizations(bytes32)',params[0]))[0])===0n;
    else {const info=await this.read('organizations','organizations(bytes32)',params[1]);allowed=address('0x'+info[0].slice(24))===wallet&&BigInt('0x'+info[1])===1n&&BigInt('0x'+(await this.read('cooperatives','cooperatives(bytes32)',params[0]))[4])===0n;}
   }
   else if(op.check==='admin'){const info=await this.read('organizations','organizations(bytes32)',org);allowed=address('0x'+info[0].slice(24))===wallet&&BigInt('0x'+info[1])===1n;}
   else if(op.check==='invited'){const info=await this.read('organizations','invitations(bytes32,address)',org,wallet);const expiry=await this.read('organizations','invitationExpiry(bytes32,address)',org,wallet);const header=await this.rpc.header();const block=await this.rpc.request('eth_getBlockByNumber',[header.number,false]);allowed=BigInt('0x'+info[0])===1n&&BigInt('0x'+expiry[0])>BigInt(block.timestamp);}
   else if(op.check==='member'){allowed=BigInt('0x'+(await this.read('organizations','isActiveMember(bytes32,address)',org,wallet))[0])===1n;}
   else if(op.check==='successor'){const info=await this.read('organizations','proposedAdministrator(bytes32)',org);allowed=address('0x'+info[0].slice(24))===wallet;}
   else if(op.check==='orgMember'||op.check==='enrolled'){
    const coop=await this.read('cooperatives','cooperatives(bytes32)',org);const organization='0x'+coop[0];
    const member=await this.read('organizations','isActiveMember(bytes32,address)',organization,wallet);
    if(op.check==='orgMember')allowed=BigInt('0x'+member[0])===1n;
    else allowed=BigInt('0x'+member[0])===1n&&BigInt('0x'+(await this.read('cooperatives','enrolled(bytes32,address)',org,wallet))[0])===1n;
   }
   // Complex governance and delegation permissions require their own exact ABI and checks.
   // Never return an optimistic approval for unsupported cases.
  }catch{return {allowed:false};}
  if(!allowed)return {allowed:false};
  const header=await this.rpc.header();
  return {allowed:true,blockHash:header.hash,policyHash:keccak256(Buffer.from(JSON.stringify([wallet,action,params,header.hash])))};
 }
 async transactionIntent({wallet,action,payload}){
  const op=TABLE[action];if(!op||!ENABLED.has(action))fail('unapproved social operation');
  const params=op.fields.map(k=>k==='account'||k==='candidate'?address(payload[k]):b32(payload[k]));
  if(typeof op.extra==='boolean')params.push(op.extra?1:0);
  if(op.extra==='support')params.push(payload.support===true||payload.support==='true'?1:0);
  return {from:address(wallet),to:address(this.contracts[op.contract]),data:enc(op.sig,params),chainId:this.rpc.chainId,value:'0x0'};
 }
 async submitSigned({wallet,action,payload}){
  const op=TABLE[action];if(!op||!ENABLED.has(action))fail('unapproved social operation');
  const raw=payload?.signedRawTransaction;
  if(!bytes(raw))fail('wallet signed raw transaction required');
  const params=op.fields.map(k=>k==='account'||k==='candidate'?address(payload[k]):b32(payload[k]));
  if(typeof op.extra==='boolean')params.push(op.extra?1:0);
  if(op.extra==='support')params.push(payload.support===true||payload.support==='true'?1:0);
  const expected=enc(op.sig,params).toLowerCase();
  // Decode and authenticate the real player-signed envelope before any broadcast.
  // The verifier is a required local cryptographic implementation, never RPC self-attestation.
  const verified=await this.verifySignedEnvelope(raw);
  if(!verified||address(verified.from)!==address(wallet)||address(verified.to)!==address(this.contracts[op.contract])||verified.input?.toLowerCase()!==expected||verified.chainId!==this.rpc.chainId||BigInt(verified.value)!==0n||!Number.isSafeInteger(verified.nonce)||verified.nonce<0)fail('prebroadcast signed intent mismatch');
  const txHash=await this.rpc.request('eth_sendRawTransaction',[raw]);
  if(!hash(txHash))fail('canonical tx hash missing');
  const tx=await this.rpc.request('eth_getTransactionByHash',[txHash]);
  if(!tx||address(tx.from)!==address(wallet)||address(tx.to)!==address(this.contracts[op.contract])
   ||tx.input?.toLowerCase()!==expected||Number(BigInt(tx.chainId))!==this.rpc.chainId||BigInt(tx.value)!==0n)fail('signed social transaction intent mismatch');
  return {hash:txHash,signer:address(tx.from),chainId:this.rpc.chainId,isFundTransfer:false};
 }
 async finalizedReceipt({hash:txHash,wallet,action}){
  const receipt=await this.rpc.request('eth_getTransactionReceipt',[txHash]);
  const tx=await this.rpc.request('eth_getTransactionByHash',[txHash]);const op=TABLE[action];
  if(!receipt||!tx||!op)return null;
  const header=await this.rpc.header();
  const at=await this.rpc.request('eth_getBlockByNumber',[receipt.blockNumber,false]);
  const finalized=at?.hash?.toLowerCase()===receipt.blockHash?.toLowerCase()&&BigInt(receipt.blockNumber)<=BigInt(header.number);
  return {hash:txHash,signer:address(tx.from),action,finalized,success:receipt.status==='0x1',isFundTransfer:BigInt(tx.value)!==0n,
   blockHash:receipt.blockHash,blockNumber:receipt.blockNumber};
 }
 async verifyFinality(event){
  if(!hash(event?.blockHash)||!event?.blockNumber)return false;
  const h=await this.rpc.header();const b=await this.rpc.request('eth_getBlockByNumber',[event.blockNumber,false]);
  return b?.hash?.toLowerCase()===event.blockHash.toLowerCase()&&BigInt(event.blockNumber)<=BigInt(h.number);
 }
 async verifyTreasurySettlement(){return false;} // no treasury settlement from a permission event
 async snapshot(){fail('canonical indexed social snapshots are not provisioned');}
 async history(){fail('canonical social event indexer is not provisioned');}
}
