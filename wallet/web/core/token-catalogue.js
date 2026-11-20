// Canonical Wallet Token template catalogue. Local profile descriptions are never
// a substitute for the verified Registry enablement snapshot.
import { TOKEN_TEMPLATES_420 } from './token-sdk.js';
import { TOKEN_SERVICE_ID_420, TOKEN_CREATION_FEE_WEI_420 } from './token-runtime.js';

const descriptions = Object.freeze({
  ERC20_FIXED: ['Fixed supply', 'Fungible token with an immutable initial supply. No subsequent minting or burning.'],
  ERC20_MINTABLE: ['Owner mintable', 'Fungible token whose owner can mint additional units. No supply cap or burning.'],
  ERC20_CAPPED: ['Capped supply', 'Owner minting up to a permanent maximum supply. No burning.'],
  ERC20_BURNABLE: ['Burnable supply', 'Fixed initial supply; holders can burn their units, or approved spenders can burn within allowance. No new minting.'],
  ERC20_PERMIT: ['Permit-enabled', 'Fixed supply with EIP-2612 signed allowance approvals. No new minting or burning.'],
  ERC20_VOTES: ['Voting checkpoints', 'Fixed supply with EIP-2612 permits, delegated voting power and historical checkpoints. No new minting or burning.'],
  ERC721_COLLECTION: ['NFT collection', 'Owner mints unique token IDs. Holders or approved operators can burn NFTs. Collection base URI; not a fungible supply.'],
  ERC1155_MULTI: ['Multi-token collection', 'Owner mints quantities per token ID. Holders or approved operators can burn quantities. Supports safe batch transfers and per-ID URI substitution.'],
});
const catalogue = Object.freeze(TOKEN_TEMPLATES_420.map(profile => {
  const [name,description]=descriptions[profile.key];
  const nft=profile.standard!=='ERC20';
  const features=Object.freeze([
    ...(nft ? ['Owner minting','Holder or approved-operator burning'] :
      [profile.mintable?'Owner minting':'No additional minting',profile.capped?'Permanent supply cap':null,
        profile.burnable?'Holder or allowance-based burning':'No burning',profile.permit?'EIP-2612 permit':null,
        profile.votes?'Delegation and historical voting checkpoints':null,'18 decimals'].filter(Boolean)),
    ...(profile.standard==='ERC721'?['Unique token IDs','Collection base URI']:[]),
    ...(profile.standard==='ERC1155'?['Quantities per ID','Safe batch transfers','URI with ID substitution']:[]),
  ]);
  return Object.freeze({...profile,name,description,features,
    creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString()});
}));
export const TOKEN_CATALOGUE_PROFILES_420=catalogue;
const states=new Set(['unconfigured','disconnected','checking','verified','blocked']);

// The only dynamic field is enablement, taken from an exact complete verified
// discovery result. Missing, duplicated, substituted or malformed profiles
// cannot be interpreted as a partial available catalogue.
function verifiedProfiles(snapshot) {
  if(snapshot?.status!=='verified'||snapshot.authority!=='DISCOVERY_ONLY'||
      snapshot.serviceId!==TOKEN_SERVICE_ID_420||snapshot.accountGrant!==false||
      snapshot.spendingAuthority!==false) return null;
  const r=snapshot.runtime,b=snapshot.verificationBlock;
  if(r?.serviceId!==TOKEN_SERVICE_ID_420||r.version!==1||!b||
    !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(b.number)||
    !/^0x[0-9a-fA-F]{64}$/.test(b.hash)||
    b.hash!==r.verificationBlock?.hash||b.number!==r.verificationBlock?.number||
    !Array.isArray(r.templates)||r.templates.length!==catalogue.length) return null;
  const byId=new Map(r.templates.map(p=>[p?.id,p]));
  if(byId.size!==catalogue.length)return null;
  for(const p of catalogue){
    const actual=byId.get(p.id);
    if(!actual||actual.key!==p.key||actual.standard!==p.standard||actual.version!==p.version||
       actual.profileHash!==p.profileHash||typeof actual.enabled!=='boolean')return null;
  }
  return byId;
}

export function describeTokenCatalogue420(snapshot) {
  const verified=verifiedProfiles(snapshot);
  const requested=states.has(snapshot?.status)?snapshot.status:'unconfigured';
  const status=requested==='verified'&&!verified?'blocked':requested;
  const profiles=Object.freeze(catalogue.map(p=>Object.freeze({...p,
    availability:verified?(verified.get(p.id).enabled?'enabled':'disabled'):'unknown',
    selectable:!!verified&&verified.get(p.id).enabled,
  })));
  return Object.freeze({status,profiles,enabledCount:verified?profiles.filter(p=>p.selectable).length:null,
    verificationBlock:verified?Object.freeze({...snapshot.verificationBlock}):null,
    chainId:verified?snapshot.runtime.chainId:null,
    accountReady:!!verified&&snapshot.deployed===true&&snapshot.controllerIsOwner===true,
    authority:'DISCOVERY_ONLY',creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString()});
}

// A selection is only a display preference for a particular independently
// reverified snapshot; it is not a draft, account grant, confirmation or spend.
export function createTokenCatalogue420(session) {
  let selected=null, revision=0, snapshot=session.getSnapshot(), disposed=false;
  const listeners=new Set();
  const view=()=>Object.freeze({...describeTokenCatalogue420(snapshot),selected});
  const emit=()=>{const v=view();for(const listener of [...listeners])listener(v);return v;};
  const stop=session.subscribe(value=>{snapshot=value;selected=null;emit();});
  function subscribe(listener){if(disposed)throw Error('catalogue disposed');listeners.add(listener);listener(view());return()=>listeners.delete(listener);}
  async function refresh(){
    if(disposed)return view();
    ++revision;selected=null;emit();
    await session.refreshCurrent();return view();
  }
  async function select(key){
    if(disposed)return false;
    const profile=view().profiles.find(p=>p.key===key);
    if(!profile?.selectable)return false;
    const start=snapshot,attempt=++revision;
    selected=null;emit();
    const fresh=await session.refreshCurrent();
    if(disposed||attempt!==revision||!fresh||session.getSnapshot()!==fresh||
      fresh.controller!==start.controller||fresh.smartAccount!==start.smartAccount||
      fresh.environment!==start.environment||
      fresh.runtime?.chainId!==start.runtime?.chainId||
      fresh.runtime?.release?.dependencyRoot!==start.runtime?.release?.dependencyRoot||
      fresh.runtime?.release?.manifestHash!==start.runtime?.release?.manifestHash||
      !describeTokenCatalogue420(fresh).profiles.find(p=>p.key===key)?.selectable)return false;
    selected=Object.freeze({key:profile.key,id:profile.id,version:profile.version,
      verificationBlock:Object.freeze({...fresh.verificationBlock}),authority:'DISPLAY_ONLY'});
    emit();return true;
  }
  function dispose(){disposed=true;++revision;selected=null;stop();listeners.clear();}
  return Object.freeze({subscribe,refresh,select,getSnapshot:view,canRefresh:()=>!disposed&&session.canRefresh(),dispose});
}
