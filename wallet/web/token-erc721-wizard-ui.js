import {tokenStatus420,setTokenStatus420,focusToken420,runTokenAction420,tokenHidingFocus420,tokenFieldError420} from './token-ui-accessibility.js';
import {mountTokenFeeReview420} from './token-fee-review-ui.js';
import {createERC721Wizard420} from './core/token-erc721-wizard.js';
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
export function mountERC721Wizard420(section,catalogue,session){
  const model=createERC721Wizard420(catalogue,session);
  const heading=el('h4',null,'Create ERC721 collection');
  heading.id='erc721-wizard-title';heading.tabIndex=-1;section.setAttribute('aria-labelledby',heading.id);
  const explanation=el('p',null,'Select the enabled ERC721 collection template with a verified, deployed SmartAccount owner to configure a draft.');
  const form=el('form','token-erc721-form');form.noValidate=true;form.hidden=true;
  const context=el('p','token-erc721-context');
  const grid=el('div','token-erc721-fields');
  const controls=el('div','token-catalogue-controls');
  const status=el('p','token-erc721-status');status.id='erc721-wizard-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  tokenStatus420(status);
  const inputs={};
  function field(key,label,hint,required=true){
    const wrap=el('div','token-erc721-field'),id='erc721-'+key;
    const lab=el('label',null,label);lab.htmlFor=id;
    const input=el('input');input.id=id;input.name=key;input.type='text';input.autocomplete='off';input.spellcheck=false;input.required=required;
    const help=el('p','token-erc721-hint',hint);help.id=id+'-hint';input.setAttribute('aria-describedby',help.id+' '+status.id);
    input.addEventListener('input',()=>model.setField(key,input.value));
    wrap.append(lab,input,help);grid.append(wrap);inputs[key]=input;
  }
  field('name','Collection name','Exact UTF-8 metadata. Names are not unique asset identities.');
  field('symbol','Collection symbol','Display symbol, not a unique identifier.');
  field('baseURI','Collection base URI','Optional. Absolute URI, e.g. ipfs://… or https://… . Every minted ID returns this exact same immutable URI. No ID substitution or network fetch.',false);
  field('userSalt','Collection deployment salt (bytes32)','Secure random default; regenerate or enter an exact 32-byte hexadecimal salt.');
  const renew=el('button','ghost-button','Regenerate collection salt');renew.type='button';
  const review=el('button','ghost-button','Prepare ERC721 draft');review.type='submit';
  const reset=el('button','ghost-button','Clear collection draft');reset.type='button';
  controls.append(renew,review,reset);
  const preview=el('section','token-erc721-preview');preview.hidden=true;preview.setAttribute('aria-label','Prepared ERC721 collection draft');
  form.append(context,grid,controls,preview);section.replaceChildren(heading,explanation,form,status);
  function render(v){
    if(!v.ready&&!v.busy)tokenHidingFocus420(form,status);
    form.hidden=!v.ready&&!v.busy;form.setAttribute('aria-busy',String(v.busy));
    explanation.textContent=v.ready?'Configure your collection. Deployment creates an empty collection; minting NFTs is a separate owner action. Draft preparation is read-only.':
      v.busy?'Rechecking the selected collection template and Wallet account…':
      'Select the enabled ERC721 collection template with a verified, deployed SmartAccount owner to configure a draft.';
    context.textContent=v.ready?'ERC721_COLLECTION · V1 · SmartAccount owner '+v.owner+' · chain '+v.chainId+' · creation fee 42 native $420 (gas separate).':'';
    for(const [key,input] of Object.entries(inputs)){if(input.value!==v.fields[key])input.value=v.fields[key];input.disabled=v.busy||!v.ready;tokenFieldError420(input,status,!!v.error&&v.errorField===key);}
    renew.disabled=review.disabled=reset.disabled=!v.ready||v.busy;
    setTokenStatus420(status,v.error?(v.error+(v.errorField?' Correct the highlighted field and prepare the draft again.':' Select or refresh the verified template and prepare again.')):(v.busy?'Rechecking Registry and Wallet…':v.draft?'Collection draft prepared. Draft step: No transaction simulated, signed or submitted.':''),v.error?'error':v.busy?'busy':v.draft?'success':'idle');
    preview.hidden=!v.draft;preview.replaceChildren();
    if(v.draft){
      const d=v.draft,r=d.request;const title=el('h5',null,'Prepared collection draft — not submitted');
      title.tabIndex=-1;const dl=el('dl','token-erc721-review');
      const entries=[['Template',d.profile.key+' · V'+d.profile.version],['Template ID',d.profile.id],
        ['Collection name',r.draft.name],['Symbol',r.draft.symbol],['Base URI',r.draft.baseURI||'(empty)'],
        ['Metadata behavior','Exact shared immutable URI for every minted ID'],['Initial NFT supply','0 — minting is separate'],
        ['Mint authority','Collection owner'],['Burn authority','Holder or approved operator'],['Collection owner',d.owner],
        ['Factory',r.target],['Chain',String(d.chainId)],['Creation fee','42 native $420 (network gas separate; see fee review)'],
        ['Deployment salt',r.draft.userSalt],['Configuration hash',r.configHash],['Calldata hash',r.calldataHash],
        ['Verified block',BigInt(d.verificationBlock.number).toString()+' · '+d.verificationBlock.hash]];
      for(const [label,value] of entries)dl.append(el('dt',null,label),el('dd',null,value));
      preview.append(title,dl);
      for(const warning of d.warnings)preview.append(el('p','token-erc721-warning',warning));
      preview.append(el('p',null,'This is a local draft only. The Wallet must independently reverify, simulate and request explicit confirmation before any creation transaction.'));
    }
  }
  const unsubscribe=model.subscribe(render);
  const disposeFeeReview=mountTokenFeeReview420(section,model,session);
  form.addEventListener('submit',e=>{e.preventDefault();void runTokenAction420(document.activeElement,status,()=>model.review(),()=>{const v=model.getSnapshot();return v.errorField?inputs[v.errorField]:v.draft?preview.querySelector('h5'):null;});});
  renew.addEventListener('click',()=>model.renewSalt());reset.addEventListener('click',()=>model.reset());
  return ()=>{unsubscribe();disposeFeeReview();model.dispose();};
}
