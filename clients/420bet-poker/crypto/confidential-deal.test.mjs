import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {providerCommitment,deriveDeck,verifyShuffle,makeRecipientKeyPair,
  keyFingerprint,encryptHoleCards,decryptHoleCards} from './confidential-deal.mjs';
const H=n=>'0x'+n.repeat(64);
const c={chainId:420,tableId:H('1'),configHash:H('2'),versionId:H('3'),
  handId:H('4'),epoch:2,nonce:1,seatSnapshotHash:H('5')};
const a=randomBytes(32),b=randomBytes(32);
const commitments={A:providerCommitment(c,'A',a),B:providerCommitment(c,'B',b)};
test('unbiased sample permutation deterministically reproduces all 52 unique cards',()=>{
  const deck=deriveDeck(c,a,b);
  assert.equal(deck.length,52);assert.equal(new Set(deck).size,52);
  assert.deepEqual([...deck].sort((x,y)=>x-y),Array.from({length:52},(_,i)=>i));
  assert.equal(verifyShuffle(c,commitments,a,b,deck),true);
});
test('different contributor seed changes shuffle',()=>{
  assert.notDeepEqual(deriveDeck(c,a,b),deriveDeck(c,a,randomBytes(32)));
});
test('tampered permutation, wrong seed and swapped provider commitments reject',()=>{
  const deck=deriveDeck(c,a,b);const tampered=[...deck];[tampered[0],tampered[1]]=[tampered[1],tampered[0]];
  assert.throws(()=>verifyShuffle(c,commitments,a,b,tampered),/not reproducible/);
  assert.throws(()=>verifyShuffle(c,commitments,randomBytes(32),b,deck),/commitment/);
  assert.throws(()=>verifyShuffle(c,{A:commitments.B,B:commitments.A},a,b,deck),/commitment/);
  const duplicate=[...deck];duplicate[1]=duplicate[0];
  assert.throws(()=>verifyShuffle(c,commitments,a,b,duplicate),/52-card unique/);
});
test('table chain version and hand domain prevent cross-context replay',()=>{
  const deck=deriveDeck(c,a,b);
  for(const changed of [{chainId:421},{tableId:H('6')},{versionId:H('7')},
    {handId:H('8')},{seatSnapshotHash:H('9')},{nonce:2},{epoch:3}]){
    const other={...c,...changed};
    assert.throws(()=>verifyShuffle(other,commitments,a,b,deck),/commitment/);
  }
});
test('player-bound X25519 authenticated encryption decrypts only for rightful recipient',()=>{
  const alice=makeRecipientKeyPair(),bob=makeRecipientKeyPair();
  const fingerprint=keyFingerprint(alice.publicKey);
  const packet=encryptHoleCards(c,0,2,alice.publicKey,[10,41],fingerprint);
  assert.deepEqual(decryptHoleCards(c,0,2,alice.privateKey,packet,fingerprint),[10,41]);
  assert.throws(()=>decryptHoleCards(c,0,2,bob.privateKey,packet,fingerprint),/wrong recipient/);
  assert.throws(()=>decryptHoleCards({...c,handId:H('f')},0,2,alice.privateKey,packet,fingerprint));
  assert.throws(()=>decryptHoleCards(c,1,2,alice.privateKey,packet,fingerprint));
  assert.throws(()=>decryptHoleCards(c,0,3,alice.privateKey,packet,fingerprint));
});
test('tampered ciphertext and unregistered encryption keys fail closed',()=>{
  const pair=makeRecipientKeyPair();
  const fingerprint=keyFingerprint(pair.publicKey);
  assert.throws(()=>encryptHoleCards(c,0,2,pair.publicKey,[1,1],fingerprint),/invalid private/);
  assert.throws(()=>encryptHoleCards(c,0,2,pair.publicKey,[1,2],'0'.repeat(64)),/unregistered/);
  const packet=encryptHoleCards(c,0,2,pair.publicKey,[10,41],fingerprint);
  const changed={...packet,ciphertext:'ff'+packet.ciphertext.slice(2)};
  assert.throws(()=>decryptHoleCards(c,0,2,pair.privateKey,changed,fingerprint),/tampered/);
  assert.throws(()=>decryptHoleCards(c,0,2,pair.privateKey,{...packet,tag:'ff'+packet.tag.slice(2)},fingerprint));
});
