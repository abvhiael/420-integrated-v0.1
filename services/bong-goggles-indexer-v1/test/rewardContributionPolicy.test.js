import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONG_GOGGLES_REWARD_DEPENDENCIES,
  BONG_GOGGLES_REWARD_SCHEMA,
} from '../src/rewardProductionConfig.js';
import {
  contributionCatalog,
  contributionEnablementPolicy,
  assertRewardableContributionSource,
  rewardReplayPolicy,
  BONG_GOGGLES_DISABLED_REWARD_TYPES,
} from '../src/rewardContributionPolicy.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;
function config(){
  return {
    schema:BONG_GOGGLES_REWARD_SCHEMA,
    environment:'production',
    contracts:Object.fromEntries(BONG_GOGGLES_REWARD_DEPENDENCIES.map((name,index)=>[name,address(index+1)])),
    campaigns:[
      {contributionType:'POST',enabled:true,scorer:address(50),policy:null,maxRewardPerContribution:1,maxRewardPerAccount:10,totalBudget:100,startsAt:1,endsAt:10},
      {contributionType:'PHOTO',enabled:false,scorer:null,policy:null,maxRewardPerContribution:0,maxRewardPerAccount:0,totalBudget:0,startsAt:0,endsAt:0},
      {contributionType:'REVIEW',enabled:true,scorer:address(51),policy:null,maxRewardPerContribution:1,maxRewardPerAccount:5,totalBudget:50,startsAt:1,endsAt:10},
    ],
  };
}

test('BG-18.2 production contribution catalog contains exactly seven canonical verifier classes',()=>{
  const catalog=contributionCatalog();
  assert.deepEqual(catalog.map((entry)=>entry.name),['POST','PHOTO','STORY','DISCOVERY','REVIEW','CORRECTION','VERIFICATION']);
  assert.equal(catalog.find((entry)=>entry.name==='REVIEW').canonicalBeneficiary ?? catalog.find((entry)=>entry.name==='REVIEW').beneficiary,'author');
  assert.equal(BONG_GOGGLES_DISABLED_REWARD_TYPES.COMMENT.enabled,false);
});

test('BG-18.2 contribution classes can be independently enabled without changing verifier identity',()=>{
  const policy=contributionEnablementPolicy(config());
  const post=policy.entries.find((entry)=>entry.contributionType==='POST');
  const photo=policy.entries.find((entry)=>entry.contributionType==='PHOTO');
  const story=policy.entries.find((entry)=>entry.contributionType==='STORY');
  assert.equal(post.enabled,true);
  assert.equal(photo.enabled,false);
  assert.equal(story.enabled,false);
  assert.equal(post.verifierMethod,'verifySocialObject');
  assert.equal(photo.verifierMethod,'verifySocialObject');
  assert.equal(post.verifierIdentityChangesWithEnablement,false);
});

test('BG-18.2 rejects hidden/inactive social objects and type mismatches',()=>{
  assert.throws(()=>assertRewardableContributionSource({contributionType:'POST',source:{exists:true,status:'HIDDEN',objectType:'STATUS',author:address(1),objectId:'p1'}}),/inactive/);
  assert.throws(()=>assertRewardableContributionSource({contributionType:'POST',source:{exists:true,status:'ACTIVE',objectType:'COMMENT',author:address(1),objectId:'p1'}}),/type mismatch/);
  const ok=assertRewardableContributionSource({contributionType:'PHOTO',source:{exists:true,status:'ACTIVE',objectType:'PHOTO_POST',author:address(2),objectId:'photo1'}});
  assert.equal(ok.beneficiary,address(2));
});

test('BG-18.2 rejects invalid closed and merged discovery sources',()=>{
  for(const status of ['INVALID','CLOSED','MERGED']){
    assert.throws(()=>assertRewardableContributionSource({contributionType:'DISCOVERY',source:{exists:true,status,submitter:address(3),subjectId:'s1'}}),/inactive/);
  }
  const ok=assertRewardableContributionSource({contributionType:'DISCOVERY',source:{exists:true,status:'ACTIVE',submitter:address(3),subjectId:'s1'}});
  assert.equal(ok.beneficiary,address(3));
});

test('BG-18.2 rejects inactive reviews and binds review replay source to subject plus author',()=>{
  assert.throws(()=>assertRewardableContributionSource({contributionType:'REVIEW',source:{reviewId:'r1',subjectId:'s1',author:address(4),active:false}}),/inactive/);
  const one=assertRewardableContributionSource({contributionType:'REVIEW',source:{reviewId:'r1',subjectId:'s1',author:address(4),active:true}});
  const two=assertRewardableContributionSource({contributionType:'REVIEW',source:{reviewId:'r2',subjectId:'s1',author:address(4),active:true}});
  assert.equal(one.sourceKeyInput,two.sourceKeyInput);
});

test('BG-18.2 correction and verification beneficiaries remain canonical source actors',()=>{
  const correction=assertRewardableContributionSource({contributionType:'CORRECTION',source:{correctionId:'c1',author:address(5)}});
  const verification=assertRewardableContributionSource({contributionType:'VERIFICATION',source:{verificationId:'v1',verifier:address(6)}});
  assert.equal(correction.beneficiary,address(5));
  assert.equal(verification.beneficiary,address(6));
});

test('BG-18.2 comments remain unsupported and replay/nullifier invariants are explicit',()=>{
  assert.throws(()=>assertRewardableContributionSource({contributionType:'COMMENT',source:{}}),/unsupported contribution type/);
  const replay=rewardReplayPolicy();
  assert.equal(replay.adapterSourceReplay,'ONE_SUBMISSION_PER_CANONICAL_SOURCE_KEY');
  assert.equal(replay.registryReplay,'NULLIFIER_SCOPED_TO_APP_PUBLISHER_NONCE');
  assert.equal(replay.reviewEdits,'ONE_SOURCE_PER_SUBJECT_AND_AUTHOR');
  assert.equal(replay.relayCannotRedirectBeneficiary,true);
});
