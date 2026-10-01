import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createOrderHttpServer} from '../src/http.js';
import {createOrderPublicationStore} from '../src/order-store.js';
import {orderDigest} from '../src/canonical.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const order={maker:addr(1),sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',recipient:addr(1),marketId:id(4),nonce:'7',expiry:'2000',allowPartial:true};
const domain={name:'420Exchange Limit Orders',version:'1',chainId:'0x420',verifyingContract:addr(9)};
const signature='0x'+'22'.repeat(65);

async function withServer(fn){
  const digest=orderDigest({domain,order});
  const store=createOrderPublicationStore({
    chainId:'0x420',settlementContract:addr(9),clock:()=>1000,
    signatureVerifier:async({digest:actual})=>{assert.equal(actual,digest);return order.maker;},
  });
  const server=createOrderHttpServer({store});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{return await fn({base:`http://127.0.0.1:${server.address().port}`,store});}
  finally{server.close();await once(server,'close');}
}

test('versioned HTTP publication and status endpoints preserve canonical identity and idempotency',async()=>{
  await withServer(async({base})=>{
    const body={schema:'420-exchange-order-publication-v1',domain,order,signature};
    const first=await fetch(base+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(first.status,201);assert.equal(first.headers.get('x-420-exchange-orders-version'),'1');
    const a=await first.json();assert.equal(a.order.state,'accepted');
    const second=await fetch(base+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(second.status,200);assert.equal((await second.json()).idempotent,true);
    const status=await fetch(base+'/v1/orders/'+a.order.orderHash);
    assert.equal(status.status,200);const s=await status.json();assert.equal(s.order.orderHash,a.order.orderHash);
  });
});

test('HTTP service rejects malformed publication and unknown status',async()=>{
  await withServer(async({base})=>{
    const bad=await fetch(base+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(bad.status,400);assert.equal((await bad.json()).schema,'420-exchange-order-error-v1');
    const missing=await fetch(base+'/v1/orders/'+'0x'+'ff'.repeat(32));
    assert.equal(missing.status,404);assert.equal((await missing.json()).code,'NOT_FOUND');
  });
});
