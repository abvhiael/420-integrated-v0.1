import {validateRuntimeConfig} from './runtime-config.js';

export const REQUIRED_JOURNEYS=Object.freeze(['wallet-profile-feed','publish-confirm-feed','media-publish-deliver','relationships','community-event','private-messaging','discovery-action','games-zero-wager','notifications','rewards-claim-paid','moderation-appeal','block-mute','reload-recovery','public-visibility']);
export const REQUIRED_RELEASE_EVIDENCE=Object.freeze(['testnetDeployment','stagingDeployment','tlsDnsCdn','securityHeaders','browserAccessibility','browserPerformance','privacySecurityReview','rollbackDrill','operatorSmoke','mainReconciliation','exactHeadQualifications']);
const LOCAL_HOSTS=new Set(['localhost','127.0.0.1','::1']);

/** A versioned deployment input is mandatory. Example endpoints never qualify as real services. */
export function validateDeploymentCandidate(input,{expectedEnvironment}={}){
 const config=validateRuntimeConfig(input);
 if(!expectedEnvironment||!['testnet','staging','production'].includes(expectedEnvironment))throw new Error('explicit deployment environment required');
 if(config.environment!==expectedEnvironment)throw new Error('deployment environment mismatch');
 const urls=['appOrigin','rpcUrl','indexerUrl','mediaUrl','messengerUrl','notificationsUrl','walletUrl','explorerUrl'];
 for(const key of urls){
  const url=new URL(config[key]);
  if(url.username||url.password||url.search||url.hash)throw new Error(`${key} must not contain credentials, query or fragment`);
  if(LOCAL_HOSTS.has(url.hostname)||url.hostname==='example'||url.hostname.endsWith('.example')||url.hostname.endsWith('.invalid')||url.hostname.endsWith('.test'))throw new Error(`${key} points to a placeholder or local host`);
 }
 if(!config.features||typeof config.features!=='object'||Array.isArray(config.features))throw new Error('feature flags must be an object');
 for(const [key,value] of Object.entries(config.features))if(!/^[a-z][a-z0-9]{0,39}$/i.test(key)||typeof value!=='boolean')throw new Error('deployment feature flags must be named booleans only');
 if(config.maintenance!==true&&expectedEnvironment==='production')throw new Error('production candidate must start in maintenance until release gates are verified');
 return config;
}

/** Evidence reports status; it does not convert unverified assertions into launch approval. */
export function evaluateLaunchReadiness({journeys={},evidence={}}={}){
 const missingJourneys=REQUIRED_JOURNEYS.filter(key=>journeys[key]?.result!=='passed'||typeof journeys[key]?.url!=='string'||!/^https:\/\//.test(journeys[key].url));
 const missingEvidence=REQUIRED_RELEASE_EVIDENCE.filter(key=>evidence[key]?.result!=='passed'||typeof evidence[key]?.url!=='string'||!/^https:\/\//.test(evidence[key].url));
 return Object.freeze({ready:missingJourneys.length===0&&missingEvidence.length===0,missingJourneys:Object.freeze(missingJourneys),missingEvidence:Object.freeze(missingEvidence),attestedOnly:true});
}
