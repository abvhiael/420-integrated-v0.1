import {tokenStatus420,setTokenStatus420,focusToken420,runTokenAction420,tokenHidingFocus420} from './token-ui-accessibility.js';
import { createTokenCatalogue420 } from './core/token-catalogue.js';
import { walletTokenDiscovery420 } from './core/token-discovery.js';
import { mountERC20Wizard420 } from './token-erc20-wizard-ui.js';
import { mountERC721Wizard420 } from './token-erc721-wizard-ui.js';
import {mountTokenPortfolio420} from './token-portfolio-ui.js';
import { mountERC1155Wizard420 } from './token-erc1155-wizard-ui.js';

function el(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
}
const messages={
  unconfigured:'Release not configured. All eight profiles are shown for reference; availability is unknown. Use an approved Wallet release configuration before creating tokens.',
  disconnected:'Connect your Wallet to verify template availability. No creation or management actions are authorized.',
  checking:'Verifying Registry and template availability…',
  blocked:'Runtime unavailable. No templates can be selected. Check the connected network, account and approved release configuration; then refresh availability.',
  verified:'Registry verified. Availability is recorded at the verified block, not a transaction authorization.',
};
export function mountTokenCatalogue420(details,session=walletTokenDiscovery420){
  const model=createTokenCatalogue420(session);
  const summary=el('summary','token-catalogue-summary','420Token template catalogue');
  const body=el('div','token-catalogue-body');
  const intro=el('p',null,'Eight frozen Genesis V1 templates. Each creation costs exactly 42 native $420, all routed to the community Treasury Vault. Network gas is separate. A template is not an endorsement or downstream asset approval.');
  const controls=el('div','token-catalogue-controls');
  const refresh=el('button','ghost-button','Refresh availability');refresh.type='button';
  const status=el('p','token-catalogue-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.id='token-catalogue-status';tokenStatus420(status);
  const account=el('p','token-catalogue-account');
  const selection=el('p','token-catalogue-selection');tokenStatus420(selection);
  const grid=el('div','token-catalogue-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Token templates');
  controls.append(refresh,status);
  const wizard=el('section','token-erc20-wizard');wizard.id='token-erc20-wizard';
  const collectionWizard=el('section','token-erc721-wizard');collectionWizard.id='token-erc721-wizard';
  const multiWizard=el('section','token-erc1155-wizard');multiWizard.id='token-erc1155-wizard';
  body.append(intro,controls,account,grid,selection,wizard,collectionWizard,multiWizard);
  const disposeWizard=mountERC20Wizard420(wizard,model,session);
  const disposeCollectionWizard=mountERC721Wizard420(collectionWizard,model,session);
  const disposeMultiWizard=mountERC1155Wizard420(multiWizard,model,session);
  const tracking=el('section','token-fee-review');tracking.hidden=true;tracking.setAttribute('aria-label','Token deployment transaction tracking');tracking.tabIndex=-1;body.append(tracking);
  const trackingStatus=tokenStatus420(el('p','token-fee-review-status'));trackingStatus.id='token-tracking-status';
  const trackingList=el('div','token-tracking-list');tracking.append(el('h5',null,'Token deployment transactions'),trackingStatus,trackingList);
  const descriptions={submitting:'Waiting for Wallet submission. Check the Wallet prompt; do not submit twice.',pending:'Pending — waiting for canonical inclusion. Check confirmation again.',confirming:'Checking canonical receipt and transaction…',reverted:'Transaction reverted. The operation did not complete; review Wallet activity before preparing a new operation.',reorganized:'Chain reorganized. Prior confirmation is no longer established. Check confirmation again.',unverified:'Transaction evidence unavailable or mismatched. Check confirmation again; do not assume completion.',rejected:'Wallet rejected or cancelled the submission. No confirmed transaction.',unknown:'Submission outcome unknown — check Wallet activity; do not resubmit automatically.'};
  const disposeTracking=session.subscribeTransactions(records=>{
    const active=document.activeElement,hash=tracking.contains(active)?active?.dataset?.txHash:null;
    if(tracking.contains(active)&&records.length===0)focusToken420(status);
    tracking.hidden=records.length===0;trackingList.replaceChildren();
    setTokenStatus420(trackingStatus,records.length?records.length+' tracked transaction'+(records.length===1?'':'s')+'. Latest tracked state: '+records.at(-1).status+'.':'',records.some(r=>r.status==='confirming'||r.status==='submitting')?'busy':'idle');
    for(const record of records){const item=el('article');const status=el('p','token-fee-review-status',record.status==='confirmed'?(record.kind==='management'?'Canonical management transaction confirmed (not finality). Refresh created tokens for current state.':'Canonical deployment confirmed (not finality or listing approval).'):record.status);tokenStatus420(status);status.dataset.txHash=record.txHash||'';item.append(status);if(descriptions[record.status])item.append(el('p',null,descriptions[record.status]));if(record.kind==='management')item.append(el('p',null,'Management: '+record.label));
      if(record.txHash){item.append(el('p','token-fee-review-status','Transaction: '+record.txHash));const check=el('button','ghost-button',record.kind==='management'?'Check management confirmation':'Check deployment confirmation');check.type='button';check.dataset.txHash=record.txHash;check.disabled=record.status==='confirming'||record.status==='submitting';check.addEventListener('click',()=>{void runTokenAction420(check,trackingStatus,()=>session.checkTransaction(record.txHash));});item.append(check);}
      if(record.error)item.append(el('p','token-fee-review-status',record.error));
      if(record.confirmation?.tokenAddress)item.append(el('p','token-fee-review-status','Deployed token: '+record.confirmation.tokenAddress+' · '+record.confirmation.confirmations+' confirmations'));
      trackingList.append(item);}
    if(hash&&document.activeElement===document.body){const next=[...tracking.querySelectorAll('[data-tx-hash]')].find(n=>n.dataset.txHash===hash&&n.tagName==='BUTTON'&&!n.disabled)||trackingStatus;focusToken420(next);}
  });
  const disposePortfolio=mountTokenPortfolio420(body,session);
  details.replaceChildren(summary,body);
  const cards=new Map();
  for(const profile of model.getSnapshot().profiles){
    const card=el('article','token-template-card');
    const title=el('h4',null,profile.standard+' · '+profile.name);
    const identity=el('p','token-template-identity','V'+profile.version+' · '+profile.key);
    const description=el('p',null,profile.description);
    const features=el('ul','token-template-features');
    for(const feature of profile.features)features.append(el('li',null,feature));
    const availability=el('p','token-template-availability');
    const choose=el('button','ghost-button','Select '+profile.name);
    choose.type='button';choose.dataset.template=profile.key;choose.setAttribute('aria-controls','token-'+profile.standard.toLowerCase()+'-wizard');choose.setAttribute('aria-pressed','false');
    choose.setAttribute('aria-describedby','token-catalogue-status token-availability-'+profile.key);
    availability.id='token-availability-'+profile.key;
    choose.addEventListener('click',()=>{void runTokenAction420(choose,status,async()=>{const ok=await model.select(profile.key);if(!ok&&model.getSnapshot().status==='verified')setTokenStatus420(selection,'Selection unavailable. Refresh availability and select an enabled template again.','error');return ok;},()=>model.getSnapshot().selected?.key===profile.key?document.getElementById(profile.standard.toLowerCase()+'-wizard-title'):null);});
    card.append(title,identity,description,features,availability,choose);grid.append(card);
    cards.set(profile.key,{card,availability,choose});
  }
  function render(view){
    setTokenStatus420(status,messages[view.status]+(view.verificationBlock?
      ' '+view.enabledCount+' of 8 enabled · block '+BigInt(view.verificationBlock.number).toString()+
      ' · chain '+view.chainId+'.':''),view.status==='blocked'?'error':view.status==='checking'?'busy':view.status==='verified'?'success':'idle');
    grid.setAttribute('aria-busy',String(view.status==='checking'));
    refresh.disabled=!model.canRefresh()||view.status==='checking';
    account.textContent=view.status==='verified'?
      (view.accountReady?'Connected deployed SmartAccount owner verified.':'Account is not a verified deployed owner; creation requires Wallet readiness.'):'';
    for(const p of view.profiles){
      const {card,availability,choose}=cards.get(p.key);
      const selected=view.selected?.key===p.key;
      card.dataset.availability=p.availability;
      availability.textContent=p.availability==='enabled'?'Enabled by Registry':
        p.availability==='disabled'?'Disabled by governance':'Availability unverified';
      if(!p.selectable&&document.activeElement===choose)focusToken420(status);
      choose.disabled=!p.selectable;
      choose.setAttribute('aria-pressed',String(selected));
    }
    selection.textContent=view.selected?
      'Selected '+view.selected.key+' (V'+view.selected.version+'). Selection only; creation requires fresh verification and Wallet confirmation.':
      'No template selected. Browsing and selecting never creates a token or requests wallet approval.';
  }
  const unsubscribe=model.subscribe(render);
  refresh.addEventListener('click',()=>{void runTokenAction420(refresh,status,()=>model.refresh());});
  const toggle=()=>{if(details.open&&model.canRefresh())void model.refresh();else if(!details.open&&body.contains(document.activeElement))focusToken420(summary);};
  details.addEventListener('toggle',toggle);
  return ()=>{details.removeEventListener('toggle',toggle);unsubscribe();disposePortfolio();disposeTracking();disposeWizard();disposeCollectionWizard();disposeMultiWizard();model.dispose();};
}
