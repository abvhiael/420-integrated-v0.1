import test from 'node:test';
import assert from 'node:assert/strict';
import { createTreasuryProjectionClient420 } from '../dist/treasury-projection.js';
test('Treasury SDK derived boundary rejects authority, wrong chain and malformed accounting',async()=>{
 const h='0x'+'ab'.repeat(32),a='0x'+'12'.repeat(20);
 const d={chainId:'420',budgetId:h,vaultId:h,category:h,asset:a,ceiling:'100',committed:'90',executed:'50',validFrom:'1',validUntil:'100',civicActionHash:h,metadataHash:h,blockNumber:'9',blockHash:h,transactionHash:h,transactionIndex:0,logIndex:1,authoritative:false};
 const c=createTreasuryProjectionClient420(420n,async path=>{assert.equal(path,'/v1/treasury/budgets/'+h+'?chainId=420');return {apiVersion:'v1',data:d};});
 assert.equal((await c.budget(h)).executed,'50');d.executed='91';await assert.rejects(()=>c.budget(h));d.executed='50';d.authoritative=true;await assert.rejects(()=>c.budget(h));d.authoritative=false;d.chainId='421';await assert.rejects(()=>c.budget(h));
});
