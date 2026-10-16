import {AuthError} from './auth.mjs';
import {checkSchema} from './schema.mjs';
import {digest,uint} from './payment-protocol.mjs';
import {quoteHash as calculateQuoteHash} from './fare.mjs';
const fail=(c)=>{throw new AuthError(c,409)};
const sum=(a,f)=>a.reduce((n,x)=>n+BigInt(x[f]),0n);
const distinct=(rows,field)=>{if(new Set(rows.map(x=>x[field])).size!==rows.length)fail('ECONOMIC_REPLAY')};
export function auditEconomicHistory({trip,quote,quoteHash,intents,operations,plans,funding,events,operationEvents,timing}){
 if(!trip||!['COMPLETED','CANCELLED'].includes(trip.state)||!timing?.ended_at)fail('ECONOMIC_TERMINAL_REQUIRED');
 if(!quote||!intents?.length||!quoteHash)fail('ECONOMIC_QUOTE_REQUIRED');
 if(calculateQuoteHash(quote)!==quoteHash)fail('ECONOMIC_QUOTE_CORRUPT');
 for(const [rows,key] of [[intents,'intent_id'],[operations,'operation_id'],[operations,'pay_operation_id'],[events,'event_id'],[operationEvents,'event_id'],[plans,'plan_hash'],[funding,'funding_ref']])distinct(rows,key);
 const current=intents.filter(x=>x.status!=='SUPERSEDED');if(current.length!==1||!current[0].captured||current[0].status!=='CAPTURED')fail('ECONOMIC_FINALITY_REQUIRED');
 const intent=current[0],payload=intent.payload;
 for(const x of intents)if(x.trip_id!==trip.id||x.payload.quoteHash!==quoteHash||digest(x.payload)!==x.intent_hash)fail('ECONOMIC_INTENT_MISMATCH');
 const amounts=quote.amounts,gross=BigInt(payload.totalCents),tip=BigInt(payload.tipCents);
 const component={fare:BigInt(amounts.transportationCents),tips:tip,taxes:sum(amounts.taxes,'amountCents'),passThrough:sum(amounts.passThrough,'amountCents')};
 if(gross!==Object.values(component).reduce((a,b)=>a+b,0n))fail('ECONOMIC_GROSS_MISMATCH');
 const used={refund:0n,driver:0n,platform:0n,passThrough:0n},refunded={fare:0n,taxes:0n,passThrough:0n,tips:0n};
 let assetUsed=0n;
 for(const o of operations){
  if(o.trip_id!==trip.id||o.payload.tripId!==trip.id||o.payload.intentId!==intent.intent_id||o.payload.payOperationId!==o.pay_operation_id||o.payload.recipient!==o.recipient||o.payload.kind!==o.kind||BigInt(o.payload.amountCents)!==BigInt(o.amount_cents)||o.payload.amountUnits!==o.amount_units)fail('ECONOMIC_OPERATION_BINDING');
  if(!Object.hasOwn(used,o.kind))fail('ECONOMIC_OPERATION_KIND');
  if(o.status==='RECOVERY_REQUIRED')fail('ECONOMIC_RECOVERY_PENDING');
  if(o.status==='FAILED')continue;
  if(!['RESERVED','FINALIZED'].includes(o.status))fail('ECONOMIC_OPERATION_STATE');
  used[o.kind]+=BigInt(o.amount_cents);assetUsed+=uint(o.amount_units);
  if(o.kind==='refund'){if(o.recipient!==payload.payer)fail('ECONOMIC_REFUND_RECIPIENT');for(const k of Object.keys(refunded))refunded[k]+=BigInt(o.payload.refunds[k]);}
  else if(!plans.some(p=>p.plan_hash===o.payload.planHash))fail('ECONOMIC_PAYOUT_PLAN_MISSING');
 }
 if(used.refund!==Object.values(refunded).reduce((a,b)=>a+b,0n))fail('ECONOMIC_REFUND_CONSERVATION');
 for(const k of Object.keys(refunded))if(refunded[k]>component[k])fail('ECONOMIC_REFUND_OVERFLOW');
 for(const plan of plans){
  if(plan.trip_id!==trip.id||plan.payload.tripId!==trip.id||plan.payload.quoteHash!==quoteHash||plan.payload.intentId!==intent.intent_id||plan.payload.conserved!==true)fail('ECONOMIC_PLAN_BINDING');
  const p=plan.payload;
  if(digest(Object.fromEntries(Object.entries(p).filter(([key])=>key!=='planHash')))!==plan.plan_hash)fail('ECONOMIC_PLAN_HASH_CORRUPT');
  if(BigInt(p.driverCents)!==BigInt(p.allowanceCents)+BigInt(p.earningsCents)+BigInt(p.topUpCents)+BigInt(p.tipCents))fail('ECONOMIC_DRIVER_SPLIT');
  if(BigInt(p.developmentCents)>0n&&BigInt(p.platformCents)<0n)fail('ECONOMIC_COMPENSATION_SPLIT');
  if(BigInt(p.netCollectedCents)+BigInt(p.platformFundingCents)!==BigInt(p.driverCents)+BigInt(p.passThroughCents)+BigInt(p.developmentCents)+BigInt(p.platformCents))fail('ECONOMIC_NOT_CONSERVED');
  for(const k of ['driver','platform','passThrough'])if(used[k]>BigInt(p[k+'Cents']))fail('ECONOMIC_ENTITLEMENT_OVERFLOW');
 }
 if((used.driver||used.platform||used.passThrough)&&!plans.length)fail('ECONOMIC_PAYOUT_PLAN_MISSING');
 const funded=funding.reduce((n,f)=>{if(f.trip_id!==trip.id)fail('ECONOMIC_FUNDING_BINDING');return n+uint(f.payload.amountUnits)},0n);
 if(assetUsed>uint(payload.amountUnits)+funded)fail('ECONOMIC_ASSET_OVERSPEND');
 for(const e of events)if(digest(e.payload)!==e.digest||!intents.some(i=>i.intent_id===e.intent_id))fail('ECONOMIC_EVENT_TAMPERED');
 for(const e of operationEvents)if(digest(e.payload)!==e.digest||!operations.some(o=>o.operation_id===e.operation_id))fail('ECONOMIC_EVENT_TAMPERED');
 return Object.freeze({tripId:trip.id,status:'RECONCILED',historyDigest:digest({quoteHash,intents:intents.map(x=>x.intent_hash),operations:operations.map(x=>x.pay_operation_id),plans:plans.map(x=>x.plan_hash),events:events.map(x=>x.digest),operationEvents:operationEvents.map(x=>x.digest)}),grossCents:gross.toString(),refundCents:used.refund.toString(),driverCents:used.driver.toString(),platformCents:used.platform.toString(),passThroughCents:used.passThrough.toString(),assetConserved:true,developmentSettlement:'SEPARATE_CANONICAL_APPROVAL'});
}
export function createEconomicReconciliationService({pool,authenticator,clock=()=>Math.floor(Date.now()/1000)}){
 return {async reconcile(token,tripId){
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(tripId))fail('INVALID_REQUEST');
  const c=await pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await checkSchema(c);
   const trip=(await c.query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1',[tripId])).rows[0]?.snapshot;
   if(!trip)fail('TRIP_UNAVAILABLE');
   const permit=()=>authenticator.authorize(token,{action:'economics.reconcile',resource:'trip:'+tripId});
   const before=await permit();if(before.role!=='operator'||before.expiresAt<=clock())fail('ECONOMIC_SCOPE_DENIED');
   const quote=(await c.query('SELECT q.payload,q.quote_hash FROM liftd.trip_quotes b JOIN liftd.fare_quotes q USING(quote_id) WHERE b.trip_id=$1',[tripId])).rows[0];
   const rows=async sql=>(await c.query(sql,[tripId])).rows;
   const result=auditEconomicHistory({trip,quote:quote?.payload,quoteHash:quote?.quote_hash,
    intents:await rows('SELECT * FROM liftd.payment_intents WHERE trip_id=$1 ORDER BY intent_id'),
    operations:await rows('SELECT * FROM liftd.pay_operations WHERE trip_id=$1 ORDER BY operation_id'),
    plans:await rows('SELECT * FROM liftd.payout_projections WHERE trip_id=$1 ORDER BY id'),
    funding:await rows('SELECT * FROM liftd.settlement_funding WHERE trip_id=$1 ORDER BY funding_ref'),
    events:await rows('SELECT e.* FROM liftd.payment_events e JOIN liftd.payment_intents i ON i.intent_id=e.intent_id WHERE i.trip_id=$1 ORDER BY e.event_id'),
    operationEvents:await rows('SELECT e.* FROM liftd.operation_events e JOIN liftd.pay_operations o ON o.operation_id=e.operation_id WHERE o.trip_id=$1 ORDER BY e.event_id'),
    timing:(await rows('SELECT * FROM liftd.trip_financial_timing WHERE trip_id=$1'))[0]});
   const after=await permit();if(after.role!=='operator'||after.expiresAt<=clock()||before.subject!==after.subject||before.accountId!==after.accountId||before.sessionId!==after.sessionId||before.recoveryEpoch!==after.recoveryEpoch)fail('ECONOMIC_SCOPE_DENIED');
   await c.query('COMMIT');return result;
  }catch(e){try{await c.query('ROLLBACK')}catch{}if(e instanceof AuthError)throw e;throw new AuthError('ECONOMIC_UNAVAILABLE',503)}finally{c.release()}
 }};
}
