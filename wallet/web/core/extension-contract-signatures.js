import {normalizeAddress} from './abi.js';
import {assertWalletChain420} from './transaction-lifecycle.js';

const MAGIC='0x1626ba7e';
const WRAPPER_MAGIC='6492649264926492649264926492649264926492649264926492649264926492';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const SIGNATURE=/^0x(?:[0-9a-fA-F]{2})+$/;
const word=n=>BigInt(n).toString(16).padStart(64,'0');

export function isEip6492Signature420(signature){
 return typeof signature==='string'&&SIGNATURE.test(signature)&&
   signature.toLowerCase().endsWith(WRAPPER_MAGIC);
}
/** Verify an actually deployed SmartAccount420/other EIP-1271 signer using its
 * on-chain signature policy. A passkey UserOperation signature is NOT
 * interchangeable with EIP-1271, and a generic 6492 wrapper MUST NOT be
 * evaluated by a user-supplied factory or verifier. */
export async function verifyExtensionContractSignature420(provider,{
 chainId,contract,digest,signature
}={}){
 if(!provider||typeof provider.request!=='function')throw new Error('verified wallet RPC required');
 const address=normalizeAddress(contract);
 if(typeof digest!=='string'||!HASH.test(digest))
  throw new Error('EIP-1271 requires exactly 32-byte message digest');
 if(typeof signature!=='string'||!SIGNATURE.test(signature)||
    signature.length>131074)throw new Error('invalid bounded EIP-1271 signature');
 if(isEip6492Signature420(signature))
  throw new Error('EIP-6492 counterfactual signature verification needs an independently qualified universal validator; no arbitrary deployment calls');
 await assertWalletChain420(provider,chainId);
 const code=await provider.request('eth_getCode',[address,'latest']);
 if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||
   /^0x0+$/i.test(code))
  throw new Error('EIP-1271 signer is not a deployed contract on the approved chain');
 const bytes=signature.slice(2);
 const calldata=MAGIC+digest.slice(2)+word(64)+word(bytes.length/2)+
   bytes.padEnd(Math.ceil(bytes.length/64)*64,'0');
 const result=await provider.request('eth_call',[
   {to:address,data:calldata,gas:'0x186a0'},'latest'
 ]);
 await assertWalletChain420(provider,chainId);
 if(typeof result!=='string'||!/^0x[0-9a-fA-F]*$/.test(result))
  throw new Error('invalid EIP-1271 contract response');
 return result.slice(0,10).toLowerCase()===MAGIC &&
   (result.length===10||/^0x1626ba7e0{56}$/i.test(result));
}
