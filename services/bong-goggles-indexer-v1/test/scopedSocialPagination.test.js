import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedSocialPagination} from '../src/scopedSocialPagination.js';
const viewer=`0x${'a'.repeat(40)}`,other=`0x${'b'.repeat(40)}`;
const hash=`0x${'c'.repeat(64)}`,reorg=`0x${'d'.repeat(64)}`;
const checkpoint={chainId:420,indexedBlock:10,indexedBlockHash:hash};
const key=Buffer.alloc(32,42);
let time=100;
const session=()=>({authenticated:true,account:viewer,chainId:420,sessionId:'session-a',expiresAt:100000});
const rows=[3,2,1].map(n=>({sortKey:String(n),owner:viewer,publicDto:{objectId:n}}));
const make=(overrides={})=>createScopedSocialPagination({expectedChainId:420,signingKey:key,
 verifySession:async()=>session(),now:()=>time,
 readPage:async({after,limit})=>{const remaining=rows.filter(r=>after===null||r.sortKey<after);return {checkpoint,records:remaining.slice(0,limit),hasMore:remaining.length>limit};},
 readCanonicalState:async()=>({healthy:true,chainId:420,headBlock:11,finalizedBlock:10,indexedBlockHash:hash}),
 authorizeRecord:async({viewer:account,record})=>account===record.owner,...overrides});
const query={credential:'opaque',feedClass:'HOME',limit:2};

test('BG-19.19 cursor traverses an exact qualified snapshot with truthful hasMore',async()=>{
 const guard=make();const first=await guard.read(query);
 assert.equal(first.status,'ready');assert.deepEqual(first.data.items.map(r=>r.objectId),[3,2]);
 assert.equal(first.data.hasMore,true);assert.ok(first.data.cursor);assert.equal(first.data.authoritative,false);
 const second=await guard.read({...query,cursor:first.data.cursor});
 assert.equal(second.status,'ready');assert.deepEqual(second.data.items.map(r=>r.objectId),[1]);
 assert.equal(second.data.hasMore,false);assert.equal(second.data.cursor,null);
});

test('rejects tampered, account-swapped, session-swapped and cross-feed cursors',async()=>{
 const first=await make().read(query);const cursor=first.data.cursor;
 for(const corrupted of [cursor.replace(/.$/,cursor.at(-1)==='A'?'B':'A'),cursor.slice(0,-1),
  `${cursor.split('.')[0]}.${Buffer.alloc(32).toString('base64url')}`]){
  assert.equal((await make().read({...query,cursor:corrupted})).status,'unavailable');
 }
 assert.equal((await make({verifySession:async()=>({...session(),account:other})}).read({...query,cursor})).status,'unavailable');
 assert.equal((await make({verifySession:async()=>({...session(),sessionId:'session-b'})}).read({...query,cursor})).status,'unavailable');
 assert.equal((await make().read({...query,feedClass:'FRIENDS',cursor})).status,'unavailable');
});

test('denies changed checkpoint, reorg and excessive chain lag before returning a page',async()=>{
 const first=await make().read(query);const cursor=first.data.cursor;
 assert.equal((await make({readPage:async()=>({checkpoint:{...checkpoint,indexedBlock:11},records:[],hasMore:false})}).read({...query,cursor})).status,'unavailable');
 assert.equal((await make({readCanonicalState:async()=>({healthy:true,chainId:420,headBlock:11,finalizedBlock:10,indexedBlockHash:reorg})}).read({...query,cursor})).status,'unavailable');
 assert.equal((await make({readCanonicalState:async()=>({healthy:true,chainId:420,headBlock:30,finalizedBlock:10,indexedBlockHash:hash})}).read({...query,cursor})).status,'unavailable');
});

test('denies expired or revoked session and expired cursor',async()=>{
 const first=await make({cursorTtlMs:10}).read(query);
 time=111;assert.equal((await make().read({...query,cursor:first.data.cursor})).status,'unavailable');time=100;
 let count=0;
 assert.equal((await make({verifySession:async()=>++count===1?session():{...session(),authenticated:false}}).read(query)).status,'unavailable');
 assert.equal((await make({verifySession:async()=>({...session(),expiresAt:100})}).read(query)).status,'unavailable');
});

test('denies unauthorized record, out-of-order or duplicate keys and inconsistent hasMore',async()=>{
 for(const page of [
  {checkpoint,records:[{...rows[0],owner:other}],hasMore:false},
  {checkpoint,records:[rows[0],rows[0]],hasMore:false},
  {checkpoint,records:[rows[0]],hasMore:true},
  {checkpoint,records:[],hasMore:true},
  {checkpoint,records:[{sortKey:'2',publicDto:{secret:'private'},owner:other}],hasMore:false},
 ])assert.equal((await make({readPage:async()=>page}).read(query)).status,'unavailable');
});

test('rejects missing dependencies, invalid signing keys and unsupported request shapes',async()=>{
 assert.equal(make({signingKey:Buffer.alloc(8)}).configured,false);
 assert.equal((await make({authorizeRecord:undefined}).read(query)).status,'unavailable');
 for(const bad of [{...query,feedClass:'DISCOVER'},{...query,limit:0},{...query,limit:51},
  {...query,cursor:'not-a-valid-cursor'}])assert.equal((await make().read(bad)).status,'unavailable');
});

test('rechecks canonical chain after policies and refuses mid-page reorg',async()=>{
 let count=0;
 const guard=make({readCanonicalState:async()=>({healthy:true,chainId:420,headBlock:11,finalizedBlock:10,indexedBlockHash:++count===1?hash:reorg})});
 assert.equal((await guard.read(query)).status,'unavailable');
});
