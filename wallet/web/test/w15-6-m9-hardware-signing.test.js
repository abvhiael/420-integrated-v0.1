import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,Signature,TypedDataEncoder,Transaction} from '../../extension/vendor/ethers-6.17.0.min.js';
import {hardwarePath420,prepareHardwareTransaction420,acceptHardwareTxSignature420,
 prepareHardwareTypedData420,acceptHardwareTypedSignature420,preBroadcastHardware420} from '../../extension/core/hardware-signing.js';
import {createTrezorConnect420} from '../../extension/core/hardware-trezor.js';
import {ledgerTransactionChunks420,ledgerTypedHashApdu420,ledgerSignature420} from '../../extension/core/hardware-ledger.js';

const signer=new Wallet('0x'+'11'.repeat(32)), chainId='0x1a4';
const reviewed={executionModel:'hardware',chainId,from:signer.address,to:'0x'+'22'.repeat(20),
 data:'0x',nonce:'0x3',gasLimit:'0x5208',maxFeePerGas:'0x59682f00',maxPriorityFeePerGas:'0x3b9aca00',value:'0x10'};
test('hardware path and reviewed EIP-1559 signing envelope',()=>{
 assert.deepEqual(hardwarePath420("m/44'/60'/0'/0/5").index,5);
 assert.throws(()=>hardwarePath420("m/44'/60'/500'/0/0"));
 const prepared=prepareHardwareTransaction420(reviewed,chainId,signer.address);
 assert.equal(prepared.tx.type,2);
 assert.equal(prepared.tx.nonce,3);
 const signature=signer.signingKey.sign(prepared.tx.unsignedHash);
 const signed=acceptHardwareTxSignature420(prepared,signature);
 assert.equal(Transaction.from(signed.raw).from?.toLowerCase(),signer.address.toLowerCase());
 assert.equal(signed.nonce,'0x3');
 assert.throws(()=>acceptHardwareTxSignature420(prepared,new Wallet('0x'+'33'.repeat(32)).signingKey.sign(prepared.tx.unsignedHash)),/does not match/);
 assert.throws(()=>prepareHardwareTransaction420({...reviewed,chainId:'0x1'},chainId,signer.address),/chain changed/);
 assert.throws(()=>prepareHardwareTransaction420({...reviewed,maxFeePerGas:'0x1'},chainId,signer.address),/fee caps/);
 assert.throws(()=>prepareHardwareTransaction420({...reviewed,from:'0x'+'44'.repeat(20)},chainId,signer.address),/sender mismatch/);
});
test('hardware EIP-712 hash and signer verification rejects cross-chain signatures',()=>{
 const data={types:{EIP712Domain:[{name:'chainId',type:'uint256'}],Gift:[{name:'to',type:'address'},{name:'amount',type:'uint256'}]},
 primaryType:'Gift',domain:{chainId:420},message:{to:reviewed.to,amount:'42'}};
 const prepared=prepareHardwareTypedData420([signer.address,JSON.stringify(data)],chainId,signer.address);
 const expected=TypedDataEncoder.hash(data.domain,{Gift:data.types.Gift},data.message);
 assert.equal(prepared.digest,expected);
 const signature=signer.signingKey.sign(prepared.digest);
 assert.equal(acceptHardwareTypedSignature420(prepared,signature).length,132);
 assert.throws(()=>acceptHardwareTypedSignature420(prepared,new Wallet('0x'+'44'.repeat(32)).signingKey.sign(prepared.digest)),/does not match/);
 assert.throws(()=>prepareHardwareTypedData420([signer.address,JSON.stringify({...data,domain:{chainId:1}})],chainId,signer.address),/chain mismatch/);
 assert.throws(()=>prepareHardwareTypedData420([signer.address,'not json'],chainId,signer.address),/Malformed/);
});
test('ledger APDU chunks preserve transaction bytes and enforce status',()=>{
 const payload='0x'+('ab'.repeat(550));
 const chunks=ledgerTransactionChunks420({index:1,account:0},payload);
 assert.ok(chunks.length>=3);
 assert.equal(chunks[0][1],4);
 assert.equal(chunks[0][2],0);
 assert.equal(chunks[1][2],128);
 const rebuilt=chunks.flatMap((chunk,i)=>Array.from(chunk.subarray(5+(i===0?21:0))));
 assert.equal(Buffer.from(rebuilt).toString('hex'),payload.slice(2));
 const typed=ledgerTypedHashApdu420({index:0,account:0},'0x'+'01'.repeat(32),'0x'+'02'.repeat(32));
 assert.equal(typed[1],12);
 assert.throws(()=>ledgerTypedHashApdu420({index:0,account:0},'0x0','0x0'),/Invalid/);
 assert.throws(()=>ledgerSignature420(Uint8Array.from([0x69,0x85])),/declined/);
 const sig=signer.signingKey.sign('0x'+'11'.repeat(32));
 const response=Uint8Array.from([sig.yParity,...Buffer.from(sig.r.slice(2),'hex'),...Buffer.from(sig.s.slice(2),'hex'),0x90,0x00]);
 assert.equal(ledgerSignature420(response).r,sig.r);
});
test('Trezor Connect adapter invokes device signing methods and rejects failures',async()=>{
 const calls=[];
 const bridge={
  async ethereumGetAddress(p){calls.push(['address',p]);return {success:true,payload:{address:signer.address}};},
  async ethereumSignTransaction(p){calls.push(['tx',p]);const tx=prepareHardwareTransaction420(reviewed,chainId,signer.address).tx;
   const s=signer.signingKey.sign(tx.unsignedHash);return {success:true,payload:{v:'0x'+s.yParity.toString(16),r:s.r,s:s.s}};},
  async ethereumSignTypedData(p){calls.push(['typed',p]);const t=prepareHardwareTypedData420([signer.address,JSON.stringify({types:{Gift:[{name:'amount',type:'uint256'}]},primaryType:'Gift',domain:{chainId:420},message:{amount:1}})],chainId,signer.address);
   return {success:true,payload:{signature:signer.signingKey.sign(t.digest).serialized}};}
 };
 const adapter=createTrezorConnect420(bridge),path="m/44'/60'/0'/0/0";
 assert.equal((await adapter.address(path)).address,signer.address.toLowerCase());
 const tx=prepareHardwareTransaction420(reviewed,chainId,signer.address);
 assert.equal(acceptHardwareTxSignature420(tx,await adapter.signTransaction(path,tx)).from,signer.address.toLowerCase());
 const typed=prepareHardwareTypedData420([signer.address,JSON.stringify({types:{Gift:[{name:'amount',type:'uint256'}]},primaryType:'Gift',domain:{chainId:420},message:{amount:1}})],chainId,signer.address);
 assert.equal(acceptHardwareTypedSignature420(typed,await adapter.signTypedData(path,typed)).length,132);
 assert.deepEqual(calls.map(x=>x[0]),['address','tx','typed']);
 const rejecting=createTrezorConnect420({...bridge,ethereumGetAddress:async()=>({success:false,payload:{error:'Device rejected'}})});
 await assert.rejects(()=>rejecting.address(path),/Device rejected/);
 await assert.rejects(()=>adapter.address("m/44'/60'/999'/0/0"),/Unapproved/);
});
test('hardware before-broadcast checks nonce, chain, base fee and recipient',async()=>{
 const prepared=prepareHardwareTransaction420(reviewed,chainId,signer.address);
 const p={request:async(m)=>m==='eth_chainId'?chainId:m==='eth_getTransactionCount'?'0x2':{baseFeePerGas:'0x3b9aca00'}};
 await preBroadcastHardware420(p,prepared);
 await assert.rejects(()=>preBroadcastHardware420({request:async m=>m==='eth_chainId'?'0x1':'0x0'},prepared),/network changed/);
 await assert.rejects(()=>preBroadcastHardware420({request:async m=>m==='eth_chainId'?chainId:'0x4'},prepared),/nonce already confirmed/);
});
