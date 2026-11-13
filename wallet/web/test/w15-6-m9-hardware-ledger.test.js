import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerDerivationPath420,ledgerWrap420,ledgerUnwrap420,
 ledgerParseAddress420,ledgerGetAddressApdu420} from '../../extension/core/hardware-ledger.js';
import {Wallet} from '../../extension/vendor/ethers-6.17.0.min.js';

test('hardware paths are bounded and hardened exactly as BIP-44 Ethereum paths',()=>{
 const d=ledgerDerivationPath420(12,3);
 assert.equal(d.path,"m/44'/60'/3'/0/12");
 assert.equal(d.bytes.length,21);
 const v=new DataView(d.bytes.buffer);
 assert.deepEqual([1,2,3,4,5].map(i=>v.getUint32(i*4-3,false)),
  [0x8000002c,0x8000003c,0x80000003,0,12]);
 for(const x of [-1,500,1.5,NaN])assert.throws(()=>ledgerDerivationPath420(x));
 for(const x of [-1,500,1.5])assert.throws(()=>ledgerDerivationPath420(0,x));
 const {apdu}=ledgerGetAddressApdu420(0);
 assert.deepEqual([...apdu.slice(0,6)],[0xe0,0x02,0x01,0x00,21,5]);
});
test('Ledger HID framing detects replay, channel and truncation',()=>{
 for(const n of [2,60,120,250]){
   const bytes=Uint8Array.from({length:n},(_,i)=>i%256);
   const frames=ledgerWrap420(bytes);
   assert.deepEqual(ledgerUnwrap420(frames),bytes);
   assert.throws(()=>ledgerUnwrap420(frames.slice(0,-1)),/Incomplete|Missing/);
   const altered=frames.map(x=>Uint8Array.from(x));altered[0][0]=0;
   assert.throws(()=>ledgerUnwrap420(altered),/channel/);
 }
});
test('Ledger address must match cryptographically reconstructed public key',()=>{
 const wallet=new Wallet('0x'+'11'.repeat(32));
 const pub=Buffer.from(wallet.signingKey.publicKey.slice(2),'hex');
 const addr=Buffer.from(wallet.address.slice(2),'ascii');
 const response=Uint8Array.from([65,...pub,40,...addr,0x90,0x00]);
 assert.equal(ledgerParseAddress420(response),wallet.address.toLowerCase());
 const fake=Uint8Array.from(response);fake[70]=fake[70]===48?49:48;
 assert.throws(()=>ledgerParseAddress420(fake),/disagree|Invalid/);
 assert.throws(()=>ledgerParseAddress420(Uint8Array.from([...response.slice(0,-2),0x69,0x85])),/rejected/);
 assert.throws(()=>ledgerParseAddress420(new Uint8Array(1)),/Truncated/);
});
