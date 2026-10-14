import test from 'node:test';
import assert from 'node:assert/strict';
import {createIndependentFinalityWitness420} from '../src/independent-finality-witness.js';
const H=x=>'0x'+x.repeat(64);
const target=H('a');
let chain='0x1a4',head='0x14',remoteHash=target,reorg=false;
const fetchImpl=async(_url,{body})=>{
 const x=JSON.parse(body);
 let result;
 if(x.method==='eth_chainId')result=chain;
 else if(x.method==='eth_getBlockByNumber'&&x.params[0]==='finalized')
  result={hash:H('c'),number:head};
 else if(x.method==='eth_getBlockByNumber')
  result={hash:reorg?H('d'):remoteHash,number:'0xa'};
 return {ok:true,json:async()=>({jsonrpc:'2.0',id:x.id,result})};
};
const verify=()=>createIndependentFinalityWitness420({url:'https://independent.example/rpc',
 chainId:420,fetchImpl});
test('R05.7 separately observed finalized head and matching hash accepts',async()=>{
 chain='0x1a4';head='0x14';reorg=false;remoteHash=target;
 assert.equal(await verify()({chainId:'420',blockHash:target,blockNumber:'10'}),true);
});
test('R05.7 wrong chain, nonfinal and divergent fork all fail closed',async()=>{
 chain='0x1';
 await assert.rejects(()=>verify()({chainId:'420',blockHash:target,blockNumber:'10'}),/r057-witness-chain-diverged/);
 chain='0x1a4';head='0x9';
 await assert.rejects(()=>verify()({chainId:'420',blockHash:target,blockNumber:'10'}),/r057-witness-finality-lag/);
 head='0x14';reorg=true;
 await assert.rejects(()=>verify()({chainId:'420',blockHash:target,blockNumber:'10'}),/r057-witness-fork-mismatch/);
 reorg=false;
 await assert.rejects(()=>verify()({chainId:'420',blockHash:target,blockNumber:'bad'}),/r057-witness-request-invalid/);
});
