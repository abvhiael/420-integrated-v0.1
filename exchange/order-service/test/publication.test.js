import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderPublicationStore,OrderPublicationError} from '../src/order-store.js';
import {hashOrder,orderDigest} from '../src/canonical.js';

const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const order=Object.freeze({
  maker:addr(1),sellToken:addr(2),buyToken:addr(3),sellAmountRaw:'1000',minBuyAmountRaw:'500',
  recipient:addr(1),marketId:id(4),nonce:'7',expiry:'2000',allowPartial:true,
});
const domain=Object.freeze({name:'420Exchange Limit Orders',version:'1',chainId:'0x420',verifyingContract:addr(9)});
const signature='0x'+'11'.repeat(65);
const envelope=(overrides={})=>({schema:'420-exchange-order-publication-v1',domain,order,signature,...overrides});
function verifier({expectedMaker=order.maker,expectedDigest=orderDigest({domain,order})}={}){
  return async({digest})=>{assert.equal(digest,expectedDigest);return expectedMaker;};
}

test('canonical order hash is deterministic and publication is idempotent by order hash',async()=>{
  let now=1000;
  const store=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier(),clock:()=>now});
  const first=await store.publish(envelope());
  const second=await store.publish(envelope());
  assert.equal(first.idempotent,false);
  assert.equal(second.idempotent,true);
  assert.equal(first.record.orderHash,hashOrder(order));
  assert.equal(second.record.orderHash,first.record.orderHash);
  assert.equal(second.record.revision,3);
  assert.deepEqual(second.record.history.map(x=>x.state),['signed','published','accepted']);
  assert.equal(second.record.provenance.service,'420/service/exchange-orders/v1');
});

test('wrong signer, wrong domain/chain and expiry fail closed',async()=>{
  const base={chainId:'0x420',settlementContract:addr(9),clock:()=>1000};
  await assert.rejects(
    createOrderPublicationStore({...base,signatureVerifier:verifier({expectedMaker:addr(8)})}).publish(envelope()),
    e=>e instanceof OrderPublicationError&&e.code==='SIGNER_MISMATCH',
  );
  await assert.rejects(
    createOrderPublicationStore({...base,signatureVerifier:verifier()}).publish(envelope({domain:{...domain,verifyingContract:addr(8)}})),
    e=>e.code==='DOMAIN_MISMATCH',
  );
  await assert.rejects(
    createOrderPublicationStore({...base,signatureVerifier:verifier()}).publish(envelope({domain:{...domain,chainId:'0x421'}})),
    e=>e.code==='INVALID_PUBLICATION'&&/chain mismatch/.test(e.message),
  );
  await assert.rejects(
    createOrderPublicationStore({...base,signatureVerifier:verifier()}).publish(envelope({order:{...order,expiry:'999'}})),
    e=>e.code==='INVALID_PUBLICATION'&&/expired/.test(e.message),
  );
});

test('partial/full fill lifecycle is monotonic and signed price floor cannot be contradicted',async()=>{
  const store=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier(),clock:()=>1000});
  const {record}=await store.publish(envelope());
  const partial=store.applyProjection(record.orderHash,{filledSellAmountRaw:'400',filledBuyAmountRaw:'200'});
  assert.equal(partial.state,'partially-filled');
  assert.equal(partial.remainingSellAmountRaw,'600');
  const filled=store.applyProjection(record.orderHash,{filledSellAmountRaw:'1000',filledBuyAmountRaw:'500'});
  assert.equal(filled.state,'filled');
  assert.equal(filled.remainingSellAmountRaw,'0');

  const store2=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier(),clock:()=>1000});
  const published=await store2.publish(envelope());
  assert.throws(()=>store2.applyProjection(published.record.orderHash,{filledSellAmountRaw:'400',filledBuyAmountRaw:'199'}),e=>e.code==='CONFLICTING_FILL_DATA');
  store2.applyProjection(published.record.orderHash,{filledSellAmountRaw:'400',filledBuyAmountRaw:'200'});
  assert.throws(()=>store2.applyProjection(published.record.orderHash,{filledSellAmountRaw:'300',filledBuyAmountRaw:'200'}),e=>e.code==='STALE_PROJECTION');
});

test('non-partial order rejects partial projection and status preserves cancel/expiry/rejection states',async()=>{
  let now=1000;
  const nonPartial={...order,allowPartial:false};
  const nonDomain=domain;
  const nonDigest=orderDigest({domain:nonDomain,order:nonPartial});
  const store=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier({expectedDigest:nonDigest}),clock:()=>now});
  const {record}=await store.publish(envelope({order:nonPartial}));
  assert.throws(()=>store.applyProjection(record.orderHash,{filledSellAmountRaw:'1',filledBuyAmountRaw:'1'}),e=>e.code==='PARTIAL_FILL_FORBIDDEN');
  assert.equal(store.applyProjection(record.orderHash,{cancelPending:true}).state,'cancel-pending');
  assert.equal(store.applyProjection(record.orderHash,{cancelled:true}).state,'cancelled');

  const expStore=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier(),clock:()=>now});
  const exp=await expStore.publish(envelope());
  now=2001;
  assert.equal(expStore.status(exp.record.orderHash).state,'expired');

  const rejStore=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:verifier(),clock:()=>1000});
  const rej=await rejStore.publish(envelope());
  assert.equal(rejStore.applyProjection(rej.record.orderHash,{rejectedReason:'projection-conflict'}).state,'rejected');
});
