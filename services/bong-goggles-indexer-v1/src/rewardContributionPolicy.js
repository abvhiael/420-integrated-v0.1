import {
  BONG_GOGGLES_CONTRIBUTION_TYPES,
  validateBongGogglesRewardConfig,
} from './rewardProductionConfig.js';

const CATALOG = Object.freeze({
  POST:Object.freeze({
    enabledByDefault:true,
    source:'SOCIAL_OBJECT',
    verifierMethod:'verifySocialObject',
    beneficiary:'author',
    sourceKey:'SOCIAL_OBJECT_ID',
    sourceRequirements:Object.freeze(['EXISTS','ACTIVE','STATUS']),
  }),
  PHOTO:Object.freeze({
    enabledByDefault:true,
    source:'SOCIAL_OBJECT',
    verifierMethod:'verifySocialObject',
    beneficiary:'author',
    sourceKey:'SOCIAL_OBJECT_ID',
    sourceRequirements:Object.freeze(['EXISTS','ACTIVE','PHOTO_POST']),
  }),
  STORY:Object.freeze({
    enabledByDefault:true,
    source:'SOCIAL_OBJECT',
    verifierMethod:'verifySocialObject',
    beneficiary:'author',
    sourceKey:'SOCIAL_OBJECT_ID',
    sourceRequirements:Object.freeze(['EXISTS','ACTIVE','STORY']),
  }),
  DISCOVERY:Object.freeze({
    enabledByDefault:true,
    source:'DISCOVERY_SUBJECT',
    verifierMethod:'verifyDiscovery',
    beneficiary:'submitter',
    sourceKey:'SUBJECT_ID',
    sourceRequirements:Object.freeze(['EXISTS','NOT_INVALID','NOT_CLOSED','NOT_MERGED']),
  }),
  REVIEW:Object.freeze({
    enabledByDefault:true,
    source:'DISCOVERY_REVIEW',
    verifierMethod:'verifyReview',
    beneficiary:'author',
    sourceKey:'SUBJECT_ID+AUTHOR',
    sourceRequirements:Object.freeze(['EXISTS','ACTIVE']),
  }),
  CORRECTION:Object.freeze({
    enabledByDefault:true,
    source:'DISCOVERY_CORRECTION',
    verifierMethod:'verifyCorrection',
    beneficiary:'author',
    sourceKey:'CORRECTION_ID',
    sourceRequirements:Object.freeze(['EXISTS']),
  }),
  VERIFICATION:Object.freeze({
    enabledByDefault:true,
    source:'DISCOVERY_VERIFICATION',
    verifierMethod:'verifyVerification',
    beneficiary:'verifier',
    sourceKey:'VERIFICATION_ID',
    sourceRequirements:Object.freeze(['EXISTS']),
  }),
});

export const BONG_GOGGLES_DISABLED_REWARD_TYPES = Object.freeze({
  COMMENT:Object.freeze({
    enabled:false,
    reason:'UNSUPPORTED_CANONICAL_CONTRIBUTION',
    verifierMethod:null,
  }),
});

function freeze(value){
  if(Array.isArray(value)) return Object.freeze(value.map(freeze));
  if(value && typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=freeze(item);
    return Object.freeze(out);
  }
  return value;
}

export function contributionCatalog(){
  return freeze(Object.entries(CATALOG).map(([name,descriptor])=>({
    name,
    contributionIdPreimage:BONG_GOGGLES_CONTRIBUTION_TYPES[name],
    ...descriptor,
    authoritative:false,
  })));
}

export function contributionEnablementPolicy(config){
  const validated=validateBongGogglesRewardConfig(config);
  const campaignByType=new Map(validated.campaigns.map((campaign)=>[campaign.contributionType,campaign]));
  const entries=Object.entries(CATALOG).map(([name,descriptor])=>{
    const configured=campaignByType.get(name) ?? null;
    return freeze({
      contributionType:name,
      contributionIdPreimage:BONG_GOGGLES_CONTRIBUTION_TYPES[name],
      enabled:configured ? configured.enabled : false,
      configured:configured !== null,
      source:descriptor.source,
      verifierMethod:descriptor.verifierMethod,
      canonicalBeneficiary:descriptor.beneficiary,
      sourceKeySemantics:descriptor.sourceKey,
      sourceRequirements:descriptor.sourceRequirements,
      verifierIdentityChangesWithEnablement:false,
      authoritative:false,
    });
  }).sort((a,b)=>a.contributionType.localeCompare(b.contributionType));

  return freeze({
    environment:validated.environment,
    entries,
    disabledUnsupported:Object.entries(BONG_GOGGLES_DISABLED_REWARD_TYPES).map(([name,value])=>freeze({contributionType:name,...value,authoritative:false})),
    authoritative:false,
  });
}

export function assertRewardableContributionSource({contributionType, source}={}){
  const name=String(contributionType??'').toUpperCase();
  if(!Object.hasOwn(CATALOG,name)) throw new Error(`unsupported contribution type: ${name || 'EMPTY'}`);
  if(!source || typeof source!=='object') throw new Error('source object required');

  switch(name){
    case 'POST':
    case 'PHOTO':
    case 'STORY':
      if(source.exists !== true) throw new Error('social source missing');
      if(String(source.status).toUpperCase() !== 'ACTIVE') throw new Error('social source inactive');
      if(name==='POST' && String(source.objectType).toUpperCase()!=='STATUS') throw new Error('social contribution type mismatch');
      if(name==='PHOTO' && String(source.objectType).toUpperCase()!=='PHOTO_POST') throw new Error('social contribution type mismatch');
      if(name==='STORY' && String(source.objectType).toUpperCase()!=='STORY') throw new Error('social contribution type mismatch');
      if(!source.author) throw new Error('canonical social beneficiary missing');
      return freeze({beneficiary:String(source.author),sourceKeyInput:String(source.objectId),authoritative:false});
    case 'DISCOVERY':{
      if(source.exists !== true) throw new Error('discovery source missing');
      const status=String(source.status).toUpperCase();
      if(['INVALID','CLOSED','MERGED'].includes(status)) throw new Error('discovery source inactive');
      if(!source.submitter) throw new Error('canonical discovery beneficiary missing');
      return freeze({beneficiary:String(source.submitter),sourceKeyInput:String(source.subjectId),authoritative:false});
    }
    case 'REVIEW':
      if(!source.reviewId || !source.author) throw new Error('review source missing');
      if(source.active !== true) throw new Error('review source inactive');
      return freeze({beneficiary:String(source.author),sourceKeyInput:`${source.subjectId}|${source.author}`,authoritative:false});
    case 'CORRECTION':
      if(!source.correctionId || !source.author) throw new Error('correction source missing');
      return freeze({beneficiary:String(source.author),sourceKeyInput:String(source.correctionId),authoritative:false});
    case 'VERIFICATION':
      if(!source.verificationId || !source.verifier) throw new Error('verification source missing');
      return freeze({beneficiary:String(source.verifier),sourceKeyInput:String(source.verificationId),authoritative:false});
    default:
      throw new Error('unsupported contribution type');
  }
}

export function rewardReplayPolicy(){
  return freeze({
    adapterSourceReplay:'ONE_SUBMISSION_PER_CANONICAL_SOURCE_KEY',
    registryReplay:'NULLIFIER_SCOPED_TO_APP_PUBLISHER_NONCE',
    reviewEdits:'ONE_SOURCE_PER_SUBJECT_AND_AUTHOR',
    relayCannotRedirectBeneficiary:true,
    contributionEnablementCannotChangeVerifierIdentity:true,
    authoritative:false,
  });
}
