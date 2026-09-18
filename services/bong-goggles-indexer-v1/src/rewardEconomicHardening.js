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

const SPAM_SENSITIVE=new Set(['POST','PHOTO','STORY','REVIEW','CORRECTION','VERIFICATION']);

export function assessRewardAbuseScenario({
  contributionType,
  sourceKey,
  account,
  now,
  recentSubmissions=[],
  cooldownSeconds=0,
  rapidWindowSeconds=60,
  rapidLimit=5,
}={}){
  const type=String(required(contributionType,'contributionType')).toUpperCase();
  const source=String(required(sourceKey,'sourceKey'));
  const beneficiary=String(required(account,'account')).toLowerCase();
  const timestamp=Number(required(now,'now'));
  if(!Number.isSafeInteger(timestamp)||timestamp<0) throw new Error('now must be a non-negative safe integer');
  if(!Array.isArray(recentSubmissions)) throw new Error('recentSubmissions must be an array');

  const normalized=recentSubmissions.map((entry)=>({
    contributionType:String(required(entry.contributionType,'recent contributionType')).toUpperCase(),
    sourceKey:String(required(entry.sourceKey,'recent sourceKey')),
    account:String(required(entry.account,'recent account')).toLowerCase(),
    at:Number(required(entry.at,'recent at')),
  }));

  const duplicateSource=normalized.some((entry)=>entry.sourceKey===source);
  const crossAccountSourceReplay=normalized.some((entry)=>entry.sourceKey===source && entry.account!==beneficiary);
  const sameAccountSameType=normalized
    .filter((entry)=>entry.account===beneficiary && entry.contributionType===type)
    .sort((a,b)=>b.at-a.at);
  const mostRecent=sameAccountSameType[0]??null;
  const cooldownViolation=Number(cooldownSeconds)>0 && mostRecent!==null && timestamp-mostRecent.at<Number(cooldownSeconds);
  const rapidCount=sameAccountSameType.filter((entry)=>timestamp-entry.at>=0 && timestamp-entry.at<=Number(rapidWindowSeconds)).length;
  const rapidSpam=SPAM_SENSITIVE.has(type) && rapidCount>=Number(rapidLimit);

  const flags=[];
  if(duplicateSource) flags.push('DUPLICATE_SOURCE');
  if(crossAccountSourceReplay) flags.push('CROSS_ACCOUNT_SOURCE_REPLAY');
  if(cooldownViolation) flags.push('COOLDOWN_VIOLATION');
  if(rapidSpam) flags.push('RAPID_SUBMISSION_BURST');

  return freeze({
    contributionType:type,
    account:beneficiary,
    sourceKey:source,
    flags,
    riskDetected:flags.length>0,
    requiresCanonicalPolicyDecision:flags.length>0,
    blocksCanonicalAccrual:false,
    authoritative:false,
  });
}

export function verifyRewardPoolInvariant({funded,reserved}={}){
  const f=Number(required(funded,'funded'));
  const r=Number(required(reserved,'reserved'));
  if(!Number.isSafeInteger(f)||f<0||!Number.isSafeInteger(r)||r<0) throw new Error('pool balances must be non-negative safe integers');
  if(r>f) throw new Error('reward pool invariant violated: reserved exceeds funded');
  return freeze({funded:f,reserved:r,available:f-r,invariantHolds:true,authoritative:false});
}
