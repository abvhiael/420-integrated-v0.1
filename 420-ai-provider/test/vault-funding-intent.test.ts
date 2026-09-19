import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, JsonRpcProvider, Wallet } from 'ethers';
import { nativeFundingIntentTypes420, verifyNativeFundingPreflight420, type NativeFundingIntent420 } from '../src/vault-funding-intent.js';
import type { VaultEvidenceReader420, VaultEscrowSnapshot420, VaultObligationSnapshot420 } from '../src/vault-reconciliation.js';

const id=(n:string)=>`0x${n.repeat(64)}` as `0x${string}`;
const payerWallet=new Wallet('0x'+'11'.repeat(32));
const payer=payerWallet.address;
const vault='0x2222222222222222222222222222222222222222';
const beneficiary='0x3333333333333333333333333333333333333333';
const ZERO='0x0000000000000000000000000000000000000000';
const policy={chainId:420n,confirmations:2,pinnedBlockNumber:10,pinnedBlockHash:id('b'),approvedVaultAddress:vault,nowSeconds:100n};
const intent:NativeFundingIntent420={jobId:id('1'),providerId:id('2'),payer,beneficiary,vaultRef:id('3'),vaultAddress:vault,fundingRef:id('4'),obligationId:id('5'),depositTxHash:id('a'),amount420:42n,nonce:id('6'),deadline:200n};
const abi=new Interface(['event NativeDeposited(address indexed from,uint256 amount)']);
async function sign(i:NativeFundingIntent420=intent,chainId=policy.chainId){return payerWallet.signTypedData({name:'420AI Native Vault Funding',version:'1',chainId,verifyingContract:vault},nativeFundingIntentTypes420,i);}
function fixture(){
 const event=abi.encodeEventLog(abi.getEvent('NativeDeposited')!,[payer,42n]);
 const state={network:420n,tip:12,pinnedHash:policy.pinnedBlockHash,receiptHash:policy.pinnedBlockHash};
 const tx={hash:intent.depositTxHash,to:vault,from:payer,value:42n,blockNumber:9,blockHash:policy.pinnedBlockHash};
 const receipt={hash:intent.depositTxHash,status:1,blockNumber:9,blockHash:policy.pinnedBlockHash,logs:[{address:vault,topics:event.topics,data:event.data}]};
 const escrow={jobId:intent.jobId,state:'NONE'} as VaultEscrowSnapshot420;
 const obligation={obligationId:intent.obligationId,vaultRef:intent.vaultRef,sourceRef:intent.fundingRef,asset:ZERO,beneficiary,amount420:42n,state:'RESERVED'} as VaultObligationSnapshot420;
 const rpc={async getNetwork(){return {chainId:state.network};},async getBlockNumber(){return state.tip;},async getBlock(n:number){return {hash:n===10?state.pinnedHash:state.receiptHash};},async getTransaction(){return tx;},async getTransactionReceipt(){return receipt;}} as unknown as JsonRpcProvider;
 const reader={async escrow(){return escrow;},async obligation(){return obligation;},async payout(){return null;}} as VaultEvidenceReader420;
 return {state,tx,receipt,escrow,obligation,rpc,reader};
}
test('EOA-signed intent binds payer, job, deposit and reserved native Vault obligation',async()=>{
 const f=fixture();
 const result=await verifyNativeFundingPreflight420(f.rpc,f.reader,intent,await sign(),policy);
 assert.equal(result.jobId,intent.jobId);
 assert.equal(result.obligationId,intent.obligationId);
});
test('rejects forged signature, cross-job reuse, expired intent and wrong network domain',async()=>{
 const f=fixture();
 const signature=await sign();
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,{...intent,jobId:id('7')},signature,policy),/signer is not payer/);
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,await sign(intent,421n),policy),/signer is not payer/);
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,{...policy,nowSeconds:201n}),/expired/);
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,{...intent,payer:beneficiary},signature,policy),/signer is not payer/);
});
test('rejects absent reservation, reused job escrow, wrong beneficiary or funding reference',async()=>{
 const f=fixture();
 const signature=await sign();
 f.obligation.state='CLAIMED';
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/dedicated native funding obligation/);
 f.obligation.state='RESERVED'; f.obligation.beneficiary=payer;
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/dedicated native funding obligation/);
 f.obligation.beneficiary=beneficiary; f.obligation.sourceRef=id('7');
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/dedicated native funding obligation/);
 f.obligation.sourceRef=intent.fundingRef; f.escrow.state='FUNDED';
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/escrow already funded/);
});
test('rejects substituted deposit transaction and reorganized confirmed history',async()=>{
 const f=fixture(); const signature=await sign();
 f.tx.value=41n;
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/deposit transaction does not match/);
 f.tx.value=42n; f.state.pinnedHash=id('c');
 await assert.rejects(verifyNativeFundingPreflight420(f.rpc,f.reader,intent,signature,policy),/pinned block reorganized/);
});
