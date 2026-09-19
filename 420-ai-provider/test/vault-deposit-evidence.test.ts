import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, JsonRpcProvider } from 'ethers';
import { verifyNativeVaultDeposit420 } from '../src/vault-deposit-evidence.js';

const id=(n:string)=>`0x${n.repeat(64)}` as `0x${string}`;
const payer='0x1111111111111111111111111111111111111111';
const vault='0x2222222222222222222222222222222222222222';
const other='0x3333333333333333333333333333333333333333';
const abi=new Interface(['event NativeDeposited(address indexed from,uint256 amount)']);
const encoded=abi.encodeEventLog(abi.getEvent('NativeDeposited')!,[payer,42n]);
const expectation={txHash:id('a'),payer,vaultAddress:vault,amount420:42n};
const policy={chainId:420n,confirmations:2,pinnedBlockNumber:10,pinnedBlockHash:id('b'),approvedVaultAddress:vault};
function fixture(){
 const state={network:420n,tip:12,pinnedHash:policy.pinnedBlockHash,receiptHash:policy.pinnedBlockHash};
 const tx={hash:expectation.txHash,to:vault,from:payer,value:42n,blockNumber:9,blockHash:policy.pinnedBlockHash};
 const receipt={hash:expectation.txHash,status:1,blockNumber:9,blockHash:policy.pinnedBlockHash,logs:[{address:vault,topics:encoded.topics,data:encoded.data}]};
 const rpc={async getNetwork(){return {chainId:state.network};},async getBlockNumber(){return state.tip;},async getBlock(n:number){return {hash:n===10?state.pinnedHash:state.receiptHash};},async getTransaction(){return tx;},async getTransactionReceipt(){return receipt;}} as unknown as JsonRpcProvider;
 return {state,tx,receipt,rpc};
}
test('accepts one canonical native Vault deposit without inferring job funding',async()=>{
 const f=fixture();
 const result=await verifyNativeVaultDeposit420(f.rpc,expectation,policy);
 assert.equal(result.payer,payer);
 assert.equal(result.amount420,42n);
 assert.equal(result.canonical,true);
 assert.equal(result.blockNumber,9);
});
test('rejects substituted payer, recipient Vault, value or failed receipt',async()=>{
 const f=fixture();
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,{...expectation,payer:other},policy),/transaction does not match/);
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,{...expectation,vaultAddress:other},policy),/unapproved Vault/);
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,{...expectation,amount420:41n},policy),/transaction does not match/);
 f.receipt.status=0;
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/transaction does not match/);
});
test('rejects missing, forged, duplicate and inconsistent native deposit events',async()=>{
 const f=fixture();
 const original=f.receipt.logs[0];
 f.receipt.logs=[];
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/unique approved/);
 f.receipt.logs=[{...original,address:other}];
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/unique approved/);
 f.receipt.logs=[original,original];
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/unique approved/);
 const wrong=abi.encodeEventLog(abi.getEvent('NativeDeposited')!,[other,42n]);
 f.receipt.logs=[{address:vault,topics:wrong.topics,data:wrong.data}];
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/event disagrees/);
});
test('rejects changed chain, inadequate confirmations and reorganized receipt or pinned block',async()=>{
 const f=fixture();
 f.state.network=421n;
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/chain or confirmation/);
 f.state.network=420n; f.state.tip=11;
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/chain or confirmation/);
 f.state.tip=12; f.state.pinnedHash=id('c');
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/pinned block reorganized/);
 f.state.pinnedHash=policy.pinnedBlockHash; f.state.receiptHash=id('d');
 await assert.rejects(verifyNativeVaultDeposit420(f.rpc,expectation,policy),/receipt reorganized/);
});
