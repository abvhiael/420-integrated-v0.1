import {normalizeExtensionConfig420, normalizeExtensionPreferences420, validateExtensionNetwork420, normalizeExtensionChain420, normalizeExtensionRpc420, normalizeExtensionAddress420, buildExtensionSend420, extensionCanSend420, EXTENSION_CONFIG_KEY_420, EXTENSION_UI_KEY_420, EXTENSION_ACTIVITY_KEY_420} from './core/extension-wallet-ui.js';
import {discoverSmartAccount} from './core/accounts.js';
import {readNativeBalance,readErc20Balance} from './core/portfolio.js';
const CHANNEL = '420-wallet-provider-v1';
const PERMISSIONS_KEY = '420-wallet-origin-permissions-v1';
const APPROVALS_KEY = '420-wallet-pending-approvals-v1';
const AUTHORITY_KEY = '420-wallet-pending-authority-v1';
const READ_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_call','eth_estimateGas','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs','net_version']);
const AUTHORITY_TRANSPORT_METHODS = new Set([...READ_METHODS, 'eth_sendUserOperation', 'eth_getUserOperationReceipt']);
const APPROVAL_METHODS = new Set(['eth_requestAccounts','eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const LOCAL_AUTHORITY_METHODS = new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const LOCAL_AUTHORITY_SOURCE = '420-wallet-local-authority';
const VAULT_KEY = '420-wallet-encrypted-vault-v1';
const VAULT_LEASE_KEY = '420-wallet-vault-lease-v1';
async function vaultLockState420() {
  const vault = (await chrome.storage.local.get(VAULT_KEY))?.[VAULT_KEY];
  if (!vault) return { exists: false, unlocked: false };
  const lease=(await chrome.storage.session.get(VAULT_LEASE_KEY))?.[VAULT_LEASE_KEY];
  return {exists:true,unlocked:typeof lease?.expiresAt==='number' && lease.expiresAt > Date.now() && lease.expiresAt<=Date.now()+30*60*1000};
}
async function accountVisibility420(accounts){
  const lock=await vaultLockState420();
  if (!lock.exists || lock.unlocked) return accounts;
  const config=await readObject('420-wallet-extension-config-v1');
  const vaultAccounts=new Set((config.vaultAccounts||[]).map(x=>String(x).toLowerCase()));
  return accounts.filter(a=>!vaultAccounts.has(String(a).toLowerCase()));
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

async function accountsFor(origin) {
  const permissions = await readObject(PERMISSIONS_KEY);
  const granted=Array.isArray(permissions[origin]?.accounts) ? permissions[origin].accounts : [];
  return accountVisibility420(granted);
}

async function setAccounts(origin, accounts) {
  const permissions = await readObject(PERMISSIONS_KEY);
  permissions[origin] = { accounts, grantedAt: Date.now() };
  await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
}

async function rpcRequest(method, params) {
  if (LOCAL_AUTHORITY_METHODS.has(method)) {
    throw Object.assign(new Error('sensitive wallet methods cannot use RPC signing or submission authority'), { code: 4100 });
  }
  const config = await readObject('420-wallet-extension-config-v1');
  const rpcUrl = config.rpcUrl;
  if (!rpcUrl) throw Object.assign(new Error('420 Wallet RPC endpoint is not configured'), { code: 4900 });
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  if (!response.ok) throw Object.assign(new Error(`rpc http ${response.status}`), { code: 4900 });
  const payload = await response.json();
  if (payload.error) throw Object.assign(new Error(payload.error.message || 'rpc error'), { code: payload.error.code, data: payload.error.data });
  return payload.result;
}

async function executeWithLocalAuthority(request, context) {
  if (!LOCAL_AUTHORITY_METHODS.has(request.method)) {
    throw Object.assign(new Error(`unsupported local authority method: ${request.method}`), { code: 4200 });
  }
  const authorityRequestId = `authority-${context.tabId ?? 'tab'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pending = await readObject(AUTHORITY_KEY);
  pending[authorityRequestId] = {
    authorityRequestId,
    request,
    context: { origin: context.origin, accounts: context.accounts ?? [], tabId: context.tabId ?? null },
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
        resolve(message.result);
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
  if (request.method === 'eth_accounts') return accountsFor(origin);
  if (request.method === 'eth_requestAccounts') {
    const existing = await accountsFor(origin);
    if (existing.length) return existing;
    const config = await readObject('420-wallet-extension-config-v1');
    const available = await accountVisibility420(Array.isArray(config.accounts) ? config.accounts : []);
    if (!available.length) throw Object.assign(new Error('no wallet accounts available'), { code: 4100 });
    const decision = await createApproval({ ...request, availableAccounts: available }, context);
    const selected = Array.isArray(decision.accounts) && decision.accounts.length ? decision.accounts : available;
    await setAccounts(origin, selected);
    chrome.tabs.sendMessage(context.tabId, { source: '420-wallet-service-worker', channel: CHANNEL, kind: 'event', event: 'accountsChanged', data: selected }).catch(() => {});
    return selected;
  }
  const granted = await accountsFor(origin);
  if (!granted.length) throw Object.assign(new Error('origin is not connected to 420 Wallet'), { code: 4100 });
  await createApproval(request, { ...context, accounts: granted });
  return executeWithLocalAuthority(request, { ...context, accounts: granted });
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
async function rememberWalletUiActivity420(entry) {
  const current=await readWalletUiActivity420();
  const next=[entry,...current.filter(x=>x.id!==entry.id)].slice(0,40);
  await chrome.storage.local.set({[EXTENSION_ACTIVITY_KEY_420]:next});
}
async function walletUiState420() {
  const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
  const prefs=normalizeExtensionPreferences420(await readObject(EXTENSION_UI_KEY_420));
  const selected=config.accounts.includes(prefs.selectedAccount)?prefs.selectedAccount:config.accounts[0]||null;
  const permissions=await readObject(PERMISSIONS_KEY);
  const sites=Object.entries(permissions).filter(([origin,x])=>{
    try {normalizeOrigin(origin);return Array.isArray(x?.accounts)&&x.accounts.length>0;}catch{return false;}
  }).map(([origin,x])=>({origin,accounts:x.accounts.filter(a=>typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a))})).sort((a,b)=>a.origin.localeCompare(b.origin));
  const state={
    config:{rpcUrl:config.rpcUrl,chainId:config.chainId,explorerUrl:config.explorerUrl,networkName:config.networkName,
      accounts:config.accounts,trackedAssets:config.trackedAssets.slice(0,25),
      vaultAccounts:(await readObject(EXTENSION_CONFIG_KEY_420)).vaultAccounts||[],
      factoryAddress:config.smartAccountConfig?.factoryAddress||null},
    selectedAccount:selected,sites,activity:await readWalletUiActivity420(),
    vault:await vaultLockState420(),
    network:{status:'unconfigured',name:config.networkName,expectedChainId:config.chainId,observedChainId:null},
    account:{controller:selected,smartAccount:null,deployed:false,ownerVerified:false,reason:'Approved SmartAccount configuration and network required'},
    assets:{native:null,tokens:[]},
  };
  if(!config.rpcUrl||!config.chainId)return state;
  let expected;
  try {expected=validateExtensionNetwork420(config);}catch(e){state.network={...state.network,status:'error',message:e.message};return state;}
  try {
    const chain=normalizeExtensionChain420(await rpcRequest('eth_chainId',[]));
    state.network.observedChainId=chain;
    if(chain!==expected.chainId){
      state.network.status='wrong-chain';
      state.network.message='RPC chain does not match the configured expected chain';
      return state;
    }
    state.network.status='matched';
    if(!selected){state.account.reason='No controller account provisioned by Wallet Core';return state;}
    if(state.config.vaultAccounts.some(a=>typeof a==='string'&&a.toLowerCase()===selected.toLowerCase())){
      const provider={request:(method,params)=>rpcRequest(method,params)};
      state.account={kind:'eoa',controller:selected,smartAccount:null,receiveAddress:selected,
        deployed:false,ownerVerified:false,
        reason:'Self-custodial EOA. Signing and sending need a local EOA authority; SmartAccount passkeys are not interchangeable.'};
      try{
        const native=await readNativeBalance(provider,selected);
        state.assets.native={raw:native.raw.toString(),decimals:native.decimals,symbol:native.symbol};
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
      return state;
    }
    if(!config.smartAccountConfig?.factoryAddress){
      state.account.reason='SmartAccountFactory420 not provisioned';return state;
    }
    const provider={request:(method,params)=>rpcRequest(method,params)};
    const discovered=await discoverSmartAccount(provider,selected,config.smartAccountConfig);
    state.account={
      controller:selected,smartAccount:discovered.smartAccount,
      deployed:discovered.deployed===true,ownerVerified:discovered.controllerIsOwner===true,
      reason:discovered.deployed?(discovered.controllerIsOwner?'Deployed SmartAccount discovered; controller matches owner. Deployment provenance requires approved configuration.':'Controller is not the current account owner'):'Counterfactual account; not yet deployed',
    };
    const native=await readNativeBalance(provider,discovered.smartAccount);
    state.assets.native={raw:native.raw.toString(),decimals:native.decimals,symbol:native.symbol};
    for(const asset of config.trackedAssets.slice(0,25)){
      try {
        const token=await readErc20Balance(provider,asset,discovered.smartAccount);
        state.assets.tokens.push({address:token.address,raw:token.raw.toString(),decimals:token.decimals,symbol:token.symbol});
      }catch(error){
        state.assets.tokens.push({address:asset.address,symbol:asset.symbol||'Token',error:'Token balance unavailable: '+error.message});
      }
    }
    return state;
  }catch(error){
    state.network.status='error';
    state.network.message='Wallet discovery or RPC verification failed: '+error.message;
    state.account.smartAccount=null;
    state.assets={native:null,tokens:[]};
    return state;
  }
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
async function handleWalletUi420(message) {
  const kind=message.kind;
  if(kind==='get-state')return walletUiState420();
  if(kind==='set-account'){
    const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
    const account=normalizeExtensionAddress420(message.account);
    if(!config.accounts.includes(account))throw Object.assign(new Error('Account is not provisioned in this wallet'),{code:4100});
    await chrome.storage.local.set({[EXTENSION_UI_KEY_420]:{selectedAccount:account}});
    return walletUiState420();
  }
  if(kind==='disconnect-site'){
    const origin=normalizeOrigin(message.origin);
    const permissions=await readObject(PERMISSIONS_KEY);
    if(!Object.prototype.hasOwnProperty.call(permissions,origin))return walletUiState420();
    delete permissions[origin];
    await chrome.storage.local.set({[PERMISSIONS_KEY]:permissions});
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
    const previous=await readObject(EXTENSION_CONFIG_KEY_420);
    await chrome.storage.local.set({[EXTENSION_CONFIG_KEY_420]:{...previous,rpcUrl,chainId,explorerUrl}});
    return walletUiState420();
  }
  if(kind==='send'){
    if(message.confirmed!==true)throw Object.assign(new Error('Explicit transaction confirmation required'),{code:4001});
    const state=await walletUiState420();
    if(!extensionCanSend420(state))throw Object.assign(new Error('Verified deployed SmartAccount owner and matching chain required'),{code:4100});
    const config=normalizeExtensionConfig420(await readObject(EXTENSION_CONFIG_KEY_420));
    const request=buildExtensionSend420({
      from:state.account.controller,recipient:message.recipient,amount:message.amount,
      asset:message.asset,trackedAssets:config.trackedAssets,
    });
    const id='wallet-'+Date.now()+'-'+Math.random().toString(16).slice(2);
    const entry={id,at:Date.now(),chainId:state.network.expectedChainId,
      controller:state.account.controller,smartAccount:state.account.smartAccount,
      recipient:request.summary.recipient,amount:request.summary.amount,
      symbol:request.summary.symbol,status:'pending',hash:null};
    await rememberWalletUiActivity420(entry);
    try {
      const hash=await executeWithLocalAuthority(
        {method:'eth_sendTransaction',params:[request.transaction]},
        {origin:chrome.runtime.getURL('popup.html'),accounts:[state.account.controller],tabId:null}
      );
      await rememberWalletUiActivity420({...entry,status:'confirmed',hash});
      return {hash,status:'confirmed'};
    }catch(error){
      await rememberWalletUiActivity420({...entry,status:'failed',error:error?.message||'Authorization failed'});
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


  if (message?.source === '420-wallet-authority-ui' && message.kind === 'authority-rpc') {
    (async () => {
      try {
        const expected = chrome.runtime.getURL('authority.html');
        if (!sender?.url?.startsWith(expected)) throw Object.assign(new Error('authority RPC caller is not trusted extension UI'), { code: 4100 });
        const request = message.request;
        if (!request || !AUTHORITY_TRANSPORT_METHODS.has(request.method)) {
          throw Object.assign(new Error(`unsupported authority transport method: ${request?.method}`), { code: 4200 });
        }
        const result = await rpcRequest(request.method, request.params ?? []);
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
      if (READ_METHODS.has(request.method)) result = await rpcRequest(request.method, request.params ?? []);
      else if (request.method === 'eth_accounts' || APPROVAL_METHODS.has(request.method)) result = await handleApprovalMethod(request, context);
      else throw Object.assign(new Error(`unsupported provider method: ${request.method}`), { code: 4200 });
      sendResponse({ id: request.id, result });
    } catch (error) {
      sendResponse({ id: message?.request?.id ?? null, error: serializeError(error) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const config = await readObject('420-wallet-extension-config-v1');
  if (!Object.keys(config).length) await chrome.storage.local.set({ '420-wallet-extension-config-v1': { rpcUrl: null, accounts: [], smartAccountConfig: null } });
});
