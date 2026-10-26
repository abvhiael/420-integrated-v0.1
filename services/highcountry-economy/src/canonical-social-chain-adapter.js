import {SettlementError} from './buds-ledger.js';
import {address,calldata,words} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
const fail=m=>{throw new SettlementError(m);};
const hash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
const bytes=x=>typeof x==='string'&&/^0x([0-9a-fA-F]{2})+$/.test(x);
const b32=x=>{if(!hash(x)||BigInt(x)===0n)fail('bytes32 identifier required');return x.toLowerCase();};
const any32=x=>{if(!hash(x))fail('bytes32 field required');return x.toLowerCase();};
const nonnegative=x=>{const n=BigInt(x);if(n<0n)fail('negative unsigned argument');return n;};
const uint=(x,bits)=>{const n=nonnegative(x);if(n>=(1n<<BigInt(bits)))fail('unsigned argument overflow');return n;};
const bool=x=>{if(x===true||x==='true')return 1;if(x===false||x==='false')return 0;fail('boolean argument required');};
const enc=(sig,args)=>calldata(sig,...args);
export const SOC5A_ENABLED_ACTIONS=Object.freeze(['organization.create','organization.invite','organization.invitation.revoke','organization.join','organization.leave','organization.remove','organization.leader.propose','organization.leader.accept','organization.delegate','organization.delegate.revoke','cooperative.create','cooperative.enroll','cooperative.withdraw','cooperative.propose','cooperative.vote','cooperative.proposal.cancel','cooperative.execute']);
const ENABLED=new Set(SOC5A_ENABLED_ACTIONS);
export const SOC5A_ABI=Object.freeze({
 'organization.create':{contract:'organizations',sig:'create(bytes32,bytes32)',fields:['id','metadataHash'],check:'create'},
 'organization.invite':{contract:'organizations',sig:'invite(bytes32,address,bool)',fields:['organization','account'],extra:true,check:'admin'},
 'organization.invitation.revoke':{contract:'organizations',sig:'invite(bytes32,address,bool)',fields:['organization','account'],extra:false,check:'admin'},
 'organization.join':{contract:'organizations',sig:'join(bytes32)',fields:['organization'],check:'invited'},
 'organization.leave':{contract:'organizations',sig:'requestLeave(bytes32)',fields:['organization'],check:'member'},
 'organization.remove':{contract:'organizations',sig:'remove(bytes32,address)',fields:['organization','account'],check:'admin'},
 'organization.leader.propose':{contract:'organizations',sig:'proposeAdmin(bytes32,address)',fields:['organization','candidate'],check:'admin'},
 'organization.leader.accept':{contract:'organizations',sig:'acceptAdmin(bytes32)',fields:['organization'],check:'successor'},
 'organization.delegate':{contract:'authority',sig:'delegate(bytes32,address,bytes32,bytes32,uint64,uint64,uint32)',fields:['organization','delegate','action','scope','starts','expires','maxUses'],check:'delegate'},
 'organization.delegate.revoke':{contract:'authority',sig:'revoke(bytes32)',fields:['grantId'],check:'revoke'},
 'cooperative.create':{contract:'cooperatives',sig:'create(bytes32,bytes32)',fields:['id','organization'],check:'admin'},
 'cooperative.enroll':{contract:'cooperatives',sig:'enroll(bytes32)',fields:['cooperative'],check:'orgMember'},
 'cooperative.withdraw':{contract:'cooperatives',sig:'withdraw(bytes32)',fields:['cooperative'],check:'enrolled'},
 'cooperative.propose':{contract:'governance',sig:'propose(bytes32,bytes32,bytes32,bytes32)',fields:['cooperative','action','scope','value'],check:'proposer'},
 'cooperative.vote':{contract:'governance',sig:'vote(bytes32,bool)',fields:['proposal'],extra:'support',check:'voter'},
 'cooperative.proposal.cancel':{contract:'governance',sig:'cancel(bytes32)',fields:['proposal'],check:'proposer'},
 'cooperative.execute':{contract:'executor',sig:'execute(bytes32)',fields:['proposal'],check:'executable'}
});
const TABLE=SOC5A_ABI;
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
  if(organizationEmergencyDomain.toLowerCase()!==keccak256(Buffer.from('HC.EMERGENCY.ORGANIZATION_GOVERNANCE'))||cooperativeEmergencyDomain.toLowerCase()!==keccak256(Buffer.from('HC.EMERGENCY.COOPERATIVE_GOVERNANCE')))fail('incorrect canonical emergency domain binding');
  for(const key of ['organizations','cooperatives','governance','executor','authority'])
   if(!rpc.contracts[key]?.codeHash||address(rpc.contracts[key].address)!==address(contracts[key]))fail('unpinned social contract');
  Object.assign(this,{rpc,contracts,scope,emergencyDomain,organizationEmergencyDomain,cooperativeEmergencyDomain,verifySignedEnvelope});
 }
 async read(name,sig,...args){return words((await this.rpc.call(name,enc(sig,args))).result);}
 async parameters(op,payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('canonical arguments missing');
  return op.fields.map(k=>{
   if(k==='account'||k==='candidate'||k==='delegate')return address(payload[k]);
   if(k==='starts'||k==='expires')return uint(payload[k],64);
   if(k==='maxUses')return uint(payload[k],32);
   if(k==='metadataHash'||k==='value')return any32(payload[k]);
   if(k==='action'||k==='scope'||k==='organization'||k==='cooperative'||k==='id'||k==='proposal'||k==='grantId')return b32(payload[k]);
   fail('unsupported ABI field');
  }).concat(op.extra===true?[1]:op.extra===false?[0]:op.extra==='support'?[bool(payload.support)]:[]);
 }
 async permission({wallet,action,payload}){
  wallet=address(wallet);const op=TABLE[action];if(!op||!ENABLED.has(action))return {allowed:false};
  try{
   const params=await this.parameters(op,payload);
   const restricted=!['organization.leave','organization.remove','organization.delegate.revoke','cooperative.withdraw','cooperative.proposal.cancel'].includes(action);
   if(restricted){
    if(!await this.rpc.unrestricted(this.emergencyDomain))return {allowed:false};
    const domain=op.contract==='organizations'||op.contract==='authority'?this.organizationEmergencyDomain:this.cooperativeEmergencyDomain;
    if(BigInt('0x'+(await this.read(op.contract,'r04DomainOpen(bytes32)',domain))[0])!==1n)return {allowed:false};
   }
   const nowHeader=await this.rpc.header();
   const block=await this.rpc.request('eth_getBlockByNumber',[nowHeader.number,false]);
   if(block?.hash?.toLowerCase()!==nowHeader.hash.toLowerCase()||!/^0x[0-9a-f]+$/i.test(block.timestamp))return {allowed:false};
   const now=BigInt(block.timestamp);
   const orgId=payload.organization??payload.id,coopId=payload.cooperative;
   const orgInfo=async id=>this.read('organizations','organizations(bytes32)',id);
   const activeOrg=async id=>{const o=await orgInfo(id);return {admin:address('0x'+o[0].slice(24)),active:BigInt('0x'+o[1])===1n};};
   const member=async(id,wallet_)=>this.read('organizations','members(bytes32,address)',id,wallet_);
   const activeMember=async(id,wallet_)=>BigInt('0x'+(await this.read('organizations','isActiveMember(bytes32,address)',id,wallet_))[0])===1n;
   const coop=async id=>this.read('cooperatives','cooperatives(bytes32)',id);
   const enrolled=async(id,wallet_)=>BigInt('0x'+(await this.read('cooperatives','enrolled(bytes32,address)',id,wallet_))[0])===1n;
   const proposal=async id=>this.read('governance','proposals(bytes32)',id);
   const eqAddress=(w,a)=>address('0x'+w.slice(24))===address(a);
   const trueWord=w=>BigInt('0x'+w)===1n;
   let allowed=false;
   switch(action){
    case 'organization.create':{const o=await orgInfo(params[0]);allowed=BigInt('0x'+o[0])===0n;break;}
    case 'organization.invite':
    case 'organization.invitation.revoke':{const o=await activeOrg(orgId);allowed=o.active&&o.admin===wallet&&address(payload.account)!==wallet;break;}
    case 'organization.join':{
     const o=await activeOrg(orgId),inv=await this.read('organizations','invitations(bytes32,address)',orgId,wallet);
     const expiry=await this.read('organizations','invitationExpiry(bytes32,address)',orgId,wallet);
     const m=await member(orgId,wallet);
     allowed=o.active&&trueWord(inv[0])&&BigInt('0x'+expiry[0])>now&&BigInt('0x'+m[0])!==1n&&BigInt('0x'+m[3])===0n;break;
    }
    case 'organization.leave':{const o=await activeOrg(orgId);allowed=o.admin!==wallet&&await activeMember(orgId,wallet);break;}
    case 'organization.remove':{
     const o=await activeOrg(orgId),m=await member(orgId,address(payload.account));
     allowed=o.admin===wallet&&address(payload.account)!==wallet&&[1n,2n].includes(BigInt('0x'+m[0]));break;
    }
    case 'organization.leader.propose':{
     const o=await activeOrg(orgId),m=await member(orgId,address(payload.candidate));
     allowed=o.active&&o.admin===wallet&&address(payload.candidate)!==wallet&&BigInt('0x'+m[0])===1n&&BigInt('0x'+m[3])===0n;break;
    }
    case 'organization.leader.accept':{
     const o=await activeOrg(orgId),next=await this.read('organizations','proposedAdministrator(bytes32)',orgId);
     const deadline=await this.read('organizations','leadershipDeadline(bytes32)',orgId);
     const candidate=await member(orgId,wallet),old=await member(orgId,o.admin);
     allowed=o.active&&eqAddress(next[0],wallet)&&BigInt('0x'+deadline[0])>now&&BigInt('0x'+candidate[0])===1n&&BigInt('0x'+candidate[3])===0n&&BigInt('0x'+old[3])===0n;break;
    }
    case 'organization.delegate':{
     const o=await activeOrg(orgId),valid=await activeMember(orgId,address(payload.delegate));
     const names=['CULTIVATION_ACTION','ROSTER_ACTION','NOTICES_ACTION'];
     const actions=await Promise.all(names.map(k=>this.read('authority',k+'()')));
     allowed=o.active&&o.admin===wallet&&address(payload.delegate)!==wallet&&valid&&actions.some(v=>v[0].toLowerCase()===b32(payload.action).slice(2))&&BigInt(params[6])>0n&&BigInt(params[5])>BigInt(params[4])&&BigInt(params[5])>now;break;
    }
    case 'organization.delegate.revoke':{
     const d=await this.read('authority','delegations(bytes32)',params[0]);
     const o=await activeOrg('0x'+d[0]);
     allowed=BigInt('0x'+d[2])!==0n&&!trueWord(d[8])&&[o.admin,address('0x'+d[1].slice(24)),address('0x'+d[2].slice(24))].includes(wallet);break;
    }
    case 'cooperative.create':{
     const o=await activeOrg(payload.organization),current=await coop(payload.id);
     allowed=o.active&&o.admin===wallet&&!trueWord(current[4]);break;
    }
    case 'cooperative.enroll':{
     const info=await coop(coopId);const org='0x'+info[0];
     const roll=await this.read('cooperatives','voterCount(bytes32)',coopId);
     allowed=trueWord(info[4])&&await activeMember(org,wallet)&&!await enrolled(coopId,wallet)&&BigInt('0x'+roll[0])<64n;break;
    }
    case 'cooperative.withdraw':{const info=await coop(coopId);allowed=trueWord(info[4])&&await enrolled(coopId,wallet);break;}
    case 'cooperative.propose':{
     const info=await coop(coopId),org='0x'+info[0],actionVal=await this.read('governance','ACTION_SET_POLICY()');
     const count=await this.read('cooperatives','voterCount(bytes32)',coopId);
     const length=Number(BigInt('0x'+count[0]));let eligible=0;
     if(length>64)return {allowed:false};
     for(let i=0;i<length;i++){
      const voterWord=await this.read('cooperatives','voterAt(bytes32,uint256)',coopId,i);
      const voter=address('0x'+voterWord[0].slice(24));
      if(await enrolled(coopId,voter)&&await activeMember(org,voter))eligible++;
     }
     allowed=trueWord(info[4])&&BigInt('0x'+info[2])===1n&&await enrolled(coopId,wallet)&&await activeMember(org,wallet)&&actionVal[0].toLowerCase()===params[1].slice(2)&&eligible>=2;break;
    }
    case 'cooperative.vote':{
     const p=await proposal(params[0]),info=await coop('0x'+p[0]);
     const snapshot=await this.read('governance','voterSnapshot(bytes32,address)',params[0],wallet);
     const voted=await this.read('governance','voted(bytes32,address)',params[0],wallet);
     allowed=BigInt('0x'+p[5])>now&&!trueWord(p[11])&&!trueWord(p[12])&&!trueWord(voted[0])&&trueWord(snapshot[0])&&await enrolled('0x'+p[0],wallet)&&await activeMember('0x'+info[0],wallet);break;
    }
    case 'cooperative.proposal.cancel':{
     const p=await proposal(params[0]);
     allowed=eqAddress(p[1],wallet)&&BigInt('0x'+p[5])>now&&!trueWord(p[11])&&!trueWord(p[12]);break;
    }
    case 'cooperative.execute':{
     const ok=await this.read('governance','executable(bytes32)',params[0]);allowed=trueWord(ok[0]);break;
    }
   }
   if(!allowed)return {allowed:false};
   return {allowed:true,blockHash:nowHeader.hash,policyHash:keccak256(Buffer.from(JSON.stringify([wallet,action,params.map(String),this.rpc.chainId,this.scope,this.contracts[op.contract]])))};
  }catch{return {allowed:false};}
 }
 async transactionIntent({wallet,action,payload}){
  const op=TABLE[action];if(!op||!ENABLED.has(action))fail('unapproved social operation');
  const params=await this.parameters(op,payload);
  return {from:address(wallet),to:address(this.contracts[op.contract]),data:enc(op.sig,params),chainId:this.rpc.chainId,value:'0x0'};
 }
 async prepareSigned({wallet,action,payload}){
  const op=TABLE[action];if(!op||!ENABLED.has(action))fail('unapproved social operation');
  const raw=payload?.signedRawTransaction;
  if(!bytes(raw))fail('wallet signed raw transaction required');
  const params=await this.parameters(op,payload);
  const expected=enc(op.sig,params).toLowerCase();
  const verified=await this.verifySignedEnvelope(raw);
  if(!verified||address(verified.from)!==address(wallet)||address(verified.to)!==address(this.contracts[op.contract])||verified.input?.toLowerCase()!==expected||verified.chainId!==this.rpc.chainId||BigInt(verified.value)!==0n||!Number.isSafeInteger(verified.nonce)||verified.nonce<0)fail('prebroadcast signed intent mismatch');
  return {hash:keccak256(Buffer.from(raw.slice(2),'hex')).toLowerCase(),verified,op,expected};
 }
 async submitSigned({wallet,action,payload}){
  const raw=payload?.signedRawTransaction;
  const {hash:preparedHash,verified,op,expected}=await this.prepareSigned({wallet,action,payload});
  const txHash=await this.rpc.request('eth_sendRawTransaction',[raw]);
  if(!hash(txHash)||txHash.toLowerCase()!==preparedHash)fail('signed transaction hash mismatch');
  const tx=await this.rpc.request('eth_getTransactionByHash',[txHash]);
  if(!tx||tx.hash?.toLowerCase()!==txHash.toLowerCase()||address(tx.from)!==address(wallet)||address(tx.to)!==address(this.contracts[op.contract])
   ||tx.input?.toLowerCase()!==expected||Number(BigInt(tx.chainId))!==this.rpc.chainId||BigInt(tx.value)!==0n||BigInt(tx.nonce)!==BigInt(verified.nonce))fail('signed social transaction intent mismatch');
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
 async history(ctx){if(!this.eventIndexer)fail('canonical social event indexer is not provisioned');return this.eventIndexer.history(ctx);}
 async indexFinalized(ctx){if(!this.eventIndexer)fail('canonical social event indexer is not provisioned');return this.eventIndexer.indexFinalized(ctx);}
}
