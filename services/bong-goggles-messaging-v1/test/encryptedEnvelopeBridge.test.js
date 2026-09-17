import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOutboundEnvelope,
  validateInboundEnvelope,
  buildEnvelopeCommitIntent,
  buildReceiptIntent,
} from '../src/encryptedEnvelopeBridge.js';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const H=(c)=>`0x${c.repeat(64)}`;
const conversation={a:A,b:B,state:'ACTIVE'};
const context={contextId:H('1'),messengerConversationId:H('2'),a:A,b:B,epoch:3,epochCommitment:H('3'),exists:true,closed:false};
const transport={conversationId:H('2'),sender:A,recipient:B,sequence:1,envelopeHash:H('4'),storageRefHash:H('5'),epoch:3,epochCommitment:H('3'),ciphertextRef:'storage://opaque/abc'};

test('validates outbound envelope and builds canonical commit intent',()=>{
  const out=validateOutboundEnvelope({transportEnvelope:transport,conversation,privateContext:context,lastSequence:0,blocked:false,canMessage:true});
  assert.equal(out.privateContextId,H('1'));
  const intent=buildEnvelopeCommitIntent(out);
  assert.equal(intent.contract,'MessengerEnvelopeRegistry420');
  assert.deepEqual(intent.args,[A,H('2'),1,H('4'),H('5')]);
  assert.equal(intent.requiresWalletAuthorization,true);
});

test('rejects sequence, epoch and policy violations',()=>{
  assert.throws(()=>validateOutboundEnvelope({transportEnvelope:{...transport,sequence:2},conversation,privateContext:context,lastSequence:0,canMessage:true}),/sequence/);
  assert.throws(()=>validateOutboundEnvelope({transportEnvelope:{...transport,epoch:4},conversation,privateContext:context,lastSequence:0,canMessage:true}),/epoch/);
  assert.throws(()=>validateOutboundEnvelope({transportEnvelope:transport,conversation,privateContext:context,lastSequence:0,blocked:true,canMessage:true}),/policy/);
});

test('rejects plaintext and secret-bearing transport fields',()=>{
  assert.throws(()=>validateOutboundEnvelope({transportEnvelope:{...transport,plaintext:'hello'},conversation,privateContext:context,lastSequence:0,canMessage:true}),/forbidden plaintext/);
  assert.throws(()=>validateOutboundEnvelope({transportEnvelope:{...transport,privateKey:'secret'},conversation,privateContext:context,lastSequence:0,canMessage:true}),/forbidden privateKey/);
});

test('validates inbound transport against canonical envelope commitment',()=>{
  const inbound=validateInboundEnvelope({
    canonicalEnvelope:{messageId:H('6'),conversationId:H('2'),sender:A,sequence:1,envelopeHash:H('4'),storageRefHash:H('5')},
    conversation,
    privateContext:context,
    recipient:B,
    transportEnvelope:transport,
    canMessage:true,
  });
  assert.equal(inbound.messageId,H('6'));
  assert.equal(inbound.recipient,B);
  assert.equal(inbound.ciphertextRef,'storage://opaque/abc');
});

test('rejects inbound commitment mismatch and wrong recipient',()=>{
  assert.throws(()=>validateInboundEnvelope({
    canonicalEnvelope:{messageId:H('6'),conversationId:H('2'),sender:A,sequence:1,envelopeHash:H('7'),storageRefHash:H('5')},
    conversation,privateContext:context,recipient:B,transportEnvelope:transport,canMessage:true,
  }),/does not match canonical commitment/);
  assert.throws(()=>validateInboundEnvelope({
    canonicalEnvelope:{messageId:H('6'),conversationId:H('2'),sender:A,sequence:1,envelopeHash:H('4'),storageRefHash:H('5')},
    conversation,privateContext:context,recipient:A,transportEnvelope:transport,canMessage:true,
  }),/canonical peer/);
});

test('builds recipient-authorized delivery/read receipt intents',()=>{
  const delivered=buildReceiptIntent({recipient:B,messageId:H('6')});
  const read=buildReceiptIntent({recipient:B,messageId:H('6'),markRead:true});
  assert.deepEqual(delivered.args,[B,H('6'),false]);
  assert.deepEqual(read.args,[B,H('6'),true]);
  assert.equal(read.contract,'MessengerReceiptRegistry420');
});
