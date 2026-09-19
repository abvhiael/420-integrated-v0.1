// BG-19.14: integration readiness is not inferred from a rendered view or green unit tests.
export const JOURNEYS=Object.freeze({
 profile:Object.freeze({route:'/profile',requires:['profileRead','relationshipRead','walletTransaction','canonicalRefresh']}),
 publish:Object.freeze({route:'/',requires:['feedRead','mediaRegistration','walletTransaction','canonicalRefresh']}),
 community:Object.freeze({route:'/groups',requires:['communityRead','membershipWrite','canonicalRefresh']}),
 messaging:Object.freeze({route:'/messages',requires:['conversationRead','encryptedMessenger','deviceKeyPolicy','messageSend']}),
 discovery:Object.freeze({route:'/discover',requires:['searchRead','reviewRead','reviewWrite','canonicalRefresh']}),
 games:Object.freeze({route:'/games',requires:['gameListRead','gameDetailRead','rulesetEngine','gameWrite','canonicalRefresh']}),
 notifications:Object.freeze({route:'/notifications',requires:['notificationRead','notificationPreferences']}),
 rewards:Object.freeze({route:'/rewards',requires:['rewardRead','claimBinding','walletTransaction','canonicalRefresh']}),
 safety:Object.freeze({route:'/safety',requires:['moderationRead','reportBinding','appealBinding','canonicalRefresh']}),
 publicPages:Object.freeze({route:'/profile',requires:['publicObjectRead','httpVisibilityStatus','searchIndexPolicy']})
});
const BINDINGS=new Set(Object.values(JOURNEYS).flatMap(j=>j.requires));
const HEX_ADDRESS=/^0x[0-9a-f]{40}$/i;
/** Caller must provide qualified, explicitly verified bindings, never boolean UI flags. */
export function qualifyJourney(name,{bindings={},viewer=null,connected=false,supportedNetwork=false,canonicalRefresh=false}={}){
 const journey=JOURNEYS[name];if(!journey)throw new Error('unknown journey');
 if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))throw new Error('invalid binding registry');
 const missing=journey.requires.filter(key=>{
  const binding=bindings[key];return !binding||binding.qualified!==true||binding.available!==true||typeof binding.version!=='string'||!binding.version.trim();
 });
 if(journey.requires.includes('canonicalRefresh')&&canonicalRefresh!==true&&!missing.includes('canonicalRefresh'))missing.push('canonicalRefresh');
 const requiresWallet=name!=='publicPages';
 if(requiresWallet&&(!connected||!HEX_ADDRESS.test(viewer??'')||!supportedNetwork))missing.push('walletSession');
 return Object.freeze({name,route:journey.route,ready:missing.length===0,missing:Object.freeze(missing),authoritative:false});
}
export function qualifyAllJourneys(context={}){return Object.freeze(Object.keys(JOURNEYS).map(name=>qualifyJourney(name,context)));}
/** Projection transport descriptors must be supplied by an audited service deployment. */
export function assertQualifiedBinding(name,binding){
 if(!BINDINGS.has(name))throw new Error('unknown binding');
 if(!binding||binding.qualified!==true||binding.available!==true||typeof binding.version!=='string'||!binding.version.trim())throw new Error(`unqualified binding: ${name}`);
 return Object.freeze({name,qualified:true,available:true,version:binding.version,authoritative:false});
}
