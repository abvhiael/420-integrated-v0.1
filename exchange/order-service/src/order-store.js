import {validatePublicationEnvelope} from './canonical.js';

export const PUBLICATION_STATES=Object.freeze(['signed','published','accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected']);
const TERMINAL=new Set(['filled','cancelled','expired','rejected']);
const exact=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();

export class OrderPublicationError extends Error{
  constructor(code,message,details={}){super(message);this.name='OrderPublicationError';this.code=code;this.details=Object.freeze({...details});}
}
const fail=(code,message,details={})=>{throw new OrderPublicationError(code,message,details);};
function provenance(record,now){
  return Object.freeze({schema:'420-exchange-order-status-provenance-v1',service:'420/service/exchange-orders/v1',orderHash:record.orderHash,revision:record.revision,observedAt:now});
}
function snapshot(record,now){
  return Object.freeze({...record,provenance:provenance(record,now)});
}

export function createOrderPublicationStore({chainId,settlementContract,signatureVerifier,withdrawalAuthorizer=null,clock=()=>Math.floor(Date.now()/1000)}={}){
  if(chainId===undefined||!/^0x[0-9a-fA-F]{40}$/.test(settlementContract??'')||typeof signatureVerifier!=='function'||typeof clock!=='function')fail('CONFIG_REQUIRED','chain, settlement contract, verifier and clock required');
  const orders=new Map();
  const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK_INVALID','valid service clock required');return n;};
  async function publish(envelope){
    const at=now();let validated;
    try{validated=validatePublicationEnvelope({...envelope,chainId,nowSeconds:at});}catch(error){fail('INVALID_PUBLICATION',error.message);}
    if(!exact(validated.domain.verifyingContract,settlementContract))fail('DOMAIN_MISMATCH','order domain verifying contract differs from configured settlement');
    let signer;
    try{signer=await signatureVerifier({digest:validated.digest,signature:validated.signature,order:validated.order,domain:validated.domain});}
    catch(error){fail('SIGNATURE_INVALID',String(error?.message??'signature verification failed'));}
    if(!exact(signer,validated.order.maker))fail('SIGNER_MISMATCH','recovered signer differs from maker');
    const existing=orders.get(validated.orderHash);
    if(existing)return Object.freeze({idempotent:true,record:snapshot(existing,at)});
    const record={
      schema:'420-exchange-order-status-v1',orderHash:validated.orderHash,digest:validated.digest,domain:validated.domain,order:validated.order,
      signature:validated.signature,state:'accepted',filledSellAmountRaw:'0',filledBuyAmountRaw:'0',remainingSellAmountRaw:validated.order.sellAmountRaw,
      revision:3,publishedAt:at,updatedAt:at,rejection:null,
      history:Object.freeze([
        Object.freeze({state:'signed',revision:1,observedAt:at}),
        Object.freeze({state:'published',revision:2,observedAt:at}),
        Object.freeze({state:'accepted',revision:3,observedAt:at}),
      ]),
    };
    orders.set(record.orderHash,record);
    return Object.freeze({idempotent:false,record:snapshot(record,at)});
  }
  async function withdraw(orderHash,{schema,maker,nonce,requestId}={}){
    const at=now(),record=orders.get(String(orderHash).toLowerCase());
    if(!record)fail('NOT_FOUND','order not found');
    if(schema!=='420-exchange-order-withdrawal-v1')fail('WITHDRAWAL_INVALID','unsupported withdrawal schema');
    if(!exact(maker,record.order.maker))fail('MAKER_MISMATCH','only the maker may withdraw an off-chain order');
    if(String(nonce)!==record.order.nonce)fail('NONCE_MISMATCH','withdrawal nonce differs from canonical order');
    if(typeof requestId!=='string'||requestId.length<8||requestId.length>128)fail('WITHDRAWAL_INVALID','bounded requestId required');
    if(typeof withdrawalAuthorizer!=='function')fail('WITHDRAWAL_AUTH_UNAVAILABLE','withdrawal authorization verifier unavailable');
    let authorized=false;
    try{authorized=await withdrawalAuthorizer({maker:record.order.maker,orderHash:record.orderHash,nonce:record.order.nonce,requestId});}
    catch(error){fail('WITHDRAWAL_AUTH_FAILED',String(error?.message??'withdrawal authorization failed'));}
    if(authorized!==true)fail('WITHDRAWAL_UNAUTHORIZED','maker withdrawal authorization rejected');
    if(record.state==='cancelled'&&record.cancellation?.mode==='OFFCHAIN_WITHDRAWAL')return Object.freeze({idempotent:true,record:snapshot(record,at)});
    if(TERMINAL.has(record.state))fail('WITHDRAWAL_NOT_ALLOWED',`cannot withdraw order in ${record.state} state`);
    record.state='cancelled';record.revision++;record.updatedAt=at;
    record.cancellation=Object.freeze({mode:'OFFCHAIN_WITHDRAWAL',requestId,observedAt:at});
    record.history=Object.freeze([...record.history,Object.freeze({state:'cancelled',revision:record.revision,observedAt:at,mode:'OFFCHAIN_WITHDRAWAL'})]);
    return Object.freeze({idempotent:false,record:snapshot(record,at)});
  }
  function status(orderHash){
    const at=now(),record=orders.get(String(orderHash).toLowerCase());
    if(!record)fail('NOT_FOUND','order not found');
    if(!TERMINAL.has(record.state)&&BigInt(record.order.expiry)<=BigInt(at)){
      record.state='expired';record.revision++;record.updatedAt=at;record.history=Object.freeze([...record.history,Object.freeze({state:'expired',revision:record.revision,observedAt:at})]);
    }
    return snapshot(record,at);
  }
  function applyProjection(orderHash,{filledSellAmountRaw,filledBuyAmountRaw,cancelPending=false,cancelled=false,rejectedReason=null}={}){
    const at=now(),record=orders.get(String(orderHash).toLowerCase());
    if(!record)fail('NOT_FOUND','order not found');
    if(TERMINAL.has(record.state)&&record.state!=='expired')return snapshot(record,at);
    if(rejectedReason){
      record.state='rejected';record.rejection=String(rejectedReason);record.revision++;record.updatedAt=at;record.history=Object.freeze([...record.history,Object.freeze({state:'rejected',revision:record.revision,observedAt:at})]);return snapshot(record,at);
    }
    let sell,buy;
    try{sell=BigInt(filledSellAmountRaw??record.filledSellAmountRaw);buy=BigInt(filledBuyAmountRaw??record.filledBuyAmountRaw);}catch{fail('INVALID_PROJECTION','fill amounts must be raw integers');}
    const total=BigInt(record.order.sellAmountRaw),minimum=BigInt(record.order.minBuyAmountRaw);
    if(sell<0n||sell>total||buy<0n)fail('INVALID_PROJECTION','fill amounts out of range');
    if(!record.order.allowPartial&&sell>0n&&sell<total)fail('PARTIAL_FILL_FORBIDDEN','projection violates signed partial-fill policy');
    if(sell<BigInt(record.filledSellAmountRaw)||buy<BigInt(record.filledBuyAmountRaw))fail('STALE_PROJECTION','fill projection regressed');
    if(sell>0n&&buy*total<minimum*sell)fail('CONFLICTING_FILL_DATA','fill economics violate signed minimum ratio');
    record.filledSellAmountRaw=sell.toString();record.filledBuyAmountRaw=buy.toString();record.remainingSellAmountRaw=(total-sell).toString();
    if(cancelled)record.state='cancelled';
    else if(cancelPending)record.state='cancel-pending';
    else if(sell===total)record.state='filled';
    else if(sell>0n)record.state='partially-filled';
    else record.state='accepted';
    record.revision++;record.updatedAt=at;record.history=Object.freeze([...record.history,Object.freeze({state:record.state,revision:record.revision,observedAt:at})]);return snapshot(record,at);
  }
  return Object.freeze({publish,withdraw,status,applyProjection,states:PUBLICATION_STATES});
}
