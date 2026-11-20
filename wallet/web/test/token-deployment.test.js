import test from 'node:test';
import assert from 'node:assert/strict';
import {readTokenDeployment420} from '../core/token-deployment.js';
import {TOKEN_TEMPLATES_420,tokenHashText420} from '../core/token-sdk.js';
import {TOKEN_CREATION_FEE_WEI_420} from '../core/token-runtime.js';
import {fixture,abi,addr,digest,account,controller,vaultHash,word} from './token-test-fixture.js';
const fee=TOKEN_CREATION_FEE_WEI_420,hash=digest(400),blockHash=digest(401),token=addr(77);
function setup(profile=TOKEN_TEMPLATES_420[0]){
  const f=fixture(),r=f.binding,q={chainId:420,controller,smartAccount:account,request:{target:r.factory.address},communityTreasuryVault:r.communityTreasuryVault.address,release:r.release,
    transaction:{data:'0x1234'},templateId:profile.id,configHash:digest(402),predictedAddress:token,gasUnits:'100000',gasPriceWei:'2'};
  const submitted={txHash:hash,review:q,maxGasWei:'200000',maxTotalWei:(fee+200000n).toString()};
  const log={address:r.factory.address,blockNumber:'0x10',blockHash,transactionHash:hash,transactionIndex:'0x0',removed:false};
  const receipt={transactionHash:hash,blockNumber:'0x10',blockHash,transactionIndex:'0x0',status:'0x1',from:controller,to:account,gasUsed:'0x100',effectiveGasPrice:'0x2',
    logs:[{...log,logIndex:'0x0',topics:[tokenHashText420('TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)'),abi(token),abi(account),profile.id],data:abi(1,q.configHash,fee)},
      {...log,logIndex:'0x1',topics:[tokenHashText420('CreationFeeDeposited(address,bytes32,uint256)'),abi(r.communityTreasuryVault.address),vaultHash],data:abi(fee)}]};
  const tx={hash,blockNumber:'0x10',blockHash,from:controller,to:account,value:'0x0',input:q.transaction.data,type:'0x0',chainId:'0x1a4',gas:'0x186a0',gasPrice:'0x2'};
  const control={receipt,tx,blockHash,tip:'0x10',chain:'0x1a4',registered:true,code:'0x6001',reads:0};
  const provider={request:async(method,args=[])=>{
    if(method==='eth_chainId')return control.chain;
    if(method==='eth_getTransactionReceipt'){control.reads++;return structuredClone(control.receipt);}
    if(method==='eth_getTransactionByHash')return control.tx;
    if(method==='eth_getBlockByNumber')return {number:'0x10',hash:control.blockHash};
    if(method==='eth_blockNumber')return control.tip;
    if(method==='eth_getCode'&&args[0]===token)return control.code;
    if(method==='eth_call')return abi(control.registered?1:0);
    return f.provider.request(method,args);
  }};
  return {control,provider,submitted,r,read:options=>readTokenDeployment420(provider,submitted,r,options)};
}
test('all eight templates require canonical matching creation and exact Treasury fee events, code and factory provenance',async()=>{
  for(const p of TOKEN_TEMPLATES_420){const x=setup(p),v=await x.read();assert.equal(v.status,'confirmed');assert.equal(v.tokenAddress,token);assert.equal(v.templateId,p.id);assert.equal(v.creationFeeWei,fee.toString());assert.equal(v.confirmations,1n);}
});
test('pending, confirming, reorganized and reverted never expose deployment address',async()=>{
  for(const status of ['pending','confirming','reorganized','reverted']){const x=setup();if(status==='pending')x.control.receipt=null;if(status==='reorganized')x.control.blockHash=digest(99);if(status==='reverted'){x.control.receipt.status='0x0';x.control.receipt.logs=[];}const v=await x.read({confirmations:status==='confirming'?2:1});assert.equal(v.status,status);assert.equal(v.tokenAddress,null);}
});
test('reject spoofed receipt, changed transaction, excess fees, missing or duplicate events, wrong owner/template/config/vault/fee/address and absent provenance',async()=>{
  for(const mutate of [
    c=>{c.tx.input='0x00'},c=>{c.tx.from=addr(99)},c=>{c.tx.gasPrice='0x3'},c=>{c.receipt.gasUsed='0x186a1'},
    c=>{c.receipt.logs.pop()},c=>{c.receipt.logs.push(c.receipt.logs[0])},c=>{c.receipt.logs[0].address=addr(99)},
    c=>{c.receipt.logs[0].topics[1]=abi(addr(99))},c=>{c.receipt.logs[0].topics[2]=abi(addr(99))},c=>{c.receipt.logs[0].topics[3]=digest(99)},
    c=>{c.receipt.logs[0].data=abi(1,digest(99),fee)},c=>{c.receipt.logs[1].topics[1]=abi(addr(99))},
    c=>{c.receipt.logs[1].data=abi(fee-1n)},c=>{c.receipt.logs[0].removed=true},c=>{c.receipt.logs[1].transactionHash=digest(99)},
    c=>{c.registered=false},c=>{c.code='0x'},c=>{c.chain='0x1'}
  ]){const x=setup();mutate(x.control);await assert.rejects(x.read());}
});
test('receipt disappearing during deployment evidence reads downgrades to reorganized',async()=>{
  const x=setup(),original=x.provider.request;x.provider.request=async(...a)=>{if(a[0]==='eth_getTransactionReceipt'&&x.control.reads>=2)return null;return original(...a);};
  const v=await x.read();assert.equal(v.status,'reorganized');assert.equal(v.tokenAddress,null);
});
