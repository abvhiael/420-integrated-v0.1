import {buildSendExecution} from './send.js';

export const EXTENSION_CONFIG_KEY_420='420-wallet-extension-config-v1';
export const EXTENSION_UI_KEY_420='420-wallet-ui-preferences-v1';
export const EXTENSION_ACTIVITY_KEY_420='420-wallet-ui-activity-v1';
export const EXTENSION_PERMISSION_KEY_420='420-wallet-origin-permissions-v1';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const CHAIN=/^0x[0-9a-fA-F]+$/;

export function normalizeExtensionAddress420(value){
  if(typeof value!=='string'||!ADDRESS.test(value)||/^0x0{40}$/i.test(value))throw new Error('A valid nonzero EVM address is required');
  return value.toLowerCase();
}
export function normalizeExtensionChain420(value){
  if(typeof value!=='string'||!CHAIN.test(value))throw new Error('Expected chain ID must be a hex quantity (0x...)');
  const n=BigInt(value);
  if(n<=0n)throw new Error('Expected chain ID must be positive');
  return '0x'+n.toString(16);
}
export function normalizeExtensionRpc420(value){
  if(typeof value!=='string'||!value.trim())throw new Error('RPC endpoint is required');
  const url=new URL(value.trim());
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))throw new Error('RPC must use HTTPS except on localhost');
  if(url.username||url.password||url.hash)throw new Error('RPC credentials and fragments are not allowed');
  return url.href;
}
export function normalizeExtensionPreferences420(value={}){
  if(!value||typeof value!=='object')return {selectedAccount:null};
  return {selectedAccount:ADDRESS.test(value.selectedAccount||'')?value.selectedAccount.toLowerCase():null};
}
export function normalizeExtensionConfig420(value={}){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const accounts=Array.isArray(raw.accounts)?[...new Set(raw.accounts.filter(x=>typeof x==='string'&&ADDRESS.test(x)&&!/^0x0{40}$/i.test(x)).map(x=>x.toLowerCase()))]:[];
  return {
    rpcUrl:raw.rpcUrl||null,
    chainId:raw.chainId||raw.expectedChainId||null,
    explorerUrl:raw.explorerUrl||null,
    accounts,
    smartAccountConfig:raw.smartAccountConfig&&typeof raw.smartAccountConfig==='object'?raw.smartAccountConfig:null,
    trackedAssets:Array.isArray(raw.trackedAssets)?raw.trackedAssets:[],
    networkName:typeof raw.networkName==='string'?raw.networkName:'420 Integrated',
  };
}
export function validateExtensionNetwork420(config){
  const rpcUrl=normalizeExtensionRpc420(config?.rpcUrl);
  const chainId=normalizeExtensionChain420(config?.chainId);
  return {rpcUrl,chainId};
}
export function extensionBalanceText420(raw,decimals=18,maxPrecision=5){
  if(typeof raw!=='string'||!/^\d+$/.test(raw))return '—';
  if(!Number.isInteger(decimals)||decimals<0||decimals>255)throw new Error('Invalid token decimals');
  const n=BigInt(raw),scale=10n**BigInt(decimals);
  const whole=n/scale;
  const fraction=(n%scale).toString().padStart(decimals,'0').slice(0,maxPrecision).replace(/0+$/,'');
  return whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export function formatExtensionUnitsExact420(raw,decimals=18){
  if(typeof raw!=='string'||!/^\d+$/.test(raw))throw new Error('verified raw balance required');
  if(!Number.isInteger(decimals)||decimals<0||decimals>255)throw new Error('invalid token decimals');
  const n=BigInt(raw),scale=10n**BigInt(decimals);
  const fraction=decimals?(n%scale).toString().padStart(decimals,'0').replace(/0+$/,''):'';
  return (n/scale).toString()+(fraction?'.'+fraction:'');
}
export function shortExtensionAddress420(value){
  return typeof value==='string'&&ADDRESS.test(value)?value.slice(0,7)+'…'+value.slice(-5):'Not available';
}
export function buildExtensionSend420({from,recipient,amount,asset='native',trackedAssets=[]}={}){
  const controller=normalizeExtensionAddress420(from);
  let picked={kind:'native',symbol:'420',decimals:18};
  if(asset!=='native'){
    const token=normalizeExtensionAddress420(asset);
    const entry=trackedAssets.find(x=>typeof x?.address==='string'&&x.address.toLowerCase()===token);
    if(!entry)throw new Error('Token is not in the configured verified asset list');
    picked={kind:'erc20',address:token,symbol:entry.symbol||'TOKEN',decimals:entry.decimals??18};
  }
  const {request,summary}=buildSendExecution({recipient,amount,asset:picked});
  return {transaction:{from:controller,to:request.target,value:'0x'+BigInt(request.value).toString(16),data:request.data},summary:{kind:summary.kind,symbol:summary.symbol,recipient:summary.recipient,amount:summary.amount}};
}
export function extensionCanSend420(state){
  if(state?.network?.status!=='matched'||!state?.account?.controller)return false;
  if(state.account.kind==='eoa')return state.vault?.unlocked===true&&
    state.selectedAccount===state.account.controller;
  if(['watch-only','hardware'].includes(state?.account?.kind))return false;
  return Boolean(state.account.deployed===true&&state.account.ownerVerified===true&&state.account.smartAccount);
}
export function extensionReceiveAddress420(state){
  if(state?.network?.status!=='matched')return null;
  const address=['eoa','watch-only','hardware'].includes(state?.account?.kind)?state?.account?.receiveAddress:state?.account?.smartAccount;
  if(!address)return null;
  try{return normalizeExtensionAddress420(address)}catch{return null}
}
export function extensionNetworkLabel420(state){
  if(state?.network?.status==='wrong-chain')return 'Wrong network';
  if(state?.network?.status==='matched')return state?.network?.name||'Connected';
  if(state?.network?.status==='error')return 'Network error';
  return 'Not configured';
}
