// Shared Wallet-owned creation draft lifecycle. No signing, simulation or broadcast.
import {describeTokenCatalogue420} from './token-catalogue.js';
import {buildTokenDeploymentRequest420} from './token-handoff.js';
import {tokenEncodeAbi420,tokenHashWord420} from './token-sdk.js';
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

// Attach a field only for validation performed on that field; RPC/context
// failures remain form-level errors. Use the same canonical SDK validation.
export function tokenWizardField420(field,validate){
  try{return validate();}catch(error){const e=new Error(String(error?.message||'Invalid field'));e.field=field;throw e;}
}
export function tokenWizardTextField420(field,value,label,uri=false){
  return tokenWizardField420(field,()=>{const v=uri?validateTokenWizardURI420(value):validateTokenWizardMetadata420(value,label);tokenEncodeAbi420(['string'],[v]);return v;});
}
export function tokenWizardSaltField420(value){return tokenWizardField420('userSalt',()=>{tokenHashWord420(value);return value;});}

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
  let selection=null,bound=null,values=blank(),draft=null,error='',errorField=null,busy=false,revision=0,disposed=false;
  const listeners=new Set();
  const view=()=>Object.freeze({profile:bound?.profile??null,owner:bound?.owner??null,chainId:bound?.chainId??null,
    factory:bound?.factory??null,block:bound?.block??null,fields:Object.freeze({...values}),draft,error,errorField,busy,
    ready:!!bound,creationFeeWei:TOKEN_CREATION_FEE_WEI_420.toString(),authority:'DRAFT_ONLY'});
  const emit=()=>{const v=view();for(const listener of [...listeners])listener(v);return v;};
  const stop=catalogue.subscribe(v=>{
    if(disposed)return;
    const next=binding(v,session.getSnapshot(),profiles);
    if(v.selected!==selection||!next||!sameBinding(next,bound)){
      selection=v.selected;bound=next;values=blank();draft=null;error='';errorField=null;
      if(bound&&!busy){try{values.userSalt=salt();}catch(e){error=e.message;errorField='userSalt';}}
    }
    emit();
  });
  function subscribe(listener){if(disposed)throw Error('wizard disposed');listeners.add(listener);listener(view());return()=>listeners.delete(listener);}
  function setField(field,value){
    if(disposed||busy||!bound||!fields.includes(field)||typeof value!=='string'||!allowField(bound.profile,field))return false;
    values={...values,[field]:value};draft=null;error='';errorField=null;revision++;emit();return true;
  }
  function renewSalt(){
    if(disposed||busy||!bound)return false;
    try{return setField('userSalt',salt());}catch(e){draft=null;error=e.message;errorField='userSalt';emit();return false;}
  }
  function reset(){
    if(disposed)return;
    revision++;busy=false;values=blank();draft=null;error='';errorField=null;
    if(bound){try{values.userSalt=salt();}catch(e){error=e.message;errorField='userSalt';}}
    emit();
  }
  async function review(){
    if(disposed||busy||!bound)return null;
    let validated;
    try{validated=validate(bound.profile.key,values);}
    catch(e){draft=null;error=e.message;errorField=fields.includes(e.field)?e.field:null;emit();return null;}
    const start=bound,saved={...values},attempt=++revision;
    busy=true;draft=null;error='';errorField=null;emit();
    let verified=false;
    try{verified=await catalogue.select(start.profile.key);}catch{/* fail closed */}
    if(disposed||attempt!==revision)return null;
    busy=false;
    const current=binding(catalogue.getSnapshot(),session.getSnapshot(),profiles);
    if(!verified||!sameBinding(start,current)||!sameBinding(bound,current)){
      values=blank();draft=null;errorField=null;error='Availability or Wallet account changed. Select a verified template again.';emit();return null;
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

// Shared URI input guard. Preserve exact bytes; never retrieve metadata.
export function validateTokenWizardURI420(uri){
  // Empty metadata is a valid V1 configuration. Nonempty URI text is stored
  // exactly and displayed as inert text. Never fetch, resolve or dereference it.
  check(typeof uri==='string','Collection base URI must be a string.');
  if(uri!==''){
    validateTokenWizardMetadata420(uri,'Collection base URI');
    check(/^[A-Za-z][A-Za-z0-9+.-]*:.+$/u.test(uri)&&!/[\s\u007f]/u.test(uri)&&!/%(?![0-9a-fA-F]{2})/u.test(uri),
      'Enter an absolute collection URI without spaces or malformed percent escapes, or leave it empty.');
    check(!/^(javascript|vbscript):/i.test(uri),'Executable URI schemes are not supported in this wizard.');
    if(/^https?:/i.test(uri)){
      let url;try{url=new URL(uri);}catch{throw Error('Invalid HTTP collection URI.');}
      check(/^https?:\/\//i.test(uri)&&url.hostname&&!url.username&&!url.password&&!uri.includes('\\'),
        'HTTP collection URI must contain a host without embedded credentials.');
    }
  }
  return uri;
}
