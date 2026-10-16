// L02.4 — strict display of server-authoritative quote, terms and payment state.
export class QuoteUiError extends Error {constructor(code){super(code);this.name='QuoteUiError';this.code=code;}}
const deny=c=>{throw new QuoteUiError(c);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const cents=x=>Number.isSafeInteger(x)&&x>=0&&x<=Number.MAX_SAFE_INTEGER;
export function validateQuote(q,now=Math.floor(Date.now()/1000)){
 if(!q||typeof q!=='object'||!id(q.quoteId)||!id(q.routeRef)||!id(q.riderId)||!id(q.accountId)||typeof q.quoteHash!=='string'||!new RegExp('^[a-f0-9]{64}' + String.fromCharCode(36)).test(q.quoteHash)||!Number.isSafeInteger(q.expiresAt)||q.expiresAt<=now)deny('QUOTE_EXPIRED_OR_INVALID');
 const a=q.amounts,p=q.cancellationPolicy;
 if(!a||a.currency!=='CAD'||!['baseCents','distanceCents','durationCents','transportationCents','minimumAdjustmentCents','bookingFeeCents','surgeCents','totalCents'].every(k=>cents(a[k]))||
 !Array.isArray(a.taxes)||!Array.isArray(a.passThrough)||[...a.taxes,...a.passThrough].some(x=>!x||typeof x.code!=='string'||!cents(x.amountCents))||
 !p||typeof p.version!=='string'||!['preTripRiderFeeCents','driverCancellationFeeCents','assignmentExpiryFeeCents','noShowFeeCents','waitingFeeCents'].every(k=>cents(p[k]))||
 typeof p.activeTrip!=='string'||typeof p.driverEarnedObligations!=='string')deny('INCOMPLETE_FARE_TERMS');
 const sum=a.transportationCents+[...a.taxes,...a.passThrough].reduce((s,x)=>s+x.amountCents,0);
 if(sum!==a.totalCents||a.bookingFeeCents!==0||a.surgeCents!==0||a.baseCents+a.distanceCents+a.durationCents+a.minimumAdjustmentCents!==a.transportationCents)deny('FARE_MISMATCH');
 return Object.freeze(q);
}
export const money=c=>{if(!cents(c))deny('INVALID_MONEY');return 'CAD $'+(c/100).toFixed(2);};
export function consentRequest(q,session,commandId,now=Math.floor(Date.now()/1000)){
 validateQuote(q,now);
 if(!session||session.status!=='authenticated'||!session.roles?.includes('rider')||session.subject!==q.riderId||session.accountId!==q.accountId||!id(commandId))deny('CONSENT_SCOPE_DENIED');
 return Object.freeze({riderId:q.riderId,commandId,quoteHash:q.quoteHash,currency:'CAD',totalCents:q.amounts.totalCents,accepted:true});
}
