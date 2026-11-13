import {normalizeAddress,normalizeBytes32} from './abi.js';
import {readSecurityAllowance420,encodeSecurityRevokeAllowance420} from './extension-security-centre.js';
import {prepareCapabilityGrantRevocation} from './capability-management.js';
import {prepareSessionKeyRevocation,readSessionEpoch} from './session-management.js';
import {keccak256Hex} from './keccak.js';

const word=value=>value.slice(2).padStart(64,'0');
const selector=signature=>'0x'+keccak256Hex(new TextEncoder().encode(signature)).slice(2,10);
const PASSKEY_ACTIVE=selector('isPasskeyActive(bytes32)');
const REVOKE_PASSKEY=selector('revokePasskey(bytes32)');
const ZERO='0x'+'0'.repeat(64);
const fail=(text,code=4100)=>Object.assign(new Error(text),{code});
function decodeBool(raw){
 if(typeof raw!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(raw))throw fail('Invalid canonical SmartAccount boolean',4900);
 if(BigInt(raw)!==0n&&BigInt(raw)!==1n)throw fail('Unqualified SmartAccount boolean response',4900);
 return BigInt(raw)===1n;
}
export async function readSecurityPasskey420(provider,smartAccount,credentialIdHash){
 const credential=normalizeBytes32(credentialIdHash),account=normalizeAddress(smartAccount);
 if(credential===ZERO)throw fail('Passkey credential hash cannot be zero');
 return {credentialIdHash:credential,active:decodeBool(await provider.request('eth_call',[
  {to:account,data:PASSKEY_ACTIVE+credential.slice(2)},'latest'
 ]))};
}
export async function prepareSecurityRevocation420(provider,{
 kind,chainId,account,token,spender,grantId,key,credentialIdHash,smartState=null,
}={}){
 const signer=normalizeAddress(account);
 if(!['allowance','capability','session','passkey'].includes(kind))throw fail('Unsupported revocation kind',-32602);
 if(!provider?.request||typeof chainId!=='string')throw fail('Verified wallet network required',4900);
 const seen=await provider.request('eth_chainId',[]);
 if(BigInt(seen)!==BigInt(chainId))throw fail('On-chain revocation network mismatch',4901);
 let transaction,authority,record,contract;
 if(kind==='allowance'){
  if(typeof token!=='string'||typeof spender!=='string')throw fail('ERC-20 token and spender required',-32602);
  const owner=smartState?.allowanceOwner||signer;
  const allowance=await readSecurityAllowance420(provider,{chainId,owner,token,spender});
  if(BigInt(allowance.value)===0n)throw fail('Allowance is already zero; no on-chain revocation needed',4001);
  contract=allowance.token;
  transaction={from:signer,to:contract,value:'0x0',data:encodeSecurityRevokeAllowance420(allowance.spender)};
  authority=owner===signer?'eoa-owner':'smart-account-owner';
  record={token:allowance.token,spender:allowance.spender,allowance:allowance.value,owner};
 }else{
  if(!smartState?.deployed||!smartState?.controllerIsOwner||
     normalizeAddress(smartState.owner)!==signer)
   throw fail('Canonical SmartAccount420 owner authorization required',4100);
  contract=normalizeAddress(smartState.smartAccount);
  if(kind==='capability'){
   const prepared=await prepareCapabilityGrantRevocation(provider,signer,smartState,grantId);
   transaction={...prepared.transaction};
   record={grantId:prepared.grantId};
  }else if(kind==='session'){
   const normalized=normalizeAddress(key);
   const epoch=await readSessionEpoch(provider,contract,normalized);
   if(epoch===0n||epoch!==BigInt(smartState.authorizationEpoch))
    throw fail('Session key is inactive or belongs to an expired authorization epoch',4001);
   const prepared=await prepareSessionKeyRevocation(provider,signer,smartState,normalized);
   transaction={...prepared.transaction};
   record={key:normalized,sessionEpoch:epoch.toString()};
  }else{
   const live=await readSecurityPasskey420(provider,contract,credentialIdHash);
   if(!live.active)throw fail('Passkey is not active in the current authorization epoch',4001);
   transaction={from:signer,to:contract,value:'0x0',
    data:REVOKE_PASSKEY+live.credentialIdHash.slice(2)};
   record={credentialIdHash:live.credentialIdHash};
  }
  authority='smartaccount-canonical-owner';
  record={...record,authorizationEpoch:String(smartState.authorizationEpoch),
   owner:signer,smartAccount:contract};
 }
 if(transaction.to!==contract||transaction.from!==signer)throw fail('Revocation target or signer changed');
 const newChain=await provider.request('eth_chainId',[]);
 if(BigInt(newChain)!==BigInt(chainId))throw fail('Revocation chain changed during inspection',4901);
 return {kind,chainId,account:signer,contract,authority,
  transaction,record};
}
export function assertSecurityTransaction420(a,b){
 if(!a||!b||a.kind!==b.kind||a.chainId!==b.chainId||a.account!==b.account||
    a.contract!==b.contract||a.authority!==b.authority||
    a.transaction?.from!==b.transaction?.from||
    a.transaction?.to!==b.transaction?.to||
    a.transaction?.value!==b.transaction?.value||
    a.transaction?.data!==b.transaction?.data||
    JSON.stringify(a.record)!==JSON.stringify(b.record))
  throw fail('On-chain security authority, allowance or revocation target changed since review',4001);
 return true;
}
