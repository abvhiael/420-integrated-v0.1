// Shared Wallet-owned creation draft lifecycle. No signing, simulation or broadcast.
import {describeTokenCatalogue420} from './token-catalogue.js';
import {buildTokenDeploymentRequest420} from './token-handoff.js';
import {TOKEN_CREATION_FEE_WEI_420} from './token-runtime.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function generateTokenCreationSalt420(){
  const bytes=new Uint8Array(32);
  if(!globalThis.crypto?.getRandomValues)throw Error('Secure randomness unavailable.');
  globalThis.crypto.getRandomValues(bytes);
  return '0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
export function validateTokenWizardMetadata420(value,label){
  check(typeof value==='string'&&value.trim().length>0,label+' is required.');
  check(!/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value),
    label+' must not contain control or directional formatting characters.');
  return value;
}

function binding(view,snapshot,profiles){
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
export function createTokenCreationWizard420(catalogue,session,{profiles,fields,validate,allowField=()=>true,salt=generateTokenCreationSalt420}){
  const blank=()=>Object.fromEntries(fields.map(field=>[field,'']));
  let selection=null,bound=null,values=blank(),draft=null,error='',busy=false,revision=0,disposed=false;
  const listeners=new Set();
  const view=()=>Object.freeze({profile:bound?.profile??null,owner:bound?.owner??null,chainId:bound?.chainId??null,
    factory:bound?.factory??null,block:bound?.block??null,fields:Object.freeze({...values}),draft,error,busy,
    ready:!!bound,creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),authority:'DRAFT_ONLY'});
  const emit=()=>{const v=view();for(const listener of [...listeners])listener(v);return v;};
  const stop=catalogue.subscribe(v=>{
    if(disposed)return;
    const next=binding(v,session.getSnapshot(),profiles);
    if(v.selected!==selection||!next||!sameBinding(next,bound)){
      selection=v.selected;bound=next;values=blank();draft=null;error='';
      if(bound&&!busy){try{values.userSalt=salt();}catch(e){error=e.message;}}
    }
    emit();
  });
  function subscribe(listener){if(disposed)throw Error('wizard disposed');listeners.add(listener);listener(view());return()=>listeners.delete(listener);}
  function setField(field,value){
    if(disposed||busy||!bound||!fields.includes(field)||typeof value!=='string'||!allowField(bound.profile,field))return false;
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
    try{validated=validate(bound.profile.key,values);}
    catch(e){draft=null;error=e.message;emit();return null;}
    const start=bound,saved={...values},attempt=++revision;
    busy=true;draft=null;error='';emit();
    let verified=false;
    try{verified=await catalogue.select(start.profile.key);}catch{/* fail closed */}
    if(disposed||attempt!==revision)return null;
    busy=false;
    const current=binding(catalogue.getSnapshot(),session.getSnapshot(),profiles);
    if(!verified||!sameBinding(start,current)||!sameBinding(bound,current)){
      values=blank();draft=null;error='Availability or Wallet account changed. Select a verified template again.';emit();return null;
    }
    bound=current;values=saved;
    try{
      const request=buildTokenDeploymentRequest420(session.getSnapshot().runtime,validated.draft);
      draft=Object.freeze({request,profile:current.profile,owner:current.owner,controller:current.controller,
        chainId:current.chainId,environment:current.environment,verificationBlock:current.block,
        release:current.release,...(validated.displaySupply!==undefined?{displaySupply:validated.displaySupply,displayCap:validated.displayCap}:{}),
        ...(validated.collection!==undefined?{collection:validated.collection}:{}),
        warnings:validated.warnings,authority:'DRAFT_ONLY',confirmationRequired:true});
      emit();return draft;
    }catch(e){draft=null;error=e.message;emit();return null;}
  }
  function dispose(){disposed=true;revision++;busy=false;draft=null;values=blank();bound=null;stop();listeners.clear();}
  return Object.freeze({subscribe,setField,renewSalt,reset,review,getSnapshot:view,dispose});
}
