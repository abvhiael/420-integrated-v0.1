import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONG_GOGGLES_APP_ID,
  BONG_GOGGLES_CONTRIBUTION_TYPES,
  BONG_GOGGLES_REWARD_DEPENDENCIES,
  BONG_GOGGLES_REWARD_SCHEMA,
  validateBongGogglesRewardConfig,
  rewardConfigInventory,
} from '../src/rewardProductionConfig.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;

function config(environment='testnet'){
  return {
    schema:BONG_GOGGLES_REWARD_SCHEMA,
    environment,
    contracts:Object.fromEntries(BONG_GOGGLES_REWARD_DEPENDENCIES.map((name,index)=>[name,address(index+1)])),
    campaigns:[
      {
        contributionType:'POST', enabled:true, scorer:address(50), policy:null,
        maxRewardPerContribution:10, maxRewardPerAccount:100, totalBudget:1000,
        startsAt:1000, endsAt:2000,
      },
      {
        contributionType:'PHOTO', enabled:false, scorer:null, policy:null,
        maxRewardPerContribution:0, maxRewardPerAccount:0, totalBudget:0,
        startsAt:0, endsAt:0,
      },
    ],
  };
}

test('BG-18.1 freezes canonical app and contribution preimages', () => {
  assert.deepEqual(BONG_GOGGLES_APP_ID,{
    symbol:'APP_ID_BONG_GOGGLES',
    preimage:'420/APP/BONG_GOGGLES/V1',
  });
  assert.deepEqual(Object.keys(BONG_GOGGLES_CONTRIBUTION_TYPES),[
    'POST','PHOTO','STORY','DISCOVERY','REVIEW','CORRECTION','VERIFICATION',
  ]);
  assert.equal(BONG_GOGGLES_CONTRIBUTION_TYPES.REVIEW,'420/BONG_GOGGLES/REWARD/REVIEW/V1');
});

test('BG-18.1 validates distinct deployment environments and dependency inventory', () => {
  for(const environment of ['testnet','staging','production']){
    const validated=validateBongGogglesRewardConfig(config(environment));
    assert.equal(validated.environment,environment);
    assert.deepEqual(Object.keys(validated.contracts),BONG_GOGGLES_REWARD_DEPENDENCIES);
  }
});

test('BG-18.1 config parsing is non-authoritative and cannot create, fund or activate campaigns', () => {
  const validated=validateBongGogglesRewardConfig(config());
  assert.equal(validated.createsCampaigns,false);
  assert.equal(validated.fundsCampaigns,false);
  assert.equal(validated.activatesCampaigns,false);
  assert.equal(validated.authoritative,false);
});

test('BG-18.1 rejects missing and zero-address canonical dependencies', () => {
  const missing=config();
  delete missing.contracts.RewardPool420;
  assert.throws(()=>validateBongGogglesRewardConfig(missing),/RewardPool420 is required/);

  const zero=config();
  zero.contracts.RewardDistributor420='0x0000000000000000000000000000000000000000';
  assert.throws(()=>validateBongGogglesRewardConfig(zero),/non-zero address/);
});

test('BG-18.1 rejects unknown contribution types and duplicate campaign intents', () => {
  const unknown=config();
  unknown.campaigns[0].contributionType='COMMENT';
  assert.throws(()=>validateBongGogglesRewardConfig(unknown),/unknown Bong Goggles contribution type/);

  const duplicate=config();
  duplicate.campaigns[1]={...duplicate.campaigns[0]};
  assert.throws(()=>validateBongGogglesRewardConfig(duplicate),/duplicate campaign intent/);
});

test('BG-18.1 rejects unsafe enabled campaign caps and windows', () => {
  const accountCap=config();
  accountCap.campaigns[0].maxRewardPerAccount=5;
  assert.throws(()=>validateBongGogglesRewardConfig(accountCap),/cannot be below/);

  const budget=config();
  budget.campaigns[0].totalBudget=5;
  assert.throws(()=>validateBongGogglesRewardConfig(budget),/totalBudget cannot be below/);

  const window=config();
  window.campaigns[0].endsAt=1000;
  assert.throws(()=>validateBongGogglesRewardConfig(window),/endsAt must be after/);
});

test('BG-18.1 inventory deterministically describes the canonical reward flow', () => {
  const inventory=rewardConfigInventory(config('production'));
  assert.equal(inventory.environment,'production');
  assert.equal(inventory.supportedContributionTypes.length,7);
  assert.deepEqual(inventory.canonicalFlow,[
    'BongGogglesContributionVerifier420',
    'BongGogglesRewardsAdapter420',
    'ContributionRegistry420',
    'RewardCampaignRegistry420',
    'RewardDistributor420',
    'RewardPool420',
  ]);
  assert.deepEqual(inventory.configuredCampaignTypes,['PHOTO','POST']);
  assert.equal(inventory.authoritative,false);
});
