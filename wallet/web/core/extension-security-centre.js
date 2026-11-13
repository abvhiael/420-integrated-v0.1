import {normalizeAddress} from './abi.js';
import {inspectExtensionApprovalRisk420} from './extension-approval-risk.js';

const WORD=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const U256=(1n<<256n)-1n;
const UNLIMITED_CUTOFF=(1n<<255n);
const hexWord=value=>BigInt(value).toString(16).padStart(64,'0');
const error=(message,code=-32602)=>Object.assign(new Error(message),{code});

export function normalizeSecurityAllowance420(token,spender){
 const contract=normalizeAddress(token),delegate=normalizeAddress(spender);
 if(!ADDRESS.test(contract)||!ADDRESS.test(delegate)||
    /^0x0{40}$/.test(contract)||/^0x0{40}$/.test(delegate))
  throw error('ERC-20 token and spender must be nonzero EVM addresses');
 return {token:contract,spender:delegate};
}
export function encodeSecurityAllowance420(owner,spender){
 return '0xdd62ed3e'+normalizeAddress(owner).slice(2).padStart(64,'0')+
   normalizeAddress(spender).slice(2).padStart(64,'0');
}
export function encodeSecurityRevokeAllowance420(spender){
 return '0x095ea7b3'+normalizeAddress(spender).slice(2).padStart(64,'0')+hexWord(0);
}
export async function readSecurityAllowance420(provider,{chainId,owner,token,spender}={}){
 if(!provider?.request)throw error('verified chain RPC is required',4900);
 const target=normalizeSecurityAllowance420(token,spender);
 const actual=await provider.request('eth_chainId',[]);
 if(BigInt(actual)!==BigInt(chainId))throw error('Allowance chain identity changed',4901);
 const code=await provider.request('eth_getCode',[target.token,'latest']);
 if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||/^0x0*$/i.test(code))
  throw error('Token has no deployed contract code on the approved chain',4100);
 const raw=await provider.request('eth_call',[{to:target.token,
   data:encodeSecurityAllowance420(owner,target.spender)},'latest']);
 if(typeof raw!=='string'||!WORD.test(raw))throw error('Token allowance returned invalid ABI uint256');
 const again=await provider.request('eth_chainId',[]);
 if(BigInt(again)!==BigInt(chainId))throw error('Allowance chain changed during verification',4901);
 const allowance=BigInt(raw);
 return {...target,owner:normalizeAddress(owner),chainId,raw:'0x'+allowance.toString(16),
  value:allowance.toString(),unlimited:allowance>=UNLIMITED_CUTOFF};
}
export function classifyWebsiteRisk420(origin){
 let url;
 try{url=new URL(origin);}catch{return {level:'high',flags:['Invalid website origin']};}
 const host=url.hostname.toLowerCase(),flags=[];
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(host))
  flags.push('Website does not use HTTPS');
 if(host.includes('xn--'))flags.push('Internationalized/punycode hostname — inspect for lookalikes');
 if(/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('['))
  flags.push('Website uses a numeric IP address');
 if(url.username||url.password)flags.push('URL contains embedded credentials');
 if(/(?:^|[-.])(metamask|walletconnect|ledger|trezor|coinbase|opensea)(?:[-.]|$)/i.test(host)&&
    !['metamask.io','walletconnect.com','ledger.com','trezor.io','coinbase.com','opensea.io'].includes(host))
  flags.push('Wallet brand words in hostname — independently verify destination');
 return {level:flags.length?'warning':'unknown',flags};
}
const SHORT=/^0x(?:[0-9a-fA-F]{2})*$/;
export function assessSecuritySignature420(method,params,{chainId,origin}={}){
 const flags=[...classifyWebsiteRisk420(origin).flags];
 let kind='unknown',summary='Review the complete signing request carefully';
 if(method==='personal_sign'){
  kind='message';
  const raw=Array.isArray(params)?params[0]:null;
  if(typeof raw!=='string'||!SHORT.test(raw))flags.push('Unparseable personal message');
  else {
   summary='Personal message signature ('+((raw.length-2)/2)+' bytes)';
   if(raw.length>2050)flags.push('Long or opaque personal message');
   try{
    const bytes=Uint8Array.from(raw.slice(2).match(/../g)||[],x=>Number.parseInt(x,16));
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(/(?:setApprovalForAll|permit2|unlimited approval|sign in to authorize transfer)/i.test(decoded))
     flags.push('Message mentions an approval or transfer authorization');
  }catch{flags.push('Message is not readable UTF-8');}
  }
 }else if(method==='eth_signTypedData_v4'){
  kind='typed-data';
  try{
   const typed=JSON.parse(Array.isArray(params)?params[1]:'');
   summary='EIP-712 '+String(typed.primaryType||'typed message').slice(0,60);
   if(typed.domain?.chainId==null||BigInt(typed.domain.chainId)!==BigInt(chainId))
    flags.push('Typed-data chain differs from active wallet network');
   if(!typed.domain?.verifyingContract)
    flags.push('No EIP-712 verifying contract in domain');
   if(/permit|approval|authorization|order|delegate|session/i.test(String(typed.primaryType)))
    flags.push('Typed-data signature may grant spending or execution authority');
   const values=JSON.stringify(typed.message||{});
   if(/115792089237316195423570985008687907853269984665640564039457584007913129639935|0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff/i.test(values))
    flags.push('Typed-data includes maximum uint256 allowance');
   if(values.length>32000)flags.push('Unusually large structured message');
  }catch{flags.push('Malformed EIP-712 typed data');}
 }else flags.push('Unsupported signing method');
 return {kind,summary,flags,severity:flags.length?'high':'review'};
}
export function suspiciousApproval420(tx){
 const risk=inspectExtensionApprovalRisk420(tx);
 return {...risk,flags: ['critical','high'].includes(risk.severity)?[risk.message]:[]};
}
export function securityRecordSignature420({origin,method,account,chainId,risk,at=Date.now()}={}){
 const url=new URL(origin);
 if(!['https:','http:'].includes(url.protocol)||!ADDRESS.test(account||'')||
    !['personal_sign','eth_signTypedData_v4'].includes(method)||
    typeof chainId!=='string'||!/^0x[0-9a-fA-F]+$/.test(chainId))
  throw error('Invalid signature audit record');
 return {origin:url.origin,method,account:normalizeAddress(account),chainId,
  at,flags:Array.isArray(risk?.flags)?risk.flags.slice(0,8).map(x=>String(x).slice(0,180)):[],
  risk:risk?.severity==='high'?'high':'review',status:'signed'};
}
export function securityRevocationKind420(kind){
 const known={
  'site':'local-only',
  'allowance':'on-chain-erc20',
  'capability':'on-chain-smartaccount-owner',
  'session':'on-chain-epoch-scoped-owner',
  'passkey':'on-chain-smartaccount-owner',
 };
 if(!Object.hasOwn(known,kind))throw error('Unknown security revocation kind');
 return known[kind];
}
export function assertSecurityRevocationSnapshot420(old,current){
 if(!old||!current||['kind','chainId','epoch','account','contract','spender','grantId','key',
  'credentialIdHash','allowance','authorizationEpoch','owner','nonce','blockHash',
  'maxFeePerGas','maxPriorityFeePerGas','gasLimit','gasFees','accountGasLimits','preVerificationGas'
 ].some(k=>old[k]!==current[k]))
  throw error('Security authority or on-chain state changed since review; start a new review',4001);
 return true;
}
