import {buildLimitOrderTypedData} from './execution.js';
import {hashLimitOrder,limitOrderDigest} from './limit-order-identity.js';
import {publishSignedLimitOrder,fetchLimitOrderStatus} from './order-publication-client.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export const ORDER_PUBLICATION_STATES=Object.freeze(['idle','prepared','signed','published','accepted','partially-filled','filled','cancel-pending','cancelled','expired','rejected','invalidated']);
export class LimitOrderPublicationError extends Error{
  constructor(code,message){super(message);this.name='LimitOrderPublicationError';this.code=code;}
}
const fail=(code,message)=>{throw new LimitOrderPublicationError(code,message);};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();

export class LimitOrderPublicationController{
  constructor({controller,publish=publishSignedLimitOrder,status=fetchLimitOrderStatus,nowSeconds=()=>Math.floor(Date.now()/1000),publicationGate=null}={}){
    if(!controller||typeof controller.captureExecutionContext!=='function'||typeof controller.subscribeInvalidation!=='function')fail('CONTROLLER_REQUIRED','browser execution controller required');
    if(typeof publish!=='function'||typeof status!=='function'||typeof nowSeconds!=='function')fail('CONFIG_REQUIRED','publication adapters and clock required');
    this.controller=controller;this.publishAdapter=publish;this.statusAdapter=status;this.nowSeconds=nowSeconds;this.publicationGate=publicationGate;
    this.state='idle';this.context=null;this.signingRequest=null;this.review=null;this.signed=null;this.orderHash=null;this.record=null;this.invalidatedReason=null;
    this.unsubscribe=controller.subscribeInvalidation(reason=>{if(!['filled','cancelled','expired','rejected'].includes(this.state))this.invalidate(reason);});
  }
  snapshot(){return Object.freeze({state:this.state,orderHash:this.orderHash,record:this.record,review:this.review,invalidatedReason:this.invalidatedReason});}
  invalidate(reason='execution-context-changed'){
    this.invalidatedReason=String(reason);this.state='invalidated';this.signingRequest=null;this.signed=null;this.record=null;return this.snapshot();
  }
  assertState(...states){if(this.state==='invalidated')fail('ORDER_INVALIDATED','order review invalidated');if(!states.includes(this.state))fail('STATE_MISMATCH',`order publication state ${this.state} invalid for operation`);}
  assertContext(){
    try{return this.controller.assertExecutionContext(this.context);}catch{this.invalidate('STALE_SESSION');fail('STALE_SESSION','wallet/session changed since order review');}
  }
  prepare({reviewedOrder,execution}={}){
    this.assertState('idle','invalidated');
    const context=this.controller.captureExecutionContext();
    let signingRequest;try{signingRequest=buildLimitOrderTypedData({runtime:this.controller.runtime,reviewedOrder,execution});}catch(error){fail('ORDER_INVALID',error.message);}
    if(normalizeAccount(signingRequest.account)!==context.account||normalizeChainId(signingRequest.chainId)!==context.chainId)fail('SESSION_MISMATCH','order maker/chain differs from connected wallet');
    const expiry=BigInt(signingRequest.order.expiry),now=BigInt(this.nowSeconds());
    if(expiry<=now)fail('ORDER_EXPIRED','order expiry must be in the future');
    const domain=signingRequest.typedData.domain,order=signingRequest.order;
    this.context=context;this.signingRequest=signingRequest;this.orderHash=hashLimitOrder(order);
    this.review=Object.freeze({
      schema:'420-exchange-limit-order-review-v1',account:context.account,chainId:context.chainId,
      domain:Object.freeze({...domain}),order:Object.freeze({...order}),orderHash:this.orderHash,digest:limitOrderDigest({domain,order}),
    });
    this.state='prepared';this.signed=null;this.record=null;this.invalidatedReason=null;return this.snapshot();
  }
  attachSigned({signature,domain,order}={}){
    this.assertState('prepared');this.assertContext();
    if(this.controller.runtime?.execution?.orderSigning!=='DISABLED_PRETESTNET')fail('RUNTIME_POLICY_INVALID','pre-testnet runtime must keep live order signing disabled');
    if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))fail('SIGNATURE_INVALID','65-byte externally signed fixture/signature required');
    const hash=hashLimitOrder(order),digest=limitOrderDigest({domain,order});
    if(hash!==this.review.orderHash||digest!==this.review.digest||JSON.stringify(domain)!==JSON.stringify(this.review.domain)||JSON.stringify(order)!==JSON.stringify(this.review.order))fail('SIGNED_ORDER_MISMATCH','signed order differs from reviewed canonical order');
    this.signed=Object.freeze({signature:signature.toLowerCase(),domain:Object.freeze({...domain}),order:Object.freeze({...order}),orderHash:hash,digest});
    this.state='signed';return this.snapshot();
  }
  async publish({fetchImpl,signal}={}){
    this.assertState('signed','published');this.assertContext();
    this.state='published';
    const result=await this.publishAdapter({runtime:this.controller.runtime,signedOrder:this.signed,fetchImpl,signal,publicationGate:this.publicationGate});
    if(result.order.orderHash!==this.orderHash)fail('ORDER_HASH_MISMATCH','publication service returned a different canonical order');
    this.record=result.order;this.state=result.order.state;return Object.freeze({idempotent:result.idempotent,...this.snapshot()});
  }
  async refresh({fetchImpl,signal}={}){
    this.assertState('published','accepted','partially-filled','cancel-pending','filled','cancelled','expired','rejected');
    const record=await this.statusAdapter({runtime:this.controller.runtime,orderHash:this.orderHash,fetchImpl,signal});
    if(record.orderHash!==this.orderHash)fail('ORDER_HASH_MISMATCH','status service returned a different canonical order');
    this.record=record;this.state=record.state;return this.snapshot();
  }
  dispose(){this.unsubscribe?.();this.unsubscribe=null;}
}
// No method in this controller invokes eth_signTypedData_v4. Real signing stays a later live-testnet gate.
