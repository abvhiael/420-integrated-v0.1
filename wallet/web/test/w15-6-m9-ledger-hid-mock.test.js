import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from '../../extension/vendor/ethers-6.17.0.min.js';
import {ledgerOpen420,ledgerWrap420,ledgerUnwrap420} from '../../extension/core/hardware-ledger.js';
import {prepareHardwareTransaction420,acceptHardwareTxSignature420} from '../../extension/core/hardware-signing.js';

const signer=new Wallet('0x'+'22'.repeat(32));
const addressBytes=Buffer.from(signer.address.slice(2),'ascii');
const pub=Buffer.from(signer.signingKey.publicKey.slice(2),'hex');
function output(payload){return Uint8Array.from([...payload,0x90,0x00]);}
class FakeLedger {
  constructor(){this.vendorId=0x2c97;this.opened=false;this.listeners=new Map();this.packets=[];this.commands=[];}
  async open(){this.opened=true;}
  async close(){this.opened=false;}
  addEventListener(k,fn){this.listeners.set(k,fn);}
  removeEventListener(k){this.listeners.delete(k);}
  async sendReport(id,bytes){
    assert.equal(id,0);
    this.packets.push(Uint8Array.from(bytes));
    const length=this.packets[0][5]*256+this.packets[0][6];
    if(57+Math.max(0,this.packets.length-1)*59<length)return;
    const apdu=ledgerUnwrap420(this.packets);
    this.commands.push(apdu);
    this.packets=[];
    let response;
    if(apdu[1]===0x02)response=output([65,...pub,40,...addressBytes]);
    else if(apdu[1]===0x04){
      const sig=signer.signingKey.sign(this.prepared.tx.unsignedHash);
      response=output([sig.yParity,...Buffer.from(sig.r.slice(2),'hex'),...Buffer.from(sig.s.slice(2),'hex')]);
    }else throw new Error('Unexpected Ledger APDU');
    queueMicrotask(()=>{
      const listener=this.listeners.get('inputreport');
      for(const frame of ledgerWrap420(response))listener?.({device:this,data:new DataView(frame.buffer)});
    });
  }
}
test('mock WebHID Ledger requires explicit selection, address and signer equality',async()=>{
 const device=new FakeLedger(),hid={requestDevice:async({filters})=>{
   assert.deepEqual(filters,[{vendorId:0x2c97}]);
   return [device];
 }};
 const ledger=await ledgerOpen420(hid);
 const found=await ledger.address(0,0);
 assert.equal(found.address,signer.address.toLowerCase());
 const transaction={executionModel:'hardware',chainId:'0x1a4',from:signer.address,
  to:'0x'+'33'.repeat(20),nonce:'0x0',gasLimit:'0x5208',maxFeePerGas:'0x5',maxPriorityFeePerGas:'0x1',value:'0x1',data:'0x'};
 const reviewed=prepareHardwareTransaction420(transaction,'0x1a4',signer.address);
 device.prepared=reviewed;
 const signed=acceptHardwareTxSignature420(reviewed,await ledger.signTransaction({index:0,account:0},reviewed.unsignedSerialized));
 assert.equal(signed.from,signer.address.toLowerCase());
 assert.ok(device.commands.some(x=>x[1]===0x04));
 await ledger.close();assert.equal(device.opened,false);
 await assert.rejects(()=>ledger.address(0,0),/disconnected/);
});
test('no user-selected HID device is a hard failure',async()=>{
 await assert.rejects(()=>ledgerOpen420({requestDevice:async()=>[]}),/No Ledger device selected/);
});
