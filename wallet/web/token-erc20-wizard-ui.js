import {mountTokenFeeReview420} from './token-fee-review-ui.js';
import {createERC20Wizard420} from './core/token-erc20-wizard.js';
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
export function mountERC20Wizard420(section,catalogue,session){
  const model=createERC20Wizard420(catalogue,session);
  const heading=el('h4',null,'Create ERC20 token');
  heading.id='erc20-wizard-title';section.setAttribute('aria-labelledby',heading.id);
  const explanation=el('p',null,'Select an enabled ERC20 template with a verified, deployed SmartAccount owner to configure a draft.');
  const form=el('form','token-erc20-form');form.noValidate=true;form.hidden=true;
  const context=el('p','token-erc20-context');
  const grid=el('div','token-erc20-fields');
  const controls=el('div','token-catalogue-controls');
  const status=el('p','token-erc20-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.id='erc20-wizard-status';
  const inputs={};
  function field(key,label,hint,decimal=false){
    const wrap=el('div','token-erc20-field'),id='erc20-'+key;
    const lab=el('label',null,label);lab.htmlFor=id;
    const input=el('input');input.id=id;input.name=key;input.type='text';input.autocomplete='off';
    input.spellcheck=false;input.required=true;
    if(decimal)input.inputMode='decimal';
    const help=el('p','token-erc20-hint',hint);help.id=id+'-hint';
    input.setAttribute('aria-describedby',help.id+' '+status.id);
    input.addEventListener('input',()=>model.setField(key,input.value));
    wrap.append(lab,input,help);grid.append(wrap);inputs[key]={wrap,input};
  }
  field('name','Token name','Exact UTF-8 metadata. Names are not unique identities.');
  field('symbol','Token symbol','Display symbol; not a unique asset identifier.');
  field('supply','Initial supply (tokens)','18 decimals. Enter a plain decimal, without commas or exponents.',true);
  field('cap','Maximum supply (tokens)','Permanent cap; must be positive and at least the initial supply.',true);
  field('userSalt','Deployment salt (bytes32)','Secure random default; regenerate or enter an exact 32-byte hexadecimal salt.');
  const renew=el('button','ghost-button','Regenerate salt');renew.type='button';
  const review=el('button','ghost-button','Prepare ERC20 draft');review.type='submit';
  const reset=el('button','ghost-button','Clear draft');reset.type='button';
  controls.append(renew,review,reset);
  const preview=el('section','token-erc20-preview');preview.hidden=true;preview.setAttribute('aria-label','Prepared ERC20 draft');
  form.append(context,grid,controls,preview);section.replaceChildren(heading,explanation,form,status);
  function render(v){
    form.hidden=!v.ready&&!v.busy;
    explanation.textContent=v.ready?'Configure the frozen ERC20 profile. Draft preparation is read-only and does not simulate, sign or submit a transaction.':
      v.busy?'Rechecking the selected template and Wallet account…':
      'Select an enabled ERC20 template with a verified, deployed SmartAccount owner to configure a draft.';
    context.textContent=v.ready?v.profile.key+' · V1 · 18 decimals · SmartAccount owner '+v.owner+' · chain '+v.chainId+' · creation fee 42 native $420 (gas separate).':'';
    for(const [key,{wrap,input}] of Object.entries(inputs)){
      if(input.value!==v.fields[key])input.value=v.fields[key];
      wrap.hidden=key==='cap'&&!v.profile?.capped;
      input.disabled=v.busy||!v.ready||wrap.hidden;
    }
    renew.disabled=review.disabled=reset.disabled=!v.ready||v.busy;
    status.textContent=v.error||(v.busy?'Rechecking Registry and Wallet…':v.draft?'Draft prepared. No transaction simulated, signed or submitted.':'');
    preview.hidden=!v.draft;preview.replaceChildren();
    if(v.draft){
      const d=v.draft,r=d.request;
      const title=el('h5',null,'Prepared draft — not submitted');
      const dl=el('dl','token-erc20-review');
      const entries=[['Template',d.profile.key+' · V'+d.profile.version],['Template ID',d.profile.id],
        ['Name',r.draft.name],['Symbol',r.draft.symbol],['Decimals','18'],['Initial supply',d.displaySupply],
        ['Initial supply (base units)',r.draft.initialSupply],['Cap',d.displayCap??'No cap'],
        ['Cap (base units)',r.draft.cap],['Owner and initial token recipient',d.owner],['Factory',r.target],
        ['Chain',String(d.chainId)],['Creation fee','42 native $420 (network gas separate; not estimated)'],
        ['Deployment salt',r.draft.userSalt],['Configuration hash',r.configHash],['Calldata hash',r.calldataHash],
        ['Verified block',BigInt(d.verificationBlock.number).toString()+' · '+d.verificationBlock.hash]];
      for(const [label,value] of entries)dl.append(el('dt',null,label),el('dd',null,value));
      preview.append(title,dl);
      for(const warning of d.warnings)preview.append(el('p','token-erc20-warning',warning));
      preview.append(el('p',null,'This is a local draft only. The Wallet must independently reverify, simulate and request explicit confirmation before any creation transaction.'));
    }
  }
  const unsubscribe=model.subscribe(render);
  const disposeFeeReview=mountTokenFeeReview420(section,model,session);
  form.addEventListener('submit',e=>{e.preventDefault();void model.review();});
  renew.addEventListener('click',()=>model.renewSalt());
  reset.addEventListener('click',()=>model.reset());
  return ()=>{unsubscribe();disposeFeeReview();model.dispose();};
}
