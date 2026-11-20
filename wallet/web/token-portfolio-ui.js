import {mountTokenManagement420} from './token-management-ui.js';
import {formatERC20Units420} from './core/token-erc20-wizard.js';
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
export function mountTokenPortfolio420(body,session){
  const panel=el('section','token-created-portfolio');panel.setAttribute('aria-label','Created-token portfolio');
  const heading=el('h5',null,'Created-token portfolio');
  const intro=el('p',null,'Tokens originally created by the selected SmartAccount, even if ownership was transferred. This is factory provenance, not a list of all holdings, an endorsement, a listing or finality.');
  const actions=el('div','token-catalogue-controls'),refresh=el('button','ghost-button','Refresh created tokens'),more=el('button','ghost-button','Scan next deployment page');
  refresh.type=more.type='button';actions.append(refresh,more);
  const status=el('p','token-fee-review-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=el('div','token-created-portfolio-list');panel.append(heading,intro,actions,status,list);body.append(panel);
  const management=mountTokenManagement420(panel,session);
  let context=session.getSnapshot(),view=session.getPortfolio();
  function render(){
    refresh.disabled=context.status!=='verified'||view.status==='checking';
    more.hidden=view.status!=='verified'||view.page.complete;more.disabled=more.hidden||view.status==='checking';
    const p=view.page;
    status.textContent=view.error||(view.status==='checking'?'Verifying canonical factory records…':view.status==='verified'?
      p.found+' of '+p.createdCount+' created tokens · '+(p.complete?'Complete at snapshot':'Partial scan — more records available')+' · chain '+p.chainId+' · block '+BigInt(p.block.number).toString()+' · '+p.block.hash:
      context.status==='verified'?'Refresh to discover created tokens from chain state.':'Connect the Wallet to verify created-token provenance.');
    list.replaceChildren();
    if(view.status!=='verified')return;
    if(!view.items.length)list.append(el('p',null,p.complete?'No tokens created by this SmartAccount at the verified block.':'No matching records on scanned pages yet.'));
    for(const t of view.items){
      const item=el('article','token-template-card'),title=el('h6',null,t.name===null||t.name===''?t.templateKey:t.name+(t.symbol?' ('+t.symbol+')':''));
      const details=el('dl','token-fee-review-details');
      const fields=[['Token contract',t.token],['Original creator',t.creator],['Current contract owner',t.owner],['Ownership status',t.ownership==='creator'?'Creator retains ownership':t.ownership==='renounced'?'Ownership renounced':'Ownership transferred'],
        ['Template',t.templateKey+' · '+t.standard+' · V'+t.version],['Template ID',t.templateId],['Configuration hash',t.configHash],['Factory',p.factory],['Factory record index',t.index],['Deployed at (Unix seconds)',t.deployedAt],['Runtime code hash',t.codeHash],
        ['Display fields',t.metadataStatus==='verified'?'Read at verified block':'Some display fields unavailable or unsafe']];
      if(t.standard==='ERC1155')fields.push(['Metadata URI (not fetched)',t.uri??'Unavailable'],['Holdings','Per-token-ID balances; no aggregate balance or supply claimed']);
      else {const format=v=>v===null?'Unavailable':t.standard==='ERC20'?(t.decimals===18?formatERC20Units420(v):v+' base units'):v;
        fields.push(['Creator balance at snapshot',format(t.balance)],['Total supply at snapshot',format(t.totalSupply)]);}
      if(t.receipt.status==='verified')fields.push(['Creation transaction',t.receipt.txHash],['Deployment block',BigInt(t.receipt.blockNumber).toString()+' · '+t.receipt.blockHash],['Creation fee evidence','42 native $420 · canonical community Treasury Vault'],['Community Treasury Vault',t.receipt.communityTreasuryVault]);
      else fields.push(['Creation receipt','Not independently verified — canonical factory record only']);
      fields.push(['Evidence boundary','Canonical factory record at snapshot; no automatic asset approval or listing']);
      for(const [k,v] of fields)details.append(el('dt',null,k),el('dd',null,v));
      item.append(title,details);
      if(context.controllerIsOwner&&context.deployed){const manage=el('button','ghost-button','Manage '+t.templateKey+' '+t.token);manage.type='button';manage.addEventListener('click',()=>management.select(t));item.append(manage);}
      list.append(item);
    }
  }
  const stop=session.subscribe(s=>{context=s;render();}),stopPortfolio=session.subscribePortfolio(v=>{view=v;render();});
  refresh.addEventListener('click',()=>{void session.refreshPortfolio();});
  more.addEventListener('click',()=>{void session.refreshPortfolio(true);});
  return()=>{stop();stopPortfolio();management.dispose();};
}
