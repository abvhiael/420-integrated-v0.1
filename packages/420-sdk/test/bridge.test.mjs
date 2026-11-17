import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBridgeSdk420} from '../dist/index.js';
const address='0x'+'11'.repeat(20),hash='0x'+'22'.repeat(32);
const sdk={network:{chainId:1056n},contracts:{chainId:1056n},contract:n=>n==='ProtocolRegistry'?{address,verified:true}:null};
test('bridge SDK packages the canonical Wallet runtime byte for byte',()=>{
 assert.equal(readFileSync(new URL('../dist/bridge-runtime.js',import.meta.url),'utf8'),readFileSync(new URL('../../../wallet/web/core/bridge-client.js',import.meta.url),'utf8'));
});
test('bridge SDK resolves trusted registry catalogue entry and defers chain operations to EIP-1193 runtime',async()=>{
 const calls=[];const provider={async request(input){calls.push(input);if(input.method==='eth_chainId')return '0x420';if(input.method==='eth_requestAccounts')return [address];throw Error('unexpected RPC');}};
 const client=createBridgeSdk420({sdk,provider,registryCodeHash:hash});assert.equal(await client.connect(),address);assert.equal(calls[0].method,'eth_chainId');
 assert.throws(()=>createBridgeSdk420({sdk:{...sdk,contract:()=>null},provider,registryCodeHash:hash}),/canonical ProtocolRegistry/);
 assert.throws(()=>createBridgeSdk420({sdk,provider,registryCodeHash:hash,exchangeQualificationCodeHash:hash}),/Exchange/);
});
