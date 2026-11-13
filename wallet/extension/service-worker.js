import {nftId420,normalizedNftRecord420,verifyNftOwnership420,discoverNftTransfers420,nftSpamFlags420,
 nftMetadataUrl420,fetchSafeNftMetadata420,nftIndexWindow420,nftTransferCall420,nftApprovalCall420,verifyNftApproval420,readNftApproval420} from './core/extension-nfts.js';
import {prepareSecurityRevocation420,assertSecurityTransaction420,readSecurityPasskey420} from './core/extension-security-actions.js';
import {readSecurityAllowance420,discoverRecentSecurityAllowances420,normalizeSecurityAllowance420,encodeSecurityRevokeAllowance420,classifyWebsiteRisk420,assessSecuritySignature420,securityRecordSignature420,securityRevocationKind420,assertSecurityRevocationSnapshot420} from './core/extension-security-centre.js';
import {prepareCapabilityGrantRevocation} from './core/capability-management.js';
import {prepareSessionKeyRevocation,readSessionEpoch} from './core/session-management.js';
import {inspectCapabilityGrant} from './core/capabilities.js';
import {readDeployedSmartAccountState} from './core/accounts.js';
import {keccak256Hex} from './core/keccak.js';
import {normalizeDappAccountPermission420,dappAccountPermissions420,normalizeDappWalletCalls420,walletCapabilities420,walletCallsStatus420} from './core/extension-dapp-compatibility.js';
import {normalizeBatchCalls,encodeExecuteBatch} from './core/batch-execution.js';
import {Transaction} from './vendor/ethers-6.17.0.min.js';
import {quoteExtensionEoa420} from './core/extension-eoa-preflight.js';
import {inspectExtensionApprovalRisk420} from './core/extension-approval-risk.js';
import {validateUserOpReplacement420,validateEoaReplacement420,reconcileUserOpReplacement420,transitionReplacement420} from './core/extension-replacement-policy.js';
import {encodeExecute,decodeString} from './core/abi.js';
import {resolveExtensionRecipient420,assertExtensionRecipientSnapshot420} from './core/extension-recipient-resolver.js';
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
const TREZOR_METHODS_420=new Set(['ethereumGetAddress','ethereumSignTransaction','ethereumSignTypedData','ethereumSignMessage']);
let trezorSdkPromise420=null;
async function trezorSdk420(){
  if(!trezorSdkPromise420)trezorSdkPromise420=(async()=>{
    // Bundled locally at release build time; no remote runtime scripts, no iframe.
    const module=await import('./vendor/trezor-connect-10.bundle.js');
    const sdk=module.default||module.TrezorConnect;
    if(!sdk?.init)throw new Error('Trezor Connect 10 extension SDK is not installed');
    const stored=await chrome.storage.local.get('420-wallet-trezor-app-manifest-v1');
    const manifest=stored['420-wallet-trezor-app-manifest-v1'];
    if(!manifest||typeof manifest.appName!=='string'||typeof manifest.email!=='string'||
       typeof manifest.appUrl!=='string'||!manifest.appUrl.startsWith('https://'))
      throw new Error('Approved Trezor Connect application manifest is missing');
    await sdk.init({manifest});
    return sdk;
  })().catch(e=>{trezorSdkPromise420=null;throw e;});
  return trezorSdkPromise420;
}
async function requestTrezor420(method,params){
  if(!TREZOR_METHODS_420.has(method))throw Object.assign(new Error('Trezor method not authorized'),{code:4200});
  const sdk=await trezorSdk420();
  if(typeof sdk[method]!=='function')throw new Error('Trezor Connect 10 method unavailable');
  return sdk[method](params);
}

const CHANNEL = '420-wallet-provider-v1';
const PERMISSIONS_KEY = '420-wallet-origin-permissions-v1';
const APPROVALS_KEY = '420-wallet-pending-approvals-v1';
const AUTHORITY_KEY = '420-wallet-pending-authority-v1';
const SECURITY_SIGNATURES_KEY='420-wallet-security-signature-history-v1';
const SECURITY_WATCH_KEY='420-wallet-security-watch-v1';
const SECURITY_REVIEW_KEY='420-wallet-security-reviews-v1';
const NFT_REVIEW_KEY_420='420-wallet-nft-review-v1';
const READ_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_call','eth_estimateGas','eth_gasPrice','eth_feeHistory','eth_maxPriorityFeePerGas','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs','net_version']);
const AUTHORITY_TRANSPORT_METHODS = new Set([...READ_METHODS, 'eth_sendUserOperation', 'eth_getUserOperationReceipt','eth_estimateUserOperationGas','eth_sendRawTransaction']);
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
  // Cached event history and NFT metadata are NEVER ownership authority.
  // Revalidate against ownerOf or balanceOf for each retained ERC721/1155,
  // and keep failed verification visibly stale rather than spendable.
  const nfts=[];
  for(const oldNft of (old.nfts||[]).slice(0,100)){
    try{
      const checked=await verifyNftOwnership420(provider,oldNft,balanceAccount);
      if(checked.verified){
        const signals=nftSpamFlags420({...oldNft.metadata,spam:settings.nftSpam.includes(checked.key)});
        const spam=!settings.nftTrusted.includes(checked.key)&&signals.spam;
        nfts.push({...checked,metadata:oldNft.metadata||null,
          hidden:settings.nftHidden.includes(checked.key)||spam,
          spam,ownership:'verified'});
      }
    }catch{
      nfts.push({...oldNft,owner:balanceAccount,ownership:'unavailable',verified:false,stale:true,
        hidden:settings.nftHidden.includes(oldNft.key)||oldNft.hidden===true,
        spam:settings.nftSpam.includes(oldNft.key)||oldNft.spam===true});
    }
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
  const address=prefs.selectedAccount;
  const metadata=await accountMetadata420();
  const isEoa=request.method==='eth_sendTransaction'?
    ['eoa','hardware'].includes(request.params?.[0]?.executionModel):
    ['personal_sign','eth_signTypedData_v4'].includes(request.method)&&['eoa','hardware'].includes(metadata[address]?.type);
  const isHardware=metadata[address]?.type==='hardware';
  if(isHardware&&metadata[address]?.signingQualified!==true)
    throw Object.assign(new Error('Hardware device account not verified'),{code:4100});
  if(!isEoa&&!effective.network.smartAccountApproved)
    throw Object.assign(new Error('No independently verified SmartAccount420 authority on selected EVM chain'),{code:4100});
  if(isEoa&&!isHardware&&!(await vaultLockState420()).unlocked)
    throw Object.assign(new Error('Encrypted local EOA vault is locked'),{code:4100});
  if(!context.chainId||effective.chainId!==context.chainId||effective.epoch!==context.epoch)
    throw Object.assign(new Error('Network context changed before signing authority'),{code:4901});
  const listed=await accountVisibility420(normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420)).accounts);
  if(!address||!listed.includes(address)||!context.accounts?.includes(address))
    throw Object.assign(new Error('Account selection or permission changed; reconnect and confirm again'),{code:4100});
  if(metadata[address]?.type==='watch-only'||
     (isEoa?!['eoa','hardware'].includes(metadata[address]?.type):['eoa','hardware'].includes(metadata[address]?.type))||
     (isHardware&&request.method==='eth_sendTransaction'&&request.params?.[0]?.executionModel!=='hardware')||
     (!isHardware&&request.method==='eth_sendTransaction'&&request.params?.[0]?.executionModel==='hardware'))
    throw Object.assign(new Error('Selected account has no authorized local signing authority for this model'),{code:4100});
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
        Promise.all([effectiveChain420(context.origin),accountsFor(context.origin)]).then(([now,stillGranted])=>{
          if(now.chainId!==context.chainId||now.epoch!==context.epoch)
            throw Object.assign(new Error('Network context changed during signing'),{code:4901});
          // Approval may be revoked while the password/passkey window is open.
          // No origin may receive the resulting signature/transaction identity
          // after its account permission has been removed.
          if(context.origin&&(!Array.isArray(stillGranted)||
             stillGranted.length!==1||stillGranted[0]!==context.accounts?.[0]))
            throw Object.assign(new Error('Website account authorization changed during signing'),{code:4100});
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
    const siteRisk=classifyWebsiteRisk420(origin);
    const decision = await createApproval({ ...request, availableAccounts: available,securityRisk:siteRisk.flags.length?
      {severity:'high',flags:siteRisk.flags,summary:'Unverified or suspicious website origin'}:null
    },{...context,chainId:pinned,epoch:before.epoch});
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
  if(request.method==='personal_sign'){
    const p=request.params;
    if(!Array.isArray(p)||p.length!==2||typeof p[0]!=='string'||
       !/^0x(?:[0-9a-fA-F]{2})*$/.test(p[0])||p[0].length>131074||
       typeof p[1]!=='string'||p[1].toLowerCase()!==granted[0])
      throw Object.assign(new Error('personal_sign requires exact connected signer and bounded hex message'),{code:-32602});
  }
  if(request.method==='eth_signTypedData_v4'){
    const p=request.params;
    if(!Array.isArray(p)||p.length!==2||typeof p[0]!=='string'||
       p[0].toLowerCase()!==granted[0]||typeof p[1]!=='string'||p[1].length>131072)
      throw Object.assign(new Error('typed data must include exact connected signer and bounded payload'),{code:-32602});
    let payload;
    try{payload=JSON.parse(p[1]);}catch{throw Object.assign(new Error('EIP-712 typed data must be valid JSON'),{code:-32602});}
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||
       !payload.domain||!payload.types||!payload.primaryType||!payload.message)
      throw Object.assign(new Error('EIP-712 domain, types, primary type and message required'),{code:-32602});
    const requested=await effectiveChain420(origin);
    if(payload.domain.chainId==null||BigInt(payload.domain.chainId)!==BigInt(requested.chainId))
      throw Object.assign(new Error('EIP-712 domain chain ID mismatch'),{code:4901});
  }
  const before=await effectiveChain420(origin),pinned=before.chainId;
  let feePreview=null,approvedTxRequest=request;
  if(request.method==='eth_sendTransaction'){
    const tx=request.params?.[0];
    if(!tx||!tx.to||!tx.from||normalizeExtensionAddress420(tx.from)!==granted[0])
      throw Object.assign(new Error('Exact granted account and transaction target required'),{code:4100});
    const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
    const provider={request:(method,params)=>rpcRequest(method,params,{origin,expectedChainId:pinned})};
    const accountMeta=await accountMetadata420(),hardware=accountMeta[granted[0]]?.type==='hardware';
    const eoa=accountMeta[granted[0]]?.type==='eoa'||hardware;
    if(hardware&&accountMeta[granted[0]]?.signingQualified!==true)
      throw Object.assign(new Error('Hardware account is not device verified'),{code:4100});
    if(eoa&&!(await vaultLockState420()).unlocked)
      throw Object.assign(new Error('Encrypted EOA vault is locked'),{code:4100});
    let smart=null;
    if(!eoa){
      if(!config.smartAccountConfig||config.chainId!==pinned)
        throw Object.assign(new Error('Approved SmartAccount configuration is missing for site chain'),{code:4100});
      smart=await discoverSmartAccount(provider,granted[0],config.smartAccountConfig);
      if(!smart?.deployed||!smart?.controllerIsOwner||!smart?.entryPoint)
        throw Object.assign(new Error('Verified SmartAccount owner or EntryPoint missing'),{code:4100});
    }
    if(tx.gasPrice!=null)throw Object.assign(new Error('Legacy gasPrice not supported; use EIP-1559'),{code:-32602});
    const choice=tx.maxFeePerGas!=null||tx.maxPriorityFeePerGas!=null?
      {level:'custom',maxFeePerGas:tx.maxFeePerGas,maxPriorityFeePerGas:tx.maxPriorityFeePerGas}:
      {level:'standard'};
    const normalizedTx={from:granted[0],to:normalizeExtensionAddress420(tx.to),
      value:tx.value??'0x0',data:tx.data??'0x'};
    const quote=eoa?
      await quoteExtensionEoa420(provider,{chainId:pinned,from:granted[0],transaction:normalizedTx,choice}):
      await quoteExtensionSend420(provider,{chainId:pinned,
        smartAccount:smart.smartAccount,entryPoint:smart.entryPoint,
        transaction:normalizedTx,choice,strictUserOpGas:true});
    const risk=inspectExtensionApprovalRisk420(normalizedTx);
    feePreview={quote,risk,normalizedTx,chainId:pinned,executionModel:hardware?'hardware':eoa?'eoa':'erc4337'};
  }
  const signatureRisk=['personal_sign','eth_signTypedData_v4'].includes(request.method)?
    assessSecuritySignature420(request.method,request.params,{chainId:pinned,origin}):null;
  const siteRisk=classifyWebsiteRisk420(origin);
  await createApproval({
    ...request,...(feePreview?{feePreview}:{}),
    ...(signatureRisk?{securityRisk:signatureRisk}:
       siteRisk.flags.length?{securityRisk:{severity:'high',flags:siteRisk.flags,
         summary:'Suspicious website domain'}}:{})
  },{ ...context, accounts: granted,chainId:pinned,epoch:before.epoch });
  if((await effectiveChain420(origin)).epoch!==before.epoch)
    throw Object.assign(new Error('Chain changed during approval'),{code:4901});
  const current=await accountsFor(origin);
  if(current.length!==1||current[0]!==granted[0])throw Object.assign(new Error('Account was changed or disconnected during approval'),{code:4100});
  if(request.method==='eth_sendTransaction'){
    const after=await effectiveChain420(origin);
    if(after.chainId!==pinned||after.epoch!==before.epoch)
      throw Object.assign(new Error('Site approval expired or chain changed'),{code:4901});
    const provider={request:(method,params)=>rpcRequest(method,params,{origin,expectedChainId:pinned})};
    const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
    const fee=feePreview.quote;
    const choice=request.params?.[0]?.maxFeePerGas!=null||request.params?.[0]?.maxPriorityFeePerGas!=null?
      {level:'custom',maxFeePerGas:request.params[0].maxFeePerGas,
       maxPriorityFeePerGas:request.params[0].maxPriorityFeePerGas}:{level:'standard'};
    let newQuote;
    if(['eoa','hardware'].includes(feePreview.executionModel)){
      if(feePreview.executionModel==='eoa'&&!(await vaultLockState420()).unlocked)
        throw Object.assign(new Error('EOA vault locked during approval'),{code:4100});
      newQuote=await quoteExtensionEoa420(provider,{chainId:pinned,from:current[0],
        transaction:feePreview.normalizedTx,choice});
      if(fee.nonce!==newQuote.nonce||fee.gasLimit!==newQuote.gasLimit||
         fee.maxFeePerGas!==newQuote.maxFeePerGas||
         fee.maxPriorityFeePerGas!==newQuote.maxPriorityFeePerGas||
         fee.blockHash!==newQuote.blockHash)
        throw Object.assign(new Error('EOA nonce/fees changed; new approval required'),{code:4001});
      approvedTxRequest={...request,params:[{...feePreview.normalizedTx,
        executionModel:feePreview.executionModel,chainId:pinned,nonce:newQuote.nonce,gasLimit:newQuote.gasLimit,
        maxFeePerGas:newQuote.maxFeePerGas,maxPriorityFeePerGas:newQuote.maxPriorityFeePerGas}]};
    }else{
      const smart=await discoverSmartAccount(provider,current[0],config.smartAccountConfig);
      newQuote=await quoteExtensionSend420(provider,{
        chainId:pinned,smartAccount:smart.smartAccount,entryPoint:smart.entryPoint,
        transaction:feePreview.normalizedTx,choice,strictUserOpGas:true});
      if(fee.gasFees!==newQuote.gasFees||fee.blockHash!==newQuote.blockHash||
         fee.nonce!==newQuote.nonce||fee.entryPoint!==newQuote.entryPoint||
         fee.gasBudget?.accountGasLimits!==newQuote.gasBudget?.accountGasLimits||
         fee.gasBudget?.preVerificationGas!==newQuote.gasBudget?.preVerificationGas)
        throw Object.assign(new Error('DApp UserOperation gas estimate changed; new approval required'),{code:4001});
      approvedTxRequest={...request,params:[{...feePreview.normalizedTx,
        gasFees:newQuote.gasFees,accountGasLimits:newQuote.gasBudget.accountGasLimits,
        preVerificationGas:newQuote.gasBudget.preVerificationGas,expectedNonce:newQuote.nonce}]};
    }
    const tx=request.params?.[0]||{};
    const id='site-send-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    const entry={id,at:Date.now(),chainId:pinned,controller:current[0],
      executionModel:feePreview.executionModel,
      origin,recipient:typeof tx.to==='string'?tx.to.toLowerCase():null,
      amount:typeof tx.value==='string'?tx.value:'0x0',
      symbol:tx.data&&tx.data!=='0x'?'contract call':'native',
      status:'pending',hash:null};
    await rememberWalletUiActivity420(entry);
    let hash=null;
    try{
      hash=await executeWithLocalAuthority(approvedTxRequest,{
        ...context,accounts:current,chainId:pinned,epoch:before.epoch,activityId:id
      });
      await rememberWalletUiActivity420({...entry,hash,status:'submitted'});
      return hash;
    }catch(error){
      const userOpHash=validHash420(error?.data?.userOpHash)?error.data.userOpHash.toLowerCase():null;
      const signedHash=validHash420(error?.data?.hash)?error.data.hash.toLowerCase():null;
      await rememberWalletUiActivity420({...entry,hash:hash||signedHash,userOpHash,
        status:(hash||signedHash||userOpHash)?'submitted':'failed',
        error:error?.message||'Site transaction authority unavailable'});
      throw error;
    }
  }
  const signerMeta=await accountMetadata420();
  const isEoaSignature=['personal_sign','eth_signTypedData_v4'].includes(request.method)&&
    ['eoa','hardware'].includes(signerMeta[current[0]]?.type);
  if(isEoaSignature&&signerMeta[current[0]]?.type==='eoa'&&!(await vaultLockState420()).unlocked)
    throw Object.assign(new Error('Unlock the local EOA vault before signing'),{code:4100});
  const result=await executeWithLocalAuthority(
    isEoaSignature?{...request,executionModel:signerMeta[current[0]]?.type==='hardware'?'hardware':'eoa'}:request,
    { ...context, accounts: current,chainId:pinned,epoch:before.epoch });
  if(signatureRisk){
    const item=securityRecordSignature420({origin,method:request.method,
      account:current[0],chainId:pinned,risk:signatureRisk});
    const history=(await chrome.storage.local.get(SECURITY_SIGNATURES_KEY))?.[SECURITY_SIGNATURES_KEY]||[];
    await chrome.storage.local.set({[SECURITY_SIGNATURES_KEY]:
      [item,...(Array.isArray(history)?history:[])].slice(0,150)});
  }
  return result;
}



/* Origin-scoped EIP-2255 / EIP-5792 compatibility. These methods never allow
 * websites to call the RPC broadcaster, invent a grant, or bypass local authority. */
async function handleDappCompatibility420(request,context){
  const origin=context.origin,method=request.method,params=request.params??[];
  const granted=await accountsFor(origin);
  if(method==='wallet_getPermissions'){
    if(!Array.isArray(params)||params.length)throw Object.assign(new Error('wallet_getPermissions accepts no parameters'),{code:-32602});
    const records=await readObject(PERMISSIONS_KEY);
    return dappAccountPermissions420(granted,origin,records[origin]?.grantedAt);
  }
  if(method==='wallet_requestPermissions'){
    normalizeDappAccountPermission420(params);
    await handleApprovalMethod({method:'eth_requestAccounts',params:[]},context);
    const records=await readObject(PERMISSIONS_KEY);
    return dappAccountPermissions420(await accountsFor(origin),origin,records[origin]?.grantedAt);
  }
  if(method==='wallet_revokePermissions'){
    normalizeDappAccountPermission420(params);
    const records=await readObject(PERMISSIONS_KEY);
    if(Object.hasOwn(records,origin)){
      delete records[origin];
      await chrome.storage.local.set({[PERMISSIONS_KEY]:records});
      await notifyDisconnectedSite420(origin);
    }
    return null;
  }
  if(method==='wallet_getCapabilities'){
    if(!granted.length)throw Object.assign(new Error('Connect the requesting site to view wallet capabilities'),{code:4100});
    if(!Array.isArray(params)||params.length<1||params.length>2||
       typeof params[0]!=='string'||params[0].toLowerCase()!==granted[0]||
       (params.length===2&&(!Array.isArray(params[1])||params[1].length>16)))
      throw Object.assign(new Error('wallet_getCapabilities requires connected account and optional chain IDs'),{code:-32602});
    const effective=await effectiveChain420(origin),config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
    const metadata=await accountMetadata420();
    let supported=false;
    if(metadata[granted[0]]?.type!=='eoa'&&
       !['watch-only','hardware'].includes(metadata[granted[0]]?.type)&&
       effective.network.smartAccountApproved&&config.chainId===effective.chainId&&config.smartAccountConfig){
      try{
        const smart=await discoverSmartAccount({request:(m,p)=>rpcRequest(m,p,{origin,expectedChainId:effective.chainId})},granted[0],config.smartAccountConfig);
        const records=(await chrome.storage.local.get('420-wallet-passkey-bindings-v1'))?.['420-wallet-passkey-bindings-v1']??{};
        supported=smart?.deployed===true&&smart?.controllerIsOwner===true&&
          !!(records[smart.smartAccount?.toLowerCase()]||records[granted[0]]);
      }catch{supported=false;}
    }
    const requested=params[1]?.length?params[1]:[effective.chainId];
    const out={};
    for(const item of requested){
      const key=chainId420(item);
      out[key]=walletCapabilities420(key,{atomicBatch:key===effective.chainId&&supported})[key];
    }
    return out;
  }
  if(method==='wallet_getCallsStatus'){
    if(!granted.length)throw Object.assign(new Error('Connect this site before querying its batches'),{code:4100});
    if(!Array.isArray(params)||params.length!==1)throw Object.assign(new Error('batch ID required'),{code:-32602});
    const entries=(await readWalletUiActivity420()).filter(x=>x.origin===origin&&x.controller===granted[0]&&x.callsId);
    let status=walletCallsStatus420(entries,params[0]);
    if(status.status===200){
      const item=entries.find(x=>x.callsId===status.id);
      if(!validHash420(item.hash))throw Object.assign(new Error('confirmed batch has no transaction hash'),{code:4900});
      const receipt=await rpcRequest('eth_getTransactionReceipt',[item.hash],{origin,expectedChainId:item.chainId});
      if(!receipt||receipt.transactionHash?.toLowerCase()!==item.hash.toLowerCase()||
         receipt.status!=='0x1')throw Object.assign(new Error('confirmed batch receipt is no longer canonical'),{code:4900});
      status={...status,receipts:[receipt]};
    }
    return status;
  }
  if(method!=='wallet_sendCalls')throw Object.assign(new Error('Unsupported dApp compatibility method'),{code:4200});
  if(granted.length!==1)throw Object.assign(new Error('Connect one account to submit atomic batch'),{code:4100});
  const before=await effectiveChain420(origin),pinned=before.chainId;
  const callRequest=normalizeDappWalletCalls420(params,{account:granted[0],chainId:pinned});
  const metadata=await accountMetadata420();
  if(metadata[granted[0]]?.type==='eoa'||['hardware','watch-only'].includes(metadata[granted[0]]?.type))
    throw Object.assign(new Error('Atomic batch requires a verified passkey SmartAccount420'),{code:4200});
  if(!before.network.smartAccountApproved)
    throw Object.assign(new Error('SmartAccount420 is not approved on selected chain'),{code:4100});
  const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
  if(config.chainId!==pinned||!config.smartAccountConfig)
    throw Object.assign(new Error('Verified SmartAccount runtime configuration missing'),{code:4100});
  const provider={request:(m,p)=>rpcRequest(m,p,{origin,expectedChainId:pinned})};
  const smart=await discoverSmartAccount(provider,granted[0],config.smartAccountConfig);
  if(!smart?.deployed||!smart?.controllerIsOwner||!smart?.entryPoint)
    throw Object.assign(new Error('SmartAccount owner/EntryPoint proof required'),{code:4100});
  const normalized=normalizeBatchCalls(smart,callRequest.calls);
  const calls=normalized.calls.map(c=>({target:c.target,value:'0x'+c.value.toString(16),data:c.data}));
  const callData=encodeExecuteBatch(normalized.calls);
  const transaction={from:granted[0],to:smart.smartAccount,value:'0x0',data:callData};
  const choice={level:'standard'};
  const quote=await quoteExtensionSend420(provider,{chainId:pinned,smartAccount:smart.smartAccount,
    entryPoint:smart.entryPoint,transaction,choice,strictUserOpGas:true,accountCallData:callData});
  const risks=normalized.calls.map(c=>inspectExtensionApprovalRisk420({
    to:c.target,value:'0x'+c.value.toString(16),data:c.data
  }));
  const severityOrder={critical:4,high:3,medium:2,low:1,none:0};
  const risk=risks.reduce((worst,next)=>
    (severityOrder[next?.severity]??0)>(severityOrder[worst?.severity]??0)?next:worst,
    {severity:'low',message:'Review each call in this atomic batch'});
  await createApproval({...request,params:[callRequest],feePreview:{
    quote,risk:{...risk,message:'Atomic batch: '+risks.map((x,i)=>
      'Call '+(i+1)+': '+(x?.message||'verify destination and calldata')).join('; ')},
    chainId:pinned,normalizedTx:transaction,batchCalls:calls,executionModel:'erc4337'}},
    {...context,accounts:granted,chainId:pinned,epoch:before.epoch});
  const after=await effectiveChain420(origin),current=await accountsFor(origin);
  if(after.chainId!==pinned||after.epoch!==before.epoch||
     current.length!==1||current[0]!==granted[0])
    throw Object.assign(new Error('Batch approval expired after chain/account change'),{code:4901});
  const latest=await discoverSmartAccount(provider,current[0],config.smartAccountConfig);
  if(!latest?.deployed||!latest?.controllerIsOwner||
     latest.smartAccount!==smart.smartAccount||latest.entryPoint!==smart.entryPoint||
     encodeExecuteBatch(normalizeBatchCalls(latest,calls).calls)!==callData)
    throw Object.assign(new Error('SmartAccount batch authority or calls changed'),{code:4100});
  const refreshed=await quoteExtensionSend420(provider,{chainId:pinned,
    smartAccount:latest.smartAccount,entryPoint:latest.entryPoint,transaction,
    choice,strictUserOpGas:true,accountCallData:callData});
  if(refreshed.blockHash!==quote.blockHash||refreshed.gasFees!==quote.gasFees||
     refreshed.nonce!==quote.nonce||
     refreshed.gasBudget?.accountGasLimits!==quote.gasBudget?.accountGasLimits||
     refreshed.gasBudget?.preVerificationGas!==quote.gasBudget?.preVerificationGas)
    throw Object.assign(new Error('Batch nonce, block or fees changed; obtain a new approval'),{code:4001});
  const activityId='site-batch-'+Date.now()+'-'+Math.random().toString(16).slice(2);
  const entry={id:activityId,at:Date.now(),chainId:pinned,origin,
    controller:granted[0],executionModel:'erc4337',recipient:smart.smartAccount,
    amount:'0x0',symbol:'atomic contract batch',status:'pending',hash:null};
  await rememberWalletUiActivity420(entry);
  const prepared={method:'eth_sendTransaction',params:[{
    ...transaction,batchCalls:calls,gasFees:refreshed.gasFees,
    accountGasLimits:refreshed.gasBudget.accountGasLimits,
    preVerificationGas:refreshed.gasBudget.preVerificationGas,
    expectedNonce:refreshed.nonce
  }]};
  try{
    const txHash=await executeWithLocalAuthority(prepared,{
      ...context,accounts:current,chainId:pinned,epoch:before.epoch,activityId
    });
    const recorded=(await readWalletUiActivity420()).find(x=>x.id===activityId);
    const callsId=validHash420(recorded?.userOpHash)?recorded.userOpHash.toLowerCase():txHash.toLowerCase();
    await rememberWalletUiActivity420({...entry,hash:txHash,callsId,status:'submitted'});
    return callsId;
  }catch(error){
    const userOpHash=error?.data?.userOpHash;
    if(validHash420(userOpHash)){
      const callsId=userOpHash.toLowerCase();
      await rememberWalletUiActivity420({...entry,callsId,userOpHash:callsId,status:'submitted'});
      return callsId; // Submitted: timeout cannot safely imply failure or rebroadcast.
    }
    await rememberWalletUiActivity420({...entry,status:'failed',
      error:error?.message||'Batch authorization failed'});
    throw error;
  }
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
  return Array.isArray(value)?value.slice(0,200).filter(x=>x&&typeof x==='object'):[];
}
// Reconcile only canonical receipts. Missing receipts cannot prove a dropped or failed transaction.
const validHash420=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
async function refreshWalletUiActivity420() {
  const entries=await readWalletUiActivity420();
  const candidates=entries.filter(x=>['submitted','pending','confirming','included','reorganized','confirmed','reverted'].includes(x.status)&&
    (validHash420(x.hash)||validHash420(x.userOpHash)))
    .sort((a,b)=>(a.lastCheckedAt??a.at??0)-(b.lastCheckedAt??b.at??0)).slice(0,8);
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
      let opReceipt=null;
      if(validHash420(current.userOpHash)){
        opReceipt=await provider.request('eth_getUserOperationReceipt',[current.userOpHash]);
        const receiptHash=opReceipt?.receipt?.transactionHash??opReceipt?.transactionHash;
        if(validHash420(receiptHash)){
          if(validHash420(current.hash)&&current.hash.toLowerCase()!==receiptHash.toLowerCase())
            throw new Error('bundler transaction hash changed unexpectedly');
          current={...current,hash:receiptHash.toLowerCase()};
        }
      }
      if(!validHash420(current.hash))continue;
      let reconciled=await reconcileExtensionTransaction420(current,{provider,chainId:entry.chainId,confirmations:2});
      if(reconciled.status==='confirmed'&&opReceipt?.success===false)
        reconciled={...reconciled,status:'reverted'};
      updates.set(entry.id,{...reconciled,lastCheckedAt:Date.now(),
        ...(reconciled.status!==entry.status?{updatedAt:Date.now()}: {})});
      changed=true;
    }catch{ /* RPC outages retain the last known status, never fabricate failure. */ }
  }
  const fresh=await readWalletUiActivity420();
  const next=fresh.map(x=>updates.has(x.id)&&
    (x.hash===updates.get(x.id).hash||(!x.hash&&x.userOpHash===updates.get(x.id).userOpHash))
       ? updates.get(x.id):x);
  // Replacement status follows confirmed UserOperation evidence, not receipt
  // timeout, elapsed time, or a submitted replacement hash.
  const byId=new Map(next.map(x=>[x.id,x]));
  for(const replacement of next.filter(x=>x.originalId&&x.replaces)){
    const original=byId.get(replacement.originalId);
    if(!original||original.chainId!==chain.chainId)continue;
    if(replacement.status==='confirmed'&&['submitted','pending','included','reorganized'].includes(original.status)){
      try{
        const provider={request:(method,params=[])=>rpcRequest(method,params,{expectedChainId:chain.chainId})};
        if(original.executionModel==='erc4337'){
          const validated=await reconcileUserOpReplacement420(provider,original,replacement);
          byId.set(original.id,validated);changed=true;
        }else if(original.executionModel==='eoa'&&replacement.executionModel==='eoa'){
          const [confirmed,originalReceipt,originalTransaction]=await Promise.all([
            provider.request('eth_getTransactionByHash',[replacement.hash]),
            provider.request('eth_getTransactionReceipt',[original.hash]),
            provider.request('eth_getTransactionByHash',[original.hash])
          ]);
          if(originalReceipt||originalTransaction?.blockHash)throw Error('Original EOA is included');
          if(!confirmed?.blockHash||!confirmed?.from||confirmed.nonce==null||
            confirmed.hash?.toLowerCase()!==replacement.hash?.toLowerCase()||
            confirmed.from.toLowerCase()!==original.from||
            BigInt(confirmed.nonce)!==BigInt(original.nonce))
            throw Error('Replacement EOA canonical sender/nonce evidence missing');
          const validated=transitionReplacement420(original,{action:replacement.action,txHash:replacement.hash},
            {canonicalEvidence:{sameChain:true,sameSenderAndNonce:true,replacementIncluded:true,
              originalNotCanonical:true,checkedAt:Date.now()}});
          byId.set(original.id,validated);changed=true;
        }
      }catch{ /* Replacement proof must be canonical and signer/nonce-checked. */ }
    }else if(replacement.status==='reorganized'&&['replaced','cancelled'].includes(original.status)&&
             original.replacedBy===replacement.hash){
      byId.set(original.id,{...original,status:'submitted',replacementUncertain:true,
        replacedBy:null,replacementUserOpHash:null});changed=true;
    }
  }
  if(!changed)return entries;
  const committed=next.map(x=>byId.get(x.id)||x);
  await chrome.storage.local.set({[EXTENSION_ACTIVITY_KEY_420]:committed});
  return committed;
}
function assertEoaRawMatchesAuthority420(raw,approved){
  if(typeof raw!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(raw)||raw.length>262144)
    throw new Error('Invalid signed EOA transaction');
  const signed=Transaction.from(raw);
  if(signed.type!==2||!signed.hash||!validHash420(signed.hash)||
     signed.from?.toLowerCase()!==approved.from?.toLowerCase()||
     signed.to?.toLowerCase()!==approved.to?.toLowerCase()||
     BigInt(signed.chainId)!==BigInt(approved.chainId)||
     BigInt(signed.nonce)!==BigInt(approved.nonce)||
     signed.value!==BigInt(approved.value??'0x0')||
     signed.gasLimit!==BigInt(approved.gasLimit)||
     signed.maxFeePerGas!==BigInt(approved.maxFeePerGas)||
     signed.maxPriorityFeePerGas!==BigInt(approved.maxPriorityFeePerGas)||
     signed.data.toLowerCase()!==(approved.data??'0x').toLowerCase())
    throw new Error('Signed EOA envelope differs from user-approved exact transaction');
  return signed.hash.toLowerCase();
}
async function recordAuthoritySignedEoa420(sender,requestId,submission){
  const expected=chrome.runtime.getURL('authority.html');
  if(sender?.id!==chrome.runtime.id||typeof sender?.url!=='string'||
    sender.url.split('?')[0]!==expected||
    new URL(sender.url).searchParams.get('request')!==requestId)
    throw Object.assign(new Error('Untrusted EOA authority result'),{code:4100});
  const pending=(await readObject(AUTHORITY_KEY))[requestId];
  if(!pending||pending.request?.method!=='eth_sendTransaction'||
     !['eoa','hardware'].includes(pending.request?.params?.[0]?.executionModel))
    throw Object.assign(new Error('No pending EOA signing authority'),{code:4100});
  const tx=pending.request.params[0];
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  if(prefs.selectedAccount!==tx.from?.toLowerCase())
    throw Object.assign(new Error('Selected signing account changed'),{code:4100});
  const now=await effectiveChain420(pending.context.origin);
  if(now.chainId!==pending.context.chainId||now.epoch!==pending.context.epoch||
      tx.chainId!==now.chainId||tx.from?.toLowerCase()!==pending.context.accounts?.[0])
    throw Object.assign(new Error('EOA signing chain/account changed'),{code:4901});
  if(!validHash420(submission?.hash)||submission.chainId!==tx.chainId||
     submission.from!==tx.from?.toLowerCase()||submission.to!==tx.to?.toLowerCase()||
     submission.nonce!==tx.nonce||
     submission.value!==tx.value||submission.data!==tx.data?.toLowerCase()||
     submission.maxFeePerGas!==tx.maxFeePerGas||
     submission.maxPriorityFeePerGas!==tx.maxPriorityFeePerGas||
     submission.gasLimit!==tx.gasLimit)
    throw Object.assign(new Error('EOA signed metadata differs from approved transaction'),{code:4100});
  const id=pending.context.activityId;
  if(id){
    const activities=await readWalletUiActivity420();
    const existing=activities.find(x=>x.id===id&&x.controller===submission.from&&x.chainId===tx.chainId);
    if(!existing)throw new Error('Pending EOA activity not found');
    await rememberWalletUiActivity420({...existing,executionModel:'eoa',signingProvider:tx.executionModel==='hardware'?'hardware':null,status:'submitted',
      hash:submission.hash,from:submission.from,to:submission.to,
      nonce:submission.nonce,value:submission.value,data:submission.data,
      gasLimit:submission.gasLimit,maxFeePerGas:submission.maxFeePerGas,
      maxPriorityFeePerGas:submission.maxPriorityFeePerGas,submittedAt:Date.now()});
  }
  return true;
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
  if(!id)return true; // Non-send signing requests have no transaction record.
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
  const next=[{...previous,...entry},...current.filter(x=>x.id!==entry.id)].slice(0,200);
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
  // Read one immutable network-registry snapshot for both the selected chain
  // and its native-currency identity. Parallel popup refreshes and user chain
  // changes must not combine 420 from a previous chain with an ETH selection.
  const registry=await networkRegistry420();
  const active=registry.selectedChainId&&registry.networks[registry.selectedChainId]?.enabled?
    {registry,chainId:registry.selectedChainId,
      network:registry.networks[registry.selectedChainId],epoch:registry.epoch}:null;
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
          kind==='hardware'?'Hardware signer: reverify device and approve each request; physical/testnet acceptance pending.':
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
      controller:selected,smartAccount:discovered.smartAccount,entryPoint:discovered.entryPoint,
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
async function replacementPreview420(message){
  const state=await walletUiState420();
  if(!extensionCanSend420(state)||message.chainId!==state.network.expectedChainId||
     message.epoch!==state.network.epoch||message.account!==state.selectedAccount)
    throw Object.assign(new Error('Wallet authority or chain changed'),{code:4901});
  if(!['speed-up','cancel'].includes(message.action))
    throw Object.assign(new Error('Unsupported replacement action'),{code:-32602});
  const entries=await readWalletUiActivity420(),original=entries.find(x=>x.id===message.activityId);
  if(!original||original.controller!==state.selectedAccount||
     original.chainId!==state.network.expectedChainId||
     !(original.executionModel==='eoa'?validHash420(original.hash):validHash420(original.userOpHash)))
    throw Object.assign(new Error('No locally authorized pending transaction to replace'),{code:4100});
  if(!['submitted','pending','reorganized','included'].includes(original.status))
    throw Object.assign(new Error('Only unconfirmed transactions may be replaced'),{code:4100});
  if(entries.some(x=>x.replaces===(original.executionModel==='eoa'?original.hash:original.userOpHash)&&
     ['pending','submitted','included','reorganized','confirmed'].includes(x.status)))
    throw Object.assign(new Error('A replacement of this UserOperation already exists; resolve its outcome first'),{code:4001});
  const provider={request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})};
  if(original.executionModel==='eoa'){
    if(!['eoa','hardware'].includes(state.account.kind)||(state.account.kind==='eoa'&&!state.vault?.unlocked))
      throw Object.assign(new Error('Local EOA signing authority is locked'),{code:4100});
    let target=original.to,value=original.value,data=original.data;
    if(message.action==='cancel'){
      target=original.from;value='0x0';data='0x';
    }
    const pending=await provider.request('eth_getTransactionByHash',[original.hash]);
    if(pending?.blockHash)throw new Error('Original EOA is included; do not replace');
    if(pending&&(pending.from?.toLowerCase()!==original.from||
       BigInt(pending.nonce)!==BigInt(original.nonce)))
      throw new Error('Original EOA nonce/signer changed');
    const block=await provider.request('eth_getBlockByNumber',['latest',false]);
    if(!block?.baseFeePerGas)throw new Error('EIP-1559 base fee unavailable');
    const bump=x=>BigInt(x)+((BigInt(x)*25n+99n)/100n)||1n;
    const priority=bump(original.maxPriorityFeePerGas);
    let maximum=bump(original.maxFeePerGas);
    const floor=BigInt(block.baseFeePerGas)*2n+priority;
    if(maximum<floor)maximum=floor;
    const choice={level:'custom',maxFeePerGas:'0x'+maximum.toString(16),
      maxPriorityFeePerGas:'0x'+priority.toString(16)};
    const transaction={from:original.from,to:target,value,data};
    const quote=await quoteExtensionEoa420(provider,{chainId:original.chainId,
      from:original.from,transaction,choice,nonceOverride:original.nonce,
      allowPendingReplacement:true});
    const candidate={executionModel:'eoa',action:message.action,chainId:original.chainId,
      from:original.from,to:target,nonce:original.nonce,value,data,
      maxFeePerGas:quote.maxFeePerGas,maxPriorityFeePerGas:quote.maxPriorityFeePerGas};
    validateEoaReplacement420(original,candidate,{minimumBumpPercent:20});
    return {originalId:original.id,originalHash:original.hash,action:message.action,
      chainId:original.chainId,epoch:state.network.epoch,account:state.selectedAccount,
      executionModel:state.account.kind==='hardware'?'hardware':'eoa',transaction,quote,nonce:original.nonce,replaces:original.hash};
  }
  if(original.executionModel!=='erc4337')throw new Error('Unsupported pending execution model');
  let target=original.target,value=original.value,data=original.data;
  if(message.action==='cancel'){
    const code=await provider.request('eth_getCode',[state.account.controller,'latest']);
    if(code!=='0x'&&code!=='0x0')throw Object.assign(new Error('Cancellation requires a verified no-code owner EOA; cannot prove no-op'),{code:4100});
    target=state.account.controller;value='0x0';data='0x';
  }
  const block=await provider.request('eth_getBlockByNumber',['latest',false]);
  if(typeof block?.baseFeePerGas!=='string'||!/^0x[0-9a-fA-F]+$/.test(block.baseFeePerGas))
    throw new Error('Current EIP-1559 base fee unavailable');
  const bump=x=>BigInt(x)+((BigInt(x)*25n+99n)/100n)||1n;
  const priority=bump(original.maxPriorityFeePerGas);
  let maximum=bump(original.maxFeePerGas);
  const floor=BigInt(block.baseFeePerGas)*2n+priority;
  if(maximum<floor)maximum=floor;
  const choice={level:'custom',maxFeePerGas:'0x'+maximum.toString(16),
    maxPriorityFeePerGas:'0x'+priority.toString(16)};
  const transaction={from:original.controller,to:target,value,data};
  const quote=await quoteExtensionSend420(provider,{
    chainId:state.network.expectedChainId,smartAccount:state.account.smartAccount,
    entryPoint:state.account.entryPoint,transaction,choice,strictUserOpGas:true,
    expectedNonce:original.nonce});
  const callData=encodeExecute(target,BigInt(value),data);
  const candidate={executionModel:'erc4337',action:message.action,
    chainId:original.chainId,sender:original.sender,entryPoint:original.entryPoint,
    entryPointVersion:original.entryPointVersion,nonce:original.nonce,
    maxFeePerGas:quote.maxFeePerGas,maxPriorityFeePerGas:quote.maxPriorityFeePerGas,
    initCode:original.initCode,callData,verifiedNoOp:message.action==='cancel'};
  const validated=validateUserOpReplacement420(original,candidate);
  return {originalId:original.id,originalHash:original.userOpHash,action:message.action,
    chainId:state.network.expectedChainId,epoch:state.network.epoch,account:state.selectedAccount,
    transaction,quote,nonce:validated.nonce,entryPoint:validated.entryPoint,
    replaces:validated.replaces,nonceKey:validated.nonceKey};
}

const SECURITY_KINDS_420=new Set(['allowance','capability','session','passkey']);
function securityContextKey420(chainId,account){
 return chainId+'|'+account.toLowerCase();
}
async function securityIdentity420(){
 const wallet=await walletUiState420();
 if(wallet.network.status!=='matched'||!wallet.network.expectedChainId||
    !wallet.selectedAccount)throw Object.assign(new Error('Verified chain and selected wallet account required'),{code:4901});
 const chainId=wallet.network.expectedChainId,account=wallet.selectedAccount,
  epoch=wallet.network.epoch;
 const provider={request:(method,params=[])=>rpcRequest(method,params,{expectedChainId:chainId})};
 return {wallet,chainId,account,epoch,provider};
}
async function securitySmartAccount420(ctx){
 const raw=await readObject(EXTENSION_CONFIG_KEY_420);
 const cfg=raw.smartAccountConfig;
 if(!cfg||raw.chainId!==ctx.chainId)
  throw Object.assign(new Error('Canonical SmartAccount420 deployment configuration unavailable'),{code:4100});
 const chain=await effectiveChain420();
 if(!chain.network.smartAccountApproved)
  throw Object.assign(new Error('SmartAccount420 deployment not independently approved'),{code:4100});
 const smart=await discoverSmartAccount(ctx.provider,ctx.account,cfg);
 if(!smart?.deployed||!smart?.controllerIsOwner||smart.owner!==ctx.account||
    !smart.entryPoint||!smart.verifiedCapabilityRegistry)
  throw Object.assign(new Error('Deployed SmartAccount owner and canonical capability registry are not verified'),{code:4100});
 return smart;
}
async function securityPasskeys420(ctx,smart){
 const saved=(await chrome.storage.local.get('420-wallet-passkey-bindings-v1'))?.['420-wallet-passkey-bindings-v1']||{};
 const bindings=new Map();
 for(const b of Object.values(saved)){
  if(!b||typeof b!=='object'||b.smartAccount?.toLowerCase()!==smart.smartAccount||
     typeof b.credentialIdHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(b.credentialIdHash))continue;
  bindings.set(b.credentialIdHash.toLowerCase(),b);
 }
 return Promise.all([...bindings.values()].slice(0,25).map(async b=>{
  try{
   const row=await readSecurityPasskey420(ctx.provider,smart.smartAccount,b.credentialIdHash);
   return {credentialIdHash:row.credentialIdHash,active:row.active,
    bindingEpoch:String(b.authorizationEpoch),currentEpoch:String(smart.authorizationEpoch),
    relyingParty:b.rpId||'Unknown',status:row.active?'active':'inactive'};
  }catch(error){
   return {credentialIdHash:b.credentialIdHash,active:false,status:'unverified',
    warning:error.message};
  }
 }));
}
async function securityWatchEntries420(ctx,smart=null){
 const raw=(await chrome.storage.local.get(SECURITY_WATCH_KEY))?.[SECURITY_WATCH_KEY]||{};
 const list=Array.isArray(raw[securityContextKey420(ctx.chainId,ctx.account)])?
  raw[securityContextKey420(ctx.chainId,ctx.account)].slice(0,60):[];
 return Promise.all(list.map(async record=>{
  try{
   if(record.kind==='allowance'){
    const owner=record.owner==='smart-account'?smart?.smartAccount:ctx.account;
    if(!owner)throw new Error('SmartAccount ownership needs verification');
    const inspection=await readSecurityAllowance420(ctx.provider,{
      chainId:ctx.chainId,owner,token:record.token,spender:record.spender});
    return {...record,status:BigInt(inspection.value)===0n?'zero':'active',
      value:inspection.value,unlimited:inspection.unlimited,verified:true};
   }
   if(!smart)throw new Error('Canonical SmartAccount deployment not verified');
   if(record.kind==='capability'){
    const inspection=await inspectCapabilityGrant(ctx.provider,smart,record.grantId);
    const expiry=inspection.grant.validUntil;
    const current=BigInt(Math.floor(Date.now()/1000));
    return {...record,status:!inspection.exists?'absent':
      !inspection.belongsToAccount?'foreign':
      inspection.grant.revoked?'revoked':expiry!==0n&&expiry<current?'expired':'active',
      verified:true,principal:inspection.grant.principal,validUntil:expiry.toString(),
      scopeHash:inspection.grant.scopeHash};
   }
   if(record.kind==='session'){
    const epoch=await readSessionEpoch(ctx.provider,smart.smartAccount,record.key);
    return {...record,status:epoch===BigInt(smart.authorizationEpoch)?'active':'expired-or-revoked',
      verified:true,sessionEpoch:epoch.toString(),authorizationEpoch:String(smart.authorizationEpoch)};
   }
   if(record.kind==='passkey'){
    const status=await readSecurityPasskey420(ctx.provider,smart.smartAccount,record.credentialIdHash);
    return {...record,status:status.active?'active':'inactive',verified:true};
   }
   throw new Error('Unknown observed security authority');
  }catch(error){return {...record,status:'unverified',verified:false,warning:error.message};}
 }));
}
async function securityState420(){
 let ctx;
 try{ctx=await securityIdentity420();}
 catch(error){
  // A wrong-chain or offline wallet must still permit local website
  // disconnection and inspection of prior local signature warnings.
  const wallet=await walletUiState420();
  const localRecords=await readObject(PERMISSIONS_KEY);
  const signatures=(await chrome.storage.local.get(SECURITY_SIGNATURES_KEY))?.[SECURITY_SIGNATURES_KEY];
  const account=wallet.selectedAccount,chainId=wallet.network.expectedChainId;
  const sites=wallet.sites.map(site=>({
   ...site,grantedAt:localRecords[site.origin]?.grantedAt??null,
   securityRisk:classifyWebsiteRisk420(site.origin),browserOnly:true
  }));
  const history=(Array.isArray(signatures)?signatures:[]).filter(x=>
   x?.account===account&&x?.chainId===chainId).slice(0,80);
  const watchedRaw=await readObject(SECURITY_WATCH_KEY);
  const watched=account&&chainId&&Array.isArray(watchedRaw[securityContextKey420(chainId,account)])?
   watchedRaw[securityContextKey420(chainId,account)].slice(0,60).map(x=>({
    ...x,status:'unverified',verified:false,warning:'Offline or wrong-chain; no on-chain verification'
   })):[];
  return {chainId,account,epoch:wallet.network.epoch,sites,signatures:history,
   watched,passkeys:[],discovered:{entries:[],partial:true,note:'Chain unavailable'},
   alerts:[...sites.flatMap(site=>site.securityRisk.flags.map(message=>({
    kind:'site',origin:site.origin,message
   }))),{kind:'network',message:'On-chain security authorities cannot be verified: '+error.message}],
   smart:null,smartError:error.message,
   disclosure:'Offline view: local sites, signatures and watch records only. On-chain status is unknown; disconnected sites may retain independent on-chain authority.'};
 }
 let smart=null,smartError=null,passkeys=[],watched=[];
 try{smart=await securitySmartAccount420(ctx);}
 catch(error){smartError=error.message;}
 if(smart)passkeys=await securityPasskeys420(ctx,smart);
 watched=await securityWatchEntries420(ctx,smart);
 let discovered={entries:[],partial:true,note:'No verified ERC-20 contracts in this wallet portfolio to scan'};
 try{
  const verified=(ctx.wallet.portfolio?.tokens||[]).filter(t=>t?.verified===true&&t.hidden!==true&&
    t.spam!==true&&typeof t.address==='string').slice(0,8).map(t=>t.address);
  if(verified.length){
   const owner=ctx.wallet.account.kind==='eoa'?ctx.account:smart?.smartAccount;
   if(owner){
    discovered=await discoverRecentSecurityAllowances420(ctx.provider,{
      chainId:ctx.chainId,owner,tokens:verified,lookbackBlocks:4096,maxSpenders:20});
    discovered.ownerType=ctx.wallet.account.kind==='eoa'?'eoa':'smart-account';
   }
  }
 }catch(error){discovered={entries:[],partial:true,error:error.message,
    note:'Bounded Approval log discovery unavailable; manually inspect exact token and spender'};}
 const signatures=(await chrome.storage.local.get(SECURITY_SIGNATURES_KEY))?.[SECURITY_SIGNATURES_KEY];
 const currentSignatures=(Array.isArray(signatures)?signatures:[]).filter(x=>
  x?.account===ctx.account&&x?.chainId===ctx.chainId).slice(0,80);
 const siteRecords=(await readObject(PERMISSIONS_KEY));
 const sites=ctx.wallet.sites.map(site=>({
  ...site,grantedAt:siteRecords[site.origin]?.grantedAt??null,
  securityRisk:classifyWebsiteRisk420(site.origin),
  browserOnly:true
 }));
 const activity=ctx.wallet.activity.filter(x=>x?.status==='submitted'||x?.status==='pending'||x?.status==='reorganized');
 const alerts=[
  ...sites.flatMap(s=>s.securityRisk.flags.map(message=>({kind:'site',origin:s.origin,message}))),
  ...currentSignatures.filter(x=>x.risk==='high').slice(0,10).map(x=>({
    kind:'signature',origin:x.origin,message:(x.flags||[]).join('; ')||'Risky approved signature recorded'
  })),
  ...watched.filter(x=>x.status==='unverified'||x.unlimited).map(x=>({
    kind:x.kind,message:x.status==='unverified'?x.warning:
      'Very large token allowance: confirm token and spender against trusted sources'
  })),
  ...activity.filter(x=>x.symbol?.includes('security')).map(x=>({
    kind:'pending',message:'Security transaction '+(x.hash||x.userOpHash||x.id)+
    ' submitted. On-chain revocation is NOT verified until canonical confirmation.'
  }))
 ].slice(0,35);
 return {chainId:ctx.chainId,account:ctx.account,epoch:ctx.epoch,sites,
  signatures:currentSignatures,watched,discovered,alerts,passkeys,
  smart:smart?{
    smartAccount:smart.smartAccount,owner:smart.owner,recoveryAuthority:smart.recoveryAuthority,
    pendingRecoveryOwner:smart.pendingRecoveryOwner,recoveryExecutableAt:String(smart.recoveryExecutableAt),
    authorizationEpoch:String(smart.authorizationEpoch),
    authorizationPolicyVersion:String(smart.authorizationPolicyVersion),
    capabilityRegistry:smart.capabilityRegistry,verifiedCapabilityRegistry:smart.verifiedCapabilityRegistry,
    entryPoint:smart.entryPoint
  }:null,smartError,
  disclosure:'This device shows locally recorded activity and explicitly watched authorities only. Discovery is not a complete chain-wide approval or signing history.'};
}
async function securityWatch420(message,remove=false){
 if(remove){
  // Unwatching is a local-only storage action. It must remain possible even
  // when RPC is offline or the current network cannot be qualified.
  const registry=await networkRegistry420(),
    prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const chainId=registry.selectedChainId,account=prefs.selectedAccount;
  if(!chainId||!account)throw Object.assign(new Error('Account and network must be selected'),{code:4100});
  const key=securityContextKey420(chainId,account),all=await readObject(SECURITY_WATCH_KEY);
  const records=Array.isArray(all[key])?all[key]:[];
  const kind=message.authorityKind;
  const match=x=>x.kind===kind&&(
   kind==='allowance'?x.token===String(message.token||'').toLowerCase()&&
     x.spender===String(message.spender||'').toLowerCase()&&x.owner===message.owner:
   kind==='capability'?x.grantId===String(message.grantId||'').toLowerCase():
   kind==='session'?x.key===String(message.key||'').toLowerCase():
   kind==='passkey'?x.credentialIdHash===String(message.credentialIdHash||'').toLowerCase():false
  );
  all[key]=records.filter(x=>!match(x));
  await chrome.storage.local.set({[SECURITY_WATCH_KEY]:all});
  return {removed:records.length!==all[key].length,localOnly:true};
 }
 const ctx=await securityIdentity420();
 const kind=message.authorityKind;
 if(!SECURITY_KINDS_420.has(kind))throw Object.assign(new Error('Unknown security authority type'),{code:-32602});
 let record={kind};
 if(kind==='allowance'){
  const addresses=normalizeSecurityAllowance420(message.token,message.spender);
  record={...record,...addresses,owner:message.owner==='smart-account'?'smart-account':'eoa'};
  const owner=record.owner==='smart-account'?
    (await securitySmartAccount420(ctx)).smartAccount:ctx.account;
  await readSecurityAllowance420(ctx.provider,{chainId:ctx.chainId,owner,...addresses});
 }else{
  const smart=await securitySmartAccount420(ctx);
  if(kind==='capability'){
   if(typeof message.grantId!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(message.grantId))
    throw Object.assign(new Error('Capability grant ID must be bytes32'),{code:-32602});
   const inspected=await inspectCapabilityGrant(ctx.provider,smart,message.grantId);
   if(!inspected.exists||!inspected.belongsToAccount)
    throw Object.assign(new Error('Capability grant does not belong to verified account'),{code:4100});
   record.grantId=inspected.grantId;
  }else if(kind==='session'){
   const key=normalizeExtensionAddress420(message.key);
   await readSessionEpoch(ctx.provider,smart.smartAccount,key);
   record.key=key;
  }else{
   const inspected=await readSecurityPasskey420(ctx.provider,smart.smartAccount,message.credentialIdHash);
   record.credentialIdHash=inspected.credentialIdHash;
  }
 }
 const key=securityContextKey420(ctx.chainId,ctx.account);
 const all=await readObject(SECURITY_WATCH_KEY),arr=Array.isArray(all[key])?all[key]:[];
 const id=JSON.stringify(record),records=arr.filter(x=>JSON.stringify(x)!==id);
 records.unshift(record);
 if(records.length>60)throw Object.assign(new Error('Security watch limit reached'),{code:4100});
 all[key]=records;
 await chrome.storage.local.set({[SECURITY_WATCH_KEY]:all});
 return securityState420();
}
async function securityPrepare420(message){
 const ctx=await securityIdentity420();
 if(!SECURITY_KINDS_420.has(message.authorityKind))
  throw Object.assign(new Error('Invalid revocation class'),{code:-32602});
 if(!extensionCanSend420(ctx.wallet))
  throw Object.assign(new Error('Unlock verified local signing authority first'),{code:4100});
 const smartNeeded=message.authorityKind!=='allowance'||message.owner==='smart-account';
 const smart=smartNeeded?await securitySmartAccount420(ctx):null;
 if(message.authorityKind!=='allowance'&&ctx.wallet.account.kind!=='eoa')
  throw Object.assign(new Error('SmartAccount authority changes require the canonical EOA owner; passkey UserOperations cannot call owner-only revocation methods'),{code:4100});
 const executionModel=message.authorityKind==='allowance'&&message.owner==='smart-account'?'erc4337':'eoa';
 if(executionModel==='erc4337'&&ctx.wallet.account.kind==='eoa')
  throw Object.assign(new Error('Cannot revoke SmartAccount-owned allowances using a different EOA sender'),{code:4100});
 if(executionModel==='eoa'&&ctx.wallet.account.kind!=='eoa')
  throw Object.assign(new Error('Local EOA owner authority is required'),{code:4100});
 const prepare=await prepareSecurityRevocation420(ctx.provider,{
   kind:message.authorityKind,chainId:ctx.chainId,account:ctx.account,
   token:message.token,spender:message.spender,grantId:message.grantId,key:message.key,
   credentialIdHash:message.credentialIdHash,
   smartState:smart?(executionModel==='erc4337'?{...smart,allowanceOwner:smart.smartAccount}:smart):null
 });
 const choice={level:'standard'};
 const quote=executionModel==='eoa'?
   await quoteExtensionEoa420(ctx.provider,{
     chainId:ctx.chainId,from:ctx.account,transaction:prepare.transaction,choice
   }):await quoteExtensionSend420(ctx.provider,{
     chainId:ctx.chainId,smartAccount:smart.smartAccount,entryPoint:smart.entryPoint,
     transaction:prepare.transaction,choice,strictUserOpGas:true
   });
 if((await effectiveChain420()).epoch!==ctx.epoch)
  throw Object.assign(new Error('Chain changed during security review'),{code:4901});
 return {ctx,prepare,quote,executionModel,
  snapshot:{kind:prepare.kind,chainId:ctx.chainId,epoch:ctx.epoch,account:ctx.account,
    contract:prepare.contract,spender:prepare.record.spender??null,
    grantId:prepare.record.grantId??null,key:prepare.record.key??null,
    credentialIdHash:prepare.record.credentialIdHash??null,
    allowance:prepare.record.allowance??null,
    authorizationEpoch:prepare.record.authorizationEpoch??null,
    owner:prepare.record.owner??null,nonce:quote.nonce,blockHash:quote.blockHash,
    maxFeePerGas:quote.maxFeePerGas??null,
    maxPriorityFeePerGas:quote.maxPriorityFeePerGas??null,gasLimit:quote.gasLimit??null,
    gasFees:quote.gasFees??null,
    accountGasLimits:quote.gasBudget?.accountGasLimits??null,
    preVerificationGas:quote.gasBudget?.preVerificationGas??null
  }};
}
async function securityReview420(message){
 const preview=await securityPrepare420(message);
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 const reviewId=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const stored=(await chrome.storage.session.get(SECURITY_REVIEW_KEY))?.[SECURITY_REVIEW_KEY]||{};
 stored[reviewId]={request:{
    authorityKind:message.authorityKind,owner:message.owner??null,token:message.token??null,
    spender:message.spender??null,grantId:message.grantId??null,
    key:message.key??null,credentialIdHash:message.credentialIdHash??null},
   snapshot:preview.snapshot,transaction:preview.prepare.transaction,
   reviewedAt:Date.now()};
 // Short-lived review ledger contains only public on-chain data and exact reviewed envelopes.
 await chrome.storage.session.set({[SECURITY_REVIEW_KEY]:Object.fromEntries(
   [...Object.entries(stored)].filter(([,x])=>Date.now()-x.reviewedAt<120000).slice(-12)
 )});
 return {reviewId,kind:preview.prepare.kind,authority:preview.prepare.authority,
  transaction:preview.prepare.transaction,record:preview.prepare.record,
  quote:preview.quote,executionModel:preview.executionModel,
  explanation:preview.prepare.kind==='allowance'?
   'On-chain ERC-20 approve(spender,0). Disconnecting a website does not change this allowance.':
   'This is an on-chain SmartAccount420 owner-only authority change, not a website permission change.',
  status:'review-required'};
}
async function securitySubmit420(message){
 if(message.confirmed!==true||typeof message.reviewId!=='string')
  throw Object.assign(new Error('Explicit security transaction confirmation required'),{code:4001});
 const stored=(await chrome.storage.session.get(SECURITY_REVIEW_KEY))?.[SECURITY_REVIEW_KEY]||{};
 const prior=stored[message.reviewId];
 if(!prior||Date.now()-prior.reviewedAt>120000)
  throw Object.assign(new Error('Security review expired; inspect on-chain authority again'),{code:4001});
 delete stored[message.reviewId];
 await chrome.storage.session.set({[SECURITY_REVIEW_KEY]:stored});
 const now=await securityPrepare420(prior.request);
 assertSecurityRevocationSnapshot420(prior.snapshot,now.snapshot);
 assertSecurityTransaction420({
   ...now.prepare,transaction:prior.transaction
 },now.prepare);
 if(JSON.stringify(prior.transaction)!==JSON.stringify(now.prepare.transaction))
  throw Object.assign(new Error('Security transaction changed since review'),{code:4001});
 const id='security-'+Date.now()+'-'+message.reviewId;
 const entry={id,at:Date.now(),chainId:now.ctx.chainId,controller:now.ctx.account,
   recipient:now.prepare.contract,
   smartAccount:now.ctx.wallet.account.smartAccount??null,
   executionModel:now.executionModel,symbol:'security '+now.prepare.kind,
   amount:'0x0',status:'pending',hash:null,
   securityAction:now.prepare.kind,securityRecord:now.prepare.record};
 await rememberWalletUiActivity420(entry);
 const tx=now.prepare.transaction;
 const qualified=now.executionModel==='eoa'?
   {...tx,executionModel:'eoa',chainId:now.ctx.chainId,nonce:now.quote.nonce,
    gasLimit:now.quote.gasLimit,maxFeePerGas:now.quote.maxFeePerGas,
    maxPriorityFeePerGas:now.quote.maxPriorityFeePerGas}:
   {...tx,gasFees:now.quote.gasFees,accountGasLimits:now.quote.gasBudget.accountGasLimits,
    preVerificationGas:now.quote.gasBudget.preVerificationGas,expectedNonce:now.quote.nonce};
 let hash=null;
 try{
  hash=await executeWithLocalAuthority({method:'eth_sendTransaction',params:[qualified]},{
    origin:null,accounts:[now.ctx.account],chainId:now.ctx.chainId,epoch:now.ctx.epoch,
    tabId:null,activityId:id
  });
  await rememberWalletUiActivity420({...entry,hash,status:'submitted'});
  return {hash,status:'submitted',kind:now.prepare.kind,
    message:'Transaction submitted. Verify canonical receipt and on-chain authority before treating it as revoked.'};
 }catch(error){
  const signedHash=validHash420(error?.data?.hash)?error.data.hash.toLowerCase():null,
    userOpHash=validHash420(error?.data?.userOpHash)?error.data.userOpHash.toLowerCase():null;
  await rememberWalletUiActivity420({...entry,hash:hash||signedHash,userOpHash,
    status:hash||signedHash||userOpHash?'submitted':'failed',error:error.message});
  throw error;
 }
}

function nftContext420(state){
 if(!state?.selectedAccount||state.network?.status!=='matched'||!state.network?.expectedChainId)
  throw Object.assign(new Error('Verified NFT network/account required'),{code:4901});
 return {chainId:state.network.expectedChainId,epoch:state.network.epoch,
  account:state.selectedAccount,owner:state.portfolio?.balanceAddress||state.selectedAccount,
  scope:portfolioScope420(state.network.expectedChainId,state.selectedAccount)};
}
async function nftProvider420(chainId){
 const chain=await effectiveChain420();
 if(chain.chainId!==chainId)throw Object.assign(new Error('NFT chain changed'),{code:4901});
 return {request:(method,params)=>portfolioRpc420(chain,method,params)};
}
async function nftSelection420(message,{allowSpam=false}={}){
 const wallet=await walletUiState420(),ctx=nftContext420(wallet);
 const ref=normalizedNftRecord420({standard:message.standard,address:message.address,tokenId:message.tokenId});
 const cached=wallet.portfolio?.nfts?.find(n=>n.key===ref.key);
 if(!cached||cached.ownership!=='verified'||cached.stale||cached.hidden||(!allowSpam&&cached.spam))
  throw Object.assign(new Error('Verified visible NFT ownership required. Hidden/spam or unknown assets are blocked'),{code:4100});
 const provider=await nftProvider420(ctx.chainId);
 const asset=await verifyNftOwnership420(provider,ref,ctx.owner);
 if(!asset.verified)throw Object.assign(new Error('NFT is no longer owned on the selected chain'),{code:4100});
 const now=await effectiveChain420();
 if(now.epoch!==ctx.epoch)throw Object.assign(new Error('NFT network changed during verification'),{code:4901});
 return {wallet,ctx,provider,ref,asset,cached};
}
async function nftImport420(message){
 const wallet=await walletUiState420(),ctx=nftContext420(wallet);
 const ref=normalizedNftRecord420({standard:message.standard,address:message.address,
   tokenId:message.tokenId});
 const provider=await nftProvider420(ctx.chainId);
 const verified=await verifyNftOwnership420(provider,ref,ctx.owner);
 if(!verified.verified)throw Object.assign(new Error('Collectible is not owned by this account on this chain'),{code:4100});
 const current=await effectiveChain420();
 if(current.chainId!==ctx.chainId||current.epoch!==ctx.epoch)
   throw Object.assign(new Error('Chain changed during collectible import'),{code:4901});
 const record=await portfolioRecord420(ctx.scope),cache=await readObject(PORTFOLIO_CACHE_KEY_420);
 const stored=cache[ctx.scope]||{};
 const nfts=new Map((stored.nfts||[]).map(n=>[n.key||nftId420(n.address,n.standard,n.tokenId),n]));
 const previous=nfts.get(ref.key);
 nfts.set(ref.key,{...verified,source:'manual',metadata:previous?.metadata||null,
   hidden:record.nftHidden.includes(ref.key),spam:record.nftSpam.includes(ref.key)});
 if(nfts.size>100)throw Object.assign(new Error('NFT inventory limit reached; hide or manage old entries'),{code:4100});
 cache[ctx.scope]={...stored,nfts:[...nfts.values()]};
 await chrome.storage.local.set({[PORTFOLIO_CACHE_KEY_420]:cache});
 return walletUiState420();
}
async function nftMetadata420(message){
 const selected=await nftSelection420(message,{allowSpam:true});
 const {provider,ref,ctx}=selected;
 const id=BigInt(ref.tokenId).toString(16).padStart(64,'0');
 const data=(ref.standard==='ERC721'?'0xc87b56dd':'0x0e89341c')+id;
 const raw=await provider.request('eth_call',[{to:ref.address,data},'latest']);
 const uri=decodeString(raw).slice(0,2048);
 nftMetadataUrl420(uri,{tokenId:ref.tokenId});
 // Never trust metadata name, image or claimed owner as authority.
 const metadata=await fetchSafeNftMetadata420(uri,{tokenId:ref.tokenId});
 const now=await effectiveChain420();
 if(now.epoch!==ctx.epoch)throw Object.assign(new Error('Network changed while fetching NFT metadata'),{code:4901});
 const newest=await verifyNftOwnership420(provider,ref,ctx.owner);
 if(!newest.verified)throw Object.assign(new Error('NFT ownership changed while fetching metadata'),{code:4100});
 const cache=await readObject(PORTFOLIO_CACHE_KEY_420);
 const stored=cache[ctx.scope]||{};
 stored.nfts=(stored.nfts||[]).map(n=>n.key===ref.key?
   {...n,metadata,spam:n.spam||metadata.flags.spam,hidden:n.hidden||metadata.flags.spam}:n);
 cache[ctx.scope]=stored;
 await chrome.storage.local.set({[PORTFOLIO_CACHE_KEY_420]:cache});
 return {metadata,nft:newest};
}
async function nftApprovalStatus420(message){
 const selected=await nftSelection420(message,{allowSpam:true});
 const inspected=await readNftApproval420(selected.provider,{
  asset:selected.ref,owner:selected.ctx.owner,operator:message.operator??null,
  collectionWide:message.collectionWide===true
 });
 const still=await effectiveChain420();
 if(still.epoch!==selected.ctx.epoch)throw Object.assign(new Error('NFT network changed during approval inspection'),{code:4901});
 return inspected;
}
async function nftVisibility420(message){
 const state=await walletUiState420(),ctx=nftContext420(state),
   ref=normalizedNftRecord420(message);
 if(typeof message.hidden!=='boolean'&&typeof message.spam!=='boolean')
  throw Object.assign(new Error('Explicit NFT spam/visibility choice required'),{code:-32602});
 const settings=await portfolioRecord420(ctx.scope);
 for(const [field,value] of [['nftHidden',message.hidden],['nftSpam',message.spam]]){
  if(typeof value==='boolean'){
   settings[field]=value?[...new Set([...settings[field],ref.key])]:
     settings[field].filter(x=>x!==ref.key);
  }
 }
 if(typeof message.spam==='boolean'){
  settings.nftTrusted=message.spam?
    settings.nftTrusted.filter(x=>x!==ref.key):
    [...new Set([...settings.nftTrusted,ref.key])];
 }
 await savePortfolioRecord420(ctx.scope,settings);
 return walletUiState420();
}
async function nftPrepare420(message){
 const selected=await nftSelection420(message);
 if(!extensionCanSend420(selected.wallet))
  throw Object.assign(new Error('Unlock qualified local EOA or passkey authority to manage NFTs'),{code:4100});
 const {wallet,ctx,provider,ref,asset}=selected,action=message.action;
 if(!['transfer','approve','revoke'].includes(action))
  throw Object.assign(new Error('Unsupported NFT management action'),{code:-32602});
 let call;
 if(action==='transfer'){
  call=nftTransferCall420({standard:ref.standard,contract:ref.address,tokenId:ref.tokenId,
   from:ctx.owner,to:message.recipient,quantity:message.quantity??'1'});
  if(BigInt(call.quantity)>BigInt(asset.quantity))
   throw Object.assign(new Error('NFT transfer exceeds the verified current holding'),{code:4100});
 }else{
  call=nftApprovalCall420({standard:ref.standard,contract:ref.address,tokenId:ref.tokenId,
   owner:ctx.owner,operator:message.operator,
   approved:action==='approve',collectionWide:message.collectionWide===true});
  if(action==='revoke'){
   const current=await readNftApproval420(provider,{
     asset:ref,owner:ctx.owner,operator:call.operator,collectionWide:call.collectionWide
   });
   if(!current.approved||ref.standard==='ERC721'&&!call.collectionWide&&current.approvedOperator!==call.operator)
    throw Object.assign(new Error('Operator no longer holds this exact NFT approval'),{code:4001});
  }
 }
 const transaction={from:ctx.account,to:call.to,value:'0x0',data:call.data};
 const choice={level:'standard'};
 const quote=wallet.account.kind==='eoa'?
  await quoteExtensionEoa420(provider,{chainId:ctx.chainId,from:ctx.account,transaction,choice}):
  await quoteExtensionSend420(provider,{chainId:ctx.chainId,smartAccount:wallet.account.smartAccount,
   entryPoint:wallet.account.entryPoint,transaction,choice,strictUserOpGas:true});
 const now=await effectiveChain420();
 if(now.chainId!==ctx.chainId||now.epoch!==ctx.epoch)
  throw Object.assign(new Error('NFT chain changed while quoting'),{code:4901});
 return {ctx,asset,ref,action,call,transaction,quote,executionModel:wallet.account.kind==='eoa'?'eoa':'erc4337',
  snapshot:{chainId:ctx.chainId,epoch:ctx.epoch,controller:ctx.account,owner:ctx.owner,
   key:ref.key,quantity:asset.quantity,action,recipient:call.recipient||null,
   operator:call.operator||null,approved:call.approved??null,
   collectionWide:call.collectionWide??null,data:call.data,
   nonce:quote.nonce,blockHash:quote.blockHash,
   gasLimit:quote.gasLimit||null,maxFeePerGas:quote.maxFeePerGas||null,
   maxPriorityFeePerGas:quote.maxPriorityFeePerGas||null,gasFees:quote.gasFees||null,
   accountGasLimits:quote.gasBudget?.accountGasLimits||null,
   preVerificationGas:quote.gasBudget?.preVerificationGas||null}};
}
async function nftReview420(message){
 const prepared=await nftPrepare420(message);
 const bytes=crypto.getRandomValues(new Uint8Array(16)),
   reviewId=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const record={message:{
   action:message.action,standard:message.standard,address:message.address,
   tokenId:message.tokenId,recipient:message.recipient??null,
   quantity:message.quantity??'1',operator:message.operator??null,
   collectionWide:message.collectionWide===true
  },snapshot:prepared.snapshot,transaction:prepared.transaction,createdAt:Date.now()};
 const state=(await chrome.storage.session.get(NFT_REVIEW_KEY_420))?.[NFT_REVIEW_KEY_420]||{};
 state[reviewId]=record;
 await chrome.storage.session.set({[NFT_REVIEW_KEY_420]:Object.fromEntries(
  Object.entries(state).filter(([,v])=>Date.now()-v.createdAt<120000).slice(-12)
 )});
 return {reviewId,action:prepared.action,asset:prepared.asset,
  transaction:prepared.transaction,quote:prepared.quote,call:prepared.call,
  executionModel:prepared.executionModel,
  warning:prepared.action==='approve'&&prepared.call.collectionWide?
   'CRITICAL: approving this operator gives control of every NFT in this collection owned by this account.':
   'NFT transfers and approvals are on-chain and cannot be undone by disconnecting a website.'};
}
async function nftSubmit420(message){
 if(message.confirmed!==true||typeof message.reviewId!=='string')
  throw Object.assign(new Error('Explicit NFT confirmation required'),{code:4001});
 const all=(await chrome.storage.session.get(NFT_REVIEW_KEY_420))?.[NFT_REVIEW_KEY_420]||{},
  previous=all[message.reviewId];
 if(!previous||Date.now()-previous.createdAt>120000)
  throw Object.assign(new Error('NFT review expired; verify ownership again'),{code:4001});
 delete all[message.reviewId];
 await chrome.storage.session.set({[NFT_REVIEW_KEY_420]:all});
 const current=await nftPrepare420(previous.message);
 if(JSON.stringify(current.snapshot)!==JSON.stringify(previous.snapshot)||
   JSON.stringify(current.transaction)!==JSON.stringify(previous.transaction))
  throw Object.assign(new Error('NFT ownership, network, calldata, nonce or fee changed; review again'),{code:4001});
 const ctx=current.ctx,quote=current.quote,tx=current.transaction;
 const id='nft-'+Date.now()+'-'+message.reviewId;
 const entry={id,at:Date.now(),chainId:ctx.chainId,controller:ctx.account,
  smartAccount:current.executionModel==='erc4337'?ctx.owner:null,
  executionModel:current.executionModel,recipient:tx.to,amount:'0x0',
  symbol:current.ref.standard+' #'+current.ref.tokenId+' '+current.action,
  status:'pending',hash:null,asset:current.ref};
 await rememberWalletUiActivity420(entry);
 let hash=null;
 try{
  const qualified=current.executionModel==='eoa'?
    {...tx,executionModel:'eoa',chainId:ctx.chainId,nonce:quote.nonce,
     gasLimit:quote.gasLimit,maxFeePerGas:quote.maxFeePerGas,
     maxPriorityFeePerGas:quote.maxPriorityFeePerGas}:
    {...tx,gasFees:quote.gasFees,accountGasLimits:quote.gasBudget.accountGasLimits,
     preVerificationGas:quote.gasBudget.preVerificationGas,expectedNonce:quote.nonce};
  hash=await executeWithLocalAuthority({method:'eth_sendTransaction',params:[qualified]},
    {origin:null,chainId:ctx.chainId,epoch:ctx.epoch,accounts:[ctx.account],tabId:null,activityId:id});
  await rememberWalletUiActivity420({...entry,hash,status:'submitted'});
  return {hash,status:'submitted',message:'Submitted; ownership and approvals must be reverified on chain after receipt.'};
 }catch(error){
  const userOpHash=validHash420(error?.data?.userOpHash)?error.data.userOpHash.toLowerCase():null;
  await rememberWalletUiActivity420({...entry,hash,userOpHash,status:hash||userOpHash?'submitted':'failed',
   error:error.message});
  throw error;
 }
}
async function handleWalletUi420(message) {
  const kind=message.kind;
  if(kind==='get-state')return walletUiState420();
  if(kind==='nft-import')return nftImport420(message);
  if(kind==='nft-metadata')return nftMetadata420(message);
  if(kind==='nft-approval-status')return nftApprovalStatus420(message);
  if(kind==='nft-visibility')return nftVisibility420(message);
  if(kind==='nft-review')return nftReview420(message);
  if(kind==='nft-submit')return nftSubmit420(message);
  if(kind==='security-state')return securityState420();
  if(kind==='security-watch')return securityWatch420(message);
  if(kind==='security-unwatch')return securityWatch420(message,true);
  if(kind==='security-review')return securityReview420(message);
  if(kind==='security-submit')return securitySubmit420(message);
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
    const latest=BigInt(await provider.request('eth_blockNumber',[]));
    const sourceAccount=(await walletUiState420()).portfolio?.balanceAddress||account;
    const older=message.older===true;
    let found={tokens:[],nfts:[],unverified:[],limited:true};
    if(!older){
      const from=BigInt(record.discoveryFrom),start=from>latest?latest:from,
        bounded=latest-start>2048n?latest-2048n:start;
      found=await discoverTokens420(provider,sourceAccount,{
        fromBlock:bounded,toBlock:latest,maxSpan:2048n});
      const known=new Map(record.tokens.map(x=>[x.address,x]));
      for(const token of found.tokens){
        const previous=known.get(token.address);
        known.set(token.address,{...token,source:previous?.source||'discovered'});
      }
      record.tokens=[...known.values()].slice(0,60);
      record.discoveryFrom=(latest+1n).toString();
    }
    // Two independent supported RPC checkpoints: forward events and historical
    // backfill. Every request reads at most 2048 blocks, never skipping a gap.
    const window=nftIndexWindow420(latest,{
      nextForward:record.nftIndexFrom,nextBack:record.nftIndexBefore,older});
    const foundNfts=window.complete?
      {nfts:[],fromBlock:window.from.toString(),toBlock:window.to.toString(),limited:true}:
      await discoverNftTransfers420(provider,sourceAccount,{
        fromBlock:window.from,toBlock:window.to,maxSpan:2048n,
        maxLogs:300,maxAssets:90});
    const cache=await readObject(PORTFOLIO_CACHE_KEY_420),previous=cache[scope]||{};
    const nfts=new Map((previous.nfts||[]).map(x=>[
      x.key||nftId420(x.address,x.standard,x.tokenId),x
    ]));
    for(const nft of foundNfts.nfts){
      const prior=nfts.get(nft.key);
      nfts.set(nft.key,{...nft,metadata:prior?.metadata||null,
        hidden:record.nftHidden.includes(nft.key)||prior?.hidden===true,
        spam:record.nftSpam.includes(nft.key)||prior?.spam===true});
    }
    const current=await effectiveChain420();
    if(current.chainId!==chain.chainId||current.epoch!==chain.epoch)
      throw Object.assign(new Error('NFT index network changed during scan'),{code:4901});
    if(!window.complete){
      record.nftIndexFrom=window.nextForward??record.nftIndexFrom;
      record.nftIndexBefore=window.nextBack??record.nftIndexBefore;
    }
    await savePortfolioRecord420(scope,record);
    cache[scope]={...previous,nfts:[...nfts.values()].slice(0,100)};
    await chrome.storage.local.set({[PORTFOLIO_CACHE_KEY_420]:cache});
    return {discovery:{...found,tokens:found.tokens.length,nfts:foundNfts.nfts.length,
      nftFrom:foundNfts.fromBlock,nftTo:foundNfts.toBlock,nftOlder:older,
      nftBackfillComplete:window.complete&&older,
      nftNextBlock:record.nftIndexFrom,nftBeforeBlock:record.nftIndexBefore,partial:true},
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
  if(kind==='replacement-preflight')return replacementPreview420(message);
  if(kind==='replacement-submit'){
    if(message.confirmed!==true)throw Object.assign(new Error('Explicit replacement confirmation required'),{code:4001});
    const preview=await replacementPreview420(message);
    const provided=message.preview;
    if(!provided||provided.action!==preview.action||provided.originalId!==preview.originalId||
       provided.originalHash!==preview.originalHash||provided.chainId!==preview.chainId||
       provided.epoch!==preview.epoch||provided.account!==preview.account||
       provided.quote?.blockHash!==preview.quote.blockHash||
       (['eoa','hardware'].includes(preview.executionModel)?
         (provided.quote?.nonce!==preview.quote.nonce||
          provided.quote?.gasLimit!==preview.quote.gasLimit||
          provided.quote?.maxFeePerGas!==preview.quote.maxFeePerGas||
          provided.quote?.maxPriorityFeePerGas!==preview.quote.maxPriorityFeePerGas):
         (provided.quote?.gasFees!==preview.quote.gasFees||
          provided.quote?.nonce!==preview.quote.nonce||
          provided.quote?.gasBudget?.accountGasLimits!==preview.quote.gasBudget?.accountGasLimits||
          provided.quote?.gasBudget?.preVerificationGas!==preview.quote.gasBudget?.preVerificationGas))||
       JSON.stringify(provided.transaction)!==JSON.stringify(preview.transaction))
      throw Object.assign(new Error('Replacement fee, nonce, chain or intent changed; review again'),{code:4001});
    const source=(await readWalletUiActivity420()).find(x=>x.id===preview.originalId);
    const id='replacement-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    const entry={id,at:Date.now(),chainId:preview.chainId,controller:preview.account,
      smartAccount:source.smartAccount,recipient:preview.transaction.to,
      amount:preview.action==='cancel'?'0':source.amount,symbol:source.symbol,
      status:'pending',hash:null,action:preview.action,
      executionModel:preview.executionModel||'erc4337',
      replaces:preview.replaces,originalId:preview.originalId};
    await rememberWalletUiActivity420(entry);
    let hash=null;
    try{
      hash=await executeWithLocalAuthority({
        method:'eth_sendTransaction',
        params:[['eoa','hardware'].includes(preview.executionModel)?
          {...preview.transaction,executionModel:preview.executionModel,chainId:preview.chainId,
            nonce:preview.nonce,gasLimit:preview.quote.gasLimit,
            maxFeePerGas:preview.quote.maxFeePerGas,
            maxPriorityFeePerGas:preview.quote.maxPriorityFeePerGas}:
          {...preview.transaction,gasFees:preview.quote.gasFees,expectedNonce:preview.nonce,
            accountGasLimits:preview.quote.gasBudget.accountGasLimits,
            preVerificationGas:preview.quote.gasBudget.preVerificationGas}]
      },{origin:null,chainId:preview.chainId,epoch:preview.epoch,accounts:[preview.account],tabId:null,activityId:id});
      await rememberWalletUiActivity420({...entry,status:'submitted',hash});
      return {status:'submitted',hash,originalId:source.id};
    }catch(error){
      const userOpHash=validHash420(error?.data?.userOpHash)?error.data.userOpHash.toLowerCase():null;
      const submittedHash=hash||(validHash420(error?.data?.hash)?error.data.hash.toLowerCase():null);
      await rememberWalletUiActivity420({...entry,status:(submittedHash||userOpHash)?'submitted':'failed',
        hash:submittedHash,userOpHash,
        error:error?.message||'Replacement not authorized'});
      throw error;
    }
  }
  if(kind==='send-native-max'){
    const state=await walletUiState420();
    if(!['eoa','hardware'].includes(state.account.kind)||!extensionCanSend420(state)||
       state.selectedAccount!==message.account||
       state.network.expectedChainId!==message.chainId||
       state.network.epoch!==message.epoch)
      throw Object.assign(new Error('Unlocked EOA and unchanged verified chain required'),{code:4100});
    const provider={request:(method,params)=>rpcRequest(method,params,
      {expectedChainId:state.network.expectedChainId})};
    const qualifiedNamesConfig=(await readObject(EXTENSION_CONFIG_KEY_420)).qualifiedNamesRuntime||null;
    const resolved=await resolveExtensionRecipient420(provider,{
      input:message.recipient,chainId:message.chainId,qualifiedNamesConfig});
    const choice=normalizeExtensionFeeChoice420(message.feeChoice);
    const quote=await quoteExtensionEoa420(provider,{
      chainId:message.chainId,from:state.selectedAccount,
      transaction:{to:resolved.recipient,value:'0x0',data:'0x'},choice});
    const balance=await provider.request('eth_getBalance',[state.selectedAccount,'pending']);
    if(typeof balance!=='string'||!/^0x[0-9a-fA-F]+$/.test(balance))
      throw new Error('Verified pending EOA balance unavailable');
    const available=BigInt(balance)-BigInt(quote.totalFeeWei);
    if(available<=0n)throw new Error('Insufficient EOA balance after maximum EIP-1559 gas cost');
    const newQuote=await quoteExtensionEoa420(provider,{
      chainId:message.chainId,from:state.selectedAccount,
      transaction:{to:resolved.recipient,value:'0x'+available.toString(16),data:'0x'},choice});
    if(quote.nonce!==newQuote.nonce||quote.gasLimit!==newQuote.gasLimit||
       quote.maxFeePerGas!==newQuote.maxFeePerGas||
       quote.maxPriorityFeePerGas!==newQuote.maxPriorityFeePerGas||
       quote.blockHash!==newQuote.blockHash)
      throw new Error('Gas cost or EOA nonce changed during Max; recompute');
    const active=await effectiveChain420();
    if(active.chainId!==message.chainId||active.epoch!==message.epoch)
      throw new Error('Network changed while computing native Max');
    return {raw:available.toString(),decimals:state.config.nativeCurrency.decimals,
      symbol:state.config.nativeCurrency.symbol,recipientSnapshot:resolved,
      feeWei:quote.totalFeeWei,nonce:quote.nonce};
  }
  if(kind==='send-preflight'){
    const state=await walletUiState420();
    if(state.network.expectedChainId!==message.chainId||state.network.epoch!==message.epoch||
       state.selectedAccount!==message.account||!extensionCanSend420(state))
      throw Object.assign(new Error('Account, signing authority or network changed'),{code:4901});
    const nameProvider={request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})};
    const qualifiedNamesConfig=(await readObject(EXTENSION_CONFIG_KEY_420)).qualifiedNamesRuntime||null;
    const recipientSnapshot=await resolveExtensionRecipient420(nameProvider,{
      input:message.recipient,chainId:state.network.expectedChainId,qualifiedNamesConfig});
    const transaction=buildExtensionSend420({
      from:state.account.controller,recipient:recipientSnapshot.recipient,amount:message.amount,
      asset:message.asset,
      trackedAssets:state.portfolio?.tokens?.filter(t=>t.verified&&!t.hidden&&!t.spam&&t.balance?.status==='spendable')||[],
    });
    const provider={request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})};
    const choice=normalizeExtensionFeeChoice420(message.feeChoice);
    const quote=['eoa','hardware'].includes(state.account.kind)?
      await quoteExtensionEoa420(provider,{chainId:state.network.expectedChainId,
        from:state.account.controller,transaction:transaction.transaction,choice}):
      await quoteExtensionSend420(provider,{chainId:state.network.expectedChainId,
        smartAccount:state.account.smartAccount,entryPoint:state.account.entryPoint,
        transaction:transaction.transaction,choice,strictUserOpGas:true});
    const current=await effectiveChain420();
    if(current.chainId!==message.chainId||current.epoch!==message.epoch)
      throw Object.assign(new Error('Chain changed during preflight'),{code:4901});
    return {transaction,quote,recipientSnapshot};
  }
  if(kind==='send'){
    if(message.confirmed!==true)throw Object.assign(new Error('Explicit transaction confirmation required'),{code:4001});
    const state=await walletUiState420();
    if(state.network.expectedChainId!==message.chainId||state.network.epoch!==message.epoch||state.selectedAccount!==message.account)
      throw Object.assign(new Error('Network or account changed since review'),{code:4901});
    if(!extensionCanSend420(state))throw Object.assign(new Error('Verified deployed SmartAccount owner and matching chain required'),{code:4100});
    const nameProvider={request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})};
    const qualifiedNamesConfig=(await readObject(EXTENSION_CONFIG_KEY_420)).qualifiedNamesRuntime||null;
    const recipientSnapshot=await resolveExtensionRecipient420(nameProvider,{
      input:message.recipient,chainId:state.network.expectedChainId,qualifiedNamesConfig});
    assertExtensionRecipientSnapshot420(message.recipientSnapshot,recipientSnapshot);
    const request=buildExtensionSend420({
      from:state.account.controller,recipient:recipientSnapshot.recipient,amount:message.amount,
      asset:message.asset,trackedAssets:state.portfolio?.tokens?.filter(t=>t.verified&&!t.hidden&&!t.spam&&t.balance?.status!=='unavailable')||[],
    });
    const choice=normalizeExtensionFeeChoice420(message.feeChoice);
    const provider={request:(method,params)=>rpcRequest(method,params,{expectedChainId:state.network.expectedChainId})};
    const quote=['eoa','hardware'].includes(state.account.kind)?
      await quoteExtensionEoa420(provider,{chainId:state.network.expectedChainId,
        from:state.account.controller,transaction:request.transaction,choice}):
      await quoteExtensionSend420(provider,{chainId:state.network.expectedChainId,
        smartAccount:state.account.smartAccount,entryPoint:state.account.entryPoint,
        transaction:request.transaction,choice,strictUserOpGas:true});
    if(!message.preflight||message.preflight.chainId!==quote.chainId||
       message.preflight.from!==quote.from||message.preflight.to!==quote.to||
       message.preflight.blockHash!==quote.blockHash||
       (['eoa','hardware'].includes(state.account.kind)?
         (message.preflight.executionModel!=='eoa'||
          message.preflight.nonce!==quote.nonce||
          message.preflight.gasLimit!==quote.gasLimit||
          message.preflight.maxFeePerGas!==quote.maxFeePerGas||
          message.preflight.maxPriorityFeePerGas!==quote.maxPriorityFeePerGas):
         (message.preflight.gasFees!==quote.gasFees||
          message.preflight.nonce!==quote.nonce||message.preflight.entryPoint!==quote.entryPoint||
          message.preflight.gasBudget?.accountGasLimits!==quote.gasBudget?.accountGasLimits||
          message.preflight.gasBudget?.preVerificationGas!==quote.gasBudget?.preVerificationGas)))
      throw Object.assign(new Error('Preflight changed since review; review transaction again'),{code:4001});
    const id='wallet-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    const entry={id,at:Date.now(),chainId:state.network.expectedChainId,
      controller:state.account.controller,smartAccount:state.account.smartAccount,
      executionModel:['eoa','hardware'].includes(state.account.kind)?'eoa':'erc4337',
      recipient:request.summary.recipient,amount:request.summary.amount,
      symbol:request.summary.symbol,status:'pending',hash:null};
    await rememberWalletUiActivity420(entry);
    let hash=null;
    try {
      hash=await executeWithLocalAuthority(
        {method:'eth_sendTransaction',params:[['eoa','hardware'].includes(state.account.kind)?
          {...request.transaction,executionModel:state.account.kind==='hardware'?'hardware':'eoa',chainId:quote.chainId,
            recipientSnapshot,
            nonce:quote.nonce,gasLimit:quote.gasLimit,
            maxFeePerGas:quote.maxFeePerGas,maxPriorityFeePerGas:quote.maxPriorityFeePerGas}:
          {...request.transaction,gasFees:quote.gasFees,feeChoice:choice.level,
            recipientSnapshot,
            accountGasLimits:quote.gasBudget.accountGasLimits,
            preVerificationGas:quote.gasBudget.preVerificationGas,expectedNonce:quote.nonce}]},
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
  if(message?.source==='420-wallet-manager-ui'&&message.kind==='hardware-trezor'){
    (async()=>{try{
      if(sender?.id!==chrome.runtime.id||sender.url?.split('?')[0]!==chrome.runtime.getURL('wallet.html'))
        throw Object.assign(new Error('Untrusted Trezor account discovery UI'),{code:4100});
      if(message.method!=='ethereumGetAddress')
        throw Object.assign(new Error('Wallet manager may only request device address'),{code:4100});
      sendResponse({result:await requestTrezor420(message.method,message.params)});
    }catch(error){sendResponse({error:serializeError(error)});}})();
    return true;
  }
  if(message?.source==='420-wallet-authority-ui'&&message.kind==='authority-trezor'){
    (async()=>{try{
      if(sender?.id!==chrome.runtime.id||sender.url?.split('?')[0]!==chrome.runtime.getURL('authority.html')||
         new URL(sender.url).searchParams.get('request')!==message.authorityRequestId)
        throw Object.assign(new Error('Untrusted hardware signing authority'),{code:4100});
      const pending=(await readObject(AUTHORITY_KEY))[message.authorityRequestId];
      const account=pending?.context?.accounts?.[0],meta=(await accountMetadata420())[account];
      const effective=await effectiveChain420(pending?.context?.origin);
      if(!pending||meta?.type!=='hardware'||meta?.provider!=='trezor'||meta?.signingQualified!==true||
         !account||effective.chainId!==pending.context.chainId||effective.epoch!==pending.context.epoch)
        throw Object.assign(new Error('Trezor account or chain is no longer authorized'),{code:4100});
      const allowed=pending.request.method==='eth_sendTransaction'?'ethereumSignTransaction':
        pending.request.method==='eth_signTypedData_v4'?'ethereumSignTypedData':
        pending.request.method==='personal_sign'?'ethereumSignMessage':null;
      if(!['ethereumGetAddress',allowed].includes(message.method))
        throw Object.assign(new Error('Trezor method differs from approved request'),{code:4100});
      sendResponse({result:await requestTrezor420(message.method,message.params)});
    }catch(error){sendResponse({error:serializeError(error)});}})();
    return true;
  }
  if(message?.source==='420-wallet-authority-ui'&&message.kind==='authority-eoa-signed'){
    (async()=>{try{sendResponse({result:await recordAuthoritySignedEoa420(
      sender,message.authorityRequestId,message.submission)});
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
        if(request.method==='eth_sendRawTransaction'){
          if(approval.request?.method!=='eth_sendTransaction'||
             !['eoa','hardware'].includes(approval.request?.params?.[0]?.executionModel))
            throw Object.assign(new Error('Raw transaction broadcast is restricted to the local EOA authority'),{code:4100});
          const activePrefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
          if(activePrefs.selectedAccount!==approval.request.params[0].from?.toLowerCase())
            throw Object.assign(new Error('Selected hardware/EOA account changed before broadcast'),{code:4100});
          const currentChain=await effectiveChain420(approval.context.origin);
          if(currentChain.chainId!==approval.context.chainId||currentChain.epoch!==approval.context.epoch)
            throw Object.assign(new Error('Network changed before raw broadcast'),{code:4901});
          const raw=request.params?.[0];
          const localHash=assertEoaRawMatchesAuthority420(raw,approval.request.params[0]);
          const rpcHash=await rpcRequest('eth_sendRawTransaction',[raw],
            {origin:approval.context.origin,expectedChainId:approval.context.chainId});
          if(typeof rpcHash!=='string'||rpcHash.toLowerCase()!==localHash)
            throw new Error('RPC response hash differs from locally signed EOA transaction');
          sendResponse({result:localHash});
          return;
        }
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
      else if (['wallet_getPermissions','wallet_requestPermissions','wallet_revokePermissions','wallet_getCapabilities','wallet_sendCalls','wallet_getCallsStatus'].includes(request.method))
        result=await handleDappCompatibility420(request,context);
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
