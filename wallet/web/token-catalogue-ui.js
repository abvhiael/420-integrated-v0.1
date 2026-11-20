import { createTokenCatalogue420 } from './core/token-catalogue.js';
import { walletTokenDiscovery420 } from './core/token-discovery.js';
import { mountERC20Wizard420 } from './token-erc20-wizard-ui.js';
import { mountERC721Wizard420 } from './token-erc721-wizard-ui.js';
import { mountERC1155Wizard420 } from './token-erc1155-wizard-ui.js';

function el(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
}
const messages={
  unconfigured:'Release not configured. All eight profiles are shown for reference; availability is unknown.',
  disconnected:'Connect your Wallet to verify template availability.',
  checking:'Verifying Registry and template availability…',
  blocked:'Runtime unavailable. No templates can be selected.',
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
  status.id='token-catalogue-status';
  const account=el('p','token-catalogue-account');
  const selection=el('p','token-catalogue-selection');selection.setAttribute('role','status');
  const grid=el('div','token-catalogue-grid');
  controls.append(refresh,status);
  const wizard=el('section','token-erc20-wizard');wizard.id='token-erc20-wizard';
  const collectionWizard=el('section','token-erc721-wizard');collectionWizard.id='token-erc721-wizard';
  const multiWizard=el('section','token-erc1155-wizard');multiWizard.id='token-erc1155-wizard';
  body.append(intro,controls,account,grid,selection,wizard,collectionWizard,multiWizard);
  const disposeWizard=mountERC20Wizard420(wizard,model,session);
  const disposeCollectionWizard=mountERC721Wizard420(collectionWizard,model,session);
  const disposeMultiWizard=mountERC1155Wizard420(multiWizard,model,session);
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
    choose.type='button';choose.dataset.template=profile.key;choose.setAttribute('aria-pressed','false');
    choose.setAttribute('aria-describedby','token-catalogue-status token-availability-'+profile.key);
    availability.id='token-availability-'+profile.key;
    choose.addEventListener('click',()=>{void model.select(profile.key);});
    card.append(title,identity,description,features,availability,choose);grid.append(card);
    cards.set(profile.key,{card,availability,choose});
  }
  function render(view){
    status.textContent=messages[view.status]+(view.verificationBlock?
      ' '+view.enabledCount+' of 8 enabled · block '+BigInt(view.verificationBlock.number).toString()+
      ' · chain '+view.chainId+'.':'');
    refresh.disabled=!model.canRefresh()||view.status==='checking';
    account.textContent=view.status==='verified'?
      (view.accountReady?'Connected deployed SmartAccount owner verified.':'Account is not a verified deployed owner; creation requires Wallet readiness.'):'';
    for(const p of view.profiles){
      const {card,availability,choose}=cards.get(p.key);
      const selected=view.selected?.key===p.key;
      card.dataset.availability=p.availability;
      availability.textContent=p.availability==='enabled'?'Enabled by Registry':
        p.availability==='disabled'?'Disabled by governance':'Availability unverified';
      choose.disabled=!p.selectable;
      choose.setAttribute('aria-pressed',String(selected));
    }
    selection.textContent=view.selected?
      'Selected '+view.selected.key+' (V'+view.selected.version+'). Selection only; creation requires fresh verification and Wallet confirmation.':
      'No template selected. Browsing and selecting never creates a token or requests wallet approval.';
  }
  const unsubscribe=model.subscribe(render);
  refresh.addEventListener('click',()=>{void model.refresh();});
  details.addEventListener('toggle',()=>{if(details.open&&model.canRefresh())void model.refresh();});
  return ()=>{unsubscribe();disposeWizard();disposeCollectionWizard();disposeMultiWizard();model.dispose();};
}
