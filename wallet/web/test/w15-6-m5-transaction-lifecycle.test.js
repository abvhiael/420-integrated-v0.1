import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 canonicalRecipient420,validateAddressBook420,validateSendRecipient420,
 gasQuote420,exactMax420,checkAvailable420,validatePreview420,
 transitionTransaction420,classifyReceipt420,replacementPolicy420,
 namehashENS420,resolveENS420
} from '../core/extension-transactions.js';
const owner='0x1111111111111111111111111111111111111111';
const destination='0x2222222222222222222222222222222222222222';
const resolver='0x3333333333333333333333333333333333333333';
const hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64);
const base={id:'id1',chainId:'0x1a4',controller:owner,hash,blockHash:null,model:'erc4337',status:'pending'};
const source=p=>readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../extension',p),'utf8');
test('M5 strict recipient and scoped address-book policy',()=>{
 assert.equal(canonicalRecipient420(destination),destination);
 assert.throws(()=>canonicalRecipient420('0x'+'0'.repeat(40)),/Zero address/);
 assert.equal(validateSendRecipient420('alice.eth').kind,'ens');
 assert.equal(validateSendRecipient420('alice.420').kind,'420names');
 for(const x of ['ALICE.ETH','alice.eth.evil','example.com','0x1234','alice 420'])
  assert.throws(()=>validateSendRecipient420(x),/Invalid/);
 const book=validateAddressBook420({entries:[{address:destination,label:'Friend'}]});
 assert.equal(book.entries[0].address,destination);
 assert.throws(()=>validateAddressBook420({entries:[book.entries[0],book.entries[0]]}),/Duplicate/);
 assert.throws(()=>validateAddressBook420({entries:[{address:destination,label:' ' }]}),/label/);
});
test('M5 EIP1559 quote and native Max reserve use exact integer math',()=>{
 const gas=gasQuote420({chainId:'0x1a4',epoch:2,gasLimit:'0x5208',baseFee:'0x64',
  maxPriorityFeePerGas:'0x32',maxFeePerGas:'0xc8'});
 assert.equal(gas.worstCaseFee,(21000n*200n).toString());
 assert.equal(exactMax420({rawBalance:'1000000000000000000',gasReserve:'100000000000000000',
  decimals:18,kind:'native'}),'0.9');
 assert.equal(exactMax420({rawBalance:'1234567',gasReserve:'100000',decimals:6,kind:'erc20'}),'1.234567');
 assert.throws(()=>gasQuote420({chainId:'0x1a4',epoch:2,gasLimit:'0x5208',baseFee:'0x64',
  maxPriorityFeePerGas:'0x32',maxFeePerGas:'0x65'}),/fee/);
 assert.throws(()=>exactMax420({rawBalance:'100',gasReserve:'100',kind:'native'}),/Insufficient/);
 assert.equal(checkAvailable420({balance:{status:'spendable',spendable:'1000'},units:'850',gasReserve:'100'}),true);
 assert.throws(()=>checkAvailable420({balance:{status:'spendable',spendable:'1000'},units:'950',gasReserve:'100'}),/gas/);
 assert.throws(()=>checkAvailable420({balance:{status:'unavailable'},units:'1'}),/unavailable/);
});
test('M5 preview cannot be reused after account, fee, recipient, epoch or time changes',()=>{
 const preview={chainId:'0x1a4',epoch:3,controller:owner,recipient:destination,
  preparedAt:10000,simulation:{success:true},gas:{worstCaseFee:'210000'}};
 assert.equal(validatePreview420(preview,{chainId:'0x1a4',epoch:3,controller:owner,recipient:destination,now:20000}),true);
 assert.throws(()=>validatePreview420(preview,{chainId:'0x1',epoch:3,controller:owner,recipient:destination,now:20000}),/Stale/);
 assert.throws(()=>validatePreview420(preview,{chainId:'0x1a4',epoch:4,controller:owner,recipient:destination,now:20000}),/Stale/);
 assert.throws(()=>validatePreview420(preview,{chainId:'0x1a4',epoch:3,controller:owner,recipient:owner,now:20000}),/Recipient/);
 assert.throws(()=>validatePreview420(preview,{chainId:'0x1a4',epoch:3,controller:owner,recipient:destination,now:60000}),/expired/);
});
test('M5 submission is not confirmation: canonical depth, reverts and reorg are verified',()=>{
 const submitted=transitionTransaction420(base,'submitted');
 const tx={...submitted,hash};
 assert.equal(submitted.status,'submitted');
 const receipt={transactionHash:hash,blockHash,blockNumber:'0xa',status:'0x1'};
 const included=classifyReceipt420(tx,{receipt,head:'0xa'});
 assert.equal(included.status,'included');
 assert.equal(included.confirmations,1);
 const confirmed=classifyReceipt420(included,{receipt,head:'0xc'});
 assert.equal(confirmed.status,'confirmed');
 assert.equal(classifyReceipt420(confirmed,{receipt:null,transaction:null}).status,'confirmed',
  'Temporary receipt absence must not invent a reorganization');
 const reorganized=transitionTransaction420(confirmed,'reorganized',{blockHash:null,confirmations:0});
 assert.equal(reorganized.status,'reorganized');
 const reverted=classifyReceipt420({...submitted,hash},{receipt:{...receipt,status:'0x0'},head:'0xa'});
 assert.equal(reverted.status,'reverted');
 assert.throws(()=>transitionTransaction420(base,'confirmed',{hash,blockHash}),/Illegal/);
 assert.throws(()=>classifyReceipt420({...submitted,hash},{receipt:{...receipt,transactionHash:'0x'+'c'.repeat(64)},head:'0xa'}),/mismatched/);
});
test('M5 EOA replacement and ERC-4337 replacement use independent nonce and fee rules',()=>{
 const old={model:'eoa',nonce:'4',maxFeePerGas:'100',maxPriorityFeePerGas:'20'};
 assert.equal(replacementPolicy420(old,{model:'eoa',nonce:'4',fee:{maxFeePerGas:'111',maxPriorityFeePerGas:'23'}}),true);
 assert.throws(()=>replacementPolicy420(old,{model:'eoa',nonce:'5',fee:{maxFeePerGas:'200',maxPriorityFeePerGas:'40'}}),/nonce/);
 assert.throws(()=>replacementPolicy420(old,{model:'eoa',nonce:'4',fee:{maxFeePerGas:'101',maxPriorityFeePerGas:'21'}}),/insufficient/);
 const smart={model:'erc4337',entryPoint:destination,nonce:'12',nonceKey:'0',
  userOpHash:hash,maxFeePerGas:'200',maxPriorityFeePerGas:'25'};
 assert.equal(replacementPolicy420(smart,{model:'erc4337',nonce:'12',
  operationHash:'0x'+'d'.repeat(64),fee:{maxFeePerGas:'210',maxPriorityFeePerGas:'27'}}),true);
 assert.throws(()=>replacementPolicy420(smart,{model:'erc4337',nonce:'13',
  operationHash:'0x'+'d'.repeat(64),fee:{maxFeePerGas:'210',maxPriorityFeePerGas:'27'}}),/nonce/);
 assert.throws(()=>replacementPolicy420(smart,{model:'eoa',nonce:'12',
  fee:{maxFeePerGas:'210',maxPriorityFeePerGas:'27'}}),/model/);
});
test('M5 ENS canonical resolver is mainnet-only and rechecks chain identity',async()=>{
 const node=namehashENS420('alice.eth');assert.match(node,/^0x[0-9a-f]{64}$/);
 let chain='0x1';
 const provider={request:async(method,params)=>{
  if(method==='eth_chainId')return chain;
  if(method==='eth_getCode')return '0x6001';
  if(method==='eth_call'){
    if(params[0].data.startsWith('0x0178b8bf'))return '0x'+resolver.slice(2).padStart(64,'0');
    if(params[0].data.startsWith('0x3b3b57de'))return '0x'+destination.slice(2).padStart(64,'0');
  }
  throw new Error('Unexpected ENS request');
 }};
 assert.equal((await resolveENS420(provider,'alice.eth','0x1')).recipient,destination);
 await assert.rejects(()=>resolveENS420(provider,'alice.eth','0x1a4'),/not approved/);
 chain='0x2';await assert.rejects(()=>resolveENS420(provider,'alice.eth','0x1'),/chain changed/);
});
test('M5 bundled popup and signing authority fail closed without approved chain authority',()=>{
 const worker=source('service-worker.js'),html=source('popup.html'),popup=source('popup.js');
 for(const m of ['prepare-send','refresh-transactions','address-book-save','max-amount',
   'resolve-recipient','classifyReceipt420','validatePreview420','executeWithLocalAuthority']){
  assert.ok(worker.includes(m),m);
 }
 for(const id of ['receive-qr','send-contact','send-max','send-priority-fee','send-fee-cap',
   'review-simulation','review-fees','refresh-transactions'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('vendor/qrcode.min.js'));
 assert.ok(popup.includes('new QRCode('));
 assert.ok(worker.includes('No verified local signing authority'));
 assert.doesNotMatch(worker,/eth_sendRawTransaction/);
});
