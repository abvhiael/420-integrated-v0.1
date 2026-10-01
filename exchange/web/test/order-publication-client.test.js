import test from 'node:test';
import assert from 'node:assert/strict';
import {publishSignedLimitOrder,fetchLimitOrderStatus,OrderPublicationClientError} from '../core/order-publication-client.js';
import {hashLimitOrder} from '../core/limit-order-identity.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const order={maker:addr(1),sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',recipient:addr(1),marketId:id(4),nonce:'7',expiry:'2000',allowPartial:true};
const domain={name:'420Exchange Limit Orders',version:'1',chainId:'0x420',verifyingContract:addr(9)};
const orderHash=hashLimitOrder(order);
const runtime={api:{baseUrl:'https://api.example.invalid',orderPublicationUrl:'https://api.example.invalid/v1/orders'},execution:{orderPublication:'DISABLED_PRETESTNET'}};
const record=state=>({schema:'420-exchange-order-status-v1',orderHash,order,state,revision:4,provenance:{schema:'420-exchange-order-status-provenance-v1',service:'420/service/exchange-orders/v1',orderHash,revision:4,observedAt:1000}});

function response(body,{status=200,url='https://api.example.invalid/v1/orders'}={}){
  return {ok:status>=200&&status<300,status,url,redirected:false,headers:{get:n=>n==='content-type'?'application/json':null},json:async()=>body};
}

test('client publishes only to pinned same-origin versioned endpoint and validates service provenance',async()=>{
  const signedOrder={domain,order,signature:'0x'+'11'.repeat(65),orderHash};
  let request;
  const result=await publishSignedLimitOrder({runtime,signedOrder,publicationGate:{enabled:true,mode:'PRE07_MOCK'},fetchImpl:async(url,options)=>{request={url,options};return response({schema:'420-exchange-order-publication-response-v1',idempotent:false,order:record('accepted')},{status:201});}});
  assert.equal(result.order.orderHash,orderHash);assert.equal(request.url,'https://api.example.invalid/v1/orders');
  assert.equal(request.options.credentials,'omit');assert.equal(request.options.redirect,'error');
});

test('status client rejects substituted endpoint, bad hash and unbound provenance',async()=>{
  await assert.rejects(fetchLimitOrderStatus({runtime,orderHash,fetchImpl:async()=>response({schema:'420-exchange-order-status-response-v1',order:record('accepted')},{url:'https://evil.invalid/v1/orders/'+orderHash})}),e=>e.code==='ENDPOINT_CHANGED');
  const bad={...record('accepted'),provenance:{...record('accepted').provenance,orderHash:'0x'+'ff'.repeat(32)}};
  await assert.rejects(fetchLimitOrderStatus({runtime,orderHash,fetchImpl:async()=>response({schema:'420-exchange-order-status-response-v1',order:bad},{url:'https://api.example.invalid/v1/orders/'+orderHash})}),e=>e.code==='PROVENANCE_INVALID');
});

test('live publication requires both checked hard-off runtime and an explicit named publication gate',async()=>{
  const signedOrder={domain,order,signature:'0x'+'11'.repeat(65)};
  await assert.rejects(publishSignedLimitOrder({runtime,signedOrder,fetchImpl:async()=>response({})}),e=>e instanceof OrderPublicationClientError&&e.code==='LIVE_ORDER_PUBLICATION_DISABLED');
  await assert.rejects(publishSignedLimitOrder({runtime:{...runtime,execution:{orderPublication:'ENABLED'}},signedOrder,publicationGate:{enabled:true,mode:'PRE07_MOCK'},fetchImpl:async()=>response({})}),e=>e instanceof OrderPublicationClientError&&e.code==='RUNTIME_POLICY_INVALID');
});
