import qrcode from './vendor/qrcode.mjs';
import {shortExtensionAddress420,extensionBalanceText420,extensionCanSend420,extensionReceiveAddress420,extensionNetworkLabel420,buildExtensionSend420,formatExtensionUnitsExact420} from './core/extension-wallet-ui.js';

const APPROVALS_KEY='420-wallet-pending-approvals-v1';
const approvalId=new URLSearchParams(location.search).get('approval');
const $=id=>document.getElementById(id);
const state={wallet:null,screen:'dashboard',prepared:null,submitting:false,epoch:0,detailAddress:null,showHidden:false,security:null,securityReview:null,securityEpoch:0,nftSelected:null,nftPrepared:null,nftShowHidden:false};
const node=(tag,cls,text)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;return el;
};
function tell(message,variant=''){
  $('global-status').textContent=message;
  const notice=$('dashboard-notice');
  if(notice&&state.screen==='dashboard'){notice.textContent=message;notice.className='notice '+variant;}
}
function screen(name){
  state.screen=name;
  for(const view of document.querySelectorAll('.view'))view.hidden=view.id!==name;
  $('bottom-nav').hidden=Boolean(approvalId);
  for(const button of document.querySelectorAll('#bottom-nav [data-screen]')){
    const active=button.dataset.screen===name;
    button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  const title=$(name)?.querySelector('h1');
  if(title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}
  $('primary-content').scrollTop=0;
}
function summarizeNetwork(){
  const w=state.wallet;if(!w)return;
  const text=extensionNetworkLabel420(w);
  $('network-label').textContent=text;
  $('network-pill').className='network-pill '+(w.network.status==='matched'?'':w.network.status==='wrong-chain'||w.network.status==='error'?'error':'warning');
}
function renderAccount(){
  const w=state.wallet;if(!w)return;
  const select=$('account-select');select.replaceChildren();
  if(!w.config.accounts.length){
    select.add(new Option('No accounts provisioned',''));select.disabled=true;
  }else{
    for(const address of w.config.accounts){
      const meta=w.config.accountMeta?.[address]||{};
      select.add(new Option((meta.label||shortExtensionAddress420(address))+' · '+(meta.type==='watch-only'?'Watch only':meta.type==='eoa'?'EOA':meta.type==='hardware'?'Hardware':'SmartAccount'),address));
    }
    select.value=w.selectedAccount||w.config.accounts[0];select.disabled=false;
  }
  const vault=w.vault||{exists:false,unlocked:false};
  $('vault-title').textContent=!vault.exists?'Create or import wallet':vault.unlocked?'Local wallet unlocked':'Encrypted wallet locked';
  $('vault-description').textContent=!vault.exists?'Set up self-custodial accounts.':vault.unlocked?'Manage your accounts and encrypted backups.':'Unlock to manage keys and restore accounts.';
  $('open-wallet').textContent=!vault.exists?'Set up':'Manage';
  const address=extensionReceiveAddress420(w);
  $('account-address').textContent=address?shortExtensionAddress420(address):'No verified wallet address';
  $('account-address').title=address||'';
  $('account-address').setAttribute('aria-label',address?'Selected account address '+address:'No verified wallet address');
  $('account-state').textContent=w.account.reason||'SmartAccount verification required';
  $('copy-account').disabled=!address;
  $('quick-receive').disabled=!address;
  $('quick-send').disabled=!extensionCanSend420(w);
  $('native-balance').textContent=w.assets.native?extensionBalanceText420(w.assets.native.raw,w.assets.native.decimals):'—';
  $('native-symbol').textContent=w.config.nativeCurrency?.symbol||'420';
  $('balance-note').textContent=w.network.status==='matched'&&address?'Chain-derived balance. No fiat value is inferred.':'Connect to the approved chain and verify your SmartAccount to display balances.';
  const status=['eoa','watch-only','hardware'].includes(w.account.kind) ?
    (w.network.status==='matched'?w.account.reason:'Set up your verified EVM network to display address balances.') :
    w.network.status==='matched'?
      w.account.deployed?(w.account.ownerVerified?'Deployed account owner confirmed; verify deployment provenance independently.':'Owner verification failed; sends blocked.'):'SmartAccount not deployed; sending disabled.':
      w.network.message||'Network unconfigured. Open Settings to set your approved RPC and chain.';
  tell(status,w.network.status==='matched'?'':w.network.status==='wrong-chain'?'error':'warn');
}
function portfolioRows420(){
  const p=state.wallet?.portfolio;
  if(!p)return [];
  return [...(p.native?[p.native]:[]),...(p.tokens||[])];
}
function openAsset420(asset){
  state.detailAddress=asset.address;
  const detail=$('asset-detail');detail.replaceChildren();
  const p=state.wallet?.portfolio;
  const data=[
    ['Asset',asset.symbol||'Unknown'],
    ['Chain',p?.chainId||'No chain'],
    ['Contract',asset.address==='native'?'Native currency':asset.address],
    ['Source',asset.address==='native'?'Chain native asset':asset.source||'imported'],
    ['Metadata',asset.verified||asset.address==='native'?'Verified on-chain':'Unverified'],
    ['Balance',asset.balance?.status==='unavailable'?'Unavailable':
      extensionBalanceText420(asset.balance?.spendable||'0',asset.decimals)+' '+asset.symbol],
    ['Status',asset.balance?.status||'unavailable'],
    ['Pending transactions',String(asset.pendingTransactions||0)],
    ['Block',asset.balance?.blockNumber||p?.blockNumber||'Unavailable'],
    ['Checked',asset.balance?.checkedAt?new Date(asset.balance.checkedAt).toLocaleString():'Unavailable'],
    ['Fiat',asset.price?.status==='verified'&&asset.price.value!==null?
      asset.price.value+' '+asset.price.currency+' (quote '+new Date(asset.price.timestamp).toLocaleString()+')':
      asset.price?.status==='stale'?'Stale quote — valuation suppressed':'Unavailable — no verified quote'],
    ['Risk',asset.spam?'Suspected spam; hidden by default':asset.hidden?'Hidden':'No automatic spam warning'],
  ];
  for(const [label,value] of data){
    const row=node('div','config-row');row.append(node('span','',label),node('strong','',value));detail.append(row);
  }
  const editable=asset.address!=='native';
  $('asset-hide').hidden=!editable;$('asset-spam').hidden=!editable;
  $('asset-hide').textContent=asset.hidden?'Show token':'Hide token';
  $('asset-spam').textContent=asset.spam?'Unmark spam':'Mark as spam';
  screen('asset-view');
}
function renderAssets(){
  const p=state.wallet?.portfolio;
  const list=$('asset-list');list.replaceChildren();
  const badge=$('portfolio-status');
  if(!p||p.status!=='verified'){
    badge.textContent=p?.status==='outage'?'Portfolio provider unavailable; cached balances are NOT spendable':
      'Portfolio unavailable until network and account are verified';
  }else{
    badge.textContent='Block '+p.blockNumber+' · '+new Date(p.checkedAt).toLocaleString()+
      ' · Account '+shortExtensionAddress420(p.account);
  }
  const assets=portfolioRows420().filter(t=>!t.hidden||state.showHidden);
  if(!assets.length){list.append(node('p','empty','No verified assets on this chain. Import a token or scan recent blocks.'));$('portfolio-fiat').textContent='Fiat valuation unavailable without a fresh verified provider quote.';return;}
  let cents=0n,fiatCount=0,missing=0;
  for(const asset of assets){
    if(asset.price?.status==='verified'&&asset.price.value!==null){
      const [whole,fraction='']=asset.price.value.split('.');
      cents+=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0').slice(0,2));fiatCount++;
    }else missing++;
    const row=node('button','asset-row portfolio-token-row');
    row.type='button';row.setAttribute('aria-label','View '+asset.symbol+' asset details');
    row.append(node('span','token-icon',asset.address==='native'?'◆':String(asset.symbol||'T').slice(0,2).toUpperCase()));
    const info=node('span','asset-info');
    info.append(node('strong','',asset.symbol||'Unknown'),
      node('small','',asset.address==='native'?'Native currency':shortExtensionAddress420(asset.address)),
      node('small','',asset.hidden?'Hidden · '+(asset.spam?'Suspected spam':'User-hidden'):
        asset.verified||asset.address==='native'?'Contract-verified metadata':'Metadata unverified'));
    const val=node('span','asset-value');
    const status=asset.balance?.status||'unavailable';
    val.append(node('strong','',status==='unavailable'?'Unavailable':
      extensionBalanceText420(asset.balance.spendable,asset.decimals)),
      node('small','',status==='pending'||asset.pendingTransactions>0?
        'Pending activity; on-chain balance not reserved':status==='spendable'?
        (extensionCanSend420(state.wallet)?'On-chain balance':'On-chain balance; sending not authorized'):'Not available'));
    if(asset.price?.status==='verified'&&asset.price.value!==null)
      val.append(node('small','',asset.price.value+' '+asset.price.currency));
    else val.append(node('small','',asset.price?.status==='stale'?'Fiat quote stale':'Fiat unavailable'));
    row.append(info,val);row.addEventListener('click',()=>openAsset420(asset));list.append(row);
  }
  const quoted=(cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0');
  $('portfolio-fiat').textContent=missing?
    'Fiat total unavailable: '+missing+' asset(s) lack fresh verified prices'+
      (fiatCount?' · Partial quoted value '+quoted+' '+(p?.currency||'CAD'):''):
    'Quoted portfolio value '+quoted+' '+(p?.currency||'CAD')+' (not a guaranteed redemption value)';
}
function nftRow420(title,detail){
 const el=node('div','nft-row');
 el.append(node('strong','',title),node('small','',detail));
 return el;
}
function selectedNft420(){
 const nft=state.wallet?.portfolio?.nfts?.find(x=>x.key===state.nftSelected);
 if(!nft||nft.ownership!=='verified'||nft.stale)
  throw new Error('NFT is not currently verified; refresh the portfolio');
 return nft;
}
function renderNFT420(){
 const list=$('nft-list');list.replaceChildren();
 const p=state.wallet?.portfolio;
 const entries=(p?.nfts||[]).filter(x=>x.ownership==='verified'&&!x.stale);
 const visible=entries.filter(x=>state.nftShowHidden||(!x.hidden&&!x.spam));
 const groups=new Map();
 for(const nft of visible){
  const id=nft.standard+':'+nft.address;
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(nft);
 }
 $('nft-index-status').textContent=p?.status==='outage'?
  'Network unavailable: stored NFTs are not verified as owned':
  'Only indexed events and verified on-chain ownership appear; run Discover assets to scan the next bounded block window. Metadata is untrusted.';
 $('nfts-show-hidden').textContent=state.nftShowHidden?'Hide spam / hidden collectibles':'Show hidden / spam collectibles';
 $('nfts-show-hidden').setAttribute('aria-pressed',String(state.nftShowHidden));
 if(!visible.length){
  list.append(node('p','empty',entries.length&&!state.nftShowHidden?
   'All verified NFTs are hidden/spam. Use Show hidden / spam collectibles to review.':
   p?.status==='outage'?'NFT ownership cannot be verified while the chain is offline':
   'No currently verified NFTs found in the indexed block windows.'));
  return;
 }
 for(const [collection,nfts] of groups){
  const heading=node('h2','nft-collection-title',nfts[0].standard+' · '+nfts[0].address);
  list.append(heading);
  for(const nft of nfts){
   const button=node('button','asset-row nft-item');
   button.type='button';
   const info=node('div','asset-info');
   const name=nft.metadata?.name||nft.standard+' #'+nft.tokenId;
   info.append(node('strong','',name),
     node('small','','#'+nft.tokenId+' · verified on chain · quantity '+nft.quantity),
     node('small','',(nft.spam?'Potential spam · ':'')+
       (nft.hidden?'Hidden · ':'')+'420Integrated/game labels are not ownership proof'));
   button.append(node('span','token-icon alt','◇'),info);
   button.addEventListener('click',()=>{
    state.nftSelected=nft.key;state.nftPrepared=null;
    renderNFTDetail420();screen('nft-detail-view');
   });
   list.append(button);
  }
 }
}
function clearNftReview420(){
 state.nftPrepared=null;$('nft-review').hidden=true;
 $('nft-review-ack').checked=false;$('nft-review-confirm').disabled=true;
}
function renderNFTDetail420(){
 const nft=selectedNft420();
 $('nft-detail-title').textContent=nft.metadata?.name||nft.standard+' #'+nft.tokenId;
 $('nft-detail-status').textContent='Owner: '+nft.owner+' · on-chain '+nft.ownership+
  ' · balance '+nft.quantity+' · selected chain '+state.wallet?.network?.expectedChainId;
 const facts=$('nft-detail-facts');facts.replaceChildren();
 facts.append(nftRow420('Contract',nft.address),nftRow420('Standard and token ID',nft.standard+' #'+nft.tokenId),
  nftRow420('Collection (contract-address grouping)',nft.address),
  nftRow420('Ownership proof',nft.standard==='ERC721'?'ownerOf(tokenId)':'balanceOf(owner,tokenId)'));
 const details=$('nft-detail-metadata');details.replaceChildren();
 if(nft.metadata){
  const meta=nft.metadata;
  details.append(nftRow420('Untrusted metadata name',meta.name||'Unnamed'),
   nftRow420('Description (plain text only)',meta.description||'No description'),
   nftRow420('Untrusted image reference (not loaded)',meta.imageReference||'None'));
  for(const attr of meta.attributes||[])details.append(nftRow420(attr.trait_type||'Attribute',attr.value||''));
  if(meta.flags?.spam)details.append(nftRow420('Warning',meta.flags.reasons.join('; ')));
 }else details.append(nftRow420('Metadata', 'Not loaded. Loading an external metadata URL can reveal the request to its host. Ownership never comes from metadata.'));
 $('nft-hide').textContent=nft.hidden?'Unhide collectible':'Hide collectible';
 $('nft-spam').textContent=nft.spam?'Unmark spam':'Mark as spam';
 $('nft-load-metadata').disabled=nft.ownership!=='verified';
 $('nft-quantity').value='1';
 $('nft-quantity').disabled=nft.standard==='ERC721';
 $('nft-collection-wide').checked=nft.standard==='ERC1155';
 $('nft-collection-wide').disabled=nft.standard==='ERC1155';
 $('nft-action').value='transfer';$('nft-recipient').value='';
 $('nft-approval-status').textContent='On-chain operator approval has not been inspected.';
 clearNftReview420();
}
async function nftWatchVisibility420(field){
 const nft=selectedNft420();
 try{
  const epoch=++state.epoch;
  const next=await command('nft-visibility',{standard:nft.standard,address:nft.address,
   tokenId:nft.tokenId,[field]:!(field==='spam'?nft.spam:nft.hidden)});
  if(await applyWalletState420(next,epoch)){
   if(state.wallet.portfolio.nfts?.some(x=>x.key===nft.key&&x.ownership==='verified'))
    renderNFTDetail420();
   else screen('nfts-view');
   tell('NFT '+field+' preference saved locally; chain ownership unchanged.');
  }
 }catch(error){$('nft-detail-status').textContent='NFT preference failed: '+error.message;}
}
async function nftReview420(event){
 event.preventDefault();
 try{
  const nft=selectedNft420(),action=$('nft-action').value,
   target=$('nft-recipient').value.trim(),collectionWide=$('nft-collection-wide').checked;
  if(nft.hidden||nft.spam)throw new Error('Unhide and unmark spam before on-chain NFT actions');
  if(nft.standard==='ERC1155'&&action!=='transfer'&&!collectionWide)
   throw new Error('ERC-1155 approvals must be collection wide');
  const request={action,standard:nft.standard,address:nft.address,tokenId:nft.tokenId,
   quantity:$('nft-quantity').value,collectionWide,
   ...(action==='transfer'?{recipient:target}:{operator:target})};
  $('nft-detail-status').textContent='Verifying chain ownership, contract and network gas…';
  const review=await command('nft-review',request);
  if(state.nftSelected!==nft.key)throw new Error('NFT selection changed during review');
  state.nftPrepared={...review,request,key:nft.key,epoch:state.wallet.network.epoch,
   chainId:state.wallet.network.expectedChainId,account:state.wallet.selectedAccount};
  const list=$('nft-review-details');list.replaceChildren();
  list.append(nftRow420('Action',review.action+' · '+nft.standard+' #'+nft.tokenId),
   nftRow420('Contract',review.transaction.to),
   nftRow420('Verified owner',nft.owner),
   nftRow420('Recipient/operator',target),
   nftRow420('Amount',action==='transfer'?request.quantity:'operator rights'),
   nftRow420('Chain',state.nftPrepared.chainId),
   nftRow420('Calldata',review.transaction.data),
   nftRow420('Nonce',review.quote.nonce),
   nftRow420('Maximum estimated fee (wei)',review.quote.totalFeeWei??'Requires explicit fee recheck'));
  $('nft-review-warning').textContent=review.warning;
  $('nft-review-ack').checked=false;$('nft-review-confirm').disabled=true;
  $('nft-review').hidden=false;
  $('nft-detail-status').textContent='NFT review is ready. Confirm all fields before signing.';
 }catch(error){clearNftReview420();$('nft-detail-status').textContent='NFT review blocked: '+error.message;}
}
async function replaceUserOperation420(entry,action){
  if(!['speed-up','cancel'].includes(action))throw new Error('Unsupported replacement action');
  const context={activityId:entry.id,action,chainId:entry.chainId,
    epoch:state.wallet?.network?.epoch,account:state.wallet?.selectedAccount};
  const preview=await command('replacement-preflight',context);
  const description=action==='cancel'
    ?'Cancel the pending transfer by signing a zero-value self-transaction for this exact nonce. Cancellation is not guaranteed until confirmed.'
    :entry.executionModel==='eoa'
      ?'Speed up with a locally signed EIP-1559 transaction using the SAME chain, sender, nonce and original call.'
      :'Speed up with a new passkey-signed UserOperation using the SAME sender and FULL nonce.';
  const message=description+'\n\nChain: '+preview.chainId+
    '\nOriginal '+(entry.executionModel==='eoa'?'transaction':'UserOp')+': '+preview.originalHash+
    '\nNew max fee per gas: '+preview.quote.maxFeePerGas+' wei'+
    '\nNew priority fee per gas: '+preview.quote.maxPriorityFeePerGas+' wei'+
    '\nTarget: '+preview.transaction.to+
    '\n\nTarget simulation passed. '+(entry.executionModel==='eoa'?
      'Local EOA password signing is required.':'Final EntryPoint simulation after passkey is mandatory.')+' Continue?';
  if(!window.confirm(message))return;
  const result=await command('replacement-submit',{...context,confirmed:true,preview});
  tell('Replacement submitted '+result.hash+'. Original operation is not marked replaced until canonical evidence.','warn');
  await refresh();
}
function renderActivity(){
  const list=$('activity-list');list.replaceChildren();
  const items=state.wallet?.activity||[];
  if(!items.length){list.append(node('p','empty','No extension transactions yet. This list records only transactions sent from this popup.'));return;}
  for(const entry of items){
    const row=node('div','activity-row');
    row.append(node('div','token-icon alt',entry.status==='confirmed'?'✓':entry.status==='failed'?'!':'↗'));
    const info=node('div','asset-info');
    info.append(node('strong','',entry.amount+' '+entry.symbol),
      node('small','',shortExtensionAddress420(entry.recipient)+' · '+(new Date(entry.at).toLocaleString('en-CA'))));
    const side=node('div','asset-value');
    side.append(node('strong','',entry.status),node('small','',entry.hash?entry.hash.slice(0,10)+'…'+entry.hash.slice(-8):
      entry.userOpHash?'UserOp '+entry.userOpHash.slice(0,10)+'…'+entry.userOpHash.slice(-8):'Extension activity'));
    row.append(info,side);
    const canReplace=(
      (entry.executionModel==='erc4337'&&
        /^0x[0-9a-fA-F]{64}$/.test(entry.userOpHash||'')&&
        entry.nonce&&entry.callData&&entry.maxFeePerGas&&entry.maxPriorityFeePerGas&&entry.entryPoint)
      ||(entry.executionModel==='eoa'&&
        /^0x[0-9a-fA-F]{64}$/.test(entry.hash||'')&&
        entry.nonce&&entry.from&&entry.to&&entry.maxFeePerGas&&entry.maxPriorityFeePerGas)
      )&&['pending','submitted','reorganized'].includes(entry.status);
    if(canReplace){
      const actions=node('div','review-actions');
      for(const [action,label] of [['speed-up','Speed up'],['cancel','Cancel pending']]){
        const button=node('button','secondary',label);button.type='button';
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try{await replaceUserOperation420(entry,action);}
          catch(error){tell('Replacement unavailable: '+error.message,'error');}
          finally{button.disabled=false;}
        });
        actions.append(button);
      }
      row.append(actions);
    }
    list.append(row);
  }
}
function renderSites(){
  const list=$('site-list');list.replaceChildren();
  const sites=state.wallet?.sites||[];
  if(!sites.length){list.append(node('p','empty','No connected sites. A website must request connection and receive your approval before it can see an account.'));return;}
  for(const site of sites){
    const card=node('div','site-row');
    const info=node('div','site-info');
    info.append(node('strong','',site.origin),
      node('small','',site.accounts.length?site.accounts.map(shortExtensionAddress420).join(', '):'No account permission'));
    const choose=node('select','site-network-select');
    choose.setAttribute('aria-label','Selected network for '+site.origin);
    for(const network of Object.values(state.wallet?.registry?.networks||{})){
      if(network.enabled&&network.rpcUrls?.length)choose.add(new Option(network.chainName+' · '+network.chainId,network.chainId));
    }
    choose.value=site.chainId||state.wallet?.registry?.selectedChainId||'';
    choose.addEventListener('change',async()=>{
      try{
        resetReview();const epoch=++state.epoch;
        const next=await command('site-network',{origin:site.origin,chainId:choose.value});
        if(await applyWalletState420(next,epoch))tell('Site network changed; prior account permission revoked.');
      }catch(error){tell('Site network change blocked: '+error.message,'error');renderSites();}
    });
    info.append(choose);
    const button=node('button','small-danger','Disconnect');button.type='button';button.setAttribute('aria-label','Disconnect '+site.origin);
    button.addEventListener('click',async()=>{
      if(!window.confirm('Disconnect '+site.origin+'? This removes browser account permission, not on-chain grants.'))return;
      button.disabled=true;
      try {const epoch=++state.epoch;const next=await command('disconnect-site',{origin:site.origin});
        if(await applyWalletState420(next,epoch))tell('Disconnected '+site.origin);}
      catch(error){button.disabled=false;tell('Disconnect failed: '+error.message,'error');}
    });
    card.append(info,button);list.append(card);
  }
}

function securityTextRow420(title,description,kind=''){
  const item=node('div','security-row');
  const heading=node('strong','',title);
  const detail=node('small','',description);
  item.append(heading,detail);
  if(kind)item.dataset.kind=kind;
  return item;
}
function securityEmpty420(root,message){
 root.replaceChildren(node('p','empty',message));
}
function securitySafeTime420(value){
 const parsed=Number(value);
 return Number.isFinite(parsed)&&parsed>0?new Date(parsed).toLocaleString():'Unknown';
}
function renderSecurity420(){
 const sec=state.security;
 if(!sec)return;
 $('security-status').textContent='Selected '+sec.account+' · chain '+sec.chainId+
  '. Browser permissions are separate from on-chain authorities.';
 const sites=$('security-sites');sites.replaceChildren();
 if(!sec.sites.length)securityEmpty420(sites,'No connected sites for this wallet.');
 for(const site of sec.sites){
  const risk=site.securityRisk?.flags?.length?site.securityRisk.flags.join('; '):'No local heuristic warning detected (not a safety guarantee)';
  const item=securityTextRow420(site.origin,
    'Accounts: '+(site.accounts?.join(', ')||'none')+
    ' · granted '+securitySafeTime420(site.grantedAt)+
    ' · '+risk);
  const btn=node('button','small-danger','Disconnect website only');
  btn.type='button';btn.setAttribute('aria-label','Disconnect '+site.origin);
  btn.addEventListener('click',async()=>{
   if(!confirm('Remove only browser account access for '+site.origin+
    '? Token approvals, SmartAccount grants, session keys and passkeys remain unchanged on chain.'))return;
   btn.disabled=true;
   try{
    const epoch=++state.epoch,next=await command('disconnect-site',{origin:site.origin});
    await applyWalletState420(next,epoch);
    await loadSecurity420();
    securityMessage420('Browser site disconnected. No on-chain permission was revoked.');
   }catch(e){securityMessage420(e.message,true);}
   finally{btn.disabled=false;}
  });
  item.append(btn);sites.append(item);
 }
 const alerts=$('security-alerts');alerts.replaceChildren();
 if(!sec.alerts.length)securityEmpty420(alerts,'No local heuristic alerts detected. This does not prove safety.');
 for(const alert of sec.alerts)alerts.append(securityTextRow420(
  (alert.kind||'alert').toUpperCase(),(alert.origin?alert.origin+': ':'')+alert.message,'alert'));
 const discovered=$('security-discovered');discovered.replaceChildren();
 $('security-discovery-note').textContent=sec.discovered?.note||
   'Recent event discovery did not run. Enter a known token and spender to inspect its allowance.';
 if(!sec.discovered?.entries?.length)
   securityEmpty420(discovered,sec.discovered?.error?
     'Approval event scan unavailable: '+sec.discovered.error:
     'No nonzero ERC-20 allowances found in the bounded recent log window. Older or nonstandard approvals may still exist.');
 for(const found of sec.discovered?.entries||[]){
   const item=securityTextRow420(found.token+' · '+found.spender,
     'Token-reported raw allowance '+(found.value??'unverified')+
     (found.unlimited?' · VERY LARGE':'')+(found.warning?' · '+found.warning:''));
   if(found.value!==undefined){
     const watch=node('button','secondary','Watch and inspect exact allowance');
     watch.type='button';
     watch.addEventListener('click',()=>watchSecurity420({
       authorityKind:'allowance',token:found.token,spender:found.spender,
       owner:sec.discovered?.ownerType==='smart-account'?'smart-account':'eoa'
     }));
     item.append(watch);
   }
   discovered.append(item);
 }
 const history=$('security-signatures');history.replaceChildren();
 if(!sec.signatures.length)securityEmpty420(history,'No successful local dApp signatures recorded for this account and chain.');
 for(const x of sec.signatures)history.append(securityTextRow420(
  x.method+' · '+securitySafeTime420(x.at),
  x.origin+' · '+x.account+' · '+(x.flags?.length?x.flags.join('; '):'No heuristic warning')+
  ' · This record cannot undo the signature.'));
 const smart=$('security-account');smart.replaceChildren();
 if(sec.smart){
  const a=sec.smart;
  smart.append(securityTextRow420('SmartAccount420 · '+a.smartAccount,
   'Owner '+a.owner+' · EntryPoint '+a.entryPoint+
   ' · authorization epoch '+a.authorizationEpoch+
   ' · policy version '+a.authorizationPolicyVersion));
  smart.append(securityTextRow420('Canonical capability registry '+a.capabilityRegistry,
   'Verified registry '+a.verifiedCapabilityRegistry));
 }else smart.append(securityTextRow420('SmartAccount420 unavailable',
  sec.smartError||'Canonical deployment not verified; no SmartAccount authority can be revoked.'));
 const recovery=$('security-recovery');recovery.replaceChildren();
 recovery.append(sec.smart?securityTextRow420(
  'Recovery authority: '+sec.smart.recoveryAuthority,
  'Pending owner '+sec.smart.pendingRecoveryOwner+
  ' · executable after '+(Number(sec.smart.recoveryExecutableAt)?
   securitySafeTime420(Number(sec.smart.recoveryExecutableAt)*1000):'not scheduled')+
  '. Recovery changes need separate canonical authority.'):
  securityTextRow420('Unavailable','No verified SmartAccount recovery authority.'));
 const passkeys=$('security-passkeys');passkeys.replaceChildren();
 if(!sec.passkeys.length)securityEmpty420(passkeys,'No locally bound passkeys found or no verified SmartAccount.');
 for(const x of sec.passkeys){
  const item=securityTextRow420('Credential '+x.credentialIdHash,
   'RP '+(x.relyingParty||'unknown')+' · binding epoch '+x.bindingEpoch+
   ' · on-chain '+x.status);
  if(x.active){
   const button=node('button','small-danger','Review on-chain passkey revocation');
   button.type='button';
   button.addEventListener('click',()=>reviewSecurity420({
    authorityKind:'passkey',credentialIdHash:x.credentialIdHash
   }));
   item.append(button);
  }
  passkeys.append(item);
 }
 for(const kind of ['allowance','capability','session']){
  const element=$('security-'+(kind==='allowance'?'allowances':kind==='capability'?'capabilities':'sessions'));
  element.replaceChildren();
  const matches=sec.watched.filter(x=>x.kind===kind);
  if(!matches.length)securityEmpty420(element,'No '+kind+' authorities tracked. Add an exact on-chain reference above.');
  for(const x of matches){
   const who=kind==='allowance'?x.token+' · spender '+x.spender+
    ' · '+x.owner+' owner':kind==='capability'?x.grantId+' · principal '+(x.principal||'unverified'):x.key;
   const detail='On-chain '+x.status+(x.value!=null?' · raw allowance '+x.value:'')+
    (x.unlimited?' · VERY LARGE ALLOWANCE':'')+
    (x.validUntil?' · valid until '+x.validUntil:'')+
    (x.sessionEpoch?' · session epoch '+x.sessionEpoch:'')+
    (x.warning?' · '+x.warning:'');
   const row=securityTextRow420(who,detail);
   if(x.verified===true&&(x.status==='active')){
    const button=node('button','small-danger','Review on-chain '+kind+' revocation');
    button.type='button';
    button.addEventListener('click',()=>reviewSecurity420({
     authorityKind:kind,...(kind==='allowance'?
      {token:x.token,spender:x.spender,owner:x.owner}:
      kind==='capability'?{grantId:x.grantId}:{key:x.key})
    }));
    row.append(button);
   }
   const hide=node('button','secondary','Stop watching (local only)');
   hide.type='button';
   hide.addEventListener('click',async()=>{
    hide.disabled=true;
    try{
     const result=await command('security-unwatch',{
       ...x,authorityKind:kind
     });
     if(result?.localOnly){
       state.security.watched=state.security.watched.filter(item=>
         !(item.kind===kind&&JSON.stringify(item)===JSON.stringify(x)));
       // Reloading may fail while offline. The local unwatch must still be
       // reflected immediately without altering any on-chain permission.
       row.remove();
       if(!element.childElementCount)
         securityEmpty420(element,'No '+kind+' authorities tracked.');
     }
     securityMessage420('Removed watch entry locally. On-chain authority is unchanged.');
    }catch(e){securityMessage420(e.message,true);}
    finally{hide.disabled=false;}
   });
   row.append(hide);element.append(row);
  }
 }
}
function securityMessage420(text,isError=false){
 const message=$('security-status');message.textContent=text;
 message.className='notice'+(isError?' error':'');
}
async function loadSecurity420(){
 const version=++state.securityEpoch;
 try{
  securityMessage420('Verifying security authorities against the current chain…');
  const next=await command('security-state');
  if(version!==state.securityEpoch)return;
  state.security=next;renderSecurity420();
 }catch(error){if(version===state.securityEpoch)securityMessage420('Security inventory unavailable: '+error.message,true);}
}
async function watchSecurity420(request){
 try{
  const next=await command('security-watch',request);
  state.security=next;renderSecurity420();
  securityMessage420('Verified on-chain authority added to this device’s watchlist. No revocation occurred.');
 }catch(error){securityMessage420('Security inspection blocked: '+error.message,true);}
}
async function reviewSecurity420(request){
 if(state.securityReview){securityMessage420('Cancel the existing revocation review before starting another.',true);return;}
 try{
  securityMessage420('Rechecking current chain, owner and authority before preparing revocation…');
  const review=await command('security-review',request);
  state.securityReview=review;
  $('security-review-kind').textContent=review.kind+' · '+review.authority+
   ' · '+review.executionModel;
  $('security-review-target').textContent=review.transaction.to+
   ' · calldata '+review.transaction.data;
  $('security-review-current').textContent=JSON.stringify(review.record);
  $('security-review-fee').textContent=review.quote.totalFeeWei??'Unavailable';
  $('security-review-simulation').textContent=review.quote.simulation+
   ' · nonce '+(review.quote.nonce||'unknown');
  $('security-review-warning').textContent=review.explanation+
   ' Gas is charged on chain. Submission is NOT evidence of revocation.';
  $('security-review-ack').checked=false;
  $('security-submit-review').disabled=true;
  $('security-revocation-review').hidden=false;
  $('security-revocation-review').scrollIntoView({block:'nearest'});
  securityMessage420('Separate on-chain revocation reviewed. Recheck destination and fee, then explicitly confirm.');
 }catch(error){securityMessage420('Revocation cannot proceed: '+error.message,true);}
}
function clearSecurityReview420(){
 state.securityReview=null;
 $('security-revocation-review').hidden=true;
 $('security-review-ack').checked=false;
 $('security-submit-review').disabled=true;
}
function renderSettings(){
  const c=state.wallet?.config||{};
  const choices=$('network-select');choices.replaceChildren();
  for(const net of Object.values(state.wallet?.registry?.networks||{})){
    choices.add(new Option(net.chainName+' · '+net.chainId+(net.enabled?'':' (disabled)'),net.chainId));
    choices.lastChild.disabled=!net.enabled||!net.rpcUrls?.length;
  }
  choices.value=state.wallet?.registry?.selectedChainId||'';
  const health=state.wallet?.network?.health||[];
  $('network-health').textContent=!c.chainId?'No active EVM network':c.chainId+': '+(health.length?health.filter(x=>x.healthy).length+'/'+health.length+' healthy RPC endpoints':'No RPC endpoint verification');
  $('rpc-url').value=c.rpcUrl||'';
  $('expected-chain').value=c.chainId||'';
  $('explorer-url').value=c.explorerUrl||'';
  $('settings-controller').textContent=shortExtensionAddress420(state.wallet?.selectedAccount);
  $('settings-factory').textContent=shortExtensionAddress420(c.factoryAddress);
  $('fiat-currency').value=state.wallet?.portfolio?.currency||'CAD';
  $('price-provider-url').value=state.wallet?.portfolio?.priceProviderUrl||'';
}
function renderReceive(){
  const address=extensionReceiveAddress420(state.wallet);
  const canvas=$('receive-qr'),network=$('receive-qr-network');
  $('receive-address').textContent=address||'Unavailable';
  $('copy-receive').disabled=!address;
  canvas.hidden=true;
  if(address){
    try{
      // Encode the exact same canonical address shown and copied by this screen, locally.
      // Do not make network requests or embed unverified ENS/420Names in a QR.
      const qr=qrcode(0,'M');qr.addData(address,'Byte');qr.make();
      const modules=qr.getModuleCount(),quiet=4,side=canvas.width,scale=side/(modules+2*quiet);
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Canvas unavailable');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,side,side);
      ctx.fillStyle='#000000';
      for(let row=0;row<modules;row++)for(let col=0;col<modules;col++){
        if(!qr.isDark(row,col))continue;
        const x0=Math.round((col+quiet)*scale),y0=Math.round((row+quiet)*scale);
        const x1=Math.round((col+quiet+1)*scale),y1=Math.round((row+quiet+1)*scale);
        ctx.fillRect(x0,y0,x1-x0,y1-y0);
      }
      canvas.hidden=false;
      network.textContent='Address-only QR · '+(state.wallet?.network?.name||'Selected network')+
        ' · '+state.wallet?.network?.expectedChainId+'. Always verify the network before sending.';
    }catch(error){network.textContent='QR unavailable: '+error.message+'; the verified address can still be copied.';}
  }else{
    network.textContent='QR unavailable until the network and selected receiving address are verified.';
  }
  $('receive-warning').textContent=address?'Confirm the exact network and account address before transferring funds.':'A matching chain and an available account are required before receiving.';
  $('receive-warning').className='notice'+(address?'':' warn');
}
async function loadAggregate420(){
  const epoch=state.epoch,account=state.wallet?.selectedAccount,box=$('aggregate-list');
  if(!account){box.textContent='Select an account to view enabled network balances.';return;}
  box.textContent='Checking enabled network balances…';
  try{
    const items=await command('aggregate-assets');
    if(epoch!==state.epoch||state.wallet?.selectedAccount!==account)return;
    box.replaceChildren();
    for(const entry of items){
      const label=entry.status==='verified'?
        extensionBalanceText420(entry.raw,entry.decimals)+' '+entry.symbol:'Unavailable';
      const summary=node('p','balance-detail',entry.name+' ('+entry.chainId+') · '+label);
      box.append(summary);
      for(const token of entry.tokens||[]){
        const amount=token.status==='unavailable'?'Unavailable':extensionBalanceText420(token.raw,token.decimals)+' '+token.symbol;
        box.append(node('p','balance-detail','   '+token.symbol+' · '+amount));
      }
    }
    if(!items.length)box.textContent='No enabled networks with verified RPC endpoints.';
  }catch(e){if(epoch===state.epoch)box.textContent='Network balances unavailable: '+e.message;}
}
async function applyWalletState420(next,expectedEpoch){
  const record=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
  if(expectedEpoch!==state.epoch)return false;
  if(record&&(record.epoch!==next?.network?.epoch||record.selectedChainId!==next?.registry?.selectedChainId))
    throw Object.assign(new Error('Network changed while updating wallet display'),{code:4901});
  state.wallet=next;renderAll();
  return true;
}
function renderAll(){
  if(!state.wallet)return;
  summarizeNetwork();renderAccount();renderAssets();renderNFT420();renderActivity();renderSites();renderSettings();renderReceive();renderAddressBook420();
}
async function command(kind,extra={}){
  const response=await chrome.runtime.sendMessage({source:'420-wallet-popup-ui',kind,...extra});
  if(!response)throw new Error('Wallet extension service worker did not respond');
  if(response.error)throw Object.assign(new Error(response.error.message||'Wallet request failed'),response.error);
  return response.result;
}
async function refresh(retry=0){
  $('quick-refresh').disabled=true;
  tell('Verifying network and account…');
  const epoch=++state.epoch;
  try{
    const next=await command('get-state');
    if(epoch!==state.epoch)return;
    if(await applyWalletState420(next,epoch))loadAggregate420().catch(()=>{});
  }catch(error){
    if(error.code===4901&&retry===0)return refresh(1);
    if(epoch===state.epoch)tell('Unable to refresh wallet: '+error.message,'error');
  }finally{$('quick-refresh').disabled=false;}
}
function resetReview(){
  state.prepared=null;$('send-review').hidden=true;$('send-confirm').disabled=true;
  $('send-state').textContent='Review required before authorization.';
}
function currentFeeChoice420(){
  const level=$('send-fee-choice').value;
  return level==='custom'
    ?{level,maxFeePerGas:$('send-max-fee').value.trim(),maxPriorityFeePerGas:$('send-priority-fee').value.trim()}
    :{level};
}
async function prepareReview(){
  const w=state.wallet;
  if(!extensionCanSend420(w))throw new Error('Verified account owner and matching network required');
  const context={chainId:w.network.expectedChainId,epoch:w.network.epoch,account:w.selectedAccount,
    recipient:$('send-recipient').value.trim(),amount:$('send-amount').value.trim(),
    asset:$('send-asset').value,feeChoice:currentFeeChoice420()};
  const {transaction,quote,recipientSnapshot}=await command('send-preflight',context);
  if(state.wallet!==w||w.network.expectedChainId!==context.chainId||w.network.epoch!==context.epoch)
    throw new Error('Network/account changed during preflight; restart review');
  state.prepared={...transaction,...context,controller:w.selectedAccount,quote,recipientSnapshot};
  $('review-asset').textContent=transaction.summary.symbol;
  $('review-amount').textContent=transaction.summary.amount;
  $('review-recipient').textContent=recipientSnapshot.kind==='address'?transaction.summary.recipient:
    recipientSnapshot.input+' → '+transaction.summary.recipient+' (resolved on '+context.chainId+')';
  $('review-chain').textContent=context.chainId;
  $('review-sender').textContent=w.account.kind==='eoa'?w.account.controller:w.account.smartAccount;
  $('review-max-fee').textContent=quote.maxFeePerGas+' wei/gas';
  $('review-priority-fee').textContent=quote.maxPriorityFeePerGas+' wei/gas';
  $('review-aa-gas').textContent=quote.executionModel==='eoa'?
    ('EOA EIP-1559 limit: '+BigInt(quote.gasLimit).toString()+' gas'):
    quote.gasBudget?
      ('Call '+BigInt(quote.gasBudget.callGasLimit).toString()+
        ', verification '+BigInt(quote.gasBudget.verificationGasLimit).toString()+
        ', pre-verification '+BigInt(quote.gasBudget.preVerificationGas).toString()):'Unavailable';
  $('review-total-fee').textContent=quote.totalFeeWei===null?
    'Unavailable — transaction blocked':'Up to '+quote.totalFeeWei+' wei (no sponsorship assumed)';
  $('review-simulation').textContent='Target call passed; this does NOT prove account-abstraction execution.';
  $('review-entrypoint').textContent=quote.executionModel==='eoa'?
    'Not applicable: local vault EOA signs the reviewed EIP-1559 transaction and verifies the signature envelope.':
    quote.gasBudget?.estimateVerified?
      'Bundler gas quote verified before confirmation. Signed EntryPoint execution must still pass before broadcast.':
      'Bundler estimate unavailable — cannot sign or submit.';
  $('send-review').hidden=false;$('send-confirm').disabled=false;
  $('send-state').textContent='Review verified bundler gas caps and worst-case fee exposure. Target call passed. Final signed EntryPoint simulation is still required before submission.';
  $('send-confirm').focus();
}
function renderAddressBook420(){
  const chain=state.wallet?.network?.expectedChainId;
  const contacts=(state.wallet?.addressBook||[]).filter(c=>c.chainId===chain);
  const selector=$('send-contact'),suggestions=$('send-address-suggestions');
  if(!selector||!suggestions)return;
  const selected=selector.value;
  selector.replaceChildren(new Option('Choose a saved contact',''));
  suggestions.replaceChildren();
  for(const contact of contacts){
    selector.add(new Option(contact.label+' · '+shortExtensionAddress420(contact.address),contact.address));
    const option=document.createElement('option');option.value=contact.address;option.label=contact.label;suggestions.append(option);
  }
  if(contacts.some(c=>c.address===selected))selector.value=selected;
}
function populateSend(){
  const symbol=state.wallet?.config?.nativeCurrency?.symbol||'420';
  const select=$('send-asset');select.replaceChildren(new Option(symbol+' · Native','native'));
  for(const token of state.wallet?.assets.tokens||[]){
    if(token.error)continue;
    select.add(new Option(token.symbol+' · ERC-20',token.address));
  }
}
async function copy(value){
  if(!value)throw new Error('No available account address');
  if(!navigator.clipboard?.writeText)throw new Error('Clipboard is unavailable in this browser');
  await navigator.clipboard.writeText(value);
  tell('Account address copied.');
}
function prettyRequest(request){
  if(!request)return '';
  if(request.method==='eth_requestAccounts')return 'Connect this site to 420 Wallet.';
  if(request.method==='eth_sendTransaction'||request.method==='wallet_sendCalls'){
    const preview=request.feePreview;
    return JSON.stringify(request.params?.[0]??{},null,2)+
      (preview?'\n\nON-CHAIN TRANSACTION REVIEW\nChain: '+preview.chainId+
        '\nTarget: '+preview.normalizedTx.to+
        '\nGas fee cap: '+preview.quote.maxFeePerGas+' wei/gas'+
        '\nPriority fee cap: '+preview.quote.maxPriorityFeePerGas+' wei/gas'+
        (preview.executionModel==='eoa'?
          '\nEOA estimated gas limit: '+preview.quote.gasLimit:
          '\nBundler estimated gas: '+preview.quote.gasBudget.callGasLimit+' call, '+
             preview.quote.gasBudget.verificationGasLimit+' verification, '+
             preview.quote.gasBudget.preVerificationGas+' pre-verification')+
        '\nMaximum estimated execution fee: '+preview.quote.totalFeeWei+' wei'+
        '\nTARGET CALL PASSED. '+(preview.executionModel==='eoa'?
          'Locally signed EOA envelope will be verified before broadcast.':
          'Signed EntryPoint execution must still pass.')+
        '\nRisk: '+preview.risk.severity.toUpperCase()+' — '+preview.risk.message:'');
  }
  if(request.method==='personal_sign')return 'Personal signature request\n'+String(request.params?.[0]??'');
  if(request.method==='eth_signTypedData_v4')return 'Typed data signature request\n'+String(request.params?.[1]??'');
  return JSON.stringify(request.params??[],null,2);
}
async function approval(){
  $('bottom-nav').hidden=true;screen('approval-view');
  $('status').textContent='Checking pending request…';
  const stored=await chrome.storage.local.get(APPROVALS_KEY);
  const approval=stored?.[APPROVALS_KEY]?.[approvalId];
  if(!approval){$('status').textContent='This approval request is no longer available.';return;}
  $('status').textContent='Review this request carefully before approving.';
  $('request').hidden=false;$('actions').hidden=false;
  $('kind').textContent=approval.request.method;
  $('origin').textContent=approval.context.origin;
  $('details').textContent=prettyRequest(approval.request);
  const risk=approval.request.feePreview?.risk;
  const signatureRisk=approval.request.securityRisk;
  const acknowledgement=$('approval-risk-ack'),checkbox=$('approval-risk-check');
  const highRisk=(['eth_sendTransaction','wallet_sendCalls'].includes(approval.request.method)&&
    ['high','critical'].includes(risk?.severity))||
    signatureRisk?.severity==='high';
  if(signatureRisk?.flags?.length)
    $('details').textContent+='\\n\\nSECURITY WARNING: '+signatureRisk.flags.join('; ');
  acknowledgement.querySelector('label').lastChild.textContent=signatureRisk?.severity==='high'?
    ' I have inspected the site, signing message, requested account and authorization risks; this signature or permission may expose assets.':
    ' I understand this contract approval/interaction could transfer assets or grant spending permissions.';
  acknowledgement.hidden=!highRisk;checkbox.checked=false;
  $('approve').disabled=highRisk;
  checkbox.addEventListener('change',()=>{$('approve').disabled=highRisk&&!checkbox.checked;});
  if(Array.isArray(approval.request.availableAccounts)&&approval.request.availableAccounts.length){
    $('account-picker').hidden=false;
    $('account').replaceChildren(...approval.request.availableAccounts.map(x=>new Option(x,x)));
  }
  async function finish(approved){
    if(approved&&highRisk&&!checkbox.checked){
      $('status').textContent='You must explicitly acknowledge the contract approval risk.';
      return;
    }
    $('approve').disabled=true;$('reject').disabled=true;
    try{
      const current=await chrome.storage.local.get(APPROVALS_KEY);
      const next=current?.[APPROVALS_KEY]??{};
      delete next[approvalId];
      await chrome.storage.local.set({[APPROVALS_KEY]:next});
      await chrome.runtime.sendMessage({
        source:'420-wallet-popup',kind:'approval-result',approvalId,approved,
        ...(approved&&!$('account-picker').hidden?{accounts:[$('account').value]}:{}),
      });
      window.close();
    }catch(error){
      $('status').textContent='Could not deliver the approval result: '+error.message;
      $('approve').disabled=highRisk&&!checkbox.checked;$('reject').disabled=false;
    }
  }
  $('approve').addEventListener('click',()=>finish(true));
  $('reject').addEventListener('click',()=>finish(false)); // User rejected request when approved=false.
}
function setup(){
  for(const [id,older] of [['nfts-scan-recent',false],['nfts-scan-older',true]]){
    $(id).addEventListener('click',async()=>{
      const button=$(id);button.disabled=true;
      try{
        const epoch=++state.epoch;
        const response=await command('portfolio-discover',{older});
        if(await applyWalletState420(response.state,epoch)){
          const d=response.discovery;
          $('nft-index-status').textContent=d.nftBackfillComplete?
            'Older NFT event history has reached genesis; currently owned collectibles remain verified on chain.':
            (older?'Historical backfill':'Recent forward scan')+
            ' complete for blocks '+d.nftFrom+'–'+d.nftTo+
            ': '+d.nfts+' NFT holdings verified. Coverage is partial; repeat to scan more blocks.';
          tell('NFT ownership reverified from contract state, not metadata.');
        }
      }catch(e){$('nft-index-status').textContent='NFT scan blocked: '+e.message;}
      finally{button.disabled=false;}
    });
  }
  $('nft-import-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type=submit]');
    button.disabled=true;
    try{
      const next=await command('nft-import',{
        standard:$('nft-import-standard').value,
        address:$('nft-import-contract').value.trim(),
        tokenId:$('nft-import-id').value.trim()
      });
      const epoch=++state.epoch;
      if(await applyWalletState420(next,epoch)){
        $('nft-index-status').textContent='Imported after current on-chain ownership verification. Token metadata remains untrusted.';
        tell('Verified collectible added to your collection.');
      }
    }catch(e){$('nft-index-status').textContent='Import blocked: '+e.message;}
    finally{button.disabled=false;}
  });
  $('nfts-show-hidden').addEventListener('click',()=>{
    state.nftShowHidden=!state.nftShowHidden;renderNFT420();
  });
  $('nft-load-metadata').addEventListener('click',async()=>{
    const button=$('nft-load-metadata');button.disabled=true;
    try{
      const nft=selectedNft420();
      const {metadata}=await command('nft-metadata',{
       standard:nft.standard,address:nft.address,tokenId:nft.tokenId});
      if(nft.key!==state.nftSelected)throw Error('Selected NFT changed');
      const refreshed=await command('get-state');
      await applyWalletState420(refreshed,++state.epoch);
      renderNFTDetail420();
      $('nft-detail-status').textContent='Untrusted metadata text loaded; ownership remains on-chain verified.';
    }catch(e){$('nft-detail-status').textContent='Metadata unavailable: '+e.message;}
    finally{button.disabled=false;}
  });
  $('nft-hide').addEventListener('click',()=>nftWatchVisibility420('hidden'));
  $('nft-spam').addEventListener('click',()=>nftWatchVisibility420('spam'));
  $('nft-inspect-approval').addEventListener('click',async()=>{
    const button=$('nft-inspect-approval');button.disabled=true;
    try{
      const nft=selectedNft420();
      const operator=$('nft-recipient').value.trim();
      const response=await command('nft-approval-status',{
        standard:nft.standard,address:nft.address,tokenId:nft.tokenId,
        ...(nft.standard==='ERC1155'||$('nft-collection-wide').checked?{operator}:{}),
        collectionWide:$('nft-collection-wide').checked
      });
      $('nft-approval-status').textContent=response.scope==='token'?
        'On-chain ERC-721 token-specific approved address: '+response.approvedOperator:
        'On-chain ERC-1155 operator '+response.operator+': '+(response.approved?'approved for ALL NFTs in collection':'not approved');
    }catch(e){$('nft-approval-status').textContent='Cannot inspect approval: '+e.message;}
    finally{button.disabled=false;}
  });
  $('nft-action-form').addEventListener('submit',nftReview420);
  for(const id of ['nft-action','nft-recipient','nft-quantity','nft-collection-wide'])
   $(id).addEventListener('input',clearNftReview420);
  $('nft-action').addEventListener('change',()=>{
   const nft=selectedNft420(),approval=$('nft-action').value!=='transfer';
   $('nft-quantity').disabled=approval||nft.standard==='ERC721';
   $('nft-collection-wide').disabled=!approval||nft.standard==='ERC1155';
   if(approval&&nft.standard==='ERC1155')$('nft-collection-wide').checked=true;
  });
  $('nft-review-ack').addEventListener('change',()=>{
    $('nft-review-confirm').disabled=!$('nft-review-ack').checked||!state.nftPrepared;
  });
  $('nft-review-cancel').addEventListener('click',()=>{
    clearNftReview420();$('nft-detail-status').textContent='NFT review cancelled. No transaction was signed.';
  });
  $('nft-review-confirm').addEventListener('click',async()=>{
    const previous=state.nftPrepared;
    if(!previous||!$('nft-review-ack').checked)return;
    const button=$('nft-review-confirm');button.disabled=true;
    try{
      const latest=selectedNft420();
      const action=$('nft-action').value,target=$('nft-recipient').value.trim();
      if(previous.key!==latest.key||previous.action!==action||
         previous.chainId!==state.wallet.network.expectedChainId||
         previous.epoch!==state.wallet.network.epoch||
         previous.account!==state.wallet.selectedAccount||
         previous.request.quantity!==$('nft-quantity').value||
         previous.request.collectionWide!==$('nft-collection-wide').checked||
         (action==='transfer'?previous.request.recipient:previous.request.operator)!==target)
        throw new Error('NFT review fields, account or chain changed; inspect again');
      const result=await command('nft-submit',{reviewId:previous.reviewId,confirmed:true});
      clearNftReview420();
      $('nft-detail-status').textContent='NFT '+action+' submitted: '+result.hash+
        '. Awaiting canonical receipt and updated on-chain owner/approval.';
      await refresh();
    }catch(e){clearNftReview420();$('nft-detail-status').textContent='NFT submission not verified: '+e.message;}
    finally{button.disabled=false;}
  });
  $('open-security-centre').addEventListener('click',()=>{screen('security-view');loadSecurity420();});
  document.querySelector('#security-view [data-back]')?.addEventListener('click',event=>{event.stopImmediatePropagation();screen('sites-view');},true);
  $('security-refresh').addEventListener('click',()=>{clearSecurityReview420();loadSecurity420();});
  $('security-allowance-form').addEventListener('submit',event=>{
    event.preventDefault();
    watchSecurity420({authorityKind:'allowance',token:$('security-token').value.trim(),
      spender:$('security-spender').value.trim(),owner:$('security-allowance-owner').value});
  });
  $('security-capability-form').addEventListener('submit',event=>{
    event.preventDefault();watchSecurity420({authorityKind:'capability',grantId:$('security-grant').value.trim()});
  });
  $('security-session-form').addEventListener('submit',event=>{
    event.preventDefault();watchSecurity420({authorityKind:'session',key:$('security-key').value.trim()});
  });
  $('security-review-ack').addEventListener('change',()=>{
    $('security-submit-review').disabled=!$('security-review-ack').checked||!state.securityReview;
  });
  $('security-cancel-review').addEventListener('click',()=>{
    clearSecurityReview420();securityMessage420('Revocation review cancelled. No on-chain action was taken.');
  });
  $('security-submit-review').addEventListener('click',async()=>{
    const review=state.securityReview;
    if(!review||!$('security-review-ack').checked)return;
    const button=$('security-submit-review');button.disabled=true;
    try{
      const result=await command('security-submit',{reviewId:review.reviewId,confirmed:true});
      clearSecurityReview420();
      await loadSecurity420();
      securityMessage420('Submitted '+result.kind+' transaction '+result.hash+
        '. The on-chain authority is NOT yet verified revoked; check the canonical receipt.');
    }catch(error){
      clearSecurityReview420();
      securityMessage420('On-chain security submission not verified: '+error.message,true);
    }
  });
  for(const nav of document.querySelectorAll('[data-screen]'))nav.addEventListener('click',()=>screen(nav.dataset.screen));
  $('tab-tokens').addEventListener('click',()=>screen('dashboard'));
  $('tab-nfts').addEventListener('click',()=>screen('nfts-view'));
  $('tab-activity').addEventListener('click',()=>screen('activity-view'));
  $('nfts-refresh').addEventListener('click',()=>refresh());
  $('portfolio-refresh').addEventListener('click',()=>refresh());
  $('show-hidden-assets').addEventListener('click',()=>{
    state.showHidden=!state.showHidden;
    $('show-hidden-assets').setAttribute('aria-pressed',String(state.showHidden));
    $('show-hidden-assets').textContent=state.showHidden?'Hide hidden/spam tokens':'Show hidden/spam tokens';
    renderAssets();
  });
  $('discover-assets').addEventListener('click',async()=>{
    const button=$('discover-assets');button.disabled=true;
    try{
      const epoch=++state.epoch;
      const response=await command('portfolio-discover');
      if(await applyWalletState420(response.state,epoch))
        tell('Scanned bounded blocks. '+response.discovery.tokens+' ERC-20 and '+response.discovery.nfts+
          ' NFT holdings verified (ERC-721/1155); NFT window '+response.discovery.nftFrom+
          '–'+response.discovery.nftTo+'. Older assets may need manual import.','success');
    }catch(e){tell('Discovery unavailable: '+e.message,'error');}
    finally{button.disabled=false;}
  });
  $('token-import-form').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      const epoch=++state.epoch;
      const next=await command('portfolio-import',{address:$('token-address').value.trim()});
      if(await applyWalletState420(next,epoch)){tell('ERC-20 contract metadata verified on chain; token imported.','success');screen('dashboard');}
    }catch(e){tell('Token import rejected: '+e.message,'error');}
  });
  $('price-provider-form').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      const epoch=++state.epoch;
      const next=await command('portfolio-provider',{url:$('price-provider-url').value.trim(),currency:$('fiat-currency').value});
      if(await applyWalletState420(next,epoch))tell('Fiat settings saved; quotes remain unavailable until authoritative provider responses.','success');
    }catch(e){tell('Price settings rejected: '+e.message,'error');}
  });
  $('asset-hide').addEventListener('click',async()=>{
    const item=portfolioRows420().find(a=>a.address===state.detailAddress);
    if(!item||item.address==='native')return;
    try{const epoch=++state.epoch;const next=await command('portfolio-visibility',{address:item.address,hidden:!item.hidden});
      if(await applyWalletState420(next,epoch))screen('dashboard');
    }catch(e){tell('Visibility update rejected: '+e.message,'error');}
  });
  $('asset-spam').addEventListener('click',async()=>{
    const item=portfolioRows420().find(a=>a.address===state.detailAddress);
    if(!item||item.address==='native')return;
    try{const epoch=++state.epoch;const next=await command('portfolio-visibility',{address:item.address,spam:!item.spam});
      if(await applyWalletState420(next,epoch))screen('dashboard');
    }catch(e){tell('Spam setting rejected: '+e.message,'error');}
  });
  $('header-settings').addEventListener('click',()=>screen('settings-view'));
  $('open-wallet').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL('wallet.html')}));
  $('quick-activity').addEventListener('click',()=>screen('activity-view'));
  $('quick-send').addEventListener('click',()=>{populateSend();resetReview();screen('send-view');});
  $('quick-receive').addEventListener('click',()=>{renderReceive();screen('receive-view');});
  $('quick-refresh').addEventListener('click',refresh);
  for(const back of document.querySelectorAll('[data-back]'))back.addEventListener('click',()=>screen(back.closest('#security-view')?'sites-view':back.closest('#nft-detail-view')?'nfts-view':'dashboard'));
  $('copy-account').addEventListener('click',()=>copy(extensionReceiveAddress420(state.wallet)).catch(e=>tell('Copy failed: '+e.message,'error')));
  $('copy-receive').addEventListener('click',()=>copy(extensionReceiveAddress420(state.wallet)).catch(e=>{$('receive-warning').textContent=e.message;$('receive-warning').className='notice error';}));
  $('account-select').addEventListener('change',async event=>{
    try{resetReview();const epoch=++state.epoch;const next=await command('set-account',{account:event.target.value});if(await applyWalletState420(next,epoch))loadAggregate420().catch(()=>{});}
    catch(e){tell('Account change blocked: '+e.message,'error');}
  });
  $('switch-network').addEventListener('click',async()=>{
    try{
      resetReview();const epoch=++state.epoch;
      const next=await command('switch-network',{chainId:$('network-select').value});
      if(await applyWalletState420(next,epoch)){loadAggregate420().catch(()=>{});tell('Network switched. All pending transaction previews were invalidated.');}
    }catch(e){tell('Network switch blocked: '+e.message,'error');}
  });
  $('add-network-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const urls=id=>$(id).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const net={chainId:$('new-chain-id').value.trim(),chainName:$('new-chain-name').value.trim(),
      rpcUrls:urls('new-rpc-urls'),blockExplorerUrls:urls('new-explorers'),
      nativeCurrency:{name:$('new-currency-name').value.trim(),symbol:$('new-currency-symbol').value.trim(),decimals:Number($('new-currency-decimals').value)}};
    try{
      const epoch=++state.epoch;const next=await command('add-network',{network:net});
      if(await applyWalletState420(next,epoch))tell('Network added after RPC verification; SmartAccount execution remains disabled on unapproved chains.');
    }catch(e){tell('Network rejected: '+e.message,'error');}
  });
  $('aggregate-assets').addEventListener('click',()=>loadAggregate420().catch(()=>{}));
  $('network-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=event.target.querySelector('button[type=submit]');button.disabled=true;
    try {
      resetReview();++state.epoch;
      const epoch=state.epoch;
      const next=await command('save-network',{
        rpcUrl:$('rpc-url').value.trim(),chainId:$('expected-chain').value.trim(),explorerUrl:$('explorer-url').value.trim(),
      });
      if(await applyWalletState420(next,epoch))tell('Network preferences saved; network verification refreshed.');
      screen('dashboard');
    }catch(e){tell('Network save failed: '+e.message,'error');$('global-status').textContent='Network save failed: '+e.message;}
    finally{button.disabled=false;}
  });
  $('send-max').addEventListener('click',async()=>{
    const button=$('send-max');button.disabled=true;
    try{
      const w=state.wallet;
      if(!extensionCanSend420(w))throw new Error('Unlocked verified account and network are required');
      if($('send-asset').value==='native'){
        if(w.account.kind!=='eoa')throw new Error('SmartAccount native Max requires verified paymaster and EntryPoint funding accounting; unavailable');
        const max=await command('send-native-max',{
          chainId:w.network.expectedChainId,epoch:w.network.epoch,
          account:w.selectedAccount,recipient:$('send-recipient').value.trim(),
          feeChoice:currentFeeChoice420()
        });
        if(state.wallet!==w)
          throw new Error('Account changed during Max computation');
        $('send-amount').value=formatExtensionUnitsExact420(max.raw,max.decimals);
        resetReview();
        $('send-state').textContent='Native Max reserves '+max.feeWei+
          ' wei for the reviewed EIP-1559 gas cap. The fee and nonce will be rechecked before sending.';
        return;
      }
      const address=$('send-asset').value.toLowerCase();
      const token=w?.portfolio?.tokens?.find(t=>t.address===address);
      if(!token?.verified||token.hidden||token.spam||token.balance?.status!=='spendable')
        throw new Error('Verified spendable token balance unavailable; refresh portfolio');
      const amount=formatExtensionUnitsExact420(token.balance.spendable,token.decimals);
      if(BigInt(token.balance.spendable)<=0n)throw new Error('Token balance is zero');
      $('send-amount').value=amount;
      resetReview();
      $('send-state').textContent='Max verified token balance selected. Review before sending; gas and execution remain independently validated.';
    }catch(e){$('send-state').textContent='Max unavailable: '+e.message;}
    finally{button.disabled=false;}
  });
  $('send-contact').addEventListener('change',()=>{
    const address=$('send-contact').value;
    if(!address)return;
    const contact=state.wallet?.addressBook?.find(c=>c.address===address&&c.chainId===state.wallet.network.expectedChainId);
    if(!contact)return;
    $('send-recipient').value=contact.address;
    $('send-contact-label').value=contact.label;
    resetReview();
  });
  $('send-save-contact').addEventListener('click',async()=>{
    const button=$('send-save-contact');button.disabled=true;
    try{
      const address=$('send-recipient').value.trim(),label=$('send-contact-label').value.trim();
      if(!label)throw new Error('Enter a nickname to save this recipient');
      const chainId=state.wallet?.network?.expectedChainId;
      const next=await command('addressbook-save',{chainId,address,label});
      const epoch=state.epoch;
      if(await applyWalletState420(next,epoch))tell('Saved recipient on this network.');
    }catch(e){tell('Could not save recipient: '+e.message,'error');}
    finally{button.disabled=false;}
  });
  $('send-delete-contact').addEventListener('click',async()=>{
    const address=$('send-contact').value;if(!address)return;
    const button=$('send-delete-contact');button.disabled=true;
    try{
      const next=await command('addressbook-delete',{chainId:state.wallet?.network?.expectedChainId,address});
      if(await applyWalletState420(next,state.epoch))tell('Saved recipient removed.');
      $('send-contact-label').value='';
    }catch(e){tell('Could not remove recipient: '+e.message,'error');}
    finally{button.disabled=false;}
  });
  for(const id of ['send-asset','send-recipient','send-amount','send-fee-choice','send-max-fee','send-priority-fee'])$(id).addEventListener('input',resetReview);
  $('send-fee-choice').addEventListener('change',()=>{
    const custom=$('send-fee-choice').value==='custom';
    $('send-max-fee').disabled=!custom;$('send-priority-fee').disabled=!custom;
    resetReview();
  });
  $('send-form').addEventListener('submit',async event=>{
    event.preventDefault();$('send-review-button').disabled=true;
    try{await prepareReview();}catch(e){resetReview();$('send-state').textContent='Cannot review: '+e.message;}
    finally{$('send-review-button').disabled=false;}
  });
  $('send-edit').addEventListener('click',()=>{$('send-review').hidden=true;resetReview();$('send-recipient').focus();});
  $('send-confirm').addEventListener('click',async()=>{
    if(!state.prepared||state.submitting)return;
    const before=state.prepared;
    try {
      // Recompute from current fields. Any edits invalidate the exact user-approved preview.
      const now=buildExtensionSend420({
        from:state.wallet.account.controller,recipient:before.recipientSnapshot.recipient,
        amount:$('send-amount').value.trim(),asset:$('send-asset').value,
        trackedAssets:state.wallet.config.trackedAssets,
      });
      if(JSON.stringify(now)!==JSON.stringify({transaction:before.transaction,summary:before.summary})||
          $('send-recipient').value.trim()!==before.recipientSnapshot.input||
          JSON.stringify(currentFeeChoice420())!==JSON.stringify(before.feeChoice)||
          before.chainId!==state.wallet.network.expectedChainId||before.epoch!==state.wallet.network.epoch||before.controller!==state.wallet.selectedAccount)
        throw new Error('Network, account or transaction changed; review again');
      state.submitting=true;$('send-confirm').disabled=true;
      $('send-state').textContent='Waiting for local passkey authorization, simulation and transaction receipt. Do not close the approval window.';
      const receipt=await command('send',{confirmed:true,chainId:before.chainId,epoch:before.epoch,account:before.controller,
        recipient:before.recipientSnapshot.input,recipientSnapshot:before.recipientSnapshot,
        amount:before.summary.amount,asset:before.asset,
        feeChoice:before.feeChoice,preflight:before.quote});
      $('send-state').textContent='Transaction submitted: '+receipt.hash+' — awaiting network confirmation.';
      resetReview();
      await refresh();screen('activity-view');
      tell('Transaction submitted. Confirmation is pending.');
    }catch(e){
      if(e?.data?.pending===true&&/^0x[0-9a-fA-F]{64}$/.test(e.data.userOpHash||'')){
        resetReview();
        await refresh();screen('activity-view');
        tell('UserOperation submitted ('+e.data.userOpHash+'). Awaiting its transaction receipt. Do not resend.','warn');
      }else{
        $('send-state').textContent='Transaction not confirmed: '+e.message;
      }
    }finally{state.submitting=false;$('send-confirm').disabled=false;}
  });
}
setup();
if(!approvalId){
  chrome.storage.onChanged?.addListener((changes,area)=>{
    if(area!=='local')return;
    if(['420-wallet-portfolio-block-v1',
      '420-wallet-networks-v1','420-wallet-origin-networks-v1','420-wallet-extension-config-v1',
      '420-wallet-ui-preferences-v1'].some(key=>Object.hasOwn(changes,key))){
      resetReview();
      refresh().catch(()=>{});
    }
  });
}
if(approvalId)approval().catch(error=>{$('status').textContent=error?.message||'Unable to load approval request.';});
else {screen('dashboard');refresh();}
