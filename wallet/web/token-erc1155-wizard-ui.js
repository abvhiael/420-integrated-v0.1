import {createERC1155Wizard420} from './core/token-erc1155-wizard.js';
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
export function mountERC1155Wizard420(section,catalogue,session){
  const model=createERC1155Wizard420(catalogue,session);
  const heading=el('h4',null,'Create ERC1155 multi-token');
  heading.id='erc1155-wizard-title';section.setAttribute('aria-labelledby',heading.id);
  const explanation=el('p',null,'Select the enabled ERC1155 multi-token template with a verified, deployed SmartAccount owner to configure a draft.');
  const form=el('form','token-erc1155-form');form.noValidate=true;form.hidden=true;
  const context=el('p','token-erc1155-context');
  const grid=el('div','token-erc1155-fields');
  const controls=el('div','token-catalogue-controls');
  const status=el('p','token-erc1155-status');status.id='erc1155-wizard-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const inputs={};
  function field(key,label,hint,required=true){
    const wrap=el('div','token-erc1155-field'),id='erc1155-'+key;
    const lab=el('label',null,label);lab.htmlFor=id;
    const input=el('input');input.id=id;input.name=key;input.type='text';input.autocomplete='off';input.spellcheck=false;input.required=required;
    const help=el('p','token-erc1155-hint',hint);help.id=id+'-hint';input.setAttribute('aria-describedby',help.id+' '+status.id);
    input.addEventListener('input',()=>model.setField(key,input.value));
    wrap.append(lab,input,help);grid.append(wrap);inputs[key]=input;
  }
  field('uri','Multi-token metadata URI','Optional absolute URI. Use literal {id} for client-side lowercase 64-digit hexadecimal token ID substitution, e.g. ipfs://…/{id}.json. The stored URI is immutable; no metadata fetch.',false);
  field('userSalt','Multi-token deployment salt (bytes32)','Secure random default; regenerate or enter an exact 32-byte hexadecimal salt.');
  const renew=el('button','ghost-button','Regenerate multi-token salt');renew.type='button';
  const review=el('button','ghost-button','Prepare ERC1155 draft');review.type='submit';
  const reset=el('button','ghost-button','Clear multi-token draft');reset.type='button';
  controls.append(renew,review,reset);
  const preview=el('section','token-erc1155-preview');preview.hidden=true;preview.setAttribute('aria-label','Prepared ERC1155 multi-token draft');
  form.append(context,grid,controls,preview);section.replaceChildren(heading,explanation,form,status);
  function render(v){
    form.hidden=!v.ready&&!v.busy;
    explanation.textContent=v.ready?'Configure your multi-token contract. Deployment creates no token IDs or balances; minting is a separate owner action. Draft preparation is read-only.':
      v.busy?'Rechecking the selected multi-token template and Wallet account…':
      'Select the enabled ERC1155 multi-token template with a verified, deployed SmartAccount owner to configure a draft.';
    context.textContent=v.ready?'ERC1155_MULTI · V1 · SmartAccount owner '+v.owner+' · chain '+v.chainId+' · creation fee 42 native $420 (gas separate).':'';
    for(const [key,input] of Object.entries(inputs)){if(input.value!==v.fields[key])input.value=v.fields[key];input.disabled=v.busy||!v.ready;}
    renew.disabled=review.disabled=reset.disabled=!v.ready||v.busy;
    status.textContent=v.error||(v.busy?'Rechecking Registry and Wallet…':v.draft?'Multi-token draft prepared. No transaction simulated, signed or submitted.':'');
    preview.hidden=!v.draft;preview.replaceChildren();
    if(v.draft){
      const d=v.draft,r=d.request;const title=el('h5',null,'Prepared multi-token draft — not submitted');
      const dl=el('dl','token-erc1155-review');
      const entries=[['Template',d.profile.key+' · V'+d.profile.version],['Template ID',d.profile.id],
        ['Stored URI',r.draft.uri||'(empty)'],['Metadata behavior','Immutable URI; client-side {id} substitution'],
        ['Example resolved URI (ID 1)',d.collection.exampleURI||'(empty)'],['Initial balances','0 — minting is separate'],
        ['Token IDs','uint256; quantities per ID'],['Mint authority','Multi-token owner'],['Burn authority','Holder or approved operator'],
        ['Transfers','Safe single and batch transfers'],['Multi-token owner',d.owner],
        ['Factory',r.target],['Chain',String(d.chainId)],['Creation fee','42 native $420 (network gas separate; not estimated)'],
        ['Deployment salt',r.draft.userSalt],['Configuration hash',r.configHash],['Calldata hash',r.calldataHash],
        ['Verified block',BigInt(d.verificationBlock.number).toString()+' · '+d.verificationBlock.hash]];
      for(const [label,value] of entries)dl.append(el('dt',null,label),el('dd',null,value));
      preview.append(title,dl);
      for(const warning of d.warnings)preview.append(el('p','token-erc1155-warning',warning));
      preview.append(el('p',null,'This is a local draft only. The Wallet must independently reverify, simulate and request explicit confirmation before any creation transaction.'));
    }
  }
  const unsubscribe=model.subscribe(render);
  form.addEventListener('submit',e=>{e.preventDefault();void model.review();});
  renew.addEventListener('click',()=>model.renewSalt());reset.addEventListener('click',()=>model.reset());
  return ()=>{unsubscribe();model.dispose();};
}
