// Adapter for a qualified viem PublicClient (or equivalent reviewed client)
// providing getChainId() and verifyMessage(). Supports EOAs and EIP-1271
// contract wallets as implemented by the approved verifier/RPC configuration.
// Never trust a browser-reported recovered address or verification boolean.
import {normalizeAccount} from '../src/wallet.js';
const CHAIN=/^[1-9][0-9]*$/;
export function createWalletSignatureVerifier({publicClient,chainId}={}){
 if(!publicClient||typeof publicClient.getChainId!=='function'||
  typeof publicClient.verifyMessage!=='function'||typeof chainId!=='string'||!CHAIN.test(chainId))
  throw Error('qualified Ethereum public client and chain required');
 return async function verifySignature({account,chainId:requestedChain,message,signature}={}){
  const wallet=normalizeAccount(account);
  if(!wallet||requestedChain!==chainId||typeof message!=='string'||message.length>2048||
   !/^0x(?:[0-9a-fA-F]{2}){1,4096}$/.test(signature))return false;
  try{
   const id=await publicClient.getChainId();
   if(typeof id!=='number'||!Number.isSafeInteger(id)||BigInt(id)!==BigInt(chainId))return false;
   return (await publicClient.verifyMessage({address:wallet,message,signature}))===true;
  }catch{return false;}
 };
}
