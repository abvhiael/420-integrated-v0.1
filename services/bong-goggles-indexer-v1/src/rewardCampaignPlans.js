import {
  BONG_GOGGLES_APP_ID,
  BONG_GOGGLES_CONTRIBUTION_TYPES,
  validateBongGogglesRewardConfig,
} from './rewardProductionConfig.js';
import { buildRewardScorerPolicyProfiles } from './rewardScorerPolicyProfiles.js';

function freeze(value){
  if(Array.isArray(value)) return Object.freeze(value.map(freeze));
  if(value && typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=freeze(item);
    return Object.freeze(out);
  }
  return value;
}

export function buildBongGogglesCampaignPlans(config, profiles={}){
  const validated=validateBongGogglesRewardConfig(config);
  const resolvedProfiles=buildRewardScorerPolicyProfiles(config, profiles);
  const profileByType=new Map(resolvedProfiles.profiles.map((profile)=>[profile.contributionType,profile]));

  const plans=validated.campaigns
    .filter((campaign)=>campaign.enabled)
    .map((campaign)=>{
      const profile=profileByType.get(campaign.contributionType);
      if(!profile || profile.enabled!==true || !profile.scorer) {
        throw new Error(`enabled campaign profile missing for ${campaign.contributionType}`);
      }
      if(campaign.maxRewardPerAccount < campaign.maxRewardPerContribution) {
        throw new Error('unsafe campaign caps: account cap below contribution cap');
      }
      if(campaign.totalBudget < campaign.maxRewardPerContribution) {
        throw new Error('unsafe campaign budget: total budget below contribution cap');
      }
      if(campaign.endsAt <= campaign.startsAt) {
        throw new Error('unsafe campaign window');
      }

      return freeze({
        schema:'bg-reward-campaign-plan-v1',
        environment:validated.environment,
        appIdSymbol:BONG_GOGGLES_APP_ID.symbol,
        appIdPreimage:BONG_GOGGLES_APP_ID.preimage,
        contributionType:campaign.contributionType,
        contributionTypePreimage:BONG_GOGGLES_CONTRIBUTION_TYPES[campaign.contributionType],
        scorer:profile.scorer.contract,
        policy:profile.policy?.contract ?? null,
        maxRewardPerContribution:campaign.maxRewardPerContribution,
        maxRewardPerAccount:campaign.maxRewardPerAccount,
        totalBudget:campaign.totalBudget,
        startsAt:campaign.startsAt,
        endsAt:campaign.endsAt,
        registryMethod:'createCampaign',
        registryArgs:Object.freeze([
          BONG_GOGGLES_APP_ID.symbol,
          campaign.contributionType,
          profile.scorer.contract,
          profile.policy?.contract ?? null,
          campaign.maxRewardPerContribution,
          campaign.maxRewardPerAccount,
          campaign.totalBudget,
          campaign.startsAt,
          campaign.endsAt,
        ]),
        sponsorControlsActivation:true,
        createsCampaign:false,
        fundsCampaign:false,
        activatesCampaign:false,
        authoritative:false,
      });
    })
    .sort((a,b)=>a.contributionType.localeCompare(b.contributionType));

  return freeze({
    schema:'bg-reward-campaign-plan-set-v1',
    environment:validated.environment,
    plans,
    createsCampaigns:false,
    fundsCampaigns:false,
    activatesCampaigns:false,
    authoritative:false,
  });
}

export function preflightCampaignPlan(plan){
  if(!plan || plan.schema!=='bg-reward-campaign-plan-v1') throw new Error('campaign plan required');
  if(plan.appIdSymbol!=='APP_ID_BONG_GOGGLES' || plan.appIdPreimage!==BONG_GOGGLES_APP_ID.preimage){
    throw new Error('campaign plan app binding mismatch');
  }
  if(!Object.hasOwn(BONG_GOGGLES_CONTRIBUTION_TYPES, plan.contributionType)){
    throw new Error('campaign plan contribution type unsupported');
  }
  if(plan.contributionTypePreimage!==BONG_GOGGLES_CONTRIBUTION_TYPES[plan.contributionType]){
    throw new Error('campaign plan contribution binding mismatch');
  }
  if(!(plan.maxRewardPerContribution>0)) throw new Error('campaign plan contribution cap must be positive');
  if(plan.maxRewardPerAccount<plan.maxRewardPerContribution) throw new Error('campaign plan account cap unsafe');
  if(plan.totalBudget<plan.maxRewardPerContribution) throw new Error('campaign plan total budget unsafe');
  if(!(plan.endsAt>plan.startsAt)) throw new Error('campaign plan window unsafe');
  if(!plan.scorer) throw new Error('campaign plan scorer missing');

  return freeze({
    valid:true,
    appBound:true,
    contributionBound:true,
    capsSafe:true,
    windowSafe:true,
    sponsorControlsActivation:plan.sponsorControlsActivation===true,
    createsCampaign:false,
    fundsCampaign:false,
    activatesCampaign:false,
    authoritative:false,
  });
}
