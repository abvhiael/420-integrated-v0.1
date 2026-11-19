import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasurySdk420,TREASURY_SERVICE_ID_420} from '../dist/index.js';
test('Treasury SDK packages canonical executable client and binds Registry and chain',async()=>{
 const sdk={network:{chainId:420n},contracts:{chainId:420n},contract:()=>({verified:true,address:'0x0000000000000000000000000000000000000434'})};
 const input={sdk,provider:{request:async()=> '0x2'},registryCodeHash:'0x'+'11'.repeat(32)};
 const client=createTreasurySdk420(input);assert.equal(TREASURY_SERVICE_ID_420,'420/service/treasury/v1');
 await assert.rejects(client.discover(),/wrong Treasury chain/);
 assert.throws(()=>createTreasurySdk420({...input,sdk:{...sdk,contract:()=>({verified:true,address:'0x'+'11'.repeat(20)})}}),/canonical Treasury Registry/);
});
