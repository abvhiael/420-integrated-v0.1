import {createQuoteController} from './quote-controller.mjs';
import {money} from './quote-policy.mjs';
export function mountQuoteView(container,session,api){
 let active=true,controller=null;const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Ride quote and consent');
 const heading=document.createElement('h2');heading.textContent='Fare and ride request';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const details=document.createElement('div');
 const consent=document.createElement('label'),tick=document.createElement('input');tick.type='checkbox';tick.checked=false;consent.append(tick,document.createTextNode(' I have reviewed the complete fare, expiry and cancellation conditions, and consent to this exact fare.'));
 const request=document.createElement('button');request.type='button';request.textContent='Submit ride request';request.disabled=true;
 const payment=document.createElement('p');payment.textContent='Payment state: not confirmed. No payment has been captured.';
 panel.append(heading,status,details,payment,consent,request);container.append(panel);
 const line=(label,text)=>{const p=document.createElement('p');p.textContent=label+': '+text;details.append(p);};
 const display=q=>{
  details.replaceChildren();const a=q.amounts,p=q.cancellationPolicy;
  line('Quoted fare',money(a.totalCents));line('Currency',a.currency);line('Base fare',money(a.baseCents));
  line('Distance charge',money(a.distanceCents));line('Time charge',money(a.durationCents));
  line('Minimum adjustment',money(a.minimumAdjustmentCents));line('Transportation total',money(a.transportationCents));
  line('Booking fee',money(a.bookingFeeCents));line('Surge',money(a.surgeCents));
  for(const charge of a.taxes)line('Tax '+charge.code,money(charge.amountCents));
  for(const charge of a.passThrough)line('Other charge '+charge.code,money(charge.amountCents));
  line('Quote expires',new Date(q.expiresAt*1000).toLocaleString());line('Policy version',p.version);
  for(const key of ['preTripRiderFeeCents','driverCancellationFeeCents','assignmentExpiryFeeCents','noShowFeeCents','waitingFeeCents'])line(key.replaceAll('Cents',''),money(p[key]));
  line('Active trip cancellation',p.activeTrip);line('Driver earned obligations',p.driverEarnedObligations);
 };
 const update=()=>{request.disabled=!active||!controller||!tick.checked||controller.status().inFlight||controller.status().state!=='ready'&&controller.status().state!=='retry';};
 tick.addEventListener('change',update);
 request.addEventListener('click',async()=>{
  if(!active||!controller||!tick.checked)return;
  request.disabled=true;status.textContent='Submitting verified consent and ride request…';
  try{const result=await controller.submit(tick.checked);if(active){status.textContent='Request recorded: '+result.tripId+'. Driver and payment status must be verified separately.';payment.textContent='Payment state: not confirmed. No payment has been captured.';}}
  catch{if(active)status.textContent='Request not confirmed. The same request identifier will be reused on retry; do not assume a new trip was created.';}
  finally{update();}
 });
 return Object.freeze({
  async showRoute(route){
   details.replaceChildren();tick.checked=false;request.disabled=true;
   if(!api){status.textContent='Fare service unavailable. No request can be submitted.';return;}
   controller=createQuoteController({...api,session});
   status.textContent='Requesting a live, authority-issued quote…';
   try{const q=await controller.load(route);if(!active)return;display(q);status.textContent='Review every charge and cancellation condition. Quote is time-limited; no payment is confirmed.';}
   catch{if(active)status.textContent='An authoritative quote is unavailable. Do not submit a ride request.';}
   update();
  },
  destroy(){active=false;controller?.clear();panel.remove();}
 });
}
