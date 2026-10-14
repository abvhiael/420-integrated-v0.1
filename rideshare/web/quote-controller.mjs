import {validateQuote,consentRequest,QuoteUiError} from './quote-policy.mjs';
// No request may leave this controller without a checked, live quote and explicit rider consent.
export function createQuoteController({issue,accept,createTrip,session,clock=()=>Math.floor(Date.now()/1000),randomId=()=>globalThis.crypto?.randomUUID?.()}){
 let quote=null,state='idle',inFlight=false,accepted=false,command=null,tripId=null,routeRef=null;
 const fail=x=>{throw new QuoteUiError(x);};
 const fresh=()=>{if(!quote||clock()>=quote.expiresAt)fail('QUOTE_EXPIRED');};
 return Object.freeze({
  status:()=>({state,quote,accepted,inFlight}),
  async load(route){
   if(inFlight)fail('IN_PROGRESS');
   if(!route||!route.routeRef)fail('ROUTE_REQUIRED');
   state='loading';quote=null;accepted=false;routeRef=route.routeRef;command=null;tripId=null;
   try{
    if(typeof issue!=='function')fail('QUOTE_UNAVAILABLE');
    const q=validateQuote(await issue(route),clock());
    if(q.routeRef!==routeRef||q.riderId!==session?.subject||q.accountId!==session?.accountId)fail('QUOTE_BINDING_MISMATCH');
    quote=q;state='ready';return q;
   }catch(e){state='error';throw e;}
  },
  async submit(consented){
   if(inFlight)fail('IN_PROGRESS');
   fresh();
   if(consented!==true)fail('EXPLICIT_CONSENT_REQUIRED');
   if(state==='submitted')return {state,tripId};
   if(state!=='ready'&&state!=='retry')fail('QUOTE_UNAVAILABLE');
   if(typeof accept!=='function'||typeof createTrip!=='function')fail('SERVICE_UNAVAILABLE');
   if(!command){command=randomId();tripId=randomId();}
   if(!command||!tripId)fail('SECURE_ID_REQUIRED');
   const request=consentRequest(quote,session,command,clock());
   inFlight=true;state='submitting';
   try{
    await accept(quote,request);
    accepted=true;fresh(); // expiry after remote acceptance is still invalid
    const trip=await createTrip({id:tripId,riderId:quote.riderId,routeRef:quote.routeRef,quoteId:quote.quoteId,commandId:tripId});
    if(!trip||trip.id!==tripId)fail('TRIP_ACK_MISMATCH');
    state='submitted';return {state,tripId};
   }catch(e){state='retry';throw e;}
   finally{inFlight=false;}
  },
  clear:()=>{quote=null;state='idle';accepted=false;command=null;tripId=null;routeRef=null;}
 });
}
