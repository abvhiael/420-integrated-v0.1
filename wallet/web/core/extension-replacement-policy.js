import {normalizeAddress} from './abi.js';
import {normalizeTransactionHash420} from './transaction-lifecycle.js';
const Q=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const U256=(1n<<256n)-1n;
const U128=(1n<<128n)-1n;
const hash=(v)=>normalizeTransactionHash420(v);
function hex(v,label){
  if(typeof v!=='string'||!Q.test(v))throw new Error('invalid '+label);
  const n=BigInt(v);if(n>U256)throw new Error(label+' out of range');return n;
}
const normChain=x=>{const n=hex(x,'chain ID');if(n===0n)throw new Error('invalid chain ID');return '0x'+n.toString(16);};
function assertBumped(oldValue,newValue,label,minPercent){
  const a=hex(oldValue,label),b=hex(newValue,label);
  const minimum=a+(a*BigInt(minPercent)+99n)/100n;
  if(b<=a||b<minimum)throw new Error(label+' replacement must increase by at least '+minPercent+' percent');
  return b;
}
export function validateEoaReplacement420(original,replacement,{minimumBumpPercent=10}={}){
  if(!Number.isInteger(minimumBumpPercent)||minimumBumpPercent<1||minimumBumpPercent>100)
    throw new Error('invalid fee bump');
  if(!original?.hash||!original?.from||original?.nonce==null||!original?.chainId)
    throw new Error('original EOA transaction metadata and hash required');
  hash(original.hash);
  if(original.executionModel!=='eoa'||replacement?.executionModel!=='eoa')
    throw new Error('EOA replacement cannot reuse SmartAccount nonce rules');
  if(normChain(original.chainId)!==normChain(replacement.chainId)||
     normalizeAddress(original.from)!==normalizeAddress(replacement.from)||
     hex(original.nonce,'EOA nonce')!==hex(replacement.nonce,'EOA nonce'))
    throw new Error('replacement must use same EOA chain, sender and nonce');
  if(!['submitted','pending','included','reorganized'].includes(original.status))
    throw new Error('only unfinalized EOA transactions can be replaced');
  if(original.maxFeePerGas!=null){
    assertBumped(original.maxFeePerGas,replacement.maxFeePerGas,'max fee',minimumBumpPercent);
    assertBumped(original.maxPriorityFeePerGas,replacement.maxPriorityFeePerGas,'priority fee',minimumBumpPercent);
  }else if(original.gasPrice!=null){
    assertBumped(original.gasPrice,replacement.gasPrice,'legacy gas price',minimumBumpPercent);
  }else throw new Error('original fee metadata missing');
  const from=normalizeAddress(original.from);
  if(replacement.action==='cancel'){
    if(normalizeAddress(replacement.to)!==from||hex(replacement.value,'cancellation value')!==0n||
       replacement.data!=='0x')throw new Error('EOA cancel must be zero-value self-transfer on same nonce');
  }else if(replacement.action==='speed-up'){
    if(normalizeAddress(replacement.to)!==normalizeAddress(original.to)||
       hex(replacement.value,'value')!==hex(original.value,'value')||
       replacement.data!==original.data)throw new Error('EOA speed-up cannot change the original call');
  }else throw new Error('unknown replacement action');
  return {model:'eoa',replaces:hash(original.hash),action:replacement.action,
    nonce:'0x'+hex(original.nonce,'EOA nonce').toString(16),from};
}
export function validateUserOpReplacement420(original,replacement,{minimumBumpPercent=10}={}){
  if(!Number.isInteger(minimumBumpPercent)||minimumBumpPercent<1||minimumBumpPercent>100)
    throw new Error('invalid fee bump');
  if(original?.executionModel!=='erc4337'||replacement?.executionModel!=='erc4337')
    throw new Error('ERC-4337 cannot copy EOA replacement rules');
  if(!original?.userOpHash||!original?.entryPoint||original?.nonce==null||
     !original?.sender||original?.chainId)throw new Error('original UserOperation metadata missing');
  hash(original.userOpHash);
  if(!['submitted','pending','included','reorganized'].includes(original.status))
    throw new Error('only unfinalized UserOperations can be replaced');
  if(normChain(original.chainId)!==normChain(replacement.chainId)||
     normalizeAddress(original.sender)!==normalizeAddress(replacement.sender)||
     normalizeAddress(original.entryPoint)!==normalizeAddress(replacement.entryPoint)||
     hex(original.nonce,'UserOperation nonce')!==hex(replacement.nonce,'UserOperation nonce'))
    throw new Error('UserOperation replacement requires the same chain, sender, EntryPoint and FULL nonce');
  const nonce=hex(original.nonce,'UserOperation nonce');
  // v0.7 packed nonce: upper 192 bits nonce key, lower 64 sequence.
  const key=nonce>>64n,sequence=nonce&((1n<<64n)-1n);
  if(original.nonceKey!=null&&hex(original.nonceKey,'nonce key')!==key)
    throw new Error('stored nonce key mismatch');
  if(original.nonceSequence!=null&&hex(original.nonceSequence,'nonce sequence')!==sequence)
    throw new Error('stored nonce sequence mismatch');
  if(original.entryPointVersion!=='0.7'||replacement.entryPointVersion!=='0.7')
    throw new Error('unqualified EntryPoint version');
  if(replacement.maxFeePerGas==null||replacement.maxPriorityFeePerGas==null||
     original.maxFeePerGas==null||original.maxPriorityFeePerGas==null)
    throw new Error('both original and replacement AA fee caps required');
  const newMax=assertBumped(original.maxFeePerGas,replacement.maxFeePerGas,'AA max fee',minimumBumpPercent);
  const newPriority=assertBumped(original.maxPriorityFeePerGas,replacement.maxPriorityFeePerGas,'AA priority fee',minimumBumpPercent);
  if(newMax>U128||newPriority>U128||newPriority>newMax)throw new Error('invalid AA packed fee caps');
  if(replacement.action==='speed-up'){
    if(replacement.callData!==original.callData||replacement.initCode!==original.initCode)
      throw new Error('AA speed-up must preserve original account call and initialization');
  }else if(replacement.action==='cancel'){
    if(replacement.callData===original.callData)
      throw new Error('AA cancel must use a distinct explicitly signed no-op');
    if(replacement.verifiedNoOp!==true)
      throw new Error('AA cancel requires independently verified account-specific no-op semantics');
  }else throw new Error('unsupported AA replacement action');
  return {model:'erc4337',action:replacement.action,replaces:hash(original.userOpHash),sender:normalizeAddress(original.sender),
    nonce:'0x'+nonce.toString(16),nonceKey:'0x'+key.toString(16),nonceSequence:'0x'+sequence.toString(16),
    entryPoint:normalizeAddress(original.entryPoint),
    // A replacement is a new, independently signed UserOperation; no RPC signing authority.
    requiresNewPasskeySignature:true,requiresEntryPointSimulation:true,requiresBundlerAcceptance:true};
}
export function transitionReplacement420(original,replacement,{canonicalEvidence}={}){
  if(!canonicalEvidence||canonicalEvidence.sameChain!==true||canonicalEvidence.sameSenderAndNonce!==true||
      canonicalEvidence.replacementIncluded!==true||canonicalEvidence.originalNotCanonical!==true)
    throw new Error('canonical replacement evidence required before declaring replaced or cancelled');
  const replacementHash=hash(replacement.txHash);
  const originalHash=hash(original.hash);
  if(replacementHash===originalHash)throw new Error('replacement hash must differ from original hash');
  return {...original,status:replacement.action==='cancel'?'cancelled':'replaced',
    replacedBy:replacementHash,updatedAt:canonicalEvidence.checkedAt??null};
}
