import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDeployedSmartAccountState } from '../core/accounts.js';
import { prepareSmartAccountExecution, sendSmartAccountExecution } from '../core/execution.js';
import { prepareSmartAccountBatch } from '../core/batch-execution.js';
import { prepareSmartAccountCreation } from '../core/deployment.js';
import { readWalletTransactionStatus420 } from '../core/transaction-lifecycle.js';
import { validateRuntimeConfig } from '../core/config.js';

const owner='0x1111111111111111111111111111111111111111';
const account='0x2222222222222222222222222222222222222222';
const factory='0x3333333333333333333333333333333333333333';
const entryPoint='0x4444444444444444444444444444444444444444';
const registry='0x0000000000000000000000000000000000000447';
const target='0x5555555555555555555555555555555555555555';
const wordAddress=a=>'0x'+'0'.repeat(24)+a.slice(2);
const wordUint=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const state={deployed:true,smartAccount:account,controllerIsOwner:true,owner,factoryAddress:factory,
  entryPoint,capabilityRegistry:registry,verifiedCapabilityRegistry:registry,verifiedEntryPoint:entryPoint,
  expectedChainId:'0x1a4',authorizationEpoch:7n};

test('checked-in Wallet runtime stays read-only without verified authority',async()=>{
  const json=JSON.parse(await fs.readFile(new URL('../runtime-config.json',import.meta.url),'utf8'));
  assert.equal(json.smartAccount.factoryAddress,null);
  assert.equal(json.network.chainId,null);
  assert.equal(json.gasQuote.enabled,false);
  assert.equal(validateRuntimeConfig(json),true);
  assert.throws(()=>validateRuntimeConfig({
    ...json,smartAccount:{...json.smartAccount,factoryAddress:'0x0000000000000000000000000000000000000420'}
  }),/retired SmartAccountFactory/);
});

test('owner execution rejects wrong chain before simulation or broadcast',async()=>{
  const requests=[];
  const provider={request:async(m)=>{requests.push(m);if(m==='eth_chainId')return '0x1a5';throw Error(m);}};
  await assert.rejects(prepareSmartAccountExecution(provider,owner,state,{target,value:1n,expectedChainId:'0x1a4'}),/chain changed/);
  assert.deepEqual(requests,['eth_chainId']);
});

test('owner cannot broadcast when chain switches after simulation',async()=>{
  let chains=0,submitted=0;
  const provider={request:async(m,params)=>{
    if(m==='eth_chainId')return ++chains===1?'0x1a4':'0x1a5';
    if(m==='eth_estimateGas')return '0x5208';
    if(m==='eth_call')return params[0]?.data==='0x8da5cb5b'?wordAddress(owner):'0x';
    if(m==='eth_sendTransaction'){submitted++;return '0x'+'ab'.repeat(32);}
    throw Error(m);
  }};
  await assert.rejects(sendSmartAccountExecution(provider,owner,state,{target,value:1n,expectedChainId:'0x1a4'}),/chain changed/);
  assert.equal(submitted,0);
});

test('batch and factory creation fail closed when chain identity changes',async()=>{
  let count=0;const provider={request:async(m)=>{count++;if(m==='eth_chainId')return '0x420';throw Error(m);}};
  await assert.rejects(prepareSmartAccountBatch(provider,owner,state,[{target,value:1n,data:'0x'}]),/chain changed/);
  await assert.rejects(prepareSmartAccountCreation(provider,owner,{factoryAddress:factory,expectedChainId:'0x1a4'}),/chain changed/);
  assert.equal(count,2);
});

test('read-only account restore rejects unexpected EntryPoint or Registry contracts',async()=>{
  const responses={
    '0x8da5cb5b':wordAddress(owner),
    '0x8a957938':wordAddress(owner),
    '0x6d5f87be':wordUint(7),
    '0x7d5366f4':wordUint(1),
    '0xe5f1af38':wordAddress('0x0000000000000000000000000000000000000000'),
    '0x93261b5b':wordUint(0),
    '0xb0d691fe':wordAddress(entryPoint),
    '0xc9de3b48':wordAddress(registry)
  };
  const provider={request:async(m,params)=>{
    if(m==='eth_getCode')return '0x60016000';
    if(m==='eth_call')return responses[params[0].data];
    throw Error(m);
  }};
  const read=await readDeployedSmartAccountState(provider,account,{controller:owner,
    verifiedEntryPoint:entryPoint,verifiedCapabilityRegistry:registry});
  assert.equal(read.controllerIsOwner,true);
  await assert.rejects(readDeployedSmartAccountState(provider,account,{
    verifiedEntryPoint:target,verifiedCapabilityRegistry:registry}),/EntryPoint binding/);
  await assert.rejects(readDeployedSmartAccountState(provider,account,{
    verifiedEntryPoint:entryPoint,verifiedCapabilityRegistry:target}),/CapabilityRegistry binding/);
});

test('orphaned reverted receipt is reorganization, not final failed transaction',async()=>{
  const hash='0x'+'ab'.repeat(32),original='0x'+'cd'.repeat(32);
  const provider={request:async(m)=>{
    if(m==='eth_getTransactionReceipt')return {transactionHash:hash,status:'0x0',blockNumber:'0x9',blockHash:original};
    if(m==='eth_getBlockByNumber')return {hash:'0x'+'ff'.repeat(32)};
    if(m==='eth_blockNumber')return '0xa';
    throw Error(m);
  }};
  const item=await readWalletTransactionStatus420(provider,hash,{canonical:true});
  assert.equal(item.status,'reorganized');
});
