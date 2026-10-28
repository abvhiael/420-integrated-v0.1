import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryPremiumRpc420} from '../src/highcountry-premium-rpc.js';
const HASH='0x'+'1'.repeat(64),CODE='0x6001600055',ADDR='0x'+'a'.repeat(40),WALLET='0x'+'b'.repeat(40),SCOPE='0x'+'c'.repeat(64);
function fixture(){
 let code=CODE,authorized=true,chain='0x1a4',finalized='0x64',latest='0x72',canonical=true;
 const methods=[];
 const rpc=createHighCountryPremiumRpc420({endpoint:'https://rpc.example.org',networkId:'420',
  expectedRegistryCode:CODE,eligibleSelector:'0x12345678',fetchImpl:async(url,req)=>{
   const p=JSON.parse(req.body);methods.push(p);
   const block={number:finalized,hash:HASH};
   const result={
    eth_chainId:chain,
    eth_getBlockByNumber:p.params[0]==='finalized'?block:{number:latest,hash:'0x'+'2'.repeat(64)},
    eth_getBlockByHash:canonical?block:null,
    eth_getCode:code,
    eth_call:'0x'+('0'.repeat(63))+(authorized?'1':'0')
   }[p.method];
   return {ok:true,json:async()=>({jsonrpc:'2.0',id:p.id,result})};
  }});
 return {rpc,methods,setCode:v=>code=v,setAuthorized:v=>authorized=v,
  setChain:v=>chain=v,setFinalized:v=>finalized=v,setCanonical:v=>canonical=v};
}
test('pinned finalized block and exact runtime code guard EIP-1898 eligibility',async()=>{
 const x=fixture(),f=await x.rpc.getFinalizedBlock();
 assert.equal(f.number,100);assert.equal(f.confirmations,15);
 assert.equal(await x.rpc.readGate({registryAddress:ADDR,account:WALLET,scope:SCOPE,
  blockHash:HASH,requireCanonical:true}),true);
 const call=x.methods.find(x=>x.method==='eth_call');
 assert.equal(call.params[1].blockHash,HASH);
 assert.equal(call.params[1].requireCanonical,true);
 assert.equal(call.params[0].data,'0x12345678'+'0'.repeat(24)+WALLET.slice(2)+SCOPE.slice(2));
 assert.equal(x.methods.find(x=>x.method==='eth_getCode').params[1].blockHash,HASH);
});
test('mismatched chain, spoofed canonical block, wrong bytecode, revoked gate fail closed',async()=>{
 const x=fixture(),params={registryAddress:ADDR,account:WALLET,scope:SCOPE,
  blockHash:HASH,requireCanonical:true};
 x.setChain('0x1a5');await assert.rejects(x.rpc.getFinalizedBlock(),/premium-chain-mismatch/);
 x.setChain('0x1a4');x.setCanonical(false);
 await assert.rejects(x.rpc.getFinalizedBlock(),/premium-finality-unavailable/);
 x.setCanonical(true);x.setCode('0x6000');
 await assert.rejects(x.rpc.readGate(params),/premium-code-mismatch/);
 x.setCode(CODE);x.setAuthorized(false);
 assert.equal(await x.rpc.readGate(params),false);
 await assert.rejects(x.rpc.readGate({...params,requireCanonical:false}),/premium-rpc-invalid-input/);
});
test('missing pin or insecure endpoint rejects configuration',()=>{
 assert.throws(()=>createHighCountryPremiumRpc420({endpoint:'http://rpc.example',networkId:'420',
  expectedRegistryCode:CODE,eligibleSelector:'0x12345678'}),/premium-rpc-config-invalid/);
});
