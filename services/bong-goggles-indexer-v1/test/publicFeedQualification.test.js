import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicFeedQualification } from '../src/publicFeedQualification.js';
import { routePublicFeedHttp } from '../src/publicFeedHttp.js';

const h = x => `0x${x.repeat(64)}`;
const account = `0x${'a'.repeat(40)}`;
const objectId = h('1');
const blockHash = h('2');
const cp = {schemaHash:h('3'),stateRoot:h('4'),chainId:420,indexedBlock:100,indexedBlockHash:blockHash};
const object = {objectId,author:account,objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',audienceRef:null,parentId:null,sourceObjectId:null,contentHash:h('5'),version:1};
const chain = {healthy:true,chainId:420,headBlock:102,finalizedBlock:100,indexedBlockHash:blockHash};
const allow = {allowed:true,objectId,author:account,chainId:420,indexedBlock:100,indexedBlockHash:blockHash,policyVersion:'canonical-v1',authorActive:true,objectActive:true,publicAudience:true,moderationPermits:true,anonymousPermits:true};
function makeView(record=object, checkpoint=cp) {
  return {checkpoint,profiles:new Map([[account,{account,active:true}]]),socialObjects:new Map([[objectId,record]]),feeds:new Map([['DISCOVER:*',[{objectId,feedClass:'DISCOVER',viewerKey:'*'}]]])};
}
function setup({view=makeView(),canonical=chain,eligibility=allow,chainId=420,lag=12}={}) {
  const calls = [];
  const deps=createPublicFeedQualification({expectedChainId:chainId,maxHeadLagBlocks:lag,
    readMaterializedView:async()=>view,
    readCanonicalState:async input=>{calls.push(input);return canonical;},
    readEligibility:async input=>{calls.push(input);return eligibility;}});
  return {deps,calls};
}
async function route(deps) {return routePublicFeedHttp({method:'GET',requestUrl:'/v1/public-feed',...deps});}

test('qualified current canonical checkpoint and structured current policy yield only allowlisted public item',async()=>{
  const {deps,calls}=setup();const response=await route(deps);
  assert.equal(response.status,200);assert.deepEqual(response.body.data.items.map(x=>x.objectId),[objectId]);
  assert.equal(response.body.data.items[0].audienceRef,undefined);
  assert.deepEqual(calls[0],{chainId:420,indexedBlock:100});
  assert.equal(calls[1].anonymous,true);
});

test('no readers, wrong chain, missing hash, noncanonical/reorged hash, unfinalized and stale states all deny without invoking policy',async()=>{
  const cases=[
    createPublicFeedQualification(),
    setup({view:makeView(object,{...cp,chainId:421})}).deps,
    setup({view:makeView(object,{...cp,indexedBlockHash:null})}).deps,
    setup({canonical:{...chain,indexedBlockHash:h('f')}}).deps,
    setup({canonical:{...chain,finalizedBlock:99}}).deps,
    setup({canonical:{...chain,headBlock:200}}).deps,
    setup({canonical:{...chain,healthy:false}}).deps,
    setup({canonical:{...chain,chainId:421}}).deps,
    setup({canonical:null}).deps,
  ];
  for(const deps of cases){const result=await route(deps);assert.equal(result.status,503);assert.deepEqual(result.body.data,undefined);}
});

test('public feed denies missing, boolean, contradictory, stale or thrown policy evidence',async()=>{
  for(const eligibility of [null,true,{...allow,authorActive:false},{...allow,objectId:h('6')},{...allow,indexedBlockHash:h('7')},{...allow,moderationPermits:false},{...allow,anonymousPermits:false},{...allow,policyVersion:''}]) {
    const {deps}=setup({eligibility});const response=await route(deps);
    assert.equal(response.status,200);assert.deepEqual(response.body.data.items,[]);
  }
  const deps=createPublicFeedQualification({expectedChainId:420,readMaterializedView:async()=>makeView(),readCanonicalState:async()=>chain,readEligibility:async()=>{throw new Error('policy unavailable');}});
  assert.deepEqual((await route(deps)).body.data.items,[]);
});

test('private, source-dependent, parented, deleted and inactive-author objects are not exposed',async()=>{
  for(const change of [{audienceType:'FRIENDS'},{audienceRef:h('8')},{sourceObjectId:h('9')},{parentId:h('a')},{status:'WITHDRAWN'},{objectType:'REPOST'}]){
    const {deps}=setup({view:makeView({...object,...change})});assert.deepEqual((await route(deps)).body.data.items,[]);
  }
  const view=makeView();view.profiles.set(account,{account,active:false});
  assert.deepEqual((await route(setup({view}).deps)).body.data.items,[]);
});

test('policy reader and checkpoint source errors fail closed',async()=>{
  const deps=createPublicFeedQualification({expectedChainId:420,readMaterializedView:async()=>{throw Error('offline');},readCanonicalState:async()=>chain,readEligibility:async()=>allow});
  assert.equal((await route(deps)).status,503);
});
