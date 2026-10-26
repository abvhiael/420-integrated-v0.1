import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SOC5A_ABI,SOC5A_ENABLED_ACTIONS,recoverSignedSocialEnvelope} from '../src/canonical-social-chain-adapter.js';
import {privateKeyToAccount} from 'viem/accounts';
const files={
 organizations:'contracts/src/highcountry/organization/OrganizationRegistry.sol',
 cooperatives:'contracts/src/highcountry/cooperative/CooperativeRegistry.sol',
 governance:'contracts/src/highcountry/cooperative/CooperativeGovernance.sol',
 executor:'contracts/src/highcountry/cooperative/GovernanceExecutor.sol',
 authority:'contracts/src/highcountry/organization/OrganizationAuthority.sol'
};
test('all enabled action function selectors have identical Solidity signature and argument arity',()=>{
 for(const action of SOC5A_ENABLED_ACTIONS){
  const op=SOC5A_ABI[action];assert.ok(op,action);
  const contract=readFileSync(files[op.contract],'utf8');
  const fn=op.sig.split('(')[0],types=op.sig.match(/\((.*)\)/)[1].split(',');
  const match=contract.match(new RegExp('function\\s+'+fn+'\\s*\\(([\\s\\S]*?)\\)\\s*external'));
  assert.ok(match,action+' missing exact contract function');
  const actual=(match[1].match(/\b(?:address|bytes32|bool|uint64|uint32)\b/g)||[]);
  assert.deepEqual(actual,types,action+' signature drift');
 }
 for(const action of ['organization.delegate','organization.delegate.revoke','cooperative.vote','cooperative.propose','cooperative.execute'])
  assert.equal(SOC5A_ENABLED_ACTIONS.includes(action),false,'unverified permission cannot be enabled');
});
test('real EIP-1559 wallet-signed transaction recovers exact sender and values',async()=>{
 const account=privateKeyToAccount('0x'+'11'.repeat(32));
 const raw=await account.signTransaction({chainId:420,to:'0x'+'2'.repeat(40),nonce:7,gas:100000n,maxFeePerGas:2000000000n,maxPriorityFeePerGas:1000000000n,value:0n,data:'0x12345678',type:'eip1559'});
 const decoded=await recoverSignedSocialEnvelope(raw);
 assert.equal(decoded.from,account.address);
 assert.equal(decoded.to,'0x'+'2'.repeat(40));
 assert.equal(decoded.chainId,420);
 assert.equal(decoded.nonce,7);
 assert.equal(decoded.input,'0x12345678');
 assert.equal(decoded.value,0n);
 await assert.rejects(recoverSignedSocialEnvelope('0xdeadbeef'),/signature|incomplete|transaction/);
});
