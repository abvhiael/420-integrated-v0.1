import test from 'node:test';
import assert from 'node:assert/strict';
import {addExtensionContact420,removeExtensionContact420,normalizeExtensionAddressBook420} from '../core/extension-address-book.js';
const alice='0x'+'11'.repeat(20),bob='0x'+'22'.repeat(20);
test('addresses and nicknames are validated; no zero address',()=>{
  assert.throws(()=>addExtensionContact420([],{label:'bad',address:'0x'+'00'.repeat(20),chainId:'0x1'}),/nonzero/);
  assert.throws(()=>addExtensionContact420([],{label:'',address:alice,chainId:'0x1'}),/label/);
  assert.throws(()=>addExtensionContact420([],{label:'A'.repeat(49),address:alice,chainId:'0x1'}),/label/);
  assert.throws(()=>addExtensionContact420([],{label:'test',address:alice,chainId:'garbage'}),/chain ID/);
});
test('saved contacts are scoped to network and deduplicated by chain and address',()=>{
  const initial=addExtensionContact420([],{label:'Alice',address:alice,chainId:'0x1'});
  const multi=addExtensionContact420(initial,{label:'Alice on 420',address:alice,chainId:'0x1a4'});
  assert.equal(multi.length,2);
  const changed=addExtensionContact420(multi,{label:'Updated',address:alice,chainId:'0x1'});
  assert.equal(changed.length,2);assert.equal(changed.find(c=>c.chainId==='0x1').label,'Updated');
  const remaining=removeExtensionContact420(changed,{address:alice,chainId:'0x1'});
  assert.deepEqual(remaining,[{label:'Alice on 420',address:alice,chainId:'0x1a4'}]);
});
test('malformed persisted contacts cannot poison address book',()=>{
  const out=normalizeExtensionAddressBook420([null,{label:'Bob',address:bob,chainId:'0x1'},{label:'wrong',address:'garbage',chainId:'0x1'}]);
  assert.equal(out.length,1);assert.equal(out[0].label,'Bob');
});
