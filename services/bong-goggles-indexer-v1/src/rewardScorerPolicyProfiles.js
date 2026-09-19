import { validateBongGogglesRewardConfig } from './rewardProductionConfig.js';
import { contributionEnablementPolicy } from './rewardContributionPolicy.js';

const ADDRESS_RE=/^0x[0-9a-fA-F]{40}$/;
const OBJECTIVE_POLICY_GATES=new Set([
  'ACCOUNT_AGE',
  'VERIFIED_PROFILE',
  'UNIQUE_SOURCE',
  'COOLDOWN',
  'CANONICAL_SOURCE_STATE',
]);

function freeze(value){
  if(Array.isArray(value)) return Object.freeze(value.map(freeze));
  if(value && typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=freeze(item);
    return Object.freeze(out);
  }
  return value;
}
function required(value,field){
  if(value===undefined||value===null||value==='') throw new Error(`${field} is required`);
  return value;
}
function address(value,field){
  const normalized=String(required(value,field)).toLowerCase();
  if(!ADDRESS_RE.test(normalized)||/^0x0{40}$/.test(normalized)) throw new Error(`${field} must be a non-zero address`);
  return normalized;
}
function indexProfiles(profiles,kind){
  if(!Array.isArray(profiles)) throw new Error(`${kind} profiles must be an array`);
  const index=new Map();
  for(const profile of profiles){
    const contract=address(profile.contract,`${kind}.contract`);
    if(index.has(contract)) throw new Error(`duplicate ${kind} profile for ${contract}`);
    index.set(contract,profile);
  }
  return index;
}

export function buildRewardScorerPolicyProfiles(config,{
  scorerProfiles=[],
  policyProfiles=[],
}={}){
  const validated=validateBongGogglesRewardConfig(config);
  const enablement=contributionEnablementPolicy(config);
  const scorers=indexProfiles(scorerProfiles,'scorer');
  const policies=indexProfiles(policyProfiles,'policy');

  const profiles=validated.campaigns.map((campaign)=>{
    const enabled=enablement.entries.find((entry)=>entry.contributionType===campaign.contributionType)?.enabled===true;
    if(!enabled){
      return freeze({
        contributionType:campaign.contributionType,
        enabled:false,
        scorer:null,
        policy:null,
        maxRewardPerContribution:campaign.maxRewardPerContribution,
        authoritative:false,
      });
    }

    const scorer=scorers.get(campaign.scorer);
    if(!scorer) throw new Error(`missing scorer profile for ${campaign.contributionType}`);
    if(scorer.interface!=='IRewardScorer420') throw new Error('scorer profile must implement IRewardScorer420');
    if(scorer.replaceable!==true) throw new Error('scorer profile must be replaceable');

    let policy=null;
    if(campaign.policy){
      const declared=policies.get(campaign.policy);
      if(!declared) throw new Error(`missing policy profile for ${campaign.contributionType}`);
      if(declared.interface!=='IRewardPolicy420') throw new Error('policy profile must implement IRewardPolicy420');
      const gates=(declared.objectiveGates??[]).map((gate)=>String(gate).toUpperCase());
      for(const gate of gates){
        if(!OBJECTIVE_POLICY_GATES.has(gate)) throw new Error(`unsupported or non-objective reward policy gate: ${gate}`);
      }
      if(declared.canRedirectBeneficiary===true||declared.canRewriteEvidence===true){
        throw new Error('reward policy cannot redirect beneficiary or rewrite contribution evidence');
      }
      policy=freeze({
        contract:campaign.policy,
        interface:'IRewardPolicy420',
        replaceable:declared.replaceable===true,
        objectiveGates:gates,
        canRedirectBeneficiary:false,
        canRewriteEvidence:false,
      });
    }

    return freeze({
      contributionType:campaign.contributionType,
      enabled:true,
      scorer:freeze({
        contract:campaign.scorer,
        interface:'IRewardScorer420',
        replaceable:true,
        inputAuthority:Object.freeze(['campaignId','contributionId','beneficiary','contentHash']),
      }),
      policy,
      maxRewardPerContribution:campaign.maxRewardPerContribution,
      popularityAuthoritative:false,
      recommendationRankAuthoritative:false,
      localEngagementAuthoritative:false,
      authoritative:false,
    });
  }).sort((a,b)=>a.contributionType.localeCompare(b.contributionType));

  return freeze({
    environment:validated.environment,
    profiles,
    authoritative:false,
  });
}

export function evaluateBoundedScorerResult({profile,amount}={}){
  if(!profile||profile.enabled!==true||!profile.scorer) throw new Error('enabled scorer profile required');
  const value=Number(required(amount,'amount'));
  if(!Number.isSafeInteger(value)||value<0) throw new Error('scorer amount must be a non-negative safe integer');
  if(value===0){
    return freeze({
      eligible:false,
      amount:0,
      reason:'ZERO_SCORE',
      accrualRequested:false,
      authoritative:false,
    });
  }
  if(value>profile.maxRewardPerContribution) throw new Error('scorer amount exceeds maxRewardPerContribution');
  return freeze({
    eligible:true,
    amount:value,
    reason:null,
    accrualRequested:false,
    authoritative:false,
  });
}

export function validatePolicyDecision({profile,canonicalContribution,decision}={}){
  if(!profile||profile.enabled!==true) throw new Error('enabled reward profile required');
  if(!canonicalContribution||typeof canonicalContribution!=='object') throw new Error('canonical contribution required');
  const before=JSON.stringify({
    beneficiary:canonicalContribution.beneficiary,
    contentHash:canonicalContribution.contentHash,
    contributionId:canonicalContribution.contributionId,
  });

  if(profile.policy===null){
    return freeze({eligible:true,policyApplied:false,authoritative:false});
  }
  if(typeof decision!=='boolean') throw new Error('reward policy decision must be boolean');

  const after=JSON.stringify({
    beneficiary:canonicalContribution.beneficiary,
    contentHash:canonicalContribution.contentHash,
    contributionId:canonicalContribution.contributionId,
  });
  if(before!==after) throw new Error('canonical contribution mutated during policy evaluation');

  return freeze({
    eligible:decision,
    policyApplied:true,
    beneficiary:String(required(canonicalContribution.beneficiary,'beneficiary')),
    contributionId:String(required(canonicalContribution.contributionId,'contributionId')),
    evidenceRewritten:false,
    beneficiaryRedirected:false,
    authoritative:false,
  });
}
