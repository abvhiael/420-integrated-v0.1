// Independent Travel consumer. No direct trip database, identity or Genesis transaction access.
import {validateTravelHandoffV1} from '../sdk/travel-handoff-v1.mjs';
export function createTravelGroundConnectionConsumer({liftdSdk,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof liftdSdk?.verify!=='function')throw Error('LIFTD_SDK_REQUIRED');
 return Object.freeze({async preview({tripId,handoffId}){
  const receipt=validateTravelHandoffV1(await liftdSdk.verify(tripId,handoffId));
  if(receipt.tripId!==tripId||receipt.handoffId!==handoffId||receipt.expiresAt<=clock())throw Error('HANDOFF_EXPIRED_OR_MISMATCHED');
  // Travel receives only an optional preview affordance. No booking, transfer,
  // wallet signing, native token movement or Genesis transaction dispatch.
  return Object.freeze({kind:'travel_ground_connection',market:receipt.context.market,
    availability:'not_live',bookingEnabled:false,transactionEnabled:false});
 }});
}
