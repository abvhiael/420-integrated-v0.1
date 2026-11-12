import {buildWalletVerificationModel420} from './core/network-verification.js';
const section=document.getElementById('network-verification');
if(section) {
  const $=id=>document.getElementById(id);
  let snapshot={phase:'loading'};
  const set=(id,value)=>{if($(id) && $(id).textContent!==value) $(id).textContent=value;};
  const map=['wallet','network','factory','entrypoint','registry','account','services'];
  const render=()=>{
    const model=buildWalletVerificationModel420(snapshot);
    set('verification-banner-title',model.banner.label);
    set('verification-banner-detail',model.banner.detail);
    $('verification-banner').dataset.state=model.banner.state;
    for(const key of map) {
      set('verification-'+key,model[key].label);
      set('verification-'+key+'-detail',model[key].detail);
    }
    // The Apps page owns manifest acceptance; this view must never infer it from config.
    const trust=$('apps-trust-state')?.textContent||'';
    if(trust==='Verified manifest') {
      set('verification-services','Manifest accepted by resolver');
      set('verification-services-detail','Available application links come only from the accepted manifest.');
    } else if(trust.startsWith('Discovery blocked:')) {
      set('verification-services','Service discovery blocked');
      set('verification-services-detail','No ecosystem launch links are trusted. See the Apps page for the error.');
    }
  };
  document.addEventListener('wallet:verification-state',event=>{
    snapshot=event.detail||{phase:'failure',error:'Missing verification state'};
    render();
  });
  const apps=$('services-section');
  if(apps) new MutationObserver(render).observe(apps,{subtree:true,childList:true,characterData:true});
  render();
}
