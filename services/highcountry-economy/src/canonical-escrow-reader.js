// Concrete R04.8 reader against canonical CanonicalMarketEscrow state and finalized logs.
// Expects a trusted viem-compatible public client injected by the authenticated service.
// No chain writes, private keys, caller-supplied logs or speculative block confirmations.
import {SettlementError} from './buds-ledger.js';
const hex32=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
const addr=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{40}$/.test(x);
const canon=x=>typeof x==='string'?x.toLowerCase():x;
export const ESCROW_ABI=[
 {type:'function',name:'listing',stateMutability:'view',inputs:[{name:'id',type:'bytes32'}],
  outputs:[{name:'',type:'tuple',components:[
   {name:'owner',type:'address'},{name:'asset',type:'bytes32'},{name:'quantity',type:'uint256'},
   {name:'expiresAt',type:'uint64'},{name:'status',type:'uint8'}]}]},
 {type:'function',name:'transferOperation',stateMutability:'view',
  inputs:[{name:'id',type:'bytes32'},{name:'buyer',type:'address'}],
  outputs:[{name:'',type:'bytes32'}]},
 {type:'event',name:'EscrowListed',inputs:[
  {name:'listingId',type:'bytes32',indexed:true},{name:'owner',type:'address',indexed:true},
  {name:'asset',type:'bytes32',indexed:true},{name:'quantity',type:'uint256',indexed:false},
  {name:'expiresAt',type:'uint64',indexed:false}]},
 {type:'event',name:'EscrowSettled',inputs:[
  {name:'listingId',type:'bytes32',indexed:true},{name:'operationId',type:'bytes32',indexed:true},
  {name:'buyer',type:'address',indexed:true}]},
 {type:'event',name:'EscrowClosed',inputs:[
  {name:'listingId',type:'bytes32',indexed:true},{name:'status',type:'uint8',indexed:false}]}
];
export class CanonicalEscrowReader {
 constructor({client,escrow,chainId,issuer,fromBlock=0n}) {
  if(!addr(escrow)||!addr(issuer)||!Number.isSafeInteger(chainId)||chainId<=0||
     typeof client?.getChainId!=='function'||typeof client?.readContract!=='function'||
     typeof client?.getContractEvents!=='function'||typeof client?.getBlockNumber!=='function'||
     typeof fromBlock!=='bigint'||fromBlock<0n)throw new SettlementError('untrusted chain client');
  Object.assign(this,{client,escrow:canon(escrow),issuer:canon(issuer),chainId,fromBlock});
 }
 async _chain(){if(await this.client.getChainId()!==this.chainId)throw new SettlementError('wrong chain');}
 async _final(log,minConfirmations){
  if(!log||typeof log.blockNumber!=='bigint'||
     !Number.isSafeInteger(minConfirmations)||minConfirmations<1)return false;
  const tip=await this.client.getBlockNumber();
  return tip>=log.blockNumber+BigInt(minConfirmations-1);
 }
 async _logs(eventName,args) {
  await this._chain();
  return this.client.getContractEvents({address:this.escrow,abi:ESCROW_ABI,eventName,
   args,fromBlock:this.fromBlock});
 }
 async _listing(listingId) {
  await this._chain();
  const value=await this.client.readContract({address:this.escrow,abi:ESCROW_ABI,
   functionName:'listing',args:[listingId]});
  if(!value||!addr(value.owner)||!hex32(value.asset)||typeof value.quantity!=='bigint')
   throw new SettlementError('invalid canonical listing');
  return value;
 }
 async lockedEscrowReceipt(listingId,minConfirmations) {
  if(!hex32(listingId))return null;
  const logs=await this._logs('EscrowListed',{listingId});
  if(logs.length!==1||!await this._final(logs[0],minConfirmations))return null;
  const l=await this._listing(listingId);
  const ev=logs[0].args;
  if(Number(l.status)!==1||canon(l.owner)!==canon(ev.owner)||
     canon(l.asset)!==canon(ev.asset)||l.quantity!==ev.quantity||
     l.quantity<=0n||l.quantity>BigInt(Number.MAX_SAFE_INTEGER))return null;
  return {receiptId:listingId,chainId:this.chainId,registry:this.escrow,issuer:this.issuer,
   owner:canon(l.owner),asset:canon(l.asset),quantity:Number(l.quantity),
   finalized:true,locked:true,consumed:false};
 }
 async expectedTransferOperation(listingId,buyer) {
  if(!hex32(listingId)||!addr(buyer))throw new SettlementError('invalid transfer identities');
  await this._chain();
  const result=await this.client.readContract({address:this.escrow,abi:ESCROW_ABI,
   functionName:'transferOperation',args:[listingId,buyer]});
  if(!hex32(result))throw new SettlementError('invalid chain operation id');
  return canon(result);
 }
 async confirmedReservedTransfer(op,minConfirmations=1) {
  if(!hex32(op))return null;
  const logs=await this._logs('EscrowSettled',{operationId:op});
  if(logs.length!==1||!await this._final(logs[0],minConfirmations))return null;
  const e=logs[0].args,l=await this._listing(e.listingId);
  if(Number(l.status)!==2||!addr(e.buyer)||
     canon(await this.expectedTransferOperation(e.listingId,e.buyer))!==canon(op)||
     l.quantity<=0n||l.quantity>BigInt(Number.MAX_SAFE_INTEGER))return null;
  return {finalized:true,operationId:canon(op),sourceReceiptId:canon(e.listingId),
   from:canon(l.owner),to:canon(e.buyer),asset:canon(l.asset),quantity:Number(l.quantity)};
 }
 async confirmedListingClosure(listingId,minConfirmations=1) {
  if(!hex32(listingId))return false;
  const l=await this._listing(listingId);
  if(Number(l.status)!==3&&Number(l.status)!==4)return false;
  const logs=await this._logs('EscrowClosed',{listingId});
  return logs.length===1 && Number(logs[0].args.status)===Number(l.status)
   && await this._final(logs[0],minConfirmations);
 }
 async proveUnexecutedAndCancelled(op,listingId,buyer,minConfirmations=1) {
  if(!hex32(op)||!hex32(listingId)||!addr(buyer))return false;
  if(canon(await this.expectedTransferOperation(listingId,buyer))!==canon(op))return false;
  return this.confirmedListingClosure(listingId,minConfirmations);
 }
}
