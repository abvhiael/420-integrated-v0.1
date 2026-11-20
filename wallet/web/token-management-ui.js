import {tokenManagementActions420} from './core/token-management.js';
import {formatERC20Units420} from './core/token-erc20-wizard.js';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
export function mountTokenManagement420(parent,session){
  const panel=el('section','token-management');panel.hidden=true;panel.setAttribute('aria-label','Template-specific token management');
  const title=el('h5',null,'Manage created token'),intro=el('p',null,'Owner actions require current contract ownership. Holder and operator actions require current balances and approvals. No 42 native $420 creation fee is charged for management; network gas applies.');
  const info=el('p','token-fee-review-status'),label=el('label',null,'Management action'),select=el('select');label.append(select);
  const form=el('div','token-management-fields'),actions=el('div','token-catalogue-controls'),review=el('button','ghost-button','Simulate management action'),authorize=el('button','ghost-button','Authorize management action'),submit=el('button','ghost-button','Submit management action'),cancel=el('button','ghost-button','Cancel management action');
  for(const b of [review,authorize,submit,cancel])b.type='button';
  actions.append(review,authorize,submit,cancel);const details=el('dl','token-fee-review-details'),status=el('p','token-fee-review-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  panel.append(title,intro,info,label,form,details,actions,status);parent.append(panel);
  let row=null,options=[],inputs=new Map(),quote=null,approval=null,busy=false,revision=0;
  function clear(){++revision;session.revokeManagement(approval);quote=null;approval=null;busy=false;details.replaceChildren();status.textContent='';buttons();}
  function buttons(){review.disabled=!row||busy||!select.value;authorize.disabled=busy||!quote||!!approval;submit.disabled=busy||!approval;cancel.disabled=!row;select.disabled=busy;for(const x of inputs.values())x.disabled=busy;}
  function showFields(){clear();form.replaceChildren();inputs=new Map();const action=options.find(x=>x.key===select.value);if(!action)return;
    if(action.key==='renounceOwnership'||action.key==='transferOwnership')form.append(el('p',null,'Warning: changing contract ownership can permanently remove your ability to manage owner-only actions.'));
    if(action.key==='mint'&&row.standard!=='ERC20')form.append(el('p',null,'Check the recipient and token ID. ERC721 mint does not check a receiver callback; ERC1155 mint requires compatible contract recipients.'));
    if(action.key==='approve'||action.key==='setApprovalForAll')form.append(el('p',null,'Warning: approvals grant spending or collection permissions. Set zero or false to revoke when applicable.'));
    for(const f of action.fields){const l=el('label',null,f.label),x=el('input');x.type='text';x.autocomplete='off';x.spellcheck=false;x.addEventListener('input',clear);l.append(x);form.append(l);inputs.set(f.name,x);}
    buttons();
  }
  function selectRow(t){row=t;panel.hidden=false;options=tokenManagementActions420(t,session.getSnapshot().smartAccount);info.textContent=t.token+' · '+t.templateKey+' · current owner at portfolio snapshot: '+t.owner+(t.templateKey==='ERC20_PERMIT'||t.templateKey==='ERC20_VOTES'?' · EIP-2612 uses ECDSA holder signatures, not SmartAccount signatures. Use on-chain approval for this SmartAccount.':'');select.replaceChildren();
    for(const opt of options){const node=el('option',null,opt.label);node.value=opt.key;select.append(node);}showFields();select.focus();}
  function reset(){clear();row=null;panel.hidden=true;buttons();}
  select.addEventListener('change',showFields);
  review.addEventListener('click',async()=>{clear();const attempt=revision;busy=true;buttons();status.textContent='Verifying provenance, authority and simulation…';
    try{const q=await session.reviewManagement(row,select.value,Object.fromEntries([...inputs].map(([k,x])=>[k,x.value])));if(attempt!==revision)return;quote=q;
      const entries=[['Action',q.label],['Token contract',q.target],['SmartAccount',q.smartAccount],['Gas-paying controller',q.controller],['Chain',String(q.chainId)],...Object.entries(q.params).map(([k,v])=>[k,Array.isArray(v)?v.join(', '):v]),['Exact execution hash',q.executionHash],['Creation fee','0 native $420'],['Gas units',q.gasUnits],['Gas price (wei)',q.gasPriceWei],['Maximum estimated gas',formatERC20Units420(q.estimatedGasWei)+' native $420'],['Simulation block',q.block.number+' · '+q.block.hash]];
      for(const [k,v] of entries)details.append(el('dt',null,k),el('dd',null,v));status.textContent='Review exact parameters and gas. Simulation passed; not submitted.';
    }catch(e){if(attempt===revision)status.textContent='Review rejected: '+String(e?.message||'Unavailable').slice(0,240);}
    finally{if(attempt===revision){busy=false;buttons();}}});
  authorize.addEventListener('click',async()=>{const attempt=revision;busy=true;buttons();try{const a=await session.authorizeManagement(quote,()=>attempt===revision);if(attempt!==revision){session.revokeManagement(a);return;}approval=a;status.textContent='Explicit management authorization recorded. Not submitted.';}
    catch(e){if(attempt===revision){quote=null;details.replaceChildren();status.textContent='Authorization rejected: '+String(e?.message||'Unavailable').slice(0,240);}}finally{if(attempt===revision){busy=false;buttons();}}});
  submit.addEventListener('click',async()=>{const attempt=revision;busy=true;buttons();try{const h=await session.submitManagement(approval,()=>attempt===revision);if(h)void session.checkTransaction(h);if(attempt===revision)status.textContent=h?'Submitted: '+h:'No confirmed submission. Check transaction tracking.';}
    catch(e){if(attempt===revision)status.textContent='Submission rejected: '+String(e?.message||'Unavailable').slice(0,240);}finally{if(attempt===revision){session.revokeManagement(approval);approval=null;quote=null;busy=false;buttons();}}});
  cancel.addEventListener('click',reset);
  const stop=session.subscribe(()=>reset()),stopPortfolio=session.subscribePortfolio(v=>{if(row&&!v.items.includes(row))reset();});
  return Object.freeze({select:selectRow,dispose(){stop();stopPortfolio();reset();}});
}
