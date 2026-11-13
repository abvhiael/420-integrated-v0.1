import {normalizeAddress,encodeExecute} from './abi.js';
import {assertWalletChain420} from './transaction-lifecycle.js';
const Q=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const U128=(1n<<128n)-1n;
const U256=(1n<<256n)-1n;
function q(value,label,{allowZero=false,max=U256}={}){
  if(typeof value!=='string'||!Q.test(value))throw new Error('invalid '+label);
  const x=BigInt(value);
  if(x>max||(!allowZero&&x===0n))throw new Error('invalid '+label+' range');
  return x;
}
const asHex=x=>'0x'+x.toString(16);
const word=x=>x.toString(16).padStart(32,'0');
const margin=(n,pct)=>n+(n*BigInt(pct)+99n)/100n;
export function parseExtensionUserOpGasEstimate420(raw){
  if(!raw||typeof raw!=='object')throw new Error('bundler gas estimate unavailable');
  const call=q(raw.callGasLimit,'call gas',{max:U128});
  const verification=q(raw.verificationGasLimit,'verification gas',{max:U128});
  const preVerification=q(raw.preVerificationGas,'pre-verification gas');
  const paddedCall=margin(call,20),paddedVerification=margin(verification,20),
    paddedPreVerification=margin(preVerification,20);
  if(paddedCall>U128||paddedVerification>U128)throw new Error('bundler gas estimate exceeds uint128');
  return Object.freeze({
    callGasLimit:asHex(paddedCall),verificationGasLimit:asHex(paddedVerification),
    preVerificationGas:asHex(paddedPreVerification),
    accountGasLimits:'0x'+word(paddedVerification)+word(paddedCall),
  });
}
export async function estimateExtensionUserOpGas420(provider,{
  chainId,sender,entryPoint,nonce,target,value='0x0',data='0x',
  gasFees,approvedLimits=null,accountCallData=null,
}={}){
  if(!provider||typeof provider.request!=='function')throw new Error('bundler transport required');
  await assertWalletChain420(provider,chainId);
  const account=normalizeAddress(sender),ep=normalizeAddress(entryPoint),to=normalizeAddress(target);
  const n=q(nonce,'owner nonce',{allowZero:true}),amount=q(value,'native value',{allowZero:true});
  if(!/^0x[0-9a-fA-F]{64}$/.test(gasFees||''))throw new Error('validated EIP-1559 packed gas fees required');
  if(typeof data!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(data))throw new Error('invalid target calldata');
  if(accountCallData!==null&&
     (typeof accountCallData!=='string'||!/^0x34fcd5be(?:[0-9a-fA-F]{2})+$/.test(accountCallData)||
      accountCallData.length>40000))
    throw new Error('invalid verified SmartAccount420 executeBatch calldata');
  const op={
    sender:account,nonce:asHex(n),initCode:'0x',
    callData:accountCallData??encodeExecute(to,amount,data),
    accountGasLimits:'0x'+'0'.repeat(64),preVerificationGas:'0x0',
    gasFees,paymasterAndData:'0x',signature:'0x',
  };
  let estimate;
  try{estimate=await provider.request('eth_estimateUserOperationGas',[op,ep]);}
  catch(error){throw new Error('Verified ERC-4337 bundler gas estimate unavailable: '+(error?.message||'RPC rejected estimation'));}
  const limits=parseExtensionUserOpGasEstimate420(estimate);
  await assertWalletChain420(provider,chainId);
  if(approvedLimits){
    if(!/^0x[0-9a-fA-F]{64}$/.test(approvedLimits.accountGasLimits||'')||
       !Q.test(approvedLimits.preVerificationGas||''))
      throw new Error('unverified approved gas caps');
    const approvedVerification=BigInt('0x'+approvedLimits.accountGasLimits.slice(2,34));
    const approvedCall=BigInt('0x'+approvedLimits.accountGasLimits.slice(34,66));
    const approvedPre=BigInt(approvedLimits.preVerificationGas);
    if(BigInt(limits.verificationGasLimit)>approvedVerification||
       BigInt(limits.callGasLimit)>approvedCall||
       BigInt(limits.preVerificationGas)>approvedPre)
      throw new Error('current ERC-4337 gas estimate exceeds approved limits; review again');
    return {...approvedLimits,estimateVerified:true,nonce:asHex(n),entryPoint:ep};
  }
  return {...limits,estimateVerified:true,nonce:asHex(n),entryPoint:ep};
}
export function maxExtensionUserOpFee420(limits,gasFees){
  if(!limits?.accountGasLimits||!limits?.preVerificationGas||!gasFees)
    throw new Error('verified ERC-4337 gas budget required');
  if(!/^0x[0-9a-fA-F]{64}$/.test(limits.accountGasLimits)||!/^0x[0-9a-fA-F]{64}$/.test(gasFees))
    throw new Error('invalid packed gas budget');
  const verification=BigInt('0x'+limits.accountGasLimits.slice(2,34));
  const call=BigInt('0x'+limits.accountGasLimits.slice(34,66));
  const maxFeePerGas=BigInt('0x'+gasFees.slice(34,66));
  return ((verification+call+BigInt(limits.preVerificationGas))*maxFeePerGas).toString();
}
