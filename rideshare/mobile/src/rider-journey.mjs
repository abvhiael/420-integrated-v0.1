// Mobile client orchestration. The existing LIFTd web policies are reused verbatim;
// signed backend services remain authoritative for Location, quote, consent, trips and safety.
import {entry,previewInput,routeDescriptor} from '../../web/pickup-policy.mjs';
import {validateQuote,consentRequest} from '../../web/quote-policy.mjs';
import {validateTrip,tripPresentation} from '../../web/trip-experience-policy.mjs';
import {checkRiderPreferences} from '../../web/preference-policy.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const disabled=()=>{throw Error('RIDER_SERVICE_UNAVAILABLE');};
export function createRiderJourney({session,api,clock=()=>Math.floor(Date.now()/1000),commandId}){
 if(!session||typeof session.withFreshRole!=='function'||!api||typeof clock!=='function'||typeof commandId!=='function')throw Error('INVALID_RIDER_CONFIGURATION');
 let pickup=null,destination=null,route=null,quote=null,trip=null,preferences=null;
 const fresh=async(action)=>session.withFreshRole('rider',async verified=>{
  if(!verified||!id(verified.subject)||!id(verified.accountId)||!id(verified.sessionId))throw Error('INVALID_SESSION');
  return action(Object.freeze({status:'authenticated',roles:['rider'],subject:verified.subject,accountId:verified.accountId}));
 });
 const resetDownstream=()=>{route=null;quote=null;trip=null;};
 const command=()=>{const k=commandId();if(!id(k))throw Error('SECURE_COMMAND_ID_REQUIRED');return k;};
 return Object.freeze({
  state:()=>Object.freeze({pickup,destination,route,quote,trip,preferences,live:false}),
  setPickup:value=>{pickup=entry(value);resetDownstream();return pickup;},
  setDestination:value=>{destination=entry(value);resetDownstream();return destination;},
  async preferences(value){const next=checkRiderPreferences(value);return fresh(async s=>{if(typeof api.savePreferences!=='function')disabled();const saved=await api.savePreferences(s,next);preferences=checkRiderPreferences(saved);return preferences;});},
  async prepareRoute(){const input=previewInput(pickup,destination);if(input.kind!=='ready')return input;return fresh(async s=>{if(typeof api.prepareRoute!=='function')disabled();const out=routeDescriptor(await api.prepareRoute(s,input.routePayload,command()));route=out;quote=null;trip=null;return out;});},
  async requestQuote(){if(!route)throw Error('ROUTE_REQUIRED');return fresh(async s=>{if(typeof api.issueQuote!=='function')disabled();const q=validateQuote(await api.issueQuote(s,route,command()),clock());if(q.riderId!==s.subject||q.accountId!==s.accountId||q.routeRef!==route.routeRef)throw Error('QUOTE_SCOPE_DENIED');quote=q;return q;});},
  async consentAndRequest(){if(!quote||!route)throw Error('QUOTE_REQUIRED');return fresh(async s=>{const request=consentRequest(quote,s,command(),clock());if(typeof api.consent!=='function'||typeof api.requestTrip!=='function')disabled();await api.consent(s,quote,request);const result=validateTrip(await api.requestTrip(s,{quoteId:quote.quoteId,routeRef:route.routeRef,commandId:command()}),s);trip=result;return result;});},
  async refreshTrip(){if(!trip)throw Error('TRIP_REQUIRED');return fresh(async s=>{if(typeof api.readTrip!=='function')disabled();trip=validateTrip(await api.readTrip(s,trip.id),s,trip);return trip;});},
  async cancelTrip(){if(!trip||!tripPresentation(trip).canCancel)throw Error('CANCELLATION_NOT_PERMITTED');return fresh(async s=>{if(typeof api.cancelTrip!=='function')disabled();trip=validateTrip(await api.cancelTrip(s,trip.id,command(),trip.revision),s,trip);return trip;});},
  async reportSafety(details){if(!trip||!tripPresentation(trip).canReport||typeof details!=='string'||details.trim().length<3||details.length>500)throw Error('SAFETY_REPORT_INVALID');return fresh(async s=>{if(typeof api.reportSafety!=='function')disabled();return api.reportSafety(s,{tripId:trip.id,details:details.trim(),commandId:command()});});},
  reset:()=>{pickup=null;destination=null;resetDownstream();preferences=null;}
 });
}
