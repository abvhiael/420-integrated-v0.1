import test from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalSocialChainAdapter} from '../src/canonical-social-chain-adapter.js';
const addr='0x'+'1'.repeat(40),contracts=Object.fromEntries(['organizations','cooperatives','governance','executor'].map(k=>[k,addr]));
const policy='0x'+'a'.repeat(64),h='0x'+'b'.repeat(64);
const rpc={chainId:420,contracts:Object.fromEntries(Object.keys(contracts).map(k=>[k,{address:addr,codeHash:h}])),
 request:async()=>null,call:async()=>({result:'0x'+'0'.repeat(64)}),unrestricted:async()=>true,header:async()=>({hash:h,number:'0x1'})};
const make=(x={})=>new CanonicalSocialChainAdapter({rpc:{...rpc,...x},contracts,scope:'HC',emergencyDomain:policy,organizationEmergencyDomain:policy,cooperativeEmergencyDomain:policy,verifySignedEnvelope:async()=>({from:addr,to:addr,input:'0x1234',chainId:420,value:'0x0',nonce:1})});
test('unsupported operations fail closed and missing signed wallet transaction rejected',async()=>{
 const a=make();
 assert.deepEqual(await a.permission({wallet:addr,action:'wallet.transfer',payload:{}}),{allowed:false});
 await assert.rejects(a.submitSigned({wallet:addr,action:'organization.join',payload:{organization:policy}}),/signed raw transaction required/);
});
test('signed chain operation requires actual RPC transaction and signer matching',async()=>{
 const a=make({request:async(method)=>method==='eth_sendRawTransaction'?h:{from:'0x'+'2'.repeat(40),to:addr,input:'0x12345678',chainId:'0x1a4',value:'0x0'}});
 await assert.rejects(a.submitSigned({wallet:addr,action:'organization.join',payload:{organization:policy,signedRawTransaction:'0x1234'}}),/prebroadcast signed intent mismatch/);
});
test('unimplemented governance calls cannot pass client authorization or enter broadcast',async()=>{
 const a=make();
 assert.deepEqual(await a.permission({wallet:addr,action:'cooperative.vote',payload:{proposal:policy,support:true}}),{allowed:false});
 await assert.rejects(a.submitSigned({wallet:addr,action:'cooperative.vote',payload:{proposal:policy,signedRawTransaction:'0x1234'}}),/unapproved social operation/);
});
test('a malformed wallet-signed envelope is rejected before any RPC broadcast',async()=>{
 let broadcast=0;const a=make({request:async m=>{if(m==='eth_sendRawTransaction')broadcast++;return h;}});
 await assert.rejects(a.submitSigned({wallet:addr,action:'organization.join',payload:{organization:policy,signedRawTransaction:'0x1234'}}),/prebroadcast signed intent mismatch/);
 assert.equal(broadcast,0);
});
test('unprovisioned social indexer does not forge persistent snapshot or histories',async()=>{
 const a=make();
 await assert.rejects(a.snapshot(),/not provisioned/);
 await assert.rejects(a.history(),/not provisioned/);
 assert.equal(await a.verifyTreasurySettlement({state:'approved'}),false);
});
test('unfinalized receipt remains visibly unfinalized',async()=>{
 const a=make({request:async(m)=>m==='eth_getTransactionReceipt'?{blockNumber:'0x2',blockHash:h,status:'0x1'}:m==='eth_getTransactionByHash'?{from:addr,value:'0x0'}:m==='eth_getBlockByNumber'?{hash:h}:null});
 const result=await a.finalizedReceipt({hash:h,wallet:addr,action:'organization.join'});
 assert.equal(result.finalized,false);
});
