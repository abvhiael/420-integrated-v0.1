import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CanonicalSocialChainAdapter,SOC5A_ABI,SOC5A_ENABLED_ACTIONS,recoverSignedSocialEnvelope} from '../src/canonical-social-chain-adapter.js';
import {calldata} from '../src/finalized-rpc.js';
import {keccak256} from '../src/keccak.js';
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
  assert.equal(SOC5A_ENABLED_ACTIONS.includes(action),true,'canonical social action unexpectedly unavailable');
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

test('real signed wallet transaction is independently matched to intent before and after RPC broadcast',async()=>{
 const account=privateKeyToAccount('0x'+'11'.repeat(32)),to='0x'+'2'.repeat(40),org='0x'+'a'.repeat(64);
 const raw=await account.signTransaction({chainId:420,to,nonce:3,gas:100000n,maxFeePerGas:2000000000n,maxPriorityFeePerGas:1000000000n,value:0n,data:calldata('join(bytes32)',org),type:'eip1559'});
 const id=keccak256(Buffer.from(raw.slice(2),'hex'));
 const addresses=Object.fromEntries(['organizations','cooperatives','governance','executor','authority'].map(k=>[k,to]));
 const spec=Object.fromEntries(Object.keys(addresses).map(k=>[k,{address:to,codeHash:'0x'+'b'.repeat(64)}]));
 const calls=[];
 const rpc={chainId:420,contracts:spec,request:async(method,params)=>{
  calls.push(method);
  if(method==='eth_sendRawTransaction')return id;
  if(method==='eth_getTransactionByHash')return {hash:id,from:account.address,to,input:calldata('join(bytes32)',org),chainId:'0x1a4',nonce:'0x3',value:'0x0'};
  throw Error('unexpected RPC method');
 },call:async()=>{throw Error('not a chain read')},header:async()=>({hash:'0x'+'f'.repeat(64),number:'0x1'})};
 const adapter=new CanonicalSocialChainAdapter({rpc,contracts:addresses,scope:'HC',emergencyDomain:'0x'+'c'.repeat(64),
  organizationEmergencyDomain:keccak256(Buffer.from('HC.EMERGENCY.ORGANIZATION_GOVERNANCE')),
  cooperativeEmergencyDomain:keccak256(Buffer.from('HC.EMERGENCY.COOPERATIVE_GOVERNANCE'))});
 const result=await adapter.submitSigned({wallet:account.address,action:'organization.join',payload:{organization:org,signedRawTransaction:raw}});
 assert.equal(result.hash,id);
 assert.deepEqual(calls,['eth_sendRawTransaction','eth_getTransactionByHash']);
 await assert.rejects(adapter.submitSigned({wallet:to,action:'organization.join',payload:{organization:org,signedRawTransaction:raw}}),/prebroadcast signed intent mismatch/);
 assert.deepEqual(calls,['eth_sendRawTransaction','eth_getTransactionByHash']);
});
test('misconfigured emergency domain cannot authorize operations',()=>{
 const addr='0x'+'2'.repeat(40);
 const rpc={chainId:420,contracts:Object.fromEntries(['organizations','cooperatives','governance','executor','authority'].map(k=>[k,{address:addr,codeHash:'0x'+'b'.repeat(64)}])),
  request:async()=>null,call:async()=>null};
 assert.throws(()=>new CanonicalSocialChainAdapter({rpc,contracts:Object.fromEntries(Object.keys(rpc.contracts).map(k=>[k,addr])),scope:'HC',emergencyDomain:'0x'+'a'.repeat(64),
  organizationEmergencyDomain:'0x'+'a'.repeat(64),cooperativeEmergencyDomain:'0x'+'a'.repeat(64)}),/incorrect canonical emergency domain binding/);
});
