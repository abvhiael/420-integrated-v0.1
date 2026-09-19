import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { VaultRPCEvidence420 } from '../src/vault-rpc-evidence.js';

const id=(n:string)=>`0x${n.repeat(64)}` as `0x${string}`;
const operation=id('1'), obligation=id('2'), vaultRef=id('3'), txHash=id('4'), blockHash=id('5');
const vault='0x1111111111111111111111111111111111111111';
const accounting='0x2222222222222222222222222222222222222222';
const beneficiary='0x3333333333333333333333333333333333333333';
const other='0x4444444444444444444444444444444444444444';
const asset='0x5555555555555555555555555555555555555555';
const withdrawal=new Interface(['event Withdrawal(bytes32 indexed operationId,address indexed asset,address indexed recipient,uint256 amount)']);
const claimed=new Interface(['event ObligationClaimed(bytes32 indexed obligationId,uint256 amount)']);
function eventLog(iface:Interface, name:string, args:unknown[], emitter:string) {
 const encoded=iface.encodeEventLog(iface.getEvent(name)!,args);
 return {address:emitter,topics:encoded.topics,data:encoded.data};
}
function fixture() {
 const w=eventLog(withdrawal,'Withdrawal',[operation,asset,beneficiary,42n],vault);
 const c=eventLog(claimed,'ObligationClaimed',[obligation,42n],accounting);
 const receipt={status:1,blockNumber:9,blockHash,hash:txHash,logs:[w,c]};
 const rpc={
  async getLogs(){return [{...w,transactionHash:txHash,blockNumber:9,blockHash}];},
  async getTransactionReceipt(){return receipt;},
  async getBlock(){return {hash:blockHash};}
 };
 // Receipt-verification-only fixture with the deployment and pinned-block prerequisites
 // stubbed. This is not a replacement for open() tests or a real RPC integration test.
 const reader=Object.assign(Object.create(VaultRPCEvidence420.prototype),{
  rpc,config:{vaultRef,fromBlock:0},addresses:{vault,accounting},height:10,
  vaultContract:{async executedOperation(){return true;}},
  async assertCanonical(){return;},
  async obligation(){return {obligationId:obligation,vaultRef,sourceRef:id('6'),asset,beneficiary,amount420:42n,state:'CLAIMED'};}
 }) as VaultRPCEvidence420;
 return {reader,receipt,rpc,w,c};
}
test('accepts only matching claimed obligation and withdrawal from approved emitters',async()=>{
 const f=fixture();
 const result=await f.reader.payout(operation);
 assert.equal(result?.operationId,operation);
 assert.equal(result?.obligationId,obligation);
 assert.equal(result?.amount420,42n);
 assert.equal(result?.txHash,txHash);
});
test('rejects forged accounting emitter, absent claim, duplicate claim and mismatched amount',async()=>{
 const f=fixture();
 f.receipt.logs=[f.w,{...f.c,address:other}];
 await assert.rejects(f.reader.payout(operation),/unique matching claim/);
 f.receipt.logs=[f.w];
 await assert.rejects(f.reader.payout(operation),/unique matching claim/);
 f.receipt.logs=[f.w,f.c,f.c];
 await assert.rejects(f.reader.payout(operation),/unique matching claim/);
 f.receipt.logs=[f.w,eventLog(claimed,'ObligationClaimed',[obligation,41n],accounting)];
 await assert.rejects(f.reader.payout(operation),/events disagree/);
});
test('rejects wrong operation, failed transaction, unconfirmed receipt and reorg',async()=>{
 const f=fixture();
 f.receipt.status=0;
 await assert.rejects(f.reader.payout(operation),/not canonically confirmed/);
 f.receipt.status=1; f.receipt.blockNumber=11;
 await assert.rejects(f.reader.payout(operation),/not canonically confirmed/);
 f.receipt.blockNumber=9; f.receipt.blockHash=id('a');
 await assert.rejects(f.reader.payout(operation),/not canonically confirmed/);
 f.receipt.blockHash=blockHash;
 f.rpc.getBlock=async()=>({hash:id('a')});
 await assert.rejects(f.reader.payout(operation),/receipt reorganized/);
});
test('rejects payout to substituted recipient or claimed obligation bound to wrong asset',async()=>{
 const f=fixture();
 f.receipt.logs=[eventLog(withdrawal,'Withdrawal',[operation,asset,other,42n],vault),f.c];
 await assert.rejects(f.reader.payout(operation),/does not match claimed obligation/);
 f.receipt.logs=[eventLog(withdrawal,'Withdrawal',[operation,other,beneficiary,42n],vault),f.c];
 await assert.rejects(f.reader.payout(operation),/does not match claimed obligation/);
});
