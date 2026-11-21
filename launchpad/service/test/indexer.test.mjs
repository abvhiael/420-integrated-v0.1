import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {makeRpc,S,P,TX,BLOCK,A,out} from './consumer.fixture.mjs';
import {reconstructProjection,rebuildProjection} from '../core/indexer.mjs';
import {ProjectionStore} from '../core/projection.mjs';
const ROUTER='0x0000000000000000000000000000000000001001',CHAIN='0x1a4';
const topic='0x'+'99'.repeat(32);
function fixture(){
  const rpc=makeRpc();
  rpc.set('resolveActive(bytes32)',out(ROUTER,1));
  rpc.set('sales()',out(A.sales));
  rpc.set('allocations()',out(A.allocations));
  rpc.set('projects()',out(A.project));
  let logs=[{address:A.sales,topics:[topic,S,P],blockHash:BLOCK,blockNumber:'0x10',
    transactionHash:TX,logIndex:'0x0',removed:false}];
  const original=rpc.call.bind(rpc);
  rpc.call=async (method,params)=>{
    if(method==='eth_getCode')return '0x6001';
    if(method==='eth_getLogs')return logs;
    return original(method,params);
  };
  return {rpc,setLogs:v=>logs=v,log:()=>logs[0]};
}
test('local indexer replays canonical SaleCreated into a verified bounded projection',async()=>{
  const {rpc}=fixture();
  const d=await reconstructProjection(rpc,{chainId:CHAIN,fromBlock:'0x10'});
  assert.equal(d.source.blockHash,BLOCK);
  assert.equal(d.source.saleRegistryAddress,A.sales);
  assert.equal(d.items.length,1);
  assert.equal(d.items[0].saleId,S);
  assert.equal(d.items[0].projectId,P);
  assert.equal(d.items[0].mode,'REWARD');
  assert.equal(d.items[0].raised,'12');
  assert.equal(d.items[0].controller,'0x000000000000000000000000000000000000c111');
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'lp-index-')),'state.json');
  const result=await rebuildProjection(rpc,{chainId:CHAIN,fromBlock:'0x10',file});
  assert.equal(result.campaigns,1);
  assert.equal((await new ProjectionStore(file,CHAIN).verify(rpc,{saleRegistryAddress:A.sales,projectRegistryAddress:A.project})).items.length,1);
});
test('reorg replay drops orphaned campaigns rather than retaining stale checkpoints',async()=>{
  const f=fixture(),file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'lp-reorg-')),'state.json');
  await rebuildProjection(f.rpc,{chainId:CHAIN,fromBlock:'0x10',file});
  const first=fs.readFileSync(file,'utf8');
  f.rpc.reorg();
  await assert.rejects(()=>rebuildProjection(f.rpc,{chainId:CHAIN,fromBlock:'0x10',file}),/orphaned Launchpad sale event/);
  assert.equal(fs.readFileSync(file,'utf8'),first);
  f.setLogs([]);
  const result=await rebuildProjection(f.rpc,{chainId:CHAIN,fromBlock:'0x10',file});
  assert.equal(result.campaigns,0);
  assert.notEqual(JSON.parse(fs.readFileSync(file,'utf8')).source.blockHash,BLOCK);
});
test('malicious RPC logs, replays, wrong chain and unbounded scans fail closed',async()=>{
  const f=fixture(),opts={chainId:CHAIN,fromBlock:'0x10'};
  await assert.rejects(()=>reconstructProjection(f.rpc,{...opts,chainId:'0x1'}),/chain mismatch/);
  await assert.rejects(()=>reconstructProjection(f.rpc,{...opts,fromBlock:'0x100000'}),/bounded historical range/);
  f.setLogs([f.log(),f.log()]);
  await assert.rejects(()=>reconstructProjection(f.rpc,opts),/replayed Launchpad sale event/);
  f.setLogs([{...f.log(),removed:true}]);
  await assert.rejects(()=>reconstructProjection(f.rpc,opts),/malformed or replayed/);
});
