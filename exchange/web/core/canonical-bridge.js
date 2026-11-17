import {createBridgeClient420} from '../../../wallet/web/core/bridge-client.js';
/** Exchange uses the Wallet's Registry-bound transaction interface. A catalogue
 * or fixture route is never upgraded into execution authority.
 */
export function createExchangeBridge420(config){
 if(!config.exchangeQualification||!config.exchangeQualificationCodeHash)throw new Error('qualified Exchange deployment required');
 const client=createBridgeClient420(config);
 return Object.freeze({...client,review(input){
  if(!input.exchangeAssetId)throw new Error('canonical Exchange asset required');
  return client.review(input);
 }});
}
/** Execute only an explicitly confirmed composition step. A local burn or
 * receipt does not permit Pay/Swap with unreceived destination value.
 */
export async function requireBridgeCompositionSettlement420(client,transferId){
 const transfer=await client.transfer(transferId);
 if(transfer.status!==7||transfer.finalized!==true)throw new Error('canonical bridge settlement required before composition');
 return transfer;
}
