// HC-NEXT-6.2: bounded gameplay licensing. Nothing here issues an external legal or ecosystem licence.
import {SettlementError} from './buds-ledger.js';
const CAPABILITIES=new Set(['cultivate','terminate-plants','view-rent','assign-occupancy']);
const EXTERNAL=new Set(['real-property','statutory-cultivation','trademark','copyright','patent','commercial-brand','ecosystem-app','protocol-operator','off-chain-distribution']);
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export const GAME_LICENSE_NAMESPACE='highcountry.game.v1';
export const EXTERNAL_LICENSE_NAMESPACE='external.unverified';
export class GameplayLicensing {
 constructor({landRights,identity,canonical}) {
  if(typeof landRights?.rights!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof canonical?.parcel!=='function')throw new SettlementError('canonical licensing dependencies required');
  Object.assign(this,{landRights,identity,canonical});
 }
 async evaluate(token,{parcelId,capability,namespace=GAME_LICENSE_NAMESPACE}={}) {
  const principal=await this.identity.registeredPrincipal(token);
  if(typeof principal!=='string'||!ID.test(principal))throw new SettlementError('registered player required');
  if(!Number.isSafeInteger(parcelId)||parcelId<=0||typeof capability!=='string')
   throw new SettlementError('invalid licensing request');
  // Never imply that a game-land NFT, lease, receipt, or permission proves rights beyond the game.
  if(namespace!==GAME_LICENSE_NAMESPACE) {
   if(namespace!==EXTERNAL_LICENSE_NAMESPACE||!EXTERNAL.has(capability))
    throw new SettlementError('unsupported licensing namespace or capability');
   return Object.freeze({namespace,parcelId,capability,allowed:false,
    reason:'independent external issuer verification required',externalLicenceVerified:false});
  }
  if(!CAPABILITIES.has(capability))throw new SettlementError('unsupported game capability');
  // The 6.1 reader enforces authenticated owner/occupant visibility and current chain occupancy.
  const rights=await this.landRights.rights(token,parcelId);
  const parcel=await this.canonical.parcel(parcelId);
  if(!parcel?.exists||parcel.id!==parcelId||rights.parcelId!==parcelId
   ||parcel.owner!==rights.owner||parcel.occupant!==rights.occupant
   ||parcel.occupancyKind!==rights.occupancyKind)
   throw new SettlementError('canonical rights changed');
  const owner=principal===parcel.owner;
  const occupant=principal===parcel.occupant;
  let allowed=false;
  switch(capability) {
   case 'cultivate': allowed=!!rights.canCultivate;break;
   case 'terminate-plants': allowed=!!rights.canTerminatePlants;break;
   case 'view-rent': allowed=!!rights.leaseId&&(owner||occupant);break;
   case 'assign-occupancy': allowed=owner&&!!rights.canReassign;break;
  }
  return Object.freeze({namespace,parcelId,capability,allowed,reason:allowed?'canonical gameplay authority':'not authorized by current canonical gameplay state',
   externalLicenceVerified:false,legalPropertyInterest:false,transferableExternalRights:false});
 }
}
