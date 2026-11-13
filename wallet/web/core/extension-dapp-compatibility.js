import {normalizeAddress} from './abi.js';
import {normalizeExtensionChain420} from './extension-wallet-ui.js';

const Q=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const DATA=/^0x(?:[0-9a-fA-F]{2})*$/;
function invalid(message){const error=new Error(message);error.code=-32602;throw error;}
export function normalizeDappAccountPermission420(params){
 if(!Array.isArray(params)||params.length!==1||!params[0]||
    typeof params[0]!=='object'||Array.isArray(params[0])||
    Object.keys(params[0]).length!==1||!Object.hasOwn(params[0],'eth_accounts')||
    !params[0].eth_accounts||typeof params[0].eth_accounts!=='object'||
    Array.isArray(params[0].eth_accounts)||Object.keys(params[0].eth_accounts).length!==0)
    invalid('only eth_accounts permission may be requested or revoked');
 return true;
}
export function dappAccountPermissions420(accounts,origin,grantedAt=0){
 if(!Array.isArray(accounts)||!accounts.length)return [];
 return [{
  parentCapability:'eth_accounts',invoker:origin,caveats:[],
  date:Math.floor((Number.isSafeInteger(grantedAt)?grantedAt:0)/1000)
 }];
}
export function normalizeDappWalletCalls420(params,{account,chainId}={}){
 if(!Array.isArray(params)||params.length!==1)invalid('wallet_sendCalls requires one request');
 const input=params[0];
 if(!input||typeof input!=='object'||Array.isArray(input))invalid('invalid wallet_sendCalls request');
 if(input.version!=='2.0.0')invalid('unsupported wallet_sendCalls version');
 const expected=normalizeAddress(account);
 if(typeof input.from!=='string'||normalizeAddress(input.from)!==expected)
  invalid('wallet_sendCalls requires the exact origin-authorized account');
 if(normalizeExtensionChain420(input.chainId)!==normalizeExtensionChain420(chainId))
  invalid('wallet_sendCalls chain mismatch');
 if(input.capabilities!=null&&
    (typeof input.capabilities!=='object'||Array.isArray(input.capabilities)||
     Object.keys(input.capabilities).some(k=>k!=='atomic')||
     (input.capabilities.atomic!=null&&
      (typeof input.capabilities.atomic!=='object'||input.capabilities.atomic.required!==true))))
  invalid('only required atomic batches are supported');
 if(!Array.isArray(input.calls)||input.calls.length<2||input.calls.length>8)
  invalid('wallet_sendCalls requires between 2 and 8 atomic calls');
 let totalDataBytes=0;
 const calls=input.calls.map((call,i)=>{
  if(!call||typeof call!=='object'||Array.isArray(call))invalid('invalid batch call '+i);
  let to;
  try{to=normalizeAddress(call.to);}catch{invalid('invalid batch destination '+i);}
  const data=call.data??'0x',value=call.value??'0x0';
  if(typeof data!=='string'||!DATA.test(data))invalid('invalid batch calldata '+i);
  if(typeof value!=='string'||!Q.test(value)||BigInt(value)>=(1n<<256n))
   invalid('invalid batch value '+i);
  totalDataBytes+=(data.length-2)/2;
  if(totalDataBytes>16384)invalid('aggregate batch calldata exceeds safe limit');
  return {target:to,data:data.toLowerCase(),value:'0x'+BigInt(value).toString(16)};
 });
 return {version:'2.0.0',from:expected,chainId:normalizeExtensionChain420(chainId),calls};
}
export function walletCapabilities420(chainId,{atomicBatch=false}={}){
 return {[normalizeExtensionChain420(chainId)]:{
  atomicBatch:{supported:atomicBatch===true}
 }};
}
export function walletCallsStatus420(activity,id){
 if(typeof id!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(id))invalid('wallet_getCallsStatus requires a 32-byte call ID');
 const entry=(activity||[]).find(x=>x.callsId===id.toLowerCase());
 if(!entry)invalid('unknown or unauthorized call batch ID');
 const status=['confirmed'].includes(entry.status)?200:
  ['reverted','failed'].includes(entry.status)?400:100;
 return {version:'2.0.0',id:id.toLowerCase(),chainId:entry.chainId,status,
  atomic:true,...(status===400?{error:{message:entry.error||'Batch execution reverted'}}:{})};
}
