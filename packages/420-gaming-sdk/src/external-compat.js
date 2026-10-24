// MIG-1 stable, zero-Genesis-import game boundary. Network operations never modify game state.
export const GAMING_SDK_COMPAT_VERSION='0.1.0';
export const GAMING_GAME_IDS=Object.freeze({
 highCountry:'420/GAMING/GAME/HIGH_COUNTRY/V1',
 greenRoad:'420/GAMING/GAME/THE_GREEN_ROAD/V1',
 budtender:'420/GAMING/GAME/BUDTENDER/V1',
 smokeAndChrome:'420/GAMING/GAME/SMOKE_AND_CHROME/V1',
 // MadBuds is not currently present in the Genesis on-chain deployment manifest.
 madBuds:null
});
export const GAMING_WALLET_METHODS=Object.freeze(['eip1193','guest']);
export const GAMING_ENTITLEMENT_SCHEMA=Object.freeze({version:1,required:['gameId','profileId','entitlementId','entitlementType','contentId','active']});
export const GAMING_REWARD_CLAIM_SCHEMA=Object.freeze({version:1,required:['gameId','profileId','claimId','evidenceHash','network']});
const fail=m=>{throw new TypeError('420 gaming compatibility: '+m)};
const str=s=>typeof s==='string'&&s.length>0&&s.length<=256;
const hex=s=>typeof s==='string'&&/^0x[0-9a-fA-F]{64}$/.test(s);
export function validateEntitlement420(v,gameId){
 if(!v||typeof v!=='object'||!GAMING_ENTITLEMENT_SCHEMA.required.every(k=>Object.hasOwn(v,k)))fail('entitlement fields');
 if(v.gameId!==gameId||!str(v.profileId)||!str(v.entitlementId)||!str(v.entitlementType)||!str(v.contentId)||typeof v.active!=='boolean')fail('entitlement invalid');
 return Object.freeze({...v});
}
export function validateRewardClaim420(v,gameId){
 if(!v||typeof v!=='object'||!GAMING_REWARD_CLAIM_SCHEMA.required.every(k=>Object.hasOwn(v,k)))fail('claim fields');
 if(v.gameId!==gameId||!str(v.profileId)||!str(v.claimId)||!hex(v.evidenceHash)||!['testnet','mainnet'].includes(v.network))fail('claim invalid');
 return Object.freeze({...v});
}
export function validateNetworkProfile420(profile,{allowUnresolved=false}={}){
 if(!profile||typeof profile!=='object'||profile.schema!=='420-gaming-external-network-v1'||!['offline','testnet'].includes(profile.mode))fail('profile');
 if(profile.mode==='offline')return Object.freeze({...profile});
 if(profile.status==='UNRESOLVED_UNTIL_DEPLOYMENT'&&allowUnresolved)return Object.freeze({...profile});
 if(!Number.isSafeInteger(profile.chainId)||profile.chainId<=0||!str(profile.rpcUrl)||!/^https:\/\//.test(profile.rpcUrl)||!profile.contracts||Object.values(profile.contracts).some(v=>!/^0x[0-9a-fA-F]{40}$/.test(v)))fail('testnet deployment unresolved');
 return Object.freeze({...profile});
}
export function createOfflineGamingAdapter420({gameId,entitlements=[]}={}){
 if(!str(gameId))fail('gameId');
 const items=entitlements.map(v=>validateEntitlement420(v,gameId));
 return Object.freeze({
  mode:'offline',gameId,
  async connect(){return Object.freeze({status:'guest',account:null})},
  async entitlement({profileId,entitlementId}){return items.find(v=>v.profileId===profileId&&v.entitlementId===entitlementId)??null},
  async claim(){return Object.freeze({status:'unavailable',reason:'offline'})},
  async disconnect(){return Object.freeze({status:'disconnected'})}
 });
}
export function createGameConnection420({gameId,adapter,onConnectionChange=()=>{}}={}){
 if(!str(gameId)||!adapter||adapter.gameId!==gameId||typeof adapter.connect!=='function'||typeof adapter.entitlement!=='function'||typeof adapter.claim!=='function'||typeof onConnectionChange!=='function')fail('adapter');
 let status='disconnected';
 const guarded=async(fn,fallback)=>{try{return await fn()}catch{return fallback}};
 return Object.freeze({
  get connectionStatus(){return status},
  async connect(){const r=await guarded(()=>adapter.connect(),{status:'unavailable'});status=r?.status==='connected'||r?.status==='guest'?r.status:'unavailable';onConnectionChange(status);return status},
  async getEntitlement(q){const result=await guarded(()=>adapter.entitlement(q),null);return result?guarded(()=>validateEntitlement420(result,gameId),null):null},
  async submitRewardClaim(v){return guarded(async()=>{validateRewardClaim420(v,gameId);return await adapter.claim(v)},{status:'unavailable'})},
  async disconnect(){await guarded(()=>adapter.disconnect?.(),null);status='disconnected';onConnectionChange(status);return status}
 });
}
// Gameplay simulation state must be maintained by the host game, never inside adapters.
