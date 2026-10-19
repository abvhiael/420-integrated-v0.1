// MBL-5 guarded consumers. All financial, trip and messaging decisions remain server authoritative.
// No local wallet secrets, wallet signing, Pay ledger or client-issued Messenger membership grants.
import {createLiftdTravelSdk,validateTravelHandoffV1} from '../../sdk/travel-handoff-v1.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const states=new Set(['REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED']);
const active=new Set(['ASSIGNED','ARRIVED','IN_PROGRESS']);
const fail=code=>{throw Error(code);};
const authorized=(s,trip)=>s&&['rider','driver'].includes(s.role)&&id(s.subject)&&id(s.accountId)&&id(s.sessionId)&&trip&&id(trip.id)&&
 Number.isSafeInteger(trip.revision)&&trip.revision>=0&&states.has(trip.state)&&
 (s.role==='rider'?s.subject===trip.riderId:s.subject===trip.driverId);
export function safePushEnvelope(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Reflect.ownKeys(raw).some(k=>!['type','tripId','state','revision'].includes(k))||
 raw.type!=='liftd.trip.status'||!id(raw.tripId)||!states.has(raw.state)||!Number.isSafeInteger(raw.revision)||raw.revision<0)fail('UNSAFE_NOTIFICATION');
 return Object.freeze({type:raw.type,tripId:raw.tripId,state:raw.state,revision:raw.revision});
}
export function validatePaymentProjection(raw,trip,previous=null){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('PAYMENT_PROJECTION_INVALID');
 if(raw.tripId!==undefined&&raw.tripId!==trip.id)fail('PAYMENT_PROJECTION_INVALID');
 if(raw.status==='NO_INTENT'||raw.status==='AWAITING_PROJECTION'){
  if(raw.tripId!==trip.id)fail('PAYMENT_PROJECTION_INVALID');
  return Object.freeze({...raw});
 }
 if(raw.currency!=='CAD')fail('PAYMENT_PROJECTION_INVALID');
 if(raw.intentId!==undefined){
  if(!id(raw.intentId)||typeof raw.status!=='string'||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Number.isSafeInteger(raw.totalCents)||raw.totalCents<0)fail('PAYMENT_PROJECTION_INVALID');
  if(previous?.intentId===raw.intentId&&(raw.revision<previous.revision||(raw.revision===previous.revision&&JSON.stringify(raw)!==JSON.stringify(previous))))fail('PAYMENT_PROJECTION_STALE');
  return Object.freeze({...raw});
 }
 for(const k of ['earningsCents','allowanceCents','tipCents','topUpCents','engagedSeconds','onlineSeconds'])if(!Number.isSafeInteger(raw[k])||raw[k]<0)fail('PAYMENT_PROJECTION_INVALID');
 if(!id(raw.periodId))fail('PAYMENT_PROJECTION_INVALID');
 return Object.freeze({...raw});
}
export function createMobileIntegratedConsumers({session,api,travelSdk,permission,clock=()=>Math.floor(Date.now()/1000),commandId}){
 if(typeof session?.withFreshRole!=='function'||!api||typeof commandId!=='function'||typeof clock!=='function'||typeof permission?.request!=='function')fail('CONSUMER_CONFIG_REQUIRED');
 let epoch=0,payment=null,pendingMessage=null;
 const nonce=()=>{const n=commandId();if(!id(n))fail('SECURE_COMMAND_REQUIRED');return n;};
 const fresh=async(trip,action)=>{
  const started=epoch;
  const result=await session.withFreshRole(trip.riderId===session.getStatus()?.subject?'rider':'driver',async verified=>{
   const s={role:verified.role,subject:verified.subject,accountId:verified.accountId,sessionId:verified.sessionId};
   if(!authorized(s,trip))fail('TRIP_SCOPE_DENIED');
   const value=await action(s);
   if(started!==epoch||!authorized({role:session.getStatus()?.role,subject:session.getStatus()?.subject,accountId:session.getStatus()?.accountId,sessionId:session.getStatus()?.sessionId},trip))fail('SESSION_CHANGED');
   return value;
  });
  return result;
 };
 return Object.freeze({
  async requestWalletIntent(trip,consented){
   if(consented!==true)fail('EXPLICIT_WALLET_CONSENT_REQUIRED');
   return fresh(trip,async s=>{if(s.role!=='rider'||typeof api.preparePayment!=='function')fail('WALLET_DENIED');return api.preparePayment(s,trip.id,{commandId:nonce()});});
  },
  async readPayment(trip){
   return fresh(trip,async s=>{if(typeof api.readPayment!=='function')fail('PAY_UNAVAILABLE');payment=validatePaymentProjection(await api.readPayment(s,trip.id),trip,payment);return payment;});
  },
  // A previously prepared operation is never automatically submitted; signing is Wallet SDK-owned.
  async prepareWalletOperation(trip,{intent,wallet,consent,expectedIntentHash,sessionKey,prepare}){
   if(consent!==true||typeof prepare!=='function'||!wallet||!intent||typeof expectedIntentHash!=='string')fail('EXPLICIT_WALLET_CONSENT_REQUIRED');
   return fresh(trip,async s=>{if(s.role!=='rider')fail('WALLET_DENIED');return prepare({wallet,intent,sessionKey,consent:true,expectedIntentHash,clock});});
  },
  async travelPreview(trip,consent){
   if(consent!==true||!travelSdk||typeof travelSdk.prepare!=='function'||typeof travelSdk.verify!=='function')fail('TRAVEL_CONSENT_REQUIRED');
   return fresh(trip,async s=>{if(s.role!=='rider')fail('TRAVEL_DENIED');
    const receipt=validateTravelHandoffV1(await travelSdk.prepare(trip.id,{commandId:nonce(),consent:true}));
    if(receipt.tripId!==trip.id||receipt.tripRevision!==trip.revision||receipt.expiresAt<=clock())fail('HANDOFF_STALE');
    const confirmed=validateTravelHandoffV1(await travelSdk.verify(trip.id,receipt.handoffId));
    if(confirmed.handoffId!==receipt.handoffId||confirmed.tripRevision!==trip.revision||confirmed.expiresAt<=clock())fail('HANDOFF_STALE');
    return Object.freeze({market:confirmed.context.market,availability:'not_live',bookingEnabled:false,transactionEnabled:false});
   });
  },
  async requestNotifications(trip,explicitConsent){
   if(explicitConsent!==true)fail('NOTIFICATION_PERMISSION_DENIED');
   return fresh(trip,async s=>{if(s.role!=='rider')fail('NOTIFICATION_PERMISSION_DENIED');
    const result=await permission.request();if(result!==true)fail('NOTIFICATION_PERMISSION_DENIED');
    return Object.freeze({enabled:true,deliveryConfirmed:false});
   });
  },
  async readMessages(trip){
   if(!active.has(trip?.state))fail('MESSAGING_UNAVAILABLE');
   return fresh(trip,async s=>{if(typeof api.readMessages!=='function')fail('MESSAGING_UNAVAILABLE');
    const v=await api.readMessages(s,trip.id);
    if(!v||!Array.isArray(v.messages)||v.messages.length>25||v.messages.some(m=>!id(m.id)||!id(m.sender)||![trip.riderId,trip.driverId].includes(m.sender)||typeof m.text!=='string'||m.text.length<1||m.text.length>1000||/[\u0000-\u001f\u007f]/.test(m.text)))fail('UNSAFE_MESSAGE_RESPONSE');
    return Object.freeze({messages:v.messages.map(m=>Object.freeze({id:m.id,sender:m.sender,text:m.text})),nextCursor:typeof v.nextCursor==='string'?v.nextCursor:null});
   });
  },
  async sendMessage(trip,text){
   if(!active.has(trip?.state)||typeof text!=='string'||text.length<1||text.length>1000||/[\u0000-\u001f\u007f]/.test(text))fail('MESSAGE_DENIED');
   if(pendingMessage&&pendingMessage.text!==text)fail('MESSAGE_RECONCILIATION_REQUIRED');
   if(!pendingMessage)pendingMessage={tripId:trip.id,text,commandId:nonce()};
   if(pendingMessage.tripId!==trip.id)fail('MESSAGE_RECONCILIATION_REQUIRED');
   return fresh(trip,async s=>{if(typeof api.sendMessage!=='function')fail('MESSAGING_UNAVAILABLE');
    const result=await api.sendMessage(s,trip.id,{text,commandId:pendingMessage.commandId});
    if(!result||!id(result.messageId)||!['ACCEPTED','DELIVERED'].includes(result.status))fail('MESSAGE_ACK_INVALID');
    pendingMessage=null;return Object.freeze({messageId:result.messageId,status:result.status});
   });
  },
  clear(){epoch++;payment=null;pendingMessage=null;}
 });
}
export {createLiftdTravelSdk};
