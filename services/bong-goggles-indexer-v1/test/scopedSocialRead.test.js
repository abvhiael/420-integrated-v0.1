import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedSocialRead} from '../src/scopedSocialRead.js';
const viewer=`0x${'a'.repeat(40)}`;
const other=`0x${'b'.repeat(40)}`;
const hash=`0x${'c'.repeat(64)}`;
const now=()=>100;
const session=()=>({authenticated:true,chainId:420,account:viewer,sessionId:'qualified-session',expiresAt:200});
const checkpoint={chainId:420,indexedBlock:10,indexedBlockHash:hash};
const canonical=()=>({healthy:true,chainId:420,headBlock:11,finalizedBlock:10,indexedBlockHash:hash});
const record={owner:viewer,publicDto:{objectId:hash}};
const make=(overrides={})=>createScopedSocialRead({expectedChainId:420,verifySession:async()=>session(),
 readCanonicalState:async()=>canonical(),readProjection:async()=>({checkpoint,records:[record]}),
 authorizeRecord:async({viewer:account,record:item})=>item.owner===account,now,...overrides});
const query={credential:'opaque',resource:'feed',feedClass:'HOME'};

test('BG-19.19 requires independently supplied session, canonical, projection and policy readers',async()=>{
 for(const option of ['verifySession','readCanonicalState','readProjection','authorizeRecord']){
  const deps={expectedChainId:420,verifySession:async()=>session(),readCanonicalState:async()=>canonical(),
    readProjection:async()=>({checkpoint,records:[record]}),authorizeRecord:async()=>true,now};
  delete deps[option];
  const guard=createScopedSocialRead(deps);
  assert.equal(guard.configured,false);
  assert.equal((await guard.read(query)).status,'unavailable');
 }
});

test('BG-19.19 exposes only allowlisted projection after current authorization and reverified session',async()=>{
 let checked=0;
 const guard=make({verifySession:async()=>{checked++;return session();}});
 const result=await guard.read(query);
 assert.equal(result.status,'ready');
 assert.deepEqual(result.data.records,[{objectId:hash}]);
 assert.equal(result.data.authoritative,false);
 assert.equal(checked,2);
});

test('BG-19.19 ignores caller account overrides and denies another account record',async()=>{
 const guard=make({readProjection:async({viewer:verified})=>{
  assert.equal(verified,viewer);
  return {checkpoint,records:[{owner:other,publicDto:{objectId:hash}}]};
 }});
 assert.equal((await guard.read({...query,viewer:other})).status,'unavailable');
});

test('BG-19.19 denies absent, expired, unverified, wrong-chain and revoked sessions',async()=>{
 for(const bad of [null,{...session(),authenticated:false},{...session(),expiresAt:100},
  {...session(),chainId:1},{...session(),account:'not-an-address'}]){
  assert.equal((await make({verifySession:async()=>bad}).read(query)).status,'unavailable');
 }
 let count=0;
 const revoked=make({verifySession:async()=>++count===1?session():{...session(),authenticated:false}});
 assert.equal((await revoked.read(query)).status,'unavailable');
});

test('BG-19.19 denies stale, unfinalized, reorged, wrong-chain and missing checkpoints',async()=>{
 const cases=[{...canonical(),headBlock:30},{...canonical(),finalizedBlock:9},
  {...canonical(),indexedBlockHash:`0x${'d'.repeat(64)}`},{...canonical(),chainId:1},null];
 for(const state of cases) assert.equal((await make({readCanonicalState:async()=>state}).read(query)).status,'unavailable');
 assert.equal((await make({readProjection:async()=>({checkpoint:{...checkpoint,indexedBlockHash:null},records:[record]})}).read(query)).status,'unavailable');
});

test('BG-19.19 denies any unauthorized, missing or raw record rather than returning a partial private page',async()=>{
 for(const records of [[record,{owner:other,publicDto:{objectId:hash}}],[{owner:viewer,secret:'private'}],Array(51).fill(record)]){
  assert.equal((await make({readProjection:async()=>({checkpoint,records})}).read(query)).status,'unavailable');
 }
 assert.equal((await make({authorizeRecord:async()=>{throw Error('private')}}).read(query)).status,'unavailable');
});

test('BG-19.19 accepts only explicitly scoped read classes and bounded requests',async()=>{
 const guard=make();
 for(const bad of [{...query,feedClass:'DISCOVER'},{...query,feedClass:'PRIVATE'},
  {...query,limit:51},{...query,limit:0},{...query,resource:'community',feedClass:null,subject:'bogus'},
  {...query,resource:'relationships',feedClass:null,subject:other},
  {...query,resource:'profile',feedClass:null,subject:'wrong'}]){
  assert.equal((await guard.read(bad)).status,'unavailable');
 }
});
