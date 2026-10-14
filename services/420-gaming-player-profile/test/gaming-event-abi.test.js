import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeGamingEvent420,GAMING_EVENT_TOPICS420,gamingEventContract420} from '../src/gaming-event-abi.js';
const h=x=>'0x'+x.repeat(64),a=x=>'0x'+x.repeat(40);
const word=x=>x.slice(2).padStart(64,'0');
const wallet=a('a'),claim=h('b'),game=h('c'),guest=h('d'),payload=h('e');
test('R05.6 emitted GameClaims ISSUE signature and ABI offsets are exact',()=>{
 const d=decodeGamingEvent420({topics:[GAMING_EVENT_TOPICS420.MigrationClaimIssued,claim,game,'0x'+word(wallet)],
 data:'0x'+word(guest)+word(payload)+BigInt(12345).toString(16).padStart(64,'0')});
 assert.equal(d.kind,'MigrationClaimIssued');
 assert.deepEqual(d.payload,{claimId:claim,gameId:game,targetAccount:wallet,
  guestStateCommitment:guest,migrationPayloadHash:payload,validUntil:'12345'});
 assert.equal(gamingEventContract420(d.kind),'claims');
});
test('R05.6 consumed/bound/applied indexed field layout matches actual contracts',()=>{
 const profile=h('f'),grower=BigInt(12).toString(16).padStart(64,'0');
 const consumed=decodeGamingEvent420({topics:[GAMING_EVENT_TOPICS420.MigrationClaimConsumed,claim,profile],data:'0x'});
 const bound=decodeGamingEvent420({topics:[GAMING_EVENT_TOPICS420.MigrationClaimBound,claim,'0x'+grower,profile],data:'0x'});
 const applied=decodeGamingEvent420({topics:[GAMING_EVENT_TOPICS420.MigrationApplied,claim,'0x'+grower],
  data:'0x'+word(guest)+word(payload)});
 assert.equal(consumed.payload.profileId,profile);
 assert.equal(bound.payload.growerId,'12');
 assert.equal(applied.payload.migrationPayloadHash,payload);
 assert.equal(gamingEventContract420(applied.kind),'migration');
});
test('R05.6 forged topics, padded address, short data and zero grower fail closed',()=>{
 const topics=[GAMING_EVENT_TOPICS420.MigrationClaimIssued,claim,game,'0x'+word(wallet)];
 const data='0x'+word(guest)+word(payload)+'0'.repeat(64);
 assert.throws(()=>decodeGamingEvent420({topics:[h('0'),claim],data:'0x'}),/event-topic-unknown/);
 assert.throws(()=>decodeGamingEvent420({topics,data:'0x'}),/event-abi-shape/);
 assert.throws(()=>decodeGamingEvent420({topics:[...topics.slice(0,3),h('f')],data}),/event-invalid-address-padding/);
 assert.throws(()=>decodeGamingEvent420({topics:[GAMING_EVENT_TOPICS420.MigrationClaimBound,claim,h('0'),h('a')],data:'0x'}),/event-invalid-uint64/);
});
