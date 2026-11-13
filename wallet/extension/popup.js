import {shortExtensionAddress420,extensionBalanceText420,extensionCanSend420,extensionReceiveAddress420,extensionNetworkLabel420,buildExtensionSend420} from './core/extension-wallet-ui.js';

const APPROVALS_KEY='420-wallet-pending-approvals-v1';
const approvalId=new URLSearchParams(location.search).get('approval');
const $=id=>document.getElementById(id);
const state={wallet:null,screen:'dashboard',prepared:null,submitting:false,epoch:0,detailAddress:null,showHidden:false};
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
function renderNFT420(){
  const list=$('nft-list');list.replaceChildren();
  const p=state.wallet?.portfolio;
  const nfts=p?.nfts?.filter(x=>x.ownership==='verified'&&!x.stale)||[];
  if(!nfts.length){
    list.append(node('p','empty',p?.status==='outage'?'NFT ownership unavailable during network outage':
      'No currently verified NFTs found in the bounded discovery window.'));
    return;
  }
  for(const nft of nfts){
    const row=node('div','asset-row');
    const info=node('div','asset-info');
    info.append(node('strong','',nft.standard+' #'+nft.tokenId),
      node('small','',nft.address),
      node('small','','Owner verified on selected chain at last refresh'));
    row.append(node('span','token-icon alt','◇'),info);list.append(row);
  }
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
    side.append(node('strong','',entry.status),node('small','',entry.hash?shortExtensionAddress420(entry.hash):'Extension activity'));
    row.append(info,side);list.append(row);
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
  $('receive-address').textContent=address||'Unavailable';
  $('copy-receive').disabled=!address;
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
  summarizeNetwork();renderAccount();renderAssets();renderNFT420();renderActivity();renderSites();renderSettings();renderReceive();
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
function prepareReview(){
  const w=state.wallet;
  if(!extensionCanSend420(w))throw new Error('Verified account owner and matching network required');
  const prepared=buildExtensionSend420({
    from:w.account.controller,
    recipient:$('send-recipient').value.trim(),amount:$('send-amount').value.trim(),
    asset:$('send-asset').value,trackedAssets:w.config.trackedAssets,
  });
  state.prepared={...prepared,asset:$('send-asset').value,chainId:w.network.expectedChainId,
    epoch:w.network.epoch,controller:w.selectedAccount};
  $('review-asset').textContent=prepared.summary.symbol;
  $('review-amount').textContent=prepared.summary.amount;
  $('review-recipient').textContent=prepared.summary.recipient;
  $('review-chain').textContent=w.network.expectedChainId;
  $('review-sender').textContent=w.account.smartAccount;
  $('send-review').hidden=false;$('send-confirm').disabled=false;
  $('send-state').textContent='Review these exact details before confirming. The next step requires local passkey authority.';
  $('send-confirm').focus();
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
  if(request.method==='eth_sendTransaction')return JSON.stringify(request.params?.[0]??{},null,2);
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
  if(Array.isArray(approval.request.availableAccounts)&&approval.request.availableAccounts.length){
    $('account-picker').hidden=false;
    $('account').replaceChildren(...approval.request.availableAccounts.map(x=>new Option(x,x)));
  }
  async function finish(approved){
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
      $('approve').disabled=false;$('reject').disabled=false;
    }
  }
  $('approve').addEventListener('click',()=>finish(true));
  $('reject').addEventListener('click',()=>finish(false)); // User rejected request when approved=false.
}
function setup(){
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
        tell('Scanned recent blocks. '+response.discovery.tokens+' ERC-20 and '+response.discovery.nfts+
          ' verified ERC-721 holdings found. Older transfers may need a separate indexer.','success');
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
  for(const back of document.querySelectorAll('[data-back]'))back.addEventListener('click',()=>screen('dashboard'));
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
  for(const id of ['send-asset','send-recipient','send-amount'])$(id).addEventListener('input',resetReview);
  $('send-form').addEventListener('submit',event=>{
    event.preventDefault();try{prepareReview();}catch(e){resetReview();$('send-state').textContent='Cannot review: '+e.message;}
  });
  $('send-edit').addEventListener('click',()=>{$('send-review').hidden=true;resetReview();$('send-recipient').focus();});
  $('send-confirm').addEventListener('click',async()=>{
    if(!state.prepared||state.submitting)return;
    const before=state.prepared;
    try {
      // Recompute from current fields. Any edits invalidate the exact user-approved preview.
      const now=buildExtensionSend420({
        from:state.wallet.account.controller,recipient:$('send-recipient').value.trim(),
        amount:$('send-amount').value.trim(),asset:$('send-asset').value,
        trackedAssets:state.wallet.config.trackedAssets,
      });
      if(JSON.stringify(now)!==JSON.stringify({transaction:before.transaction,summary:before.summary})||
          before.chainId!==state.wallet.network.expectedChainId||before.epoch!==state.wallet.network.epoch||before.controller!==state.wallet.selectedAccount)
        throw new Error('Network, account or transaction changed; review again');
      state.submitting=true;$('send-confirm').disabled=true;
      $('send-state').textContent='Waiting for local passkey authorization, simulation and transaction receipt. Do not close the approval window.';
      const receipt=await command('send',{confirmed:true,chainId:before.chainId,epoch:before.epoch,account:before.controller,
        recipient:before.summary.recipient,amount:before.summary.amount,asset:before.asset});
      $('send-state').textContent='Transaction confirmed: '+receipt.hash;
      resetReview();
      await refresh();screen('activity-view');
      tell('Transaction confirmed.');
    }catch(e){
      $('send-state').textContent='Transaction not confirmed: '+e.message;
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
