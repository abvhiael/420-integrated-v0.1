import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryProjectionStore} from '../src/projection-store.mjs';
import {dedupeAndValidate,historyPage,mapIndexerEventToHistory} from '../src/projection.mjs';

const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
function event({eventName='LimitOrderFilled',block='10',hash=id(10),tx=id(20),logIndex=0,fields={orderHash:id(30),sellAmountFilled:100},protocol='420Exchange'}={}){
 return {chainId:'1056',blockNumber:block,blockHash:hash,transactionHash:tx,transactionIndex:0,logIndex,contractAddress:addr(9),protocol,eventName,objectKey:null,fields};
}
const map=e=>mapIndexerEventToHistory(e,{observedAt:1000,finality:'safe',freshness:'canonical'});

test('mapping preserves stable record IDs, provenance, finality and freshness',()=>{
 const a=map(event());const b=map(event());
 assert.equal(a.recordId,b.recordId);assert.equal(a.active,true);assert.equal(a.finality,'safe');assert.equal(a.freshness,'canonical');assert.equal(a.provenance.authoritative,false);
});

test('duplicate identical events dedupe while duplicate ID conflicts fail closed',()=>{
 const a=map(event()),b=map(event());assert.equal(dedupeAndValidate([a,b]).length,1);
 assert.throws(()=>dedupeAndValidate([a,{...a,beneficiary:addr(88)}]),/duplicate recordId conflict/);
});

test('source rollback marks disappeared records inactive without deleting provenance',()=>{
 const store=new MemoryProjectionStore().open(),a=map(event());
 store.reconcile([a]);store.reconcile([]);
 const old=store.values().find(r=>r.recordId===a.recordId);
 assert.equal(old.active,false);assert.equal(old.canonicality,'orphaned');assert.equal(old.txHash,a.txHash);
});

test('same semantic event after rollback is explicit replacement with stable old record',()=>{
 const store=new MemoryProjectionStore().open(),old=map(event({hash:id(10),tx:id(20)})),replacement=map(event({hash:id(11),tx:id(21)}));
 store.reconcile([old]);store.reconcile([replacement]);
 const values=store.values(),prior=values.find(r=>r.recordId===old.recordId),next=values.find(r=>r.recordId===replacement.recordId);
 assert.equal(prior.active,false);assert.equal(prior.replacedBy,next.recordId);assert.equal(next.active,true);
});

test('fee and beneficiary conflicts on one semantic projection fail closed',()=>{
 const feeA=map(event({eventName:'ExchangeFeeRouted',fields:{tradeRef:id(70),grossRevenue:100,developerPayment:5}}));
 const feeB={...map(event({eventName:'ExchangeFeeRouted',hash:id(12),tx:id(22),fields:{tradeRef:id(70),grossRevenue:101,developerPayment:6}})),semanticKey:feeA.semanticKey};
 assert.throws(()=>dedupeAndValidate([feeA,feeB]),/fee conflict/);
 const a={...map(event({eventName:'AtomicPathExecuted',fields:{pathHash:id(71),recipient:addr(1),amountIn:1,amountOut:1}})),semanticKey:'trade-x'};
 const b={...map(event({eventName:'AtomicPathExecuted',hash:id(13),tx:id(23),fields:{pathHash:id(72),recipient:addr(2),amountIn:1,amountOut:1}})),semanticKey:'trade-x'};
 assert.throws(()=>dedupeAndValidate([a,b]),/beneficiary conflict/);
});

test('pagination cursor is query-bound and activeOnly preserves orphan/replacement semantics',()=>{
 const records=[];
 for(let i=0;i<5;i++)records.push({...map(event({block:String(20-i),hash:id(100+i),tx:id(200+i)})),recordId:'r'+i,kind:'FILL',subjectId:id(30),active:i!==2});
 const p1=historyPage(records,{kind:'FILL',activeOnly:false,limit:2});
 assert.equal(p1.records.length,2);assert.ok(p1.nextCursor);
 const p2=historyPage(records,{kind:'FILL',activeOnly:false,limit:2,cursor:p1.nextCursor});assert.equal(p2.records.length,2);
 assert.throws(()=>historyPage(records,{kind:'TRADE',activeOnly:false,limit:2,cursor:p1.nextCursor}),/cursor\/query mismatch/);
 assert.equal(historyPage(records,{kind:'FILL',activeOnly:true,limit:100}).records.length,4);
});
