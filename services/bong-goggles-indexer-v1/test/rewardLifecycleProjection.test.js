import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRewardLifecycleProjection,
  applyRewardLifecycleEvent,
  rewardLifecycleView,
  prepareRewardClaimIntent,
} from '../src/rewardLifecycleProjection.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;

function contribution(){
  return {
    name:'ContributionPublished',
    contributionId:'c1',
    appId:'bg',
    contributionType:'POST',
    publisher:address(1),
    beneficiary:address(2),
    contentHash:'hash',
    nullifier:'nullifier',
  };
}

test('BG-18.6 keeps contribution submission distinct from reward accrual',()=>{
  const state=createRewardLifecycleProjection();
  const view=applyRewardLifecycleEvent(state,contribution());
  assert.equal(view.contributionSubmitted,true);
  assert.equal(view.rewardAccrued,false);
  assert.equal(view.rewardPaid,false);
  assert.equal(view.contribution.status,'SUBMITTED');
});

test('BG-18.6 projects canonical accrue reserve claim release lifecycle',()=>{
  const state=createRewardLifecycleProjection();
  applyRewardLifecycleEvent(state,contribution());
  applyRewardLifecycleEvent(state,{name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:address(2),amount:10});
  let view=applyRewardLifecycleEvent(state,{name:'RewardReserved',campaignId:'camp1',rewardId:'r1',amount:10});
  assert.equal(view.reward.status,'RESERVED');
  assert.equal(view.rewardPaid,false);

  view=applyRewardLifecycleEvent(state,{name:'RewardClaimed',rewardId:'r1',beneficiary:address(2),amount:10});
  assert.equal(view.reward.status,'CLAIMED');
  assert.equal(view.claimConfirmed,true);
  assert.equal(view.rewardPaid,false);

  view=applyRewardLifecycleEvent(state,{name:'RewardReleased',campaignId:'camp1',rewardId:'r1',beneficiary:address(2),amount:10});
  assert.equal(view.reward.status,'PAID');
  assert.equal(view.rewardPaid,true);
  assert.equal(view.localMayMarkPaid,true);
  assert.equal(view.contribution.status,'PAID');
});

test('BG-18.6 fails closed on lifecycle beneficiary campaign or amount drift',()=>{
  const state=createRewardLifecycleProjection();
  applyRewardLifecycleEvent(state,contribution());
  assert.throws(()=>applyRewardLifecycleEvent(state,{name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:address(3),amount:10}),/beneficiary mismatch/);

  applyRewardLifecycleEvent(state,{name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:address(2),amount:10});
  assert.throws(()=>applyRewardLifecycleEvent(state,{name:'RewardReserved',campaignId:'wrong',rewardId:'r1',amount:10}),/campaign mismatch/);
  assert.throws(()=>applyRewardLifecycleEvent(state,{name:'RewardClaimed',rewardId:'r1',beneficiary:address(2),amount:9}),/amount mismatch/);
});

test('BG-18.6 claim intents target RewardDistributor420.claim and preserve canonical beneficiary',()=>{
  const state=createRewardLifecycleProjection();
  applyRewardLifecycleEvent(state,contribution());
  applyRewardLifecycleEvent(state,{name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:address(2),amount:10});
  const reward=rewardLifecycleView(state,{rewardId:'r1'}).reward;
  const intent=prepareRewardClaimIntent({reward,rewardDistributor:address(9),account:address(2)});
  assert.equal(intent.method,'claim');
  assert.deepEqual(intent.args,['r1',address(2)]);
  assert.equal(intent.requiresWalletConfirmation,true);
  assert.equal(intent.marksPaidLocally,false);
  assert.equal(intent.beneficiary,address(2));
});

test('BG-18.6 claim intent cannot redirect beneficiary or claim already paid reward',()=>{
  const state=createRewardLifecycleProjection();
  applyRewardLifecycleEvent(state,contribution());
  applyRewardLifecycleEvent(state,{name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:address(2),amount:10});
  let reward=rewardLifecycleView(state,{rewardId:'r1'}).reward;
  assert.throws(()=>prepareRewardClaimIntent({reward,rewardDistributor:address(9),account:address(3)}),/canonical beneficiary/);

  applyRewardLifecycleEvent(state,{name:'RewardReleased',campaignId:'camp1',rewardId:'r1',beneficiary:address(2),amount:10});
  reward=rewardLifecycleView(state,{rewardId:'r1'}).reward;
  assert.throws(()=>prepareRewardClaimIntent({reward,rewardDistributor:address(9),account:address(2)}),/not claimable/);
});
