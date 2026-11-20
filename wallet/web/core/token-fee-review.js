// One explicit user gesture authorizes only a freshly re-simulated exact Wallet
// review. The record is in-memory, not a signature, transaction or capability.
const equal=(a,b)=>['controller','smartAccount','chainId','environment','authorizationEpoch','authorizationPolicyVersion',
  'templateId','configHash','calldataHash','executionHash','creatorNonce','predictedAddress','communityTreasuryVault',
  'creationFeeWei','gasUnits','gasPriceWei','estimatedGasWei','estimatedTotalWei'].every(k=>a[k]===b[k])&&
  ['metadataHash','manifestHash','interfaceHash','dependencyRoot'].every(k=>a.release[k]===b.release[k])&&
  ['from','to','value','data'].every(k=>a.transaction[k]===b.transaction[k]);
export function createTokenFeeReview420(wizard,session){
  let draft=null,quote=null,authorization=null,busy=false,error='',revision=0,disposed=false;
  const listeners=new Set();
  const view=()=>Object.freeze({draft,quote,authorization,busy,error});
  const emit=()=>{const v=view();for(const listener of [...listeners])listener(v);return v;};
  function clear(){++revision;quote=null;authorization=null;busy=false;error='';}
  const stop=wizard.subscribe(v=>{if(draft!==v.draft){clear();draft=v.draft;emit();}});
  const stopSession=session.subscribe(()=>{clear();emit();});
  function subscribe(listener){if(disposed)throw Error('Token fee review disposed');listeners.add(listener);listener(view());return()=>listeners.delete(listener);}
  async function simulate(){
    if(disposed||busy||!draft)return null;
    clear();const attempt=revision,source=draft,expected=session.getSnapshot();busy=true;emit();
    try{
      const result=await session.simulateCurrent(source,expected);
      if(disposed||attempt!==revision||draft!==source||session.getSnapshot()!==expected)return null;
      quote=result;busy=false;emit();return quote;
    }catch(e){if(!disposed&&attempt===revision){busy=false;error='Simulation or fee review failed: '+String(e?.message||'Unavailable').slice(0,240);emit();}return null;}
  }
  async function authorize(reviewed){
    if(disposed||busy||!draft||!quote||reviewed!==quote||authorization)return null;
    const attempt=++revision,source=draft,expected=session.getSnapshot();busy=true;error='';emit();
    try{
      const fresh=await session.simulateCurrent(source,expected,reviewed);
      if(disposed||attempt!==revision||draft!==source||session.getSnapshot()!==expected)return null;
      busy=false;quote=fresh;
      if(!equal(reviewed,fresh)){error='Review changed. Inspect the updated estimate and explicitly authorize again.';emit();return null;}
      authorization=Object.freeze({authority:'EXPLICIT_TOKEN_CREATION_AUTHORIZATION',review:fresh,confirmationRequired:false,submitted:false,
        maxGasWei:fresh.estimatedGasWei,maxTotalWei:fresh.estimatedTotalWei,
        // This is a review record only. A downstream Wallet submission must
        // independently verify it, enforce fee bounds and consume it once.
        submissionRequired:true});
      emit();return authorization;
    }catch(e){if(!disposed&&attempt===revision){busy=false;quote=null;authorization=null;error='Authorization rejected: '+String(e?.message||'Unavailable').slice(0,240);emit();}return null;}
  }
  function cancel(){if(!disposed){clear();emit();}}
  function dispose(){disposed=true;clear();draft=null;stop();stopSession();listeners.clear();}
  return Object.freeze({subscribe,simulate,authorize,cancel,getSnapshot:view,dispose});
}
