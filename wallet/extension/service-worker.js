import {quoteExtensionSend420,normalizeExtensionFeeChoice420} from './core/extension-fee-preflight.js';
import {EXTENSION_ADDRESS_BOOK_KEY_420,normalizeExtensionAddressBook420,addExtensionContact420,removeExtensionContact420} from './core/extension-address-book.js';
import {reconcileExtensionTransaction420} from './core/extension-transaction-activity.js';
import {normalizeExtensionConfig420, normalizeExtensionPreferences420, validateExtensionNetwork420, normalizeExtensionChain420, normalizeExtensionRpc420, normalizeExtensionAddress420, buildExtensionSend420, extensionCanSend420, EXTENSION_CONFIG_KEY_420, EXTENSION_UI_KEY_420, EXTENSION_ACTIVITY_KEY_420} from './core/extension-wallet-ui.js';
import {discoverSmartAccount} from './core/accounts.js';
import {readNativeBalance,readErc20Balance} from './core/portfolio.js';
import {PORTFOLIO_SETTINGS_KEY_420,PORTFOLIO_CACHE_KEY_420,PRICE_CACHE_KEY_420,
  portfolioScope420,normalizedPortfolioSettings420,checkedToken420,
  verifiedTokenMetadata420,checkedTokenBalance420,discoverTokens420,
  spamSignals420,classifyBalance420,validatePrice420,fiatValue420} from './core/extension-portfolio.js';
import {NETWORKS_KEY_420,ORIGIN_NETWORKS_KEY_420,normalizeRegistry420,normalizeNetwork420,networkFromLegacy420,chainId420,probeNetwork420,watchAsset420} from './core/network-registry.js';
const CHANNEL = '420-wallet-provider-v1';
const PERMISSIONS_KEY = '420-wallet-origin-permissions-v1';
const APPROVALS_KEY = '420-wallet-pending-approvals-v1';
const AUTHORITY_KEY = '420-wallet-pending-authority-v1';
const READ_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_call','eth_estimateGas','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs','net_version']);
const AUTHORITY_TRANSPORT_METHODS = new Set([...READ_METHODS, 'eth_sendUserOperation', 'eth_getUserOperationReceipt']);
const APPROVAL_METHODS = new Set(['eth_requestAccounts','eth_sendTransaction','personal_sign','eth_signTypedData_v4','wallet_addEthereumChain','wallet_switchEthereumChain','wallet_watchAsset']);
const LOCAL_AUTHORITY_METHODS = new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const LOCAL_AUTHORITY_SOURCE = '420-wallet-local-authority';
const NETWORK_HEALTH_KEY_420='420-wallet-network-health-v1';
const VAULT_KEY = '420-wallet-encrypted-vault-v1';
const VAULT_LEASE_KEY = '420-wallet-vault-lease-v1';
async function vaultLockState420() {
  const vault = (await chrome.storage.local.get(VAULT_KEY))?.[VAULT_KEY];
  if (!vault) return { exists: false, unlocked: false };
  const lease=(await chrome.storage.session.get(VAULT_LEASE_KEY))?.[VAULT_LEASE_KEY];
  return {exists:true,unlocked:typeof lease?.expiresAt==='number' && lease.expiresAt > Date.now() && lease.expiresAt<=Date.now()+30*60*1000};
}
async function portfolioRecord420(scope){
  const all=await readObject(PORTFOLIO_SETTINGS_KEY_420);
  return normalizedPortfolioSettings420(all[scope]||{});
}
async function savePortfolioRecord420(scope,record){
  const all=await readObject(PORTFOLIO_SETTINGS_KEY_420);
  all[scope]=normalizedPortfolioSettings420(record);
  await chrome.storage.local.set({[PORTFOLIO_SETTINGS_KEY_420]:all});
}
async function scopedPortfolio420(){
  const chain=await effectiveChain420();
  const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const account=prefs.selectedAccount;
  if(!account||!(await accountVisibility420(config.accounts)).includes(account))
    throw Object.assign(new Error('An unlocked selected account is required'),{code:4100});
  return {chain,account,scope:portfolioScope420(chain.chainId,account)};
}
async function portfolioRpc420(chain,method,params){
  const now=await effectiveChain420();
  if(now.chainId!==chain.chainId||now.epoch!==chain.epoch)throw Object.assign(new Error('Portfolio network changed'),{code:4901});
  return rpcRequest(method,params,{expectedChainId:chain.chainId});
}
async function verifiedPrice420(chain,scope,asset,settings){
  const cache=await readObject(PRICE_CACHE_KEY_420);
  const key=scope+':'+asset.address;
  const previous=cache[key];
  const now=Date.now();
  if(!settings.priceEndpoint){
    return {status:'unavailable',reason:'No approved price provider configured'};
  }
  let url;
  try{
    url=new URL(settings.priceEndpoint);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)throw new Error('Invalid provider URL');
  }catch{return {status:'unavailable',reason:'Price provider is not a valid HTTPS endpoint'};}
  // A provider only supplies data, never transaction or signing authority.
  url.searchParams.set('chainId',chain.chainId);
  url.searchParams.set('asset',asset.address);
  url.searchParams.set('currency',settings.fiatCurrency);
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    let response;
    try{response=await fetch(url.href,{method:'GET',signal:controller.signal,cache:'no-store'});}
    finally{clearTimeout(timer);}
    if(!response.ok)throw new Error('Price provider HTTP '+response.status);
    const payload=await response.json();
    const quote=validatePrice420(payload,{chainId:chain.chainId,address:asset.address,now});
    if(quote.currency!==settings.fiatCurrency)throw new Error('Fiat currency mismatch');
    cache[key]=quote;await chrome.storage.local.set({[PRICE_CACHE_KEY_420]:cache});
    return {...quote,status:quote.stale?'stale':'verified',value:quote.stale?null:fiatValue420(asset.raw,asset.decimals,quote)};
  }catch(error){
    if(previous){
      try{
        const quote=validatePrice420(previous,{chainId:chain.chainId,address:asset.address,now});
        return {...quote,status:'stale',stale:true,value:null,reason:'Price provider unavailable: '+error.message};
      }catch{}
    }
    return {status:'unavailable',reason:'Price provider unavailable: '+error.message};
  }
}
async function readAssetPortfolio420(state){
  const {selectedAccount,network,registry}=state;
  const chainId=network.expectedChainId,epoch=network.epoch;
  const noPrices={status:'unavailable',reason:'No authoritative price quote'};
  const blank={account:selectedAccount,chainId,status:'unavailable',
    checkedAt:Date.now(),blockNumber:null,currency:'CAD',native:null,tokens:[],nfts:[],priceStatus:noPrices};
  if(!selectedAccount||!chainId||network.status!=='matched')return blank;
  const balanceAccount=state.account?.smartAccount&&state.account?.deployed===true&&state.account?.ownerVerified===true?
    state.account.smartAccount:selectedAccount;
  const scope=portfolioScope420(chainId,selectedAccount),settings=await portfolioRecord420(scope);
  blank.currency=settings.fiatCurrency;blank.priceProviderConfigured=Boolean(settings.priceEndpoint);blank.priceProviderUrl=settings.priceEndpoint;
  const cache=await readObject(PORTFOLIO_CACHE_KEY_420),old=cache[scope]||{};
  const chain=await effectiveChain420();
  if(chain.chainId!==chainId||chain.epoch!==epoch)throw Object.assign(new Error('Portfolio context changed'),{code:4901});
  const provider={request:(method,params)=>portfolioRpc420(chain,method,params)};
  let block;
  try{block=BigInt(await provider.request('eth_blockNumber',[]));}catch{
    return {...blank,status:'outage',lastObserved:old.checkedAt||null,
      native:old.native?{...old.native,balance:classifyBalance420({status:'unavailable'}),stale:true,price:noPrices}:null,
      tokens:(old.tokens||[]).map(t=>({...t,balance:classifyBalance420({status:'unavailable'}),stale:true,price:noPrices})),
      nfts:(old.nfts||[]).map(n=>({...n,stale:true,ownership:'unavailable'}))};
  }
  blank.blockNumber=block.toString();
  const checkedAt=Date.now(),pending=(await readWalletUiActivity420()).filter(x=>
    x.controller===selectedAccount&&x.chainId===chainId&&['pending','submitted','included','confirming','reorganized'].includes(x.status)).length;
  const nativeNetwork=chain.network.nativeCurrency;
  let native;
  try{
    const result=await provider.request('eth_getBalance',[balanceAccount,'latest']);
    if(typeof result!=='string'||!/^0x[0-9a-fA-F]+$/.test(result))throw new Error('Invalid native balance');
    const raw=BigInt(result).toString();
    native={address:'native',symbol:nativeNetwork.symbol,decimals:nativeNetwork.decimals,raw,
      balance:classifyBalance420({raw,status:'verified',blockNumber:block.toString(),checkedAt}),
      pendingTransactions:pending,price:noPrices};
  }catch{native={address:'native',symbol:nativeNetwork.symbol,decimals:nativeNetwork.decimals,
    balance:classifyBalance420({status:'unavailable'}),pendingTransactions:pending,price:noPrices};}
  const known=new Map();
  for(const x of [...(chain.network.assets||[]),...settings.tokens]){
    try{const token=checkedToken420(x);known.set(token.address,token);}catch{}
  }
  const tokens=[];
  for(const token of [...known.values()].slice(0,60)){
    const flags=spamSignals420({...token,spam:settings.spam.includes(token.address)});
    const hidden=settings.hidden.includes(token.address)||token.hidden||flags.suspected;
    try{
      const metadata=await verifiedTokenMetadata420(provider,token.address);
      // User-submitted symbols/decimals are display hints, never verified contract metadata.
      const raw=await checkedTokenBalance420(provider,metadata,balanceAccount);
      tokens.push({...metadata,raw,source:token.source,hidden,spam:flags.suspected,
        balance:classifyBalance420({raw,status:'verified',blockNumber:block.toString(),checkedAt}),price:noPrices});
    }catch(error){
      tokens.push({...token,verified:false,hidden,spam:flags.suspected,price:noPrices,
        balance:classifyBalance420({status:'unavailable'}),error:'Token contract metadata or balance unavailable: '+error.message});
    }
  }
  const nfts=(old.nfts||[]).map(n=>({...n,ownership:'unavailable',stale:true}));
  // NFT ownership must be reverified; a cached transfer event is not proof of current ownership.
  for(let i=0;i<nfts.length;i++){
    const n=nfts[i];
    try{
      if(n.standard!=='ERC721')continue;
      const result=await provider.request('eth_call',[{to:n.address,data:'0x6352211e'+BigInt(n.tokenId).toString(16).padStart(64,'0')},'latest']);
      n.ownership=typeof result==='string'&&/^0x[0-9a-fA-F]{64}$/.test(result)&&
        ('0x'+result.slice(-40).toLowerCase())===balanceAccount?'verified':'not-owned';
      n.stale=false;
    }catch{}
  }
  const portfolio={...blank,balanceAddress:balanceAccount,status:'verified',checkedAt,blockNumber:block.toString(),native,tokens,
    nfts:nfts.filter(n=>n.ownership!=='not-owned'),lastObserved:checkedAt,priceProviderConfigured:Boolean(settings.priceEndpoint),priceProviderUrl:settings.priceEndpoint};
  const assets=[native,...tokens.filter(t=>t.balance.status!=='unavailable')];
  for(const asset of assets){
    asset.price=await verifiedPrice420(chain,scope,asset,settings);
  }
  if((await effectiveChain420()).epoch!==epoch)throw Object.assign(new Error('Network changed while reading portfolio'),{code:4901});
  cache[scope]={...portfolio};await chrome.storage.local.set({[PORTFOLIO_CACHE_KEY_420]:cache});
  return portfolio;
}
async function accountMetadata420(){
  const config=await readObject('420-wallet-extension-config-v1');
  return config.accountMeta&&typeof config.accountMeta==='object'&&!Array.isArray(config.accountMeta)?config.accountMeta:{};
}
async function accountVisibility420(accounts){
  const lock=await vaultLockState420();
  const config=await readObject('420-wallet-extension-config-v1');
  const vaultAccounts=new Set((config.vaultAccounts||[]).map(x=>String(x).toLowerCase()));
  const metadata=await accountMetadata420();
  return accounts.filter(a=>metadata[a]?.hidden!==true&&(!lock.exists||lock.unlocked||!vaultAccounts.has(String(a).toLowerCase())));
}


function normalizeOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw Object.assign(new Error('unsupported request origin'), { code: 4100 });
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Object.assign(new Error('insecure request origin'), { code: 4100 });
  return url.origin;
}

function serializeError(error) {
  return { code: Number.isInteger(error?.code) ? error.code : -32603, message: error?.message || '420 Wallet request failed', ...('data' in (error ?? {}) ? { data: error.data } : {}) };
}

async function readObject(key) {
  const stored = await chrome.storage.local.get(key);
  const value = stored?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function networkRegistry420(){
  const saved=(await chrome.storage.local.get(NETWORKS_KEY_420))?.[NETWORKS_KEY_420];
  if(saved)return normalizeRegistry420(saved);
  const config=await readObject(EXTENSION_CONFIG_KEY_420),registry=normalizeRegistry420();
  try{const legacy=networkFromLegacy420(config);
    if(legacy){registry.networks[legacy.chainId]=legacy;registry.selectedChainId=legacy.chainId;}
  }catch{}
  await chrome.storage.local.set({[NETWORKS_KEY_420]:registry});
  return registry;
}
async function effectiveChain420(origin=null){
  const registry=await networkRegistry420(),overrides=await readObject(ORIGIN_NETWORKS_KEY_420);
  const chainId=(origin&&overrides[origin])||registry.selectedChainId;
  if(!chainId||!registry.networks[chainId]?.enabled)throw Object.assign(new Error('No enabled EVM network selected'),{code:4901});
  return {registry,chainId,network:registry.networks[chainId],epoch:registry.epoch};
}
async function notifyChain420(origin,chain){
  if(!chrome.tabs?.query)return;
  const tabs=await chrome.tabs.query({});
  await Promise.all(tabs.filter(tab=>Number.isInteger(tab.id)).map(async tab=>{
    try{
      if(!origin||normalizeOrigin(tab.url)===origin)
        await chrome.tabs.sendMessage(tab.id,{source:'420-wallet-service-worker',channel:CHANNEL,kind:'event',event:'chainChanged',data:chain});
    }catch{}
  }));
}
async function changeNetwork420(chain,{origin=null}={}){
  const registry=await networkRegistry420(),key=chainId420(chain),network=registry.networks[key];
  if(!network?.enabled||!network.rpcUrls.length)throw Object.assign(new Error('Unknown or disabled EVM network'),{code:4902});
  const health=await probeNetwork420(network);
  if(!health.some(x=>x.healthy))throw Object.assign(new Error('No verified RPC endpoint on selected chain'),{code:4900});
  const before=(await effectiveChain420(origin).catch(()=>({chainId:null}))).chainId;
  if(before!==key)registry.epoch++;
  if(origin){
    const overrides=await readObject(ORIGIN_NETWORKS_KEY_420);
    const permissions=await readObject(PERMISSIONS_KEY);
    overrides[origin]=key;
    const connected=Object.hasOwn(permissions,origin);
    delete permissions[origin];
    // Network identity, epoch and account revocation are committed together.
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry,
      [ORIGIN_NETWORKS_KEY_420]:overrides,[PERMISSIONS_KEY]:permissions});
    if(connected)await notifyDisconnectedSite420(origin);
  }else{
    registry.selectedChainId=key;
    const previous=await readObject(EXTENSION_CONFIG_KEY_420);
    const same=previous.chainId&&chainId420(previous.chainId)===key;
    const config={...previous,chainId:key,rpcUrl:health.find(x=>x.healthy).url,
      explorerUrl:network.blockExplorerUrls[0]||null,networkName:network.chainName,
      trackedAssets:network.assets||[],smartAccountConfig:same?previous.smartAccountConfig:null};
    // Never publish an epoch attached to one chain and the UI config for another.
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry,[EXTENSION_CONFIG_KEY_420]:config});
  }
  if(before!==key){
    if(origin)await notifyChain420(origin,key);
    else {
      const overrides=await readObject(ORIGIN_NETWORKS_KEY_420);
      if(chrome.tabs?.query){
        for(const tab of await chrome.tabs.query({})){
          if(!Number.isInteger(tab.id))continue;
          try{
            const origin=normalizeOrigin(tab.url),effective=overrides[origin]||key;
            await chrome.tabs.sendMessage(tab.id,{source:'420-wallet-service-worker',channel:CHANNEL,kind:'event',event:'chainChanged',data:effective});
          }catch{}
        }
      }
    }
  }
  return key;
}
async function accountsFor(origin) {
  const permissions = await readObject(PERMISSIONS_KEY);
  const granted=Array.isArray(permissions[origin]?.accounts) ? permissions[origin].accounts : [];
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const allowed=await accountVisibility420(granted);
  const current=(await effectiveChain420(origin)).chainId;
  if(permissions[origin]?.chainId!==current)return [];
  return allowed.filter(a=>a===prefs.selectedAccount);
}

async function setAccounts(origin, accounts) {
  const permissions = await readObject(PERMISSIONS_KEY);
  permissions[origin] = { accounts, chainId:(await effectiveChain420(origin)).chainId, grantedAt: Date.now() };
  await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
}

async function rpcRequest(method,params=[],{origin=null,expectedChainId=null}={}){
  if(LOCAL_AUTHORITY_METHODS.has(method))throw Object.assign(new Error('sensitive wallet methods cannot use RPC signing or submission authority'),{code:4100});
  const {chainId,network}=await effectiveChain420(origin);
  if(expectedChainId&&chainId!==chainId420(expectedChainId))throw Object.assign(new Error('Network changed; discard request'),{code:4901});
  if(method==='eth_chainId')return chainId;
  if(method==='net_version')return BigInt(chainId).toString(10);
  const epoch=(await effectiveChain420(origin)).epoch;
  const failures=[];
  for(const endpoint of network.rpcUrls){
    try{
      const verified=await probeNetwork420({...network,rpcUrls:[endpoint]});
      if(!verified[0].healthy)throw new Error(verified[0].error);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      let response;
      try{response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params})});}
      finally{clearTimeout(timer);}
      if(!response.ok)throw new Error('RPC HTTP '+response.status);
      const payload=await response.json();
      if(payload.error)throw Object.assign(new Error(payload.error.message||'RPC error'),{code:payload.error.code??-32603});
      const current=await effectiveChain420(origin);
      if(current.chainId!==chainId||current.epoch!==epoch)throw Object.assign(new Error('Network changed while RPC was pending'),{code:4901});
      return payload.result;
    }catch(error){if(error.code===4901)throw error;failures.push(endpoint+': '+error.message);}
  }
  throw Object.assign(new Error('No healthy RPC on '+chainId+': '+failures.join('; ')),{code:4900});
}

async function executeWithLocalAuthority(request, context) {
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const effective=await effectiveChain420(context.origin);
  if(!effective.network.smartAccountApproved)throw Object.assign(new Error('No independently verified SmartAccount420 authority on selected EVM chain'),{code:4100});
  if(!context.chainId||effective.chainId!==context.chainId||effective.epoch!==context.epoch)
    throw Object.assign(new Error('Network context changed before signing authority'),{code:4901});
  const address=prefs.selectedAccount;
  const listed=await accountVisibility420(normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420)).accounts);
  const metadata=await accountMetadata420();
  if(!address||!listed.includes(address)||!context.accounts?.includes(address))
    throw Object.assign(new Error('Account selection or permission changed; reconnect and confirm again'),{code:4100});
  if(['watch-only','hardware','eoa'].includes(metadata[address]?.type))
    throw Object.assign(new Error('This account has no verified SmartAccount passkey signing authority in this flow'),{code:4100});
  const requestedFrom=request.method==='eth_sendTransaction'?request.params?.[0]?.from:
    request.method==='personal_sign'?request.params?.[1]:request.method==='eth_signTypedData_v4'?request.params?.[0]:null;
  if(typeof requestedFrom!=='string'||requestedFrom.toLowerCase()!==address)
    throw Object.assign(new Error('Requested signer is not the currently selected authorized account'),{code:4100});
  if (!LOCAL_AUTHORITY_METHODS.has(request.method)) {
    throw Object.assign(new Error(`unsupported local authority method: ${request.method}`), { code: 4200 });
  }
  const authorityRequestId = `authority-${context.tabId ?? 'tab'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pending = await readObject(AUTHORITY_KEY);
  pending[authorityRequestId] = {
    authorityRequestId,
    request,
    context: { origin: context.origin, chainId:context.chainId, epoch:context.epoch, accounts: context.accounts ?? [],
      tabId: context.tabId ?? null, activityId:context.activityId??null },
    createdAt: Date.now(),
  };
  await chrome.storage.local.set({ [AUTHORITY_KEY]: pending });
  await chrome.windows.create({
    url: chrome.runtime.getURL(`authority.html?request=${encodeURIComponent(authorityRequestId)}`),
    type: 'popup',
    width: 460,
    height: 680,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup().finally(() => reject(Object.assign(new Error('local wallet authority timed out'), { code: 4001 })));
    }, 120000);
    const listener = (message) => {
      if (!message || message.source !== LOCAL_AUTHORITY_SOURCE || message.kind !== 'authority-result' || message.authorityRequestId !== authorityRequestId) return;
      cleanup().then(() => {
        if (message.error) {
          reject(Object.assign(new Error(message.error.message || 'local wallet authority rejected the request'), {
            code: Number.isInteger(message.error.code) ? message.error.code : -32603,
            ...('data' in message.error ? { data: message.error.data } : {}),
          }));
          return;
        }
        if (!('result' in message)) {
          reject(Object.assign(new Error('420 Wallet local authority returned no result'), { code: -32603 }));
          return;
        }
        effectiveChain420(context.origin).then(now=>{
          if(now.chainId!==context.chainId||now.epoch!==context.epoch)throw Object.assign(new Error('Network context changed during signing'),{code:4901});
          resolve(message.result);
        }).catch(reject);
      });
    };
    async function cleanup() {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      const current = await readObject(AUTHORITY_KEY);
      delete current[authorityRequestId];
      await chrome.storage.local.set({ [AUTHORITY_KEY]: current });
    }
    chrome.runtime.onMessage.addListener(listener);
  });
}

async function createApproval(request, context) {
  const approvals = await readObject(APPROVALS_KEY);
  const approvalId = `${context.tabId ?? 'tab'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  approvals[approvalId] = { approvalId, request, context, createdAt: Date.now() };
  await chrome.storage.local.set({ [APPROVALS_KEY]: approvals });
  await chrome.windows.create({ url: chrome.runtime.getURL(`popup.html?approval=${encodeURIComponent(approvalId)}`), type: 'popup', width: 420, height: 620 });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(Object.assign(new Error('approval timed out'), { code: 4001 })); }, 120000);
    const listener = (message) => {
      if (!message || message.source !== '420-wallet-popup' || message.kind !== 'approval-result' || message.approvalId !== approvalId) return;
      cleanup();
      if (!message.approved) reject(Object.assign(new Error('User rejected the request'), { code: 4001 }));
      else resolve(message);
    };
    function cleanup() { clearTimeout(timeout); chrome.runtime.onMessage.removeListener(listener); }
    chrome.runtime.onMessage.addListener(listener);
  });
}

async function handleApprovalMethod(request, context) {
  const origin = context.origin;
  if(request.method==='wallet_addEthereumChain'){
    const raw=request.params?.[0];
    const proposed=normalizeNetwork420({...raw,enabled:true},{local:false});
    if(!proposed.rpcUrls.length)throw Object.assign(new Error('RPC endpoints required'),{code:-32602});
    const fallbackRegistry=await networkRegistry420();
    const before=await effectiveChain420(origin).catch(()=>({chainId:null,epoch:fallbackRegistry.epoch}));
    await createApproval({...request,params:[proposed]},{...context,chainId:before.chainId,epoch:before.epoch});
    if((await networkRegistry420()).epoch!==before.epoch)throw Object.assign(new Error('Network changed during add-chain approval'),{code:4901});
    const health=await probeNetwork420(proposed);
    if(health.some(x=>!x.healthy))throw Object.assign(new Error('RPC chain mismatch or unavailable'),{code:4900});
    const registry=await networkRegistry420(),old=registry.networks[proposed.chainId];
    registry.networks[proposed.chainId]={...proposed,trusted:old?.trusted===true,smartAccountApproved:false};
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry});
    return null;
  }
  if(request.method==='wallet_switchEthereumChain'){
    const chain=chainId420(request.params?.[0]?.chainId);
    const current=await effectiveChain420(origin);
    await createApproval(request,{...context,chainId:current.chainId,epoch:current.epoch});
    if((await effectiveChain420(origin)).epoch!==current.epoch)throw Object.assign(new Error('Network changed while switch approval was pending'),{code:4901});
    await changeNetwork420(chain,{origin});
    return null;
  }
  if(request.method==='wallet_watchAsset'){
    const {chainId,epoch}=await effectiveChain420(origin),asset=watchAsset420(request.params?.[0],chainId);
    await createApproval(request,{...context,chainId,epoch});
    const after=await effectiveChain420(origin);
    if(after.chainId!==chainId||after.epoch!==epoch)throw Object.assign(new Error('Chain changed during asset approval'),{code:4901});
    const code=await rpcRequest('eth_getCode',[asset.address,'latest'],{origin,expectedChainId:chainId});
    if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||/^0x0*$/i.test(code))throw new Error('Token contract is not deployed');
    const registry=await networkRegistry420(),tokens=registry.networks[chainId].assets||[];
    registry.networks[chainId].assets=[...tokens.filter(x=>x.address!==asset.address),asset].slice(0,25);
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry});
    return true;
  }
  if (request.method === 'eth_accounts') return accountsFor(origin);
  if (request.method === 'eth_requestAccounts') {
    const existing = await accountsFor(origin);
    if (existing.length) return existing;
    const config = await readObject('420-wallet-extension-config-v1');
    const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
    const available = (await accountVisibility420(Array.isArray(config.accounts) ? config.accounts : [])).filter(a=>a===prefs.selectedAccount);
    if (!available.length) throw Object.assign(new Error('no wallet accounts available'), { code: 4100 });
    const before=await effectiveChain420(origin),pinned=before.chainId;
    const decision = await createApproval({ ...request, availableAccounts: available },{...context,chainId:pinned,epoch:before.epoch});
    const selected = Array.isArray(decision.accounts)&&decision.accounts.length?decision.accounts:available;
    if(selected.length!==1||selected[0]!==prefs.selectedAccount)
      throw Object.assign(new Error('Approval account no longer matches the selection'),{code:4100});
    const after=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
    const afterNetwork=await effectiveChain420(origin);
    if(afterNetwork.chainId!==pinned||afterNetwork.epoch!==before.epoch)throw Object.assign(new Error('Network changed during connect approval'),{code:4901});
    if(after.selectedAccount!==prefs.selectedAccount)throw Object.assign(new Error('Account changed during approval'),{code:4100});
    await setAccounts(origin, selected);
    chrome.tabs.sendMessage(context.tabId, { source: '420-wallet-service-worker', channel: CHANNEL, kind: 'event', event: 'accountsChanged', data: selected }).catch(() => {});
    return selected;
  }
  const granted = await accountsFor(origin);
  if (!granted.length) throw Object.assign(new Error('origin is not connected to 420 Wallet'), { code: 4100 });
  const before=await effectiveChain420(origin),pinned=before.chainId;
  await createApproval(request, { ...context, accounts: granted,chainId:pinned,epoch:before.epoch });
  if((await effectiveChain420(origin)).epoch!==before.epoch)throw Object.assign(new Error('Chain changed during approval'),{code:4901});
  const current=await accountsFor(origin);
  if(current.length!==1||current[0]!==granted[0])throw Object.assign(new Error('Account was changed or disconnected during approval'),{code:4100});
  return executeWithLocalAuthority(request, { ...context, accounts: current,chainId:pinned,epoch:before.epoch });
}


/* The popup owns presentation only. The service worker revalidates every read and
   action. No popup-origin message is accepted from content scripts or web pages. */
function trustedWalletPopup420(sender) {
  if(sender?.id!==chrome.runtime.id||typeof sender.url!=='string')return false;
  try {
    const url=new URL(sender.url);
    return url.href.split('?')[0]===chrome.runtime.getURL('popup.html') && !url.hash;
  }catch{return false;}
}
async function readWalletUiActivity420() {
  const value=(await chrome.storage.local.get(EXTENSION_ACTIVITY_KEY_420))?.[EXTENSION_ACTIVITY_KEY_420];
  return Array.isArray(value)?value.slice(0,40).filter(x=>x&&typeof x==='object'):[];
}
// Reconcile only canonical receipts. Missing receipts cannot prove a dropped or failed transaction.
const validHash420=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
async function refreshWalletUiActivity420() {
  const entries=await readWalletUiActivity420();
  const candidates=entries.filter(x=>['submitted','pending','confirming','included','reorganized'].includes(x.status)&&
    (validHash420(x.hash)||validHash420(x.userOpHash))).slice(0,5);
  if(!candidates.length)return entries;
  let chain;
  try{chain=await effectiveChain420();}catch{return entries;}
  let changed=false;
  const updates=new Map();
  for(const entry of candidates){
    if(entry.chainId!==chain.chainId)continue;
    try{
      const provider={request:(method,params=[])=>rpcRequest(method,params,{expectedChainId:entry.chainId})};
      let current=entry;
      if(!validHash420(current.hash)&&validHash420(current.userOpHash)){
        const receipt=await provider.request('eth_getUserOperationReceipt',[current.userOpHash]);
        const receiptHash=receipt?.receipt?.transactionHash??receipt?.transactionHash;
        if(validHash420(receiptHash))current={...current,hash:receiptHash.toLowerCase()};
      }
      if(!validHash420(current.hash))continue;
      const reconciled=await reconcileExtensionTransaction420(current,{provider,chainId:entry.chainId,confirmations:2});
      if(reconciled.status!==entry.status||reconciled.hash!==entry.hash){
        updates.set(entry.id,{...reconciled,updatedAt:Date.now()});
        changed=true;
      }
    }catch{ /* RPC outages retain the last known status, never fabricate failure. */ }
  }
  if(!changed)return entries;
  const fresh=await readWalletUiActivity420();
  const next=fresh.map(x=>updates.has(x.id)&&
    (x.hash===updates.get(x.id).hash||(!x.hash&&x.userOpHash===updates.get(x.id).userOpHash))&&
    !['confirmed','reverted','cancelled','replaced','dropped'].includes(x.status)?updates.get(x.id):x);
  await chrome.storage.local.set({[EXTENSION_ACTIVITY_KEY_420]:next});
  return next;
}
async function recordAuthoritySubmission420(sender,requestId,submission){
  const address=chrome.runtime.getURL('authority.html');
  if(sender?.id!==chrome.runtime.id||typeof sender?.url!=='string'||
     !sender.url.startsWith(address+'?'))throw Object.assign(new Error('Unauthorized authority submission'),{code:4100});
  const actual=new URL(sender.url).searchParams.get('request');
  if(actual!==requestId)throw Object.assign(new Error('Authority request identity mismatch'),{code:4100});
  const pending=await readObject(AUTHORITY_KEY),request=pending[requestId];
  if(!request||request.context?.chainId!==(await effectiveChain420(request.context.origin)).chainId)
    throw Object.assign(new Error('Stale or missing authority request'),{code:4901});
  if(!validHash420(submission?.userOpHash)||!/^0x[0-9a-fA-F]{1,64}$/.test(submission?.nonce??'')||
      !/^0x[0-9a-fA-F]{64}$/.test(submission?.gasFees??'')||
      !/^0x[0-9a-fA-F]{40}$/.test(submission?.sender??'')||
      !/^0x[0-9a-fA-F]{40}$/.test(submission?.entryPoint??''))
    throw Object.assign(new Error('Unverified UserOperation submission metadata'),{code:-32602});
  const id=request.context.activityId;
  if(!id)return true; // dApp-origin activity is tracked separately when the origin owns the request.
  const activities=await readWalletUiActivity420();
  const entry=activities.find(x=>x.id===id&&x.chainId===request.context.chainId&&
    x.controller===request.context.accounts?.[0]);
  if(!entry)throw Object.assign(new Error('Pending activity was not found'),{code:-32603});
  await rememberWalletUiActivity420({...entry,
    executionModel:'erc4337',status:'submitted',submittedAt:Date.now(),
    userOpHash:submission.userOpHash.toLowerCase(),
    sender:submission.sender.toLowerCase(),entryPoint:submission.entryPoint.toLowerCase(),
    entryPointVersion:'0.7',nonce:submission.nonce,nonceKey:submission.nonceKey,
    nonceSequence:submission.nonceSequence,gasFees:submission.gasFees.toLowerCase(),
    maxPriorityFeePerGas:'0x'+BigInt('0x'+submission.gasFees.slice(2,34)).toString(16),
    maxFeePerGas:'0x'+BigInt('0x'+submission.gasFees.slice(34,66)).toString(16),
    callData:submission.callData,initCode:submission.initCode,target:submission.target,
    value:submission.value,data:submission.data
  });
  return true;
}
async function rememberWalletUiActivity420(entry) {
  const current=await readWalletUiActivity420();
  const previous=current.find(x=>x.id===entry.id);
  const next=[{...previous,...entry},...current.filter(x=>x.id!==entry.id)].slice(0,40);
  await chrome.storage.local.set({[EXTENSION_ACTIVITY_KEY_420]:next});
}
async function finalizeWalletUiState420(state){
  const now=await networkRegistry420();
  if(now.epoch!==state.network.epoch||now.selectedChainId!==state.registry.selectedChainId)
    throw Object.assign(new Error('Network changed while reading wallet state; refresh it again'),{code:4901});
  if(state.network.status==='matched'){
    try{state.portfolio=await readAssetPortfolio420(state);}
    catch(error){
      if(error.code===4901)throw error;
      state.portfolio={status:'outage',reason:error.message,account:state.selectedAccount,
        chainId:state.network.expectedChainId,native:null,tokens:[],nfts:[],currency:'CAD'};
    }
  }else{
    state.portfolio={status:state.network.status,account:state.selectedAccount,chainId:state.network.expectedChainId,
      native:null,tokens:[],nfts:[],currency:'CAD',priceStatus:{status:'unavailable'}};
  }
  const latest=await networkRegistry420();
  if(latest.epoch!==state.network.epoch||latest.selectedChainId!==state.registry.selectedChainId)
    throw Object.assign(new Error('Network changed during portfolio refresh'),{code:4901});
  return state;
}
async function walletUiState420() {
  const registry=await networkRegistry420();
  const active=await effectiveChain420().catch(()=>null);
  const raw=await readObject(EXTENSION_CONFIG_KEY_420);
  const config=normalizeExtensionConfig420({...raw,chainId:active?.chainId||null,
    rpcUrl:active?.network.rpcUrls[0]||null,explorerUrl:active?.network.blockExplorerUrls[0]||null,
    networkName:active?.network.chainName||'420 Integrated',
    trackedAssets:active?.network.assets||[],
    smartAccountConfig:raw.chainId===active?.chainId?raw.smartAccountConfig:null});
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const available=await accountVisibility420(config.accounts);
  const selected=available.includes(prefs.selectedAccount)?prefs.selectedAccount:available[0]||null;
  const accountMeta=await accountMetadata420();
  const permissions=await readObject(PERMISSIONS_KEY);
  const originNetworks=await readObject(ORIGIN_NETWORKS_KEY_420);
  const sites=Object.entries({...Object.fromEntries(Object.keys(originNetworks).map(origin=>[origin,{accounts:[]}])),...permissions}).filter(([origin,x])=>{
    try {normalizeOrigin(origin);return Array.isArray(x?.accounts);}catch{return false;}
  }).map(([origin,x])=>{
    const chainId=originNetworks[origin]||registry.selectedChainId;
    return {origin,chainId,
      accounts:x.chainId===chainId?x.accounts.filter(a=>typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a)):[]};
  }).sort((a,b)=>a.origin.localeCompare(b.origin));
  const state={
    registry,
    config:{rpcUrl:config.rpcUrl,chainId:config.chainId,explorerUrl:config.explorerUrl,networkName:config.networkName,
      accounts:available,accountMeta,trackedAssets:config.trackedAssets.slice(0,25),
      nativeCurrency:active?.network.nativeCurrency||{name:'420',symbol:'420',decimals:18},
      vaultAccounts:(await readObject(EXTENSION_CONFIG_KEY_420)).vaultAccounts||[],
      factoryAddress:config.smartAccountConfig?.factoryAddress||null},
    addressBook:normalizeExtensionAddressBook420((await chrome.storage.local.get(EXTENSION_ADDRESS_BOOK_KEY_420))?.[EXTENSION_ADDRESS_BOOK_KEY_420]),
    selectedAccount:selected,sites,activity:(await refreshWalletUiActivity420()).filter(x=>x.controller===selected&&(!config.chainId||x.chainId===config.chainId)),
    vault:await vaultLockState420(),
    network:{status:'unconfigured',name:config.networkName,expectedChainId:config.chainId,observedChainId:null,health:[],epoch:registry.epoch},
    account:{controller:selected,smartAccount:null,deployed:false,ownerVerified:false,reason:'Approved SmartAccount configuration and network required'},
    assets:{native:null,tokens:[]},
  };
  if(!config.rpcUrl||!config.chainId)return finalizeWalletUiState420(state);
  let expected;
  try {expected=validateExtensionNetwork420(config);}catch(e){state.network={...state.network,status:'error',message:e.message};return finalizeWalletUiState420(state);}
  try {
    state.network.health=await probeNetwork420(active.network);
    if(!state.network.health.some(x=>x.healthy)){
      const mismatch=state.network.health.some(x=>/different chain ID|chain mismatch/i.test(x.error||''));
      state.network.status=mismatch?'wrong-chain':'error';
      state.network.message=mismatch?'RPC endpoint is connected to a different EIP-155 chain; switching and signing blocked':
        'No healthy RPC endpoint on this chain';
      return finalizeWalletUiState420(state);
    }
    const chain=normalizeExtensionChain420(await rpcRequest('eth_chainId',[]));
    state.network.observedChainId=chain;
    if(chain!==expected.chainId){
      state.network.status='wrong-chain';
      state.network.message='RPC chain does not match the configured expected chain';
      return finalizeWalletUiState420(state);
    }
    state.network.status='matched';
    if(!selected){state.account.reason='No controller account provisioned by Wallet Core';return finalizeWalletUiState420(state);}
    if(accountMeta[selected]?.type==='watch-only'||accountMeta[selected]?.type==='hardware'||state.config.vaultAccounts.some(a=>typeof a==='string'&&a.toLowerCase()===selected.toLowerCase())){
      const provider={request:(method,params)=>rpcRequest(method,params)};
      const kind=accountMeta[selected]?.type||'eoa';
      state.account={kind,controller:selected,smartAccount:null,receiveAddress:selected,
        deployed:false,ownerVerified:false,
        reason:kind==='watch-only'?'Read-only account. Sending and signing are permanently disabled.':
          kind==='hardware'?'Hardware signature requires verified external device transport; unavailable.':
          'Locally encrypted EOA. No SmartAccount passkey authority is inherited.'};
      try{
        const native=await readNativeBalance(provider,selected);
        state.assets.native={raw:native.raw.toString(),decimals:active.network.nativeCurrency.decimals,symbol:active.network.nativeCurrency.symbol};
        for(const token of config.trackedAssets.slice(0,25)){
          try{
            const balance=await readErc20Balance(provider,token,selected);
            state.assets.tokens.push({address:balance.address,raw:balance.raw.toString(),decimals:balance.decimals,symbol:balance.symbol});
          }catch(error){
            state.assets.tokens.push({address:token.address,symbol:token.symbol||'Token',error:'Token balance unavailable: '+error.message});
          }
        }
      }catch(error){
        state.assets={native:null,tokens:[]};
        state.account.reason='EOA balance read failed: '+error.message;
      }
      return finalizeWalletUiState420(state);
    }
    if(!active.network.smartAccountApproved||!config.smartAccountConfig?.factoryAddress){
      state.account.reason='SmartAccount420 execution disabled until chain deployment and account authority are independently verified';return finalizeWalletUiState420(state);
    }
    const provider={request:(method,params)=>rpcRequest(method,params)};
    const discovered=await discoverSmartAccount(provider,selected,config.smartAccountConfig);
    state.account={
      controller:selected,smartAccount:discovered.smartAccount,
      deployed:discovered.deployed===true,ownerVerified:discovered.controllerIsOwner===true,
      reason:discovered.deployed?(discovered.controllerIsOwner?'Deployed SmartAccount discovered; controller matches owner. Deployment provenance requires approved configuration.':'Controller is not the current account owner'):'Counterfactual account; not yet deployed',
    };
    const native=await readNativeBalance(provider,discovered.smartAccount);
    state.assets.native={raw:native.raw.toString(),decimals:active.network.nativeCurrency.decimals,symbol:active.network.nativeCurrency.symbol};
    for(const asset of config.trackedAssets.slice(0,25)){
      try {
        const token=await readErc20Balance(provider,asset,discovered.smartAccount);
        state.assets.tokens.push({address:token.address,raw:token.raw.toString(),decimals:token.decimals,symbol:token.symbol});
      }catch(error){
        state.assets.tokens.push({address:asset.address,symbol:asset.symbol||'Token',error:'Token balance unavailable: '+error.message});
      }
    }
    return finalizeWalletUiState420(state);
  }catch(error){
    state.network.status='error';
    state.network.message='Wallet discovery or RPC verification failed: '+error.message;
    state.account.smartAccount=null;
    state.assets={native:null,tokens:[]};
    return finalizeWalletUiState420(state);
  }
}
async function aggregateAssets420(){
  const registry=await networkRegistry420(),config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  if(!prefs.selectedAccount||!(await accountVisibility420(config.accounts)).includes(prefs.selectedAccount))return [];
  const output=[];
  for(const network of Object.values(registry.networks).filter(n=>n.enabled&&n.rpcUrls.length).slice(0,12)){
    const health=await probeNetwork420(network),endpoint=health.find(x=>x.healthy)?.url;
    if(!endpoint){output.push({chainId:network.chainId,name:network.chainName,status:'unavailable'});continue;}
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[prefs.selectedAccount,'latest']})});
      const data=await response.json();
      if(!response.ok||data.error||!/^0x[0-9a-fA-F]+$/.test(data.result))throw new Error('Balance unavailable');
      const tokens=[];
      for(const token of (network.assets||[]).slice(0,8)){
        try{
          const method='0x70a08231'+prefs.selectedAccount.slice(2).padStart(64,'0');
          const balance=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({jsonrpc:'2.0',id:2,method:'eth_call',params:[{to:token.address,data:method},'latest']})});
          const result=await balance.json();
          if(!balance.ok||result.error||!/^0x[0-9a-fA-F]{64}$/.test(result.result))throw new Error('Invalid token balance');
          tokens.push({address:token.address,symbol:token.symbol,decimals:token.decimals,raw:BigInt(result.result).toString()});
        }catch{tokens.push({address:token.address,symbol:token.symbol,status:'unavailable'});}
      }
      output.push({chainId:network.chainId,name:network.chainName,symbol:network.nativeCurrency.symbol,
        decimals:network.nativeCurrency.decimals,raw:BigInt(data.result).toString(),tokens,status:'verified'});
    }catch{output.push({chainId:network.chainId,name:network.chainName,status:'unavailable'});}
  }
  return output;
}
async function notifyDisconnectedSite420(origin) {
  if(!chrome.tabs?.query)return;
  const tabs=await chrome.tabs.query({});
  await Promise.all(tabs.filter(tab=>Number.isInteger(tab.id)).map(async tab=>{
    try {
      if(normalizeOrigin(tab.url)===origin) await chrome.tabs.sendMessage(tab.id,{
        source:'420-wallet-service-worker',channel:CHANNEL,kind:'event',event:'accountsChanged',data:[]
      });
    }catch{}
  }));
}
async function switchSelectedAccount420(value){
  const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
  const account=normalizeExtensionAddress420(value);
  if(!(await accountVisibility420(config.accounts)).includes(account))
    throw Object.assign(new Error('Account is hidden, locked or not provisioned'),{code:4100});
  const previous=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420)).selectedAccount;
  await chrome.storage.local.set({[EXTENSION_UI_KEY_420]:{selectedAccount:account}});
  if(previous!==account){
    const permissions=await readObject(PERMISSIONS_KEY);
    for(const [origin,grant] of Object.entries(permissions)){
      if(!Array.isArray(grant?.accounts))continue;
      // Every account switch invalidates prior website grants. Reconnection is explicit.
      delete permissions[origin];
      await notifyDisconnectedSite420(origin);
    }
    await chrome.storage.local.set({[PERMISSIONS_KEY]:permissions});
  }
  return walletUiState420();
}
async function handleWalletUi420(message) {
  const kind=message.kind;
  if(kind==='get-state')return walletUiState420();
  if(kind==='addressbook-save'||kind==='addressbook-delete'){
    const chain=await effectiveChain420();
    if(message.chainId!==chain.chainId)throw Object.assign(new Error('Network changed; refresh contacts'),{code:4901});
    const previous=normalizeExtensionAddressBook420(
      (await chrome.storage.local.get(EXTENSION_ADDRESS_BOOK_KEY_420))?.[EXTENSION_ADDRESS_BOOK_KEY_420]);
    const next=kind==='addressbook-save'
      ?addExtensionContact420(previous,{label:message.label,address:message.address,chainId:chain.chainId})
      :removeExtensionContact420(previous,{address:message.address,chainId:chain.chainId});
    await chrome.storage.local.set({[EXTENSION_ADDRESS_BOOK_KEY_420]:next});
    return walletUiState420();
  }
  if(kind==='site-network'){
    const origin=normalizeOrigin(message.origin);
    await changeNetwork420(message.chainId,{origin});return walletUiState420();
  }
  if(kind==='switch-network'){await changeNetwork420(message.chainId);return walletUiState420();}
  if(kind==='add-network'){
    const network=normalizeNetwork420({...message.network,enabled:true},{local:true});
    if(!network.rpcUrls.length)throw new Error('At least one RPC endpoint required');
    const health=await probeNetwork420(network);
    if(health.some(x=>!x.healthy))throw new Error('Every supplied RPC endpoint must match the expected chain');
    const registry=await networkRegistry420();
    registry.networks[network.chainId]={...network,trusted:registry.networks[network.chainId]?.trusted===true,smartAccountApproved:false};
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry});
    return walletUiState420();
  }
  if(kind==='network-health'){
    const registry=await networkRegistry420();
    return Promise.all(Object.values(registry.networks).map(async network=>({
      chainId:network.chainId,health:network.enabled?await probeNetwork420(network):[]
    })));
  }
  if(kind==='aggregate-assets')return aggregateAssets420();
  if(kind==='portfolio-import'){
    const {chain,account,scope}=await scopedPortfolio420();
    const provider={request:(method,params)=>portfolioRpc420(chain,method,params)};
    const input=normalizeExtensionAddress420(message.address);
    const metadata=await verifiedTokenMetadata420(provider,input);
    const record=await portfolioRecord420(scope);
    record.tokens=[...record.tokens.filter(x=>x.address!==metadata.address),
      {...metadata,source:'imported'}].slice(0,60);
    record.hidden=record.hidden.filter(x=>x!==metadata.address);
    await savePortfolioRecord420(scope,record);
    return walletUiState420();
  }
  if(kind==='portfolio-visibility'){
    const {scope}=await scopedPortfolio420();
    const address=normalizeExtensionAddress420(message.address);
    if(typeof message.hidden!=='boolean'&&typeof message.spam!=='boolean')
      throw new Error('Explicit hide or spam choice required');
    const record=await portfolioRecord420(scope);
    if(typeof message.hidden==='boolean')record.hidden=message.hidden?
      [...new Set([...record.hidden,address])]:record.hidden.filter(a=>a!==address);
    if(typeof message.spam==='boolean')record.spam=message.spam?
      [...new Set([...record.spam,address])]:record.spam.filter(a=>a!==address);
    await savePortfolioRecord420(scope,record);
    return walletUiState420();
  }
  if(kind==='portfolio-provider'){
    const {scope}=await scopedPortfolio420();
    const record=await portfolioRecord420(scope);
    if(message.url){
      const url=new URL(message.url);
      if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)
        throw new Error('Price provider requires an HTTPS endpoint without credentials or query');
      record.priceEndpoint=url.href;
    }else record.priceEndpoint=null;
    if(!/^(CAD|USD|EUR|GBP)$/.test(message.currency))throw new Error('Unsupported fiat currency');
    record.fiatCurrency=message.currency;
    await savePortfolioRecord420(scope,record);
    return walletUiState420();
  }
  if(kind==='portfolio-discover'){
    const {chain,account,scope}=await scopedPortfolio420(),record=await portfolioRecord420(scope);
    const provider={request:(method,params)=>portfolioRpc420(chain,method,params)};
    const latest=BigInt(await provider.request('eth_blockNumber',[])),from=BigInt(record.discoveryFrom);
    const start=from>latest?latest:from;
    const bounded=latest-start>2048n?latest-2048n:start;
    const found=await discoverTokens420(provider,account,{fromBlock:bounded,toBlock:latest,maxSpan:2048n});
    const known=new Map(record.tokens.map(x=>[x.address,x]));
    for(const token of found.tokens){
      const current=known.get(token.address);
      known.set(token.address,{...token,source:current?.source||'discovered'});
    }
    record.tokens=[...known.values()].slice(0,60);
    record.discoveryFrom=(latest+1n).toString();
    await savePortfolioRecord420(scope,record);
    const cache=await readObject(PORTFOLIO_CACHE_KEY_420);
    const previous=cache[scope]||{};
    const nfts=new Map((previous.nfts||[]).map(x=>[x.address+':'+x.tokenId,x]));
    for(const nft of found.nfts)nfts.set(nft.address+':'+nft.tokenId,{...nft,ownership:'verified',stale:false});
    cache[scope]={...previous,nfts:[...nfts.values()].slice(0,100)};
    await chrome.storage.local.set({[PORTFOLIO_CACHE_KEY_420]:cache});
    return {discovery:{...found,tokens:found.tokens.length,nfts:found.nfts.length},
      state:await walletUiState420()};
  }
  if(kind==='portfolio-refresh')return walletUiState420();
  if(kind==='set-account'){
    return switchSelectedAccount420(message.account);
  }
  if(kind==='disconnect-site'){
    const origin=normalizeOrigin(message.origin);
    const permissions=await readObject(PERMISSIONS_KEY);
    // A site with only a per-origin network override is still disconnectable.
    delete permissions[origin];
    await chrome.storage.local.set({[PERMISSIONS_KEY]:permissions});
    const overrides=await readObject(ORIGIN_NETWORKS_KEY_420);
    if(Object.hasOwn(overrides,origin)){delete overrides[origin];await chrome.storage.local.set({[ORIGIN_NETWORKS_KEY_420]:overrides});}
    await notifyDisconnectedSite420(origin);
    return walletUiState420();
  }
  if(kind==='save-network'){
    const rpcUrl=normalizeExtensionRpc420(message.rpcUrl);
    const chainId=normalizeExtensionChain420(message.chainId);
    let explorerUrl=null;
    if(message.explorerUrl){
      const url=new URL(message.explorerUrl);
      if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Explorer must use HTTPS');
      if(url.username||url.password)throw new Error('Explorer credentials cannot be stored');
      explorerUrl=url.href;
    }
    const registry=await networkRegistry420(),existing=registry.networks[chainId];
    const proposal=normalizeNetwork420({chainId,chainName:existing?.chainName||'Custom EVM network',
      nativeCurrency:existing?.nativeCurrency||{name:'Ether',symbol:'ETH',decimals:18},
      rpcUrls:[rpcUrl],blockExplorerUrls:explorerUrl?[explorerUrl]:[],enabled:true},{local:true});
    if((await probeNetwork420(proposal)).some(x=>!x.healthy))throw new Error('RPC chain verification failed');
    registry.networks[chainId]={...proposal,trusted:existing?.trusted===true,smartAccountApproved:false};
    registry.epoch++;
    await chrome.storage.local.set({[NETWORKS_KEY_420]:registry});
    await changeNetwork420(chainId);
    return walletUiState420();
  }
  if(kind==='send-preflight'){
    const state=await walletUiState420();
    if(state.network.expectedChainId!==message.chainId||state.network.epoch!==message.epoch||
       state.selectedAccount!==message.account||!extensionCanSend420(state))
      throw Object.assign(new Error('Account, signing authority or network changed'),{code:4901});
    const transaction=buildExtensionSend420({
      from:state.account.controller,recipient:message.recipient,amount:message.amount,
      asset:message.asset,
      trackedAssets:state.portfolio?.tokens?.filter(t=>t.verified&&!t.hidden&&!t.spam&&t.balance?.status==='spendable')||[],
    });
    const quote=await quoteExtensionSend420(
      {request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})},
      {chainId:state.network.expectedChainId,smartAccount:state.account.smartAccount,
       transaction:transaction.transaction,choice:normalizeExtensionFeeChoice420(message.feeChoice)});
    const current=await effectiveChain420();
    if(current.chainId!==message.chainId||current.epoch!==message.epoch)
      throw Object.assign(new Error('Chain changed during preflight'),{code:4901});
    return {transaction,quote};
  }
  if(kind==='send'){
    if(message.confirmed!==true)throw Object.assign(new Error('Explicit transaction confirmation required'),{code:4001});
    const state=await walletUiState420();
    if(state.network.expectedChainId!==message.chainId||state.network.epoch!==message.epoch||state.selectedAccount!==message.account)
      throw Object.assign(new Error('Network or account changed since review'),{code:4901});
    if(!extensionCanSend420(state))throw Object.assign(new Error('Verified deployed SmartAccount owner and matching chain required'),{code:4100});
    const request=buildExtensionSend420({
      from:state.account.controller,recipient:message.recipient,amount:message.amount,
      asset:message.asset,trackedAssets:state.portfolio?.tokens?.filter(t=>t.verified&&!t.hidden&&!t.spam&&t.balance?.status!=='unavailable')||[],
    });
    const choice=normalizeExtensionFeeChoice420(message.feeChoice);
    const quote=await quoteExtensionSend420(
      {request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})},
      {chainId:state.network.expectedChainId,smartAccount:state.account.smartAccount,
       transaction:request.transaction,choice});
    if(!message.preflight||message.preflight.chainId!==quote.chainId||
       message.preflight.from!==quote.from||message.preflight.to!==quote.to||
       message.preflight.gasFees!==quote.gasFees||message.preflight.blockHash!==quote.blockHash)
      throw Object.assign(new Error('Preflight changed since review; review transaction again'),{code:4001});
    const id='wallet-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    const entry={id,at:Date.now(),chainId:state.network.expectedChainId,
      controller:state.account.controller,smartAccount:state.account.smartAccount,
      recipient:request.summary.recipient,amount:request.summary.amount,
      symbol:request.summary.symbol,status:'pending',hash:null};
    await rememberWalletUiActivity420(entry);
    let hash=null;
    try {
      hash=await executeWithLocalAuthority(
        {method:'eth_sendTransaction',params:[{...request.transaction,gasFees:quote.gasFees,feeChoice:choice.level}]},
        {origin:null,chainId:state.network.expectedChainId,epoch:state.network.epoch,accounts:[state.account.controller],tabId:null,activityId:id}
      );
      const current=await effectiveChain420();
      if(current.chainId!==entry.chainId||current.epoch!==state.network.epoch)throw Object.assign(new Error('Chain changed during transaction'),{code:4901});
      // A hash confirms submission only. Inclusion/finality must be verified from a canonical receipt.
      await rememberWalletUiActivity420({...entry,status:'submitted',hash});
      return {hash,status:'submitted'};
    }catch(error){
      const userOpHash=validHash420(error?.data?.userOpHash)?error.data.userOpHash.toLowerCase():null;
      await rememberWalletUiActivity420({...entry,status:(hash||userOpHash)?'submitted':'failed',hash,userOpHash,
        error:error?.message||'Authorization failed'});
      throw error;
    }
  }
  throw Object.assign(new Error('Unsupported wallet popup action'),{code:4200});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message?.source==='420-wallet-popup-ui'){
    (async()=>{
      try {
        if(!trustedWalletPopup420(sender))throw Object.assign(new Error('Untrusted wallet UI caller'),{code:4100});
        sendResponse({result:await handleWalletUi420(message)});
      }catch(error){sendResponse({error:serializeError(error)});}
    })();
    return true;
  }


  if(message?.source==='420-wallet-manager-ui'&&message.kind==='set-account'){
    (async()=>{try{
      if(sender?.id!==chrome.runtime.id||sender?.url!==chrome.runtime.getURL('wallet.html'))throw Object.assign(new Error('Untrusted account manager'),{code:4100});
      sendResponse({result:await switchSelectedAccount420(message.account)});
    }catch(error){sendResponse({error:serializeError(error)});}})();
    return true;
  }
  if (message?.source==='420-wallet-authority-ui'&&message.kind==='authority-submitted'){
    (async()=>{try{
      sendResponse({result:await recordAuthoritySubmission420(sender,message.authorityRequestId,message.submission)});
    }catch(error){sendResponse({error:serializeError(error)});}})();
    return true;
  }
  if (message?.source === '420-wallet-authority-ui' && message.kind === 'authority-rpc') {
    (async () => {
      try {
        const expected = chrome.runtime.getURL('authority.html');
        if (!sender?.url?.startsWith(expected)) throw Object.assign(new Error('authority RPC caller is not trusted extension UI'), { code: 4100 });
        const request = message.request;
        if (!request || !AUTHORITY_TRANSPORT_METHODS.has(request.method)) {
          throw Object.assign(new Error(`unsupported authority transport method: ${request?.method}`), { code: 4200 });
        }
        const pending=await readObject(AUTHORITY_KEY);
        const requestId=new URL(sender.url).searchParams.get('request'),approval=pending[requestId];
        const effective=await effectiveChain420(approval?.context?.origin);
        if(!approval?.context?.chainId||effective.chainId!==approval.context.chainId||effective.epoch!==approval.context.epoch)
          throw Object.assign(new Error('Network changed; authority request cancelled'),{code:4901});
        const result=await rpcRequest(request.method,request.params??[],{origin:approval.context.origin,expectedChainId:approval.context.chainId});
        sendResponse({ result });
      } catch (error) {
        sendResponse({ error: serializeError(error) });
      }
    })();
    return true;
  }

  if (!message || message.source !== '420-wallet-content' || message.channel !== CHANNEL || message.kind !== 'rpc') return;
  (async () => {
    try {
      const request = message.request;
      const origin = normalizeOrigin(message.origin);
      const senderOrigin = normalizeOrigin(sender?.url ?? sender?.tab?.url);
      if (origin !== senderOrigin || (sender?.frameId ?? 0) !== 0) throw Object.assign(new Error('request origin is not authorized'), { code: 4100 });
      const context = { origin, tabId: sender?.tab?.id ?? null, frameId: sender?.frameId ?? 0, method: request.method };
      let result;
      if (READ_METHODS.has(request.method)) result = await rpcRequest(request.method,request.params??[],{origin});
      else if (request.method === 'eth_accounts' || APPROVAL_METHODS.has(request.method)) result = await handleApprovalMethod(request, context);
      else throw Object.assign(new Error(`unsupported provider method: ${request.method}`), { code: 4200 });
      sendResponse({ id: request.id, result });
    } catch (error) {
      sendResponse({ id: message?.request?.id ?? null, error: serializeError(error) });
    }
  })();
  return true;
});

const PORTFOLIO_BLOCK_KEY_420='420-wallet-portfolio-block-v1';
async function monitorPortfolioBlocks420(){
  try{
    const {chain,account,scope}=await scopedPortfolio420();
    if(!chain.network.rpcUrls.length)return;
    const height=await portfolioRpc420(chain,'eth_blockNumber',[]);
    const previous=await readObject(PORTFOLIO_BLOCK_KEY_420);
    if(previous[scope]!==height){
      previous[scope]=height;
      await chrome.storage.local.set({[PORTFOLIO_BLOCK_KEY_420]:previous});
    }
  }catch{} // Outage cannot create a synthetic balance.
}
async function monitorNetworks420(){
  const registry=await networkRegistry420(),snapshots={};
  for(const network of Object.values(registry.networks).filter(n=>n.enabled)){
    snapshots[network.chainId]={checkedAt:Date.now(),endpoints:await probeNetwork420(network)};
  }
  await chrome.storage.local.set({[NETWORK_HEALTH_KEY_420]:snapshots});
  await monitorPortfolioBlocks420();
}
chrome.alarms?.onAlarm?.addListener(alarm=>{
  if(alarm.name==='420-wallet-network-health')monitorNetworks420().catch(()=>{});
});
chrome.runtime.onStartup?.addListener(()=>{
  chrome.alarms?.create?.('420-wallet-network-health',{periodInMinutes:1});
});
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms?.create?.('420-wallet-network-health',{periodInMinutes:1});
  const config = await readObject('420-wallet-extension-config-v1');
  if (!Object.keys(config).length) await chrome.storage.local.set({ '420-wallet-extension-config-v1': { rpcUrl: null, accounts: [], smartAccountConfig: null } });
});
