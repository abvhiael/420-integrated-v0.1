// ERC20 wizard: exact quantities, canonical drafts and read-only verification.
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,tokenWord420} from './token-sdk.js';
import {describeTokenCatalogue420} from './token-catalogue.js';
import {buildTokenDeploymentRequest420} from './token-handoff.js';
import {TOKEN_CREATION_FEE_WEI_420} from './token-runtime.js';
const UNIT=10n**18n;
const fields=['name','symbol','supply','cap','userSalt'];
const profiles=new Map(TOKEN_TEMPLATES_420.filter(p=>p.standard==='ERC20').map(p=>[p.key,p]));
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function parseERC20Units420(value){
  check(typeof value==='string'&&value.length<=80&&/^[0-9]+(?:\.[0-9]{1,18})?$/.test(value),
    'Enter a nonnegative decimal amount with at most 18 fractional digits (no exponents or separators).');
  const [whole,fraction='']=value.split('.');
  const amount=BigInt(whole)*UNIT+BigInt(fraction.padEnd(18,'0'));
  tokenWord420(amount);return amount.toString();
}
export function formatERC20Units420(value){
  const amount=BigInt('0x'+tokenWord420(value));
  const fraction=(amount%UNIT).toString().padStart(18,'0').replace(/0+$/,'');
  return (amount/UNIT).toString()+(fraction?'.'+fraction:'');
}
export function generateERC20Salt420(){
  const bytes=new Uint8Array(32);
  if(!globalThis.crypto?.getRandomValues)throw Error('Secure randomness unavailable.');
  globalThis.crypto.getRandomValues(bytes);
  return '0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function metadata(value,label){
  check(typeof value==='string'&&value.trim().length>0,label+' is required.');
  check(!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value),
    label+' must not contain control or directional formatting characters.');
  return value;
}
export function validateERC20WizardFields420(key,input){
  const profile=profiles.get(key);
  check(profile,'Select a frozen ERC20 template.');
  check(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).every(k=>fields.includes(k)),
    'Unexpected ERC20 wizard field.');
  const supply=parseERC20Units420(input.supply);
  const cap=profile.capped?parseERC20Units420(input.cap):'0';
  check(profile.capped||input.cap===''||input.cap==='0'||input.cap===undefined,'Only the capped template accepts a supply cap.');
  const result=encodeTokenCreation420({template:key,name:metadata(input.name,'Token name'),
    symbol:metadata(input.symbol,'Token symbol'),initialSupply:supply,cap,userSalt:input.userSalt});
  return Object.freeze({...result,displaySupply:formatERC20Units420(supply),displayCap:profile.capped?formatERC20Units420(cap):null,
    warnings:Object.freeze(supply==='0'?[profile.mintable?'Initial supply is zero; the owner can mint later.':
      'Initial supply is zero and this template cannot mint later.']:[])});
}
const blank=()=>({name:'',symbol:'',supply:'',cap:'',userSalt:''});
function binding(view,snapshot){
  const selected=view.selected,profile=profiles.get(selected?.key),runtime=snapshot?.runtime;
  if(!profile||selected.authority!=='DISPLAY_ONLY'||selected.id!==profile.id||
    selected.version!==profile.version||!view.accountReady||snapshot?.status!=='verified'||
    snapshot.deployed!==true||snapshot.controllerIsOwner!==true||
    !describeTokenCatalogue420(snapshot).profiles.find(p=>p.id===profile.id)?.selectable||
    selected.verificationBlock?.hash!==snapshot.verificationBlock?.hash||
    selected.verificationBlock?.number!==snapshot.verificationBlock?.number||
    !/^0x[0-9a-f]{40}$/i.test(snapshot.controller||'')||!/^0x[0-9a-f]{40}$/i.test(snapshot.smartAccount||''))return null;
  return Object.freeze({profile,controller:snapshot.controller,owner:snapshot.smartAccount,chainId:runtime.chainId,
    environment:snapshot.environment,factory:runtime.factory.address,release:runtime.release,block:Object.freeze({...snapshot.verificationBlock})});
}
const sameBinding=(a,b)=>!!a&&!!b&&a.profile.id===b.profile.id&&a.controller===b.controller&&
  a.owner===b.owner&&a.chainId===b.chainId&&a.environment===b.environment&&a.factory===b.factory&&
  ['manifestHash','dependencyRoot','interfaceHash','metadataHash'].every(k=>a.release[k]===b.release[k]);
export function createERC20Wizard420(catalogue,session,{salt=generateERC20Salt420}={}){
  let selection=null,bound=null,values=blank(),draft=null,error='',busy=false,revision=0,disposed=false;
  const listeners=new Set();
  const view=()=>Object.freeze({profile:bound?.profile??null,owner:bound?.owner??null,chainId:bound?.chainId??null,
    factory:bound?.factory??null,block:bound?.block??null,fields:Object.freeze({...values}),draft,error,busy,
    ready:!!bound,creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),authority:'DRAFT_ONLY'});
  const emit=()=>{const v=view();for(const listener of [...listeners])listener(v);return v;};
  const stop=catalogue.subscribe(v=>{
    if(disposed)return;
    const next=binding(v,session.getSnapshot());
    if(v.selected!==selection||!next||!sameBinding(next,bound)){
      selection=v.selected;bound=next;values=blank();draft=null;error='';
      if(bound&&!busy){try{values.userSalt=salt();}catch(e){error=e.message;}}
    }
    emit();
  });
  function subscribe(listener){if(disposed)throw Error('wizard disposed');listeners.add(listener);listener(view());return()=>listeners.delete(listener);}
  function setField(field,value){
    if(disposed||busy||!bound||!fields.includes(field)||typeof value!=='string'||(field==='cap'&&!bound.profile.capped))return false;
    values={...values,[field]:value};draft=null;error='';revision++;emit();return true;
  }
  function renewSalt(){
    if(disposed||busy||!bound)return false;
    try{return setField('userSalt',salt());}catch(e){draft=null;error=e.message;emit();return false;}
  }
  function reset(){
    if(disposed)return;
    revision++;busy=false;values=blank();draft=null;error='';
    if(bound){try{values.userSalt=salt();}catch(e){error=e.message;}}
    emit();
  }
  async function review(){
    if(disposed||busy||!bound)return null;
    let validated;
    try{validated=validateERC20WizardFields420(bound.profile.key,values);}
    catch(e){draft=null;error=e.message;emit();return null;}
    const start=bound,saved={...values},attempt=++revision;
    busy=true;draft=null;error='';emit();
    let verified=false;
    try{verified=await catalogue.select(start.profile.key);}catch{/* fail closed */}
    if(disposed||attempt!==revision)return null;
    busy=false;
    const current=binding(catalogue.getSnapshot(),session.getSnapshot());
    if(!verified||!sameBinding(start,current)||!sameBinding(bound,current)){
      values=blank();draft=null;error='Availability or Wallet account changed. Select a verified template again.';emit();return null;
    }
    bound=current;values=saved;
    try{
      const request=buildTokenDeploymentRequest420(session.getSnapshot().runtime,validated.draft);
      draft=Object.freeze({request,profile:current.profile,owner:current.owner,controller:current.controller,
        chainId:current.chainId,environment:current.environment,verificationBlock:current.block,
        release:current.release,displaySupply:validated.displaySupply,displayCap:validated.displayCap,
        warnings:validated.warnings,authority:'DRAFT_ONLY',confirmationRequired:true});
      emit();return draft;
    }catch(e){draft=null;error=e.message;emit();return null;}
  }
  function dispose(){disposed=true;revision++;busy=false;draft=null;values=blank();bound=null;stop();listeners.clear();}
  return Object.freeze({subscribe,setField,renewSalt,reset,review,getSnapshot:view,dispose});
}
