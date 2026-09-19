import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, JsonRpcProvider, keccak256 } from 'ethers';
import { VaultRPCEvidence420, type VaultRPCEvidenceConfig420 } from '../src/vault-rpc-evidence.js';

const id=(n:string)=>`0x${n.repeat(64)}` as `0x${string}`;
const escrowAddress='0x1111111111111111111111111111111111111111';
const vaultAddress='0x2222222222222222222222222222222222222222';
const accountingAddress='0x3333333333333333333333333333333333333333';
const code='0x6000';
const abi=new Interface(['function vaultId() view returns (bytes32)','function accounting() view returns (address)']);
const config:VaultRPCEvidenceConfig420={chainId:420n,confirmations:2,fromBlock:1,vaultRef:id('1'),escrowAddress,vaultAddress,accountingAddress,escrowCodeHash:keccak256(code) as `0x${string}`,vaultCodeHash:keccak256(code) as `0x${string}`,accountingCodeHash:keccak256(code) as `0x${string}`};
function rpcFixture() {
 const state={chainId:420n,hash:id('a'),code};
 const rpc={
   async getNetwork(){return {chainId:state.chainId};},
   async getBlockNumber(){return 30;},
   async getBlock(_number:number){return {hash:state.hash};},
   async getCode(_address:string,_block:number){return state.code;},
   async call(tx:{to:string;data:string}){
     if (tx.to.toLowerCase()!==vaultAddress.toLowerCase()) throw new Error('unexpected contract call');
     if (tx.data.slice(0,10)===abi.getFunction('vaultId')!.selector) return abi.encodeFunctionResult('vaultId',[config.vaultRef]);
     if (tx.data.slice(0,10)===abi.getFunction('accounting')!.selector) return abi.encodeFunctionResult('accounting',[accountingAddress]);
     throw new Error('unexpected selector');
   },
   async getLogs(){return [];}
 };
 return {rpc:rpc as unknown as JsonRpcProvider,state};
}

test('opens a code-verified, confirmation-pinned reader and rejects an unproven payout',async()=>{
 const {rpc}=rpcFixture();
 const reader=await VaultRPCEvidence420.open(rpc,config);
 assert.equal(reader.height,28);
 assert.equal(await reader.payout(id('2')),null);
});
test('rejects the wrong chain, missing confirmed history and unapproved runtime bytecode',async()=>{
 const f=rpcFixture(); f.state.chainId=421n;
 await assert.rejects(VaultRPCEvidence420.open(f.rpc,config),/chain mismatch/);
 f.state.chainId=420n;
 await assert.rejects(VaultRPCEvidence420.open(f.rpc,{...config,fromBlock:29}),/insufficient confirmed/);
 f.state.code='0x6001';
 await assert.rejects(VaultRPCEvidence420.open(f.rpc,config),/bytecode mismatch/);
});
test('a pinned reader rejects block-hash changes rather than reporting absent payout',async()=>{
 const f=rpcFixture(); const reader=await VaultRPCEvidence420.open(f.rpc,config);
 f.state.hash=id('b');
 await assert.rejects(reader.payout(id('2')),/reorganized/);
});
