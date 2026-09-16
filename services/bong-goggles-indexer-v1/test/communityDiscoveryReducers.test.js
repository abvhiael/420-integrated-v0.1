import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesProjector } from '../src/projector.js';
import { adaptBongGogglesEvent } from '../src/contractEventAdapters.js';

const SCHEMA = '0xsearch-schema-v1';
const CHAIN = 420;

function event(blockNumber, logIndex, eventName, args, state) {
  return {
    chainId: CHAIN,
    blockNumber,
    blockHash: `0xb${blockNumber}`,
    transactionIndex: 0,
    transactionHash: `0xtx-${blockNumber}`,
    logIndex,
    eventName,
    mutations: adaptBongGogglesEvent({ eventName, args }, state),
  };
}

test('page and group lifecycle hydrate canonical records', () => {
  const page = { pageId:'page1', profileAccount:'0xPAGE', owner:'0xOWNER', metadataRoot:'0xmeta', active:true, exists:true, createdAt:1, updatedAt:2 };
  const group = { groupId:'group1', owner:'0xOWNER', privacy:'PUBLIC', joinPolicy:'OPEN', metadataRoot:'0xgroup', active:true, exists:true, createdAt:1, updatedAt:3 };
  const pm = adaptBongGogglesEvent({ eventName:'PageUpdated', args:{ pageId:'page1' } }, { page })[0];
  const gm = adaptBongGogglesEvent({ eventName:'GroupUpdated', args:{ groupId:'group1' } }, { group })[0];
  assert.equal(pm.entityType, 'page');
  assert.equal(pm.value.owner, '0xowner');
  assert.equal(gm.entityType, 'group');
  assert.equal(gm.value.joinPolicy, 'OPEN');
});

test('group membership request, activation and removal converge without stale membership', () => {
  const projector = new BongGogglesProjector({ schemaHash:SCHEMA, chainId:CHAIN });
  projector.applyBatch([
    event(10,0,'GroupJoinRequested',{groupId:'g1',account:'0xA'},{groupMember:{state:'PENDING',role:'NONE',joinedAt:0,updatedAt:10}}),
    event(11,0,'GroupMemberActivated',{groupId:'g1',account:'0xA'},{groupMember:{state:'ACTIVE',role:'MEMBER',joinedAt:11,updatedAt:11}}),
    event(12,0,'GroupMemberRemoved',{groupId:'g1',account:'0xA'},{}),
  ]);
  assert.equal(projector.exportState().some((x)=>x.entityType==='groupMember'), false);
});

test('events and RSVP state materialize deterministically', () => {
  const projector = new BongGogglesProjector({ schemaHash:SCHEMA, chainId:CHAIN });
  projector.applyBatch([
    event(10,0,'EventCreated',{eventId:'e1'},{eventRecord:{eventId:'e1',owner:'0xA',hostType:'GROUP',hostAccount:'0xA',hostId:'g1',visibility:'PUBLIC',metadataRoot:'0xm',startsAt:100,endsAt:200,active:true,exists:true,createdAt:10,updatedAt:10}}),
    event(11,0,'EventRSVP',{eventId:'e1',account:'0xB',state:'GOING'},{}),
  ]);
  const state = projector.exportState();
  assert.equal(state.find((x)=>x.entityType==='event').value.active, true);
  assert.equal(state.find((x)=>x.entityType==='eventRsvp').value.state, 'GOING');
});

test('discovery subject and review replacement preserve canonical active status', () => {
  const projector = new BongGogglesProjector({ schemaHash:SCHEMA, chainId:CHAIN });
  projector.applyBatch([
    event(10,0,'SubjectSubmitted',{subjectId:'s1'},{subject:{subjectId:'s1',subjectType:'PLACE',canonicalRef:'0xref',metadataRoot:'0xm',locationCommitment:'0xloc',locationPrecision:'CITY',submitter:'0xA',createdAt:10,status:'SUBMITTED',exists:true}}),
    event(11,0,'ReviewPublished',{reviewId:'r1',subjectId:'s1',author:'0xB'},{review:{reviewId:'r1',subjectId:'s1',author:'0xB',contentHash:'0xc1',ratingBps:8000,version:1,active:true,updatedAt:11}}),
    event(12,0,'ReviewPublished',{reviewId:'r2',subjectId:'s1',author:'0xB'},{previousReview:{reviewId:'r1',subjectId:'s1',author:'0xB',contentHash:'0xc1',ratingBps:8000,version:1,active:false,updatedAt:11},review:{reviewId:'r2',subjectId:'s1',author:'0xB',contentHash:'0xc2',ratingBps:9000,version:2,active:true,updatedAt:12}}),
  ]);
  const reviews = projector.exportState().filter((x)=>x.entityType==='review');
  assert.equal(reviews.length, 2);
  assert.equal(reviews.find((x)=>x.entityId==='r1').value.active, false);
  assert.equal(reviews.find((x)=>x.entityId==='r2').value.active, true);
});

test('review withdrawal, corrections and verification attestations project canonical records', () => {
  const withdrawal = adaptBongGogglesEvent({eventName:'ReviewWithdrawn',args:{reviewId:'r1'}},{review:{reviewId:'r1',subjectId:'s1',author:'0xB',contentHash:'0xc',ratingBps:7000,version:1,active:false,updatedAt:20}})[0];
  const correction = adaptBongGogglesEvent({eventName:'CorrectionSubmitted',args:{correctionId:'c1'}},{correction:{correctionId:'c1',subjectId:'s1',author:'0xC',fieldId:'name',proposedValueHash:'0xv',evidenceHash:'0xe',createdAt:21}})[0];
  const verification = adaptBongGogglesEvent({eventName:'VerificationAttested',args:{verificationId:'v1'}},{verification:{verificationId:'v1',subjectId:'s1',verifier:'0xD',propositionHash:'0xp',subjectVersion:1,supportsProposition:true,evidenceHash:'0xe',createdAt:22}})[0];
  assert.equal(withdrawal.value.active, false);
  assert.equal(correction.entityType, 'discoveryCorrection');
  assert.equal(verification.value.supportsProposition, true);
});

test('community events fail closed without required canonical hydration', () => {
  assert.throws(()=>adaptBongGogglesEvent({eventName:'PageUpdated',args:{pageId:'p1'}}), /canonical page state/);
  assert.throws(()=>adaptBongGogglesEvent({eventName:'EventUpdated',args:{eventId:'e1'}}), /canonical event state/);
});
