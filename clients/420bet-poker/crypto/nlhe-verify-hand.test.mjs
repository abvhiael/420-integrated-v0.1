import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {providerCommitment,deriveDeck} from './confidential-deal.mjs';
import {actionDigest,independentlyVerifyOpenHand} from './nlhe-verify-hand.mjs';
const hex=n=>'0x'+n.repeat(64);
const ctx={chainId:420,tableId:hex('1'),configHash:hex('2'),versionId:hex('3'),
  rulesetId:hex('4'),handId:hex('5'),seatSnapshotHash:hex('6'),epoch:2,nonce:1};
const seedA=randomBytes(32),seedB=randomBytes(32);
const commitments={A:providerCommitment(ctx,'A',seedA),B:providerCommitment(ctx,'B',seedB)};
const deck=deriveDeck(ctx,seedA,seedB);
const players=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
const seatKeys=players.map(p=>p.publicKey.export({format:'der',type:'spki'}).toString('hex'));
const action={nonce:1,street:0,seat:0,type:'fold',amount:0};
const signed={action,signature:sign(null,actionDigest(ctx,1,action),players[0].privateKey).toString('hex')};
const base={context:ctx,commitments,seedA,seedB,openedDeck:deck,stacks:[100,100],
  button:0,smallBlind:5,bigBlind:10,seatKeys,actions:[signed],claimedPayouts:[0,15]};
test('independent replay verifies player signed fold and exact chip conservation',()=>{
 const result=independentlyVerifyOpenHand(base);
 assert.deepEqual(result.payouts,[0,15]);
 assert.deepEqual(result.finalStacks,[95,105]);
 assert.equal(typeof result.resultHash,'string');
});
test('forged payout cannot pass transcript replay',()=>{
 assert.throws(()=>independentlyVerifyOpenHand({...base,claimedPayouts:[0,20]}),/payout/);
});
test('unsigned, wrong-seat and forged actions fail',()=>{
 assert.throws(()=>independentlyVerifyOpenHand({...base,actions:[{action,signature:'00'.repeat(64)}]}),/signature/);
 const forged={...action,seat:1};
 assert.throws(()=>independentlyVerifyOpenHand({...base,actions:[{action:forged,signature:signed.signature}]}),/signature/);
});
test('altered shuffle after signed action cannot pass',()=>{
 const corrupt=[...deck];[corrupt[0],corrupt[1]]=[corrupt[1],corrupt[0]];
 assert.throws(()=>independentlyVerifyOpenHand({...base,openedDeck:corrupt}),/not reproducible/);
});
