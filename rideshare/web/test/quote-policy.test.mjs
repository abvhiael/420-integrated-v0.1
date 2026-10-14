import test from 'node:test';import assert from 'node:assert/strict';
import {validateQuote,consentRequest,money} from '../quote-policy.mjs';
import {createQuoteController} from '../quote-controller.mjs';
const session={status:'authenticated',roles:['rider'],subject:'rider1',accountId:'account1'};
const q=()=>({quoteId:'quote1',routeRef:'route1',riderId:'rider1',accountId:'account1',quoteHash:'a'.repeat(64),expiresAt:1100,
 amounts:{currency:'CAD',baseCents:400,distanceCents:180,durationCents:45,minimumAdjustmentCents:375,transportationCents:1000,bookingFeeCents:0,surgeCents:0,totalCents:1050,taxes:[{code:'tax',amountCents:50}],passThrough:[]},
 cancellationPolicy:{version:'v1',preTripRiderFeeCents:0,driverCancellationFeeCents:0,assignmentExpiryFeeCents:0,noShowFeeCents:0,waitingFeeCents:0,activeTrip:'safety-resolution-required',driverEarnedObligations:'preserved'}});
test('complete fare, disclosure, expiry and signed quote scope validation',()=>{
 assert.equal(validateQuote(q(),1000).amounts.totalCents,1050);assert.equal(money(1050),'CAD $10.50');
 for(const changed of [{expiresAt:1000},{amounts:{...q().amounts,totalCents:1051}},{cancellationPolicy:null},{quoteHash:'invalid'},{amounts:{...q().amounts,taxes:[]}}])assert.throws(()=>validateQuote({...q(),...changed},1000));
 assert.deepEqual(consentRequest(q(),session,'command1',1000),{riderId:'rider1',commandId:'command1',quoteHash:'a'.repeat(64),currency:'CAD',totalCents:1050,accepted:true});
 assert.throws(()=>consentRequest(q(),{...session,accountId:'other'},'command1',1000));
});
test('explicit consent, single-flight, stable replay key and immutable quote before request',async()=>{
 let acceptCount=0,tripCount=0,fail=true;const ids=['consent1','trip1'];let now=1000;
 const ctl=createQuoteController({issue:async()=>q(),accept:async()=>{acceptCount++;},createTrip:async body=>{tripCount++;if(fail){fail=false;throw Error('network');}return {id:body.id};},session,clock:()=>now,randomId:()=>ids.shift()});
 await ctl.load({routeRef:'route1'});
 await assert.rejects(ctl.submit(false),e=>e.code==='EXPLICIT_CONSENT_REQUIRED');
 await assert.rejects(ctl.submit(true));
 assert.equal(ctl.status().state,'retry');
 assert.equal((await ctl.submit(true)).tripId,'trip1');
 assert.equal((await ctl.submit(true)).tripId,'trip1');
 assert.equal(tripCount,2);assert.equal(acceptCount,2);
 now=1100;await assert.rejects(ctl.submit(true),e=>e.code==='QUOTE_EXPIRED');
});
test('quote mismatch and duplicate simultaneous requests are denied',async()=>{
 const bad=createQuoteController({issue:async()=>({...q(),routeRef:'foreign'}),session,clock:()=>1000});
 await assert.rejects(bad.load({routeRef:'route1'}));
 let unblock;const ctl=createQuoteController({issue:async()=>q(),accept:()=>new Promise(r=>{unblock=r;}),createTrip:async body=>({id:body.id}),session,clock:()=>1000,randomId:(()=>{let n=0;return ()=>'cmd'+(++n)})()});
 await ctl.load({routeRef:'route1'});const pending=ctl.submit(true);
 await assert.rejects(ctl.submit(true),e=>e.code==='IN_PROGRESS');unblock();await pending;
});
