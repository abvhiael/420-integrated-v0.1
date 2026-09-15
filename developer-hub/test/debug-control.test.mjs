import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugClient420,createDebugControlView420} from '../src/debug-control.mjs';
const network={chainIdDecimal:'420'};
function indexer(){return {canonicalAuthority:false,chainId:'420',transaction:async h=>({hash:h,source:'indexed'}),receipt:async h=>({transactionHash:h,status:'0x1'}),logs:async o=>({items:[o]}),protocolEvents:async o=>({items:[o]}),diagnostics:async()=>({source:'420Indexer',canonicalAuthority:false})};}
function rpc(){return {request:async(method,params)=>method==='eth_chainId'?'0x1a4':{method,params,canonical:true}};}
test('transaction debugger correlates indexer projection with canonical RPC receipt',async()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});const h='0x'+'ab'.repeat(32);const v=await c.transaction(h);assert.equal(v.transactionHash,h);assert.equal(v.indexer.canonical,false);assert.equal(v.canonical.source,'420-chain-rpc');assert.equal(v.rules.canonicalReceiptRequiredForFinality,true);});
test('log queries remain explicitly non-canonical',async()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});const v=await c.logs({address:'0x'+'11'.repeat(20),limit:10});assert.equal(v.canonicalAuthority,false);assert.match(v.securityRule,/canonical RPC/);});
test('protocol event queries cannot authorize transitions',async()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});const v=await c.protocolEvents({protocol:'420Registry'});assert.match(v.securityRule,/cannot authorize/);});
test('diagnostics preserve Indexer and canonical RPC provenance',async()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});const v=await c.diagnostics();assert.equal(v.indexer.source,'420Indexer');assert.equal(v.rpc.canonical,true);assert.equal(v.rpc.chainId,'0x1a4');});
test('mismatched Indexer chain fails closed',()=>{assert.throws(()=>createDebugClient420({network,indexer:{...indexer(),chainId:'421'},rpc:rpc()}),/chain mismatch/);});
test('invalid hashes and limits fail closed',async()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});await assert.rejects(c.transaction('bad'),/transaction hash/);await assert.rejects(c.logs({limit:0}),/limit/);});
test('control view does not claim canonical authority',()=>{const c=createDebugClient420({network,indexer:indexer(),rpc:rpc()});const v=createDebugControlView420(c);assert.equal(v.canonicalAuthority,false);assert.match(v.securityRule,/cannot replace canonical/);});
