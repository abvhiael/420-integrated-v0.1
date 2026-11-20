import {tokenManagementActions420} from './core/token-management.js';
import {formatERC20Units420} from './core/token-erc20-wizard.js';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
export function mountTokenManagement420(parent,session){
  const panel=el('section','token-management');panel.hidden=true;panel.setAttribute('aria-label','Template-specific token management');
  const title=el('h5',null,'Manage created token'),intro=el('p',null,'Owner actions require current contract ownership. Holder and operator actions require current balances and approvals. No 42 native $420 creation fee is charged for management; network gas applies.');
  const info=el('p','token-fee-review-status'),label=el('label',null,'Management action'),select=el('select');label.append(select);
  const security=el('section','token-permission-controls');security.setAttribute('aria-label','Ownership and permission security');
  const secTitle=el('h6',null,'Ownership and permissions'),secNote=el('p',null,'Check a specific spender or operator and, for NFTs or multi-tokens, a token ID. These mappings are not enumerable; this is not a complete permissions inventory. Local cancellation does not revoke on-chain permissions.');
  const spenderLabel=el('label',null,'Permission lookup address (optional)'),spender=el('input');spender.type='text';spender.autocomplete='off';spender.spellcheck=false;spenderLabel.append(spender);
  const idLabel=el('label',null,'Permission lookup token ID (optional)'),id=el('input');id.type='text';id.autocomplete='off';idLabel.append(id);
  const inspect=el('button','ghost-button','Check current permissions');inspect.type='button';const secStatus=el('p','token-fee-review-status');secStatus.setAttribute('role','status');secStatus.setAttribute('aria-live','polite');const secDetails=el('dl','token-fee-review-details'),revokes=el('div','token-catalogue-controls');
  security.append(secTitle,secNote,spenderLabel,idLabel,inspect,secStatus,secDetails,revokes);
  const form=el('div','token-management-fields'),actions=el('div','token-catalogue-controls'),review=el('button','ghost-button','Simulate management action'),authorize=el('button','ghost-button','Authorize management action'),submit=el('button','ghost-button','Submit management action'),cancel=el('button','ghost-button','Cancel management action');
  for(const b of [review,authorize,submit,cancel])b.type='button';
  actions.append(review,authorize,submit,cancel);const details=el('dl','token-fee-review-details'),status=el('p','token-fee-review-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const risk=el('div','token-management-risk');risk.hidden=true;const riskText=el('div'),ackLabel=el('label'),ack=el('input');ack.type='text';ack.autocomplete='off';ack.spellcheck=false;const ackPrompt=el('span');ackLabel.append(ackPrompt,ack);risk.append(riskText,ackLabel);
  panel.append(title,intro,info,security,label,form,details,risk,actions,status);parent.append(panel);
  let row=null,options=[],inputs=new Map(),quote=null,approval=null,busy=false,revision=0,securityRevision=0,securityView=null,securityBusy=false;
  function clear(){++revision;session.revokeManagement(approval);session.revokeManagement(quote);session.cancelManagement();quote=null;approval=null;busy=false;details.replaceChildren();risk.hidden=true;riskText.replaceChildren();ack.value='';status.textContent='';buttons();}
  function buttons(){review.disabled=!row||busy||!select.value;authorize.disabled=busy||!quote||!!approval||(quote.security.acknowledgement!==null&&ack.value!==quote.security.acknowledgement);submit.disabled=busy||!approval;cancel.disabled=!row;ack.disabled=busy||!!approval;inspect.disabled=!row||securityBusy||busy;spender.disabled=securityBusy||busy;id.disabled=securityBusy||busy;for(const x of revokes.querySelectorAll('button'))x.disabled=busy||securityBusy;select.disabled=busy;for(const x of inputs.values())x.disabled=busy;}
  function showFields(){clear();form.replaceChildren();inputs=new Map();const action=options.find(x=>x.key===select.value);if(!action){buttons();return;}
    if(action.key==='renounceOwnership'||action.key==='transferOwnership')form.append(el('p',null,'Warning: changing contract ownership can permanently remove your ability to manage owner-only actions.'));
    if(action.key==='mint'&&row.standard!=='ERC20')form.append(el('p',null,'Check the recipient and token ID. ERC721 mint does not check a receiver callback; ERC1155 mint requires compatible contract recipients.'));
    if(action.key==='approve'||action.key==='setApprovalForAll')form.append(el('p',null,'Warning: approvals grant spending or collection permissions. Set zero or false to revoke when applicable.'));
    for(const f of action.fields){const l=el('label',null,f.label),x=el('input');x.type='text';x.autocomplete='off';x.spellcheck=false;x.addEventListener('input',clear);l.append(x);form.append(l);inputs.set(f.name,x);}
    buttons();
  }
  function clearSecurity(){++securityRevision;securityView=null;securityBusy=false;secStatus.textContent='';secDetails.replaceChildren();revokes.replaceChildren();buttons();}
  function selectRow(t){clearSecurity();spender.value='';id.value='';idLabel.hidden=t.standard==='ERC20';row=t;panel.hidden=false;options=tokenManagementActions420(t,session.getSnapshot().smartAccount);info.textContent=t.token+' · '+t.templateKey+' · current owner at portfolio snapshot: '+t.owner+(t.templateKey==='ERC20_PERMIT'||t.templateKey==='ERC20_VOTES'?' · EIP-2612 uses ECDSA holder signatures, not SmartAccount signatures. Use on-chain approval for this SmartAccount.':'');select.replaceChildren();const placeholder=el('option',null,'Choose an action');placeholder.value='';select.append(placeholder);
    for(const opt of options){const node=el('option',null,opt.label);node.value=opt.key;select.append(node);}showFields();select.focus();}
  function reset(){clear();clearSecurity();row=null;panel.hidden=true;buttons();}
  select.addEventListener('change',showFields);ack.addEventListener('input',buttons);
  for(const x of [spender,id])x.addEventListener('input',clearSecurity);
  inspect.addEventListener('click',async()=>{
    clear();clearSecurity();const attempt=++securityRevision;securityBusy=true;buttons();secStatus.textContent='Checking canonical ownership and permissions…';
    try{const v=await session.inspectManagementPermissions(row,{spender:spender.value,id:row.standard==='ERC20'?'':id.value});if(attempt!==securityRevision)return;securityView=v;
      const entries=[['Current contract owner',v.owner],['Ownership status',v.ownership],['Selected holder',v.account],['Verified permission block',v.block.number+' · '+v.block.hash]];
      if(v.spender)entries.push(['Queried spender / operator',v.spender]);if(v.id!==null)entries.push(['Queried token ID',v.id]);
      if(v.balance!==null)entries.push(['Selected holder balance',v.standard==='ERC20'?formatERC20Units420(v.balance):v.balance]);
      if(v.allowance!==null)entries.push(['Current ERC20 allowance',BigInt(v.allowance)===2n**256n-1n?'Unlimited (uint256 max)':formatERC20Units420(v.allowance)]);
      if(v.operator!==null)entries.push(['Collection-wide operator',v.operator?'Granted — all current and future items':'Not granted']);
      if(v.nftOwner!==null)entries.push(['NFT holder',v.nftOwner],['NFT-specific approved address',v.nftApproved],['Selected SmartAccount is operator for NFT holder',v.nftOperatorForHolder?'Yes':'No']);
      if(v.delegation!==null)entries.push(['Current voting delegate',v.delegation]);if(v.permitNonce!==null)entries.push(['Current permit nonce',v.permitNonce+' — revoking allowance does not invalidate signed permits']);
      for(const [k,x] of entries)secDetails.append(el('dt',null,k),el('dd',null,x));
      for(const r of v.revocations){const b=el('button','ghost-button',r.label);b.type='button';b.addEventListener('click',()=>{if(securityView!==v)return;select.value=r.action;showFields();for(const [k,x] of Object.entries(r.params))if(inputs.has(k))inputs.get(k).value=x;status.textContent='Revocation prepared only. Simulate, authorize and submit to change on-chain state.';review.focus();});revokes.append(b);}
      secStatus.textContent='Permissions verified at snapshot only. No changes submitted.';
    }catch(e){if(attempt===securityRevision)secStatus.textContent='Permissions unavailable: '+String(e?.message||'Verification failed').slice(0,240);}
    finally{if(attempt===securityRevision){securityBusy=false;buttons();}}
  });
  review.addEventListener('click',async()=>{clear();const attempt=revision;busy=true;buttons();status.textContent='Verifying provenance, authority and simulation…';
    try{const q=await session.reviewManagement(row,select.value,Object.fromEntries([...inputs].map(([k,x])=>[k,x.value])));if(attempt!==revision)return;quote=q;
      const entries=[['Action',q.label],['Token contract',q.target],['SmartAccount',q.smartAccount],['Gas-paying controller',q.controller],['Chain',String(q.chainId)],...Object.entries(q.params).map(([k,v])=>[k==='amount'&&row.standard==='ERC20'?'Amount (exact base units)':k,Array.isArray(v)?v.join(', '):v]),['Exact execution hash',q.executionHash],['Creation fee','0 native $420'],['Gas units',q.gasUnits],['Gas price (wei)',q.gasPriceWei],['Maximum estimated gas',formatERC20Units420(q.estimatedGasWei)+' native $420'],['Simulation block',q.block.number+' · '+q.block.hash]];
      for(const [k,v] of entries)details.append(el('dt',null,k),el('dd',null,v));
      const securityEntries=[['Verified current contract owner',q.state.owner]];
      for(const [k,v] of Object.entries(q.state)){if(k==='allowance')securityEntries.push(['Current allowance (base units)',BigInt(v).toString()]);else if(k==='holder')securityEntries.push(['Verified NFT holder','0x'+v.slice(-40)]);else if(k==='approved')securityEntries.push(['Current NFT approved address','0x'+v.slice(-40)]);else if(k==='operator')securityEntries.push(['Current operator permission',BigInt(v)===1n?'Granted':'Not granted']);else if(k==='destinationCode')securityEntries.push(['Destination code at review',v]);}
      for(const [k,v] of securityEntries)details.append(el('dt',null,k),el('dd',null,v));
      risk.hidden=q.security.warnings.length===0&&q.security.acknowledgement===null;for(const warning of q.security.warnings)riskText.append(el('p',null,warning));ackLabel.hidden=q.security.acknowledgement===null;ackPrompt.textContent=q.security.acknowledgement?'Type '+q.security.acknowledgement+' to acknowledge this exact review.':'';status.textContent='Review exact parameters and gas. Simulation passed; not submitted.';
    }catch(e){if(attempt===revision)status.textContent='Review rejected: '+String(e?.message||'Unavailable').slice(0,240);}
    finally{if(attempt===revision){busy=false;buttons();}}});
  authorize.addEventListener('click',async()=>{const attempt=revision;busy=true;buttons();try{const a=await session.authorizeManagement(quote,()=>attempt===revision,ack.value);if(attempt!==revision){session.revokeManagement(a);return;}approval=a;status.textContent='Explicit management authorization recorded. Not submitted.';}
    catch(e){if(attempt===revision){quote=null;details.replaceChildren();status.textContent='Authorization rejected: '+String(e?.message||'Unavailable').slice(0,240);}}finally{if(attempt===revision){busy=false;buttons();}}});
  submit.addEventListener('click',async()=>{const attempt=revision;busy=true;buttons();try{const h=await session.submitManagement(approval,()=>attempt===revision);if(h)void session.checkTransaction(h);if(attempt===revision)status.textContent=h?'Submitted: '+h:'No confirmed submission. Check transaction tracking.';}
    catch(e){if(attempt===revision)status.textContent='Submission rejected: '+String(e?.message||'Unavailable').slice(0,240);}finally{if(attempt===revision){session.revokeManagement(approval);approval=null;quote=null;busy=false;buttons();}}});
  cancel.addEventListener('click',reset);
  const stop=session.subscribe(()=>reset()),stopPortfolio=session.subscribePortfolio(v=>{if(row&&!v.items.includes(row))reset();});
  return Object.freeze({select:selectRow,dispose(){stop();stopPortfolio();reset();}});
}
