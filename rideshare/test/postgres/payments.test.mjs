import test,{before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {generateRoots} from './dispatch-fixture.mjs';
import {paymentFixture,addr,hex} from './payment-fixture.mjs';
assert.ok(process.env.LIFTD_DATABASE_URL,'Real PostgreSQL mandatory');
const owner=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL}),pairs=[...generateRoots(),...generateRoots()],controls={now:100,quotes:true,pay:true,encryptionKey:Buffer.alloc(32,12).toString('base64')};let pool,app;
before(async()=>{
  assert.equal((await owner.query('SELECT current_database() name')).rows[0].name,'liftd_qualification');await migrate(owner);
  await owner.query("CREATE ROLE liftd_pay_runtime LOGIN PASSWORD 'pay_fixture' NOSUPERUSER NOCREATEDB NOCREATEROLE");
  await owner.query('GRANT USAGE ON SCHEMA liftd TO liftd_pay_runtime');await owner.query('GRANT SELECT ON ALL TABLES IN SCHEMA liftd TO liftd_pay_runtime');
  await owner.query('GRANT INSERT,UPDATE ON liftd.trips,liftd.private_locations,liftd.driver_availability,liftd.assignment_leases,liftd.trip_financial_timing,liftd.payment_intents,liftd.pay_operations TO liftd_pay_runtime');
  await owner.query('GRANT INSERT ON liftd.events,liftd.commands,liftd.availability_commands,liftd.fare_quotes,liftd.quote_consents,liftd.quote_commands,liftd.trip_quotes,liftd.trip_viability,liftd.cancellation_assessments,liftd.subsidy_bindings,liftd.wallet_consents,liftd.payment_events,liftd.financial_receipts,liftd.financial_commands,liftd.payout_projections,liftd.settlement_funding,liftd.operation_events TO liftd_pay_runtime');
  await owner.query('GRANT USAGE ON ALL SEQUENCES IN SCHEMA liftd TO liftd_pay_runtime');
  const u=new URL(process.env.LIFTD_DATABASE_URL);u.username='liftd_pay_runtime';u.password='pay_fixture';pool=createDatabasePool({connectionString:u.href});app=paymentFixture(pool,pairs,controls);
});
afterEach(async()=>{
  for(const k of Object.keys(controls))if(!['now','quotes','pay','encryptionKey'].includes(k))delete controls[k];controls.now=100;
  for(const t of (await pool.query("SELECT snapshot FROM liftd.trips WHERE trip_id LIKE 'payment_%' AND state IN ('ASSIGNED','ARRIVED','IN_PROGRESS')")).rows.map(r=>r.snapshot)) {
    controls.now=200;if(t.state==='IN_PROGRESS')await app.transition('driver',t.driverId,t.id,'complete',t.revision);else await app.transition('rider','rider_fare',t.id,'cancel',t.revision);
  }
  controls.now=100;for(const r of (await pool.query('SELECT driver_id,vehicle_id FROM liftd.driver_availability WHERE online')).rows)await app.online(r.driver_id,r.vehicle_id,false);
});
after(async()=>{await pool?.end();await owner.end();});
test('scoped prepared Pay intent binds canonical IDs/calldata and explicit independent Wallet consent',async()=>{
  await app.create('payment_consent');const intent=await app.prepareIntent('payment_consent',100);assert.equal(intent.status,'PREPARED');assert.equal(intent.payer,addr(423));
  await assert.rejects(()=>app.capture('payment_consent'),e=>e.code==='WALLET_CONSENT_REQUIRED');
  controls.walletApproved=false;await assert.rejects(()=>app.authorize('payment_consent',intent),e=>e.code==='WALLET_CONSENT_REQUIRED');
  controls.walletApproved=true;controls.walletPatch={payer:addr(44)};await assert.rejects(()=>app.authorize('payment_consent',intent));controls.walletPatch={};await app.authorize('payment_consent',intent);
  assert.equal((await app.capture('payment_consent')).status,'CAPTURED');
  await assert.rejects(()=>owner.query("UPDATE liftd.payment_intents SET payload='{}',revision=revision+1 WHERE trip_id='payment_consent'"),e=>e.code==='23514');
});
test('wrong account, forged Pay bindings, weak finality and late submission cannot recognize collected funds',async()=>{
  await app.create('payment_bad');controls.intentPatch={asset:addr(55)};await assert.rejects(()=>app.prepareIntent('payment_bad'));controls.intentPatch={};
  const intent=await app.prepareIntent('payment_bad');await app.authorize('payment_bad',intent);
  for(const patch of [{payer:addr(5)},{paymentId:hex('wrong')},{invoiceId:hex('wrong')},{registry:addr(5)},{finality:'CERTIFIED',paymentStatus:3},{submittedAt:130},{amountUnits:'1'}]){controls.eventPatch=patch;await assert.rejects(()=>app.capture('payment_bad'));}
  controls.eventPatch={};await app.capture('payment_bad');
  const foreign=app.token('rider','rider_other','payment_bad');await assert.rejects(()=>app.paymentService.read(foreign,'payment_bad'),e=>e.code==='PAY_SCOPE_DENIED');
});
test('completion has no capture side effect; finalized capture yields conserved separate actual driver and development projections',async()=>{
  // Isolate this statement assertion from other sequential PostgreSQL fixture trips.
  // Keep strict trip count and conserved monetary projections unchanged.
  controls.periodId='payment_plan_qualification';
  await app.create('payment_plan');const intent=await app.prepareIntent('payment_plan',200);await app.authorize('payment_plan',intent);await app.complete('payment_plan');
  assert.equal((await app.paymentService.read(app.rider('payment_plan'),'payment_plan')).status,'AUTHORIZED');
  await app.capture('payment_plan');const p=await app.plan('payment_plan');assert.equal(p.conserved,true);assert.equal(p.tipCents,200);assert.equal(p.allowanceCents,104);assert.equal(p.earningsCents,796);assert.equal(p.developmentCents,19);assert.equal(p.platformCents,180);
  await assert.rejects(()=>app.reserve('payment_plan','development',p.developmentCents),e=>e.code==='CANONICAL_DEVELOPMENT_POLICY_INCOMPATIBLE');
  const statement=await app.paymentService.read(app.token('driver','driver_pay','payment_plan'),'payment_plan');assert.equal(statement.allowanceCents,104);assert.equal(statement.tipCents,200);
  const period=await app.paymentService.statement(app.token('driver','driver_pay'),'driver_pay',controls.periodId);assert.equal(period.trips,1);assert.equal(period.earningsCents,796);assert.equal(period.onlineTimeGuarantee,false);
});
test('two instances racing reserve one driver entitlement; immutable finalized payout does not free its budget',async()=>{
  await app.create('payment_race');const i=await app.prepareIntent('payment_race');await app.authorize('payment_race',i);await app.complete('payment_race');await app.capture('payment_race');const p=await app.plan('payment_race');
  const second=paymentFixture(pool,pairs,controls),results=await Promise.allSettled([app.reserve('payment_race','driver',p.driverCents),second.reserve('payment_race','driver',p.driverCents)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const op=results.find(r=>r.status==='fulfilled').value;await app.reconcileOperation('payment_race',op);
  await assert.rejects(()=>app.reserve('payment_race','driver',1),e=>e.code==='PAYOUT_EXCEEDS_ENTITLEMENT');
  controls.operationStatus='FAILED';await assert.rejects(()=>app.reconcileOperation('payment_race',op),e=>e.code==='FINALIZED_OPERATION_REQUIRES_RECOVERY');
});
test('cancellation refunds return only to original payer and preserve engaged driver allowance/guarantee through platform funding',async()=>{
  await app.create('payment_cancel');const i=await app.prepareIntent('payment_cancel');await app.authorize('payment_cancel',i);await app.online('driver_cancel_pay','vehicle_cancel_pay');await app.transition('operator','operator_pay','payment_cancel','match',0);controls.now=120;
  await app.transition('rider','rider_fare','payment_cancel','cancel',1);await app.capture('payment_cancel');
  const refund=await app.reserve('payment_cancel','refund',i.totalCents);assert.equal(refund.recipient,i.payer);await app.reconcileOperation('payment_cancel',refund);
  const p=await app.plan('payment_cancel');assert.equal(p.netCollectedCents,0);assert.equal(p.earningsCents,0);assert.equal(p.driverCents,118);assert.equal(p.platformFundingCents,118);
  const payout=await app.reserve('payment_cancel','driver',p.driverCents);assert.equal(payout.recipient,addr(24));assert.ok((await pool.query("SELECT * FROM liftd.settlement_funding WHERE trip_id='payment_cancel'")).rowCount>0);
  await app.reconcileOperation('payment_cancel',payout);
  await assert.rejects(()=>app.reserve('payment_cancel','refund',1),e=>e.code==='REFUND_EXCEEDS_CAPTURE');
});
test('post-finality reorg freezes new outflows and recovery never reopens trip or resets previous payouts',async()=>{
  await app.create('payment_reorg');const i=await app.prepareIntent('payment_reorg');await app.authorize('payment_reorg',i);await app.complete('payment_reorg');await app.capture('payment_reorg');const p=await app.plan('payment_reorg'),op=await app.reserve('payment_reorg','driver',p.driverCents);await app.reconcileOperation('payment_reorg',op);
  controls.payRevision=2;controls.eventPatch={type:'REORG',canonical:false};assert.equal((await app.capture('payment_reorg')).status,'RECOVERY_REQUIRED');
  await assert.rejects(()=>app.reserve('payment_reorg','platform',1),e=>e.code==='PAY_FINALITY_REQUIRED');
  controls.payRevision=3;controls.eventPatch={recoveryRef:'independent_recovery'};assert.equal((await app.capture('payment_reorg')).status,'CAPTURED');
  assert.equal((await app.tripStore.get('payment_reorg')).state,'COMPLETED');await assert.rejects(()=>app.reserve('payment_reorg','driver',1),e=>e.code==='PAYOUT_EXCEEDS_ENTITLEMENT');
});
test('original-receipt equivocation, stale authority revision and operation receipt replay fail closed',async()=>{
  await app.create('payment_event');const i=await app.prepareIntent('payment_event');await app.authorize('payment_event',i);await app.capture('payment_event');
  controls.eventPatch={blockNumber:101};await assert.rejects(()=>app.capture('payment_event'),e=>e.code==='PAY_EVENT_EQUIVOCATION');
  controls.eventPatch={eventId:hex('new_event'),authorityRevision:1};await assert.rejects(()=>app.capture('payment_event'),e=>e.code==='STALE_PAY_PROJECTION');
});
test('financial insert failure rolls back recognized capture and safe command retry succeeds',async()=>{
  await app.create('payment_rollback');const i=await app.prepareIntent('payment_rollback');await app.authorize('payment_rollback',i);
  await owner.query("ALTER TABLE liftd.financial_commands ADD CONSTRAINT payment_test_failure CHECK(trip_id<>'payment_rollback' OR action<>'pay.reconcile')");
  const key=app.cid();try{await assert.rejects(()=>app.paymentService.reconcile(app.operator('payment_rollback'),'payment_rollback',{commandId:key}));}finally{await owner.query('ALTER TABLE liftd.financial_commands DROP CONSTRAINT payment_test_failure');}
  assert.equal((await app.paymentService.read(app.rider('payment_rollback'),'payment_rollback')).status,'AUTHORIZED');
  assert.equal((await pool.query('SELECT * FROM liftd.payment_events WHERE intent_id=$1',[i.intentId])).rowCount,0);await app.paymentService.reconcile(app.operator('payment_rollback'),'payment_rollback',{commandId:key});
});
test('expired intent, meter account/duration forgery and unsafe refund components are denied',async()=>{
  await app.create('payment_expired');const old=await app.prepareIntent('payment_expired');controls.now=130;await assert.rejects(()=>app.authorize('payment_expired',old),e=>e.code==='PAY_INTENT_EXPIRED');controls.now=100;
  await app.create('payment_meter');const i=await app.prepareIntent('payment_meter');await app.authorize('payment_meter',i);await app.complete('payment_meter');await app.capture('payment_meter');
  for(const patch of [{accountId:'other'},{engagedSeconds:99},{onlineSeconds:1}]){controls.meterPatch=patch;await assert.rejects(()=>app.plan('payment_meter'),e=>e.code==='INVALID_ENGAGEMENT');}
  controls.meterPatch={};controls.refunds={fare:i.totalCents+1,taxes:0,passThrough:0,tips:0};await assert.rejects(()=>app.reserve('payment_meter','refund',i.totalCents),e=>e.code==='INVALID_REFUND_ALLOCATION');
});
test('protected HTTP requires scoped rider consent/reconciliation and driver sees only their statement',async()=>{
  await app.create('payment_http');const credential=app.rider('payment_http');
  const response=await app.handler(new Request('https://liftd.example/v1/rideshare/trips/payment_http/payments/prepare',{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify({commandId:app.cid(),tipCents:0})}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const anonymous=await app.handler(new Request('https://liftd.example/v1/rideshare/trips/payment_http/payments'));assert.equal(anonymous.status,401);
  const foreign=await app.handler(new Request('https://liftd.example/v1/rideshare/trips/payment_http/payments',{headers:{authorization:`Bearer ${app.token('driver','driver_other','payment_http')}`}}));assert.equal(foreign.status,403);
});
test('independently failed uncaptured attempt can be superseded without reusing invoice, consent or receipt authority',async()=>{
  await app.create('payment_retry');const first=await app.prepareIntent('payment_retry');
  controls.eventPatch={type:'FAILED',canonical:true,paymentStatus:8};await app.capture('payment_retry');
  const second=await app.prepareIntent('payment_retry');assert.notEqual(second.intentId,first.intentId);assert.notEqual(second.invoiceId,first.invoiceId);
  await assert.rejects(()=>app.authorize('payment_retry',first));
  controls.eventPatch={};await app.authorize('payment_retry',second);await app.capture('payment_retry');
  assert.equal((await pool.query('SELECT status FROM liftd.payment_intents WHERE intent_id=$1',[first.intentId])).rows[0].status,'SUPERSEDED');
});
test('pause preserves original-payer refund and owed driver payout while preventing new spending intent',async()=>{
  await app.create('payment_pause');const i=await app.prepareIntent('payment_pause');await app.authorize('payment_pause',i);await app.complete('payment_pause');await app.capture('payment_pause');const p=await app.plan('payment_pause');controls.paused=true;
  await assert.rejects(()=>app.reserve('payment_pause','platform',1),e=>e.code==='SERVICE_PAUSED');
  const driver=await app.reserve('payment_pause','driver',p.driverCents);await app.reconcileOperation('payment_pause',driver);
  controls.refunds={fare:100,taxes:0,passThrough:0,tips:0};const refund=await app.reserve('payment_pause','refund',100);assert.equal(refund.recipient,i.payer);
});
test('operation finality reorganization holds its budget until independent recovery and rejects wrong receipt chain/recipient',async()=>{
  await app.create('payment_op_reorg');const i=await app.prepareIntent('payment_op_reorg');await app.authorize('payment_op_reorg',i);await app.complete('payment_op_reorg');await app.capture('payment_op_reorg');const p=await app.plan('payment_op_reorg'),op=await app.reserve('payment_op_reorg','driver',p.driverCents);
  controls.operationEventPatch={recipient:addr(55)};await assert.rejects(()=>app.reconcileOperation('payment_op_reorg',op),e=>e.code==='PAY_OPERATION_BINDING_MISMATCH');controls.operationEventPatch={chainId:421};await assert.rejects(()=>app.reconcileOperation('payment_op_reorg',op));
  controls.operationEventPatch={};await app.reconcileOperation('payment_op_reorg',op);controls.operationStatus='RECOVERY_REQUIRED';await app.reconcileOperation('payment_op_reorg',op);
  await assert.rejects(()=>app.reserve('payment_op_reorg','platform',1),e=>e.code==='PAY_RECOVERY_REQUIRED');
  controls.operationStatus='FINALIZED';controls.operationEventPatch={eventId:hex('recovered-operation'),receiptHash:hex('recovered-receipt')};await app.reconcileOperation('payment_op_reorg',op);
  await assert.rejects(()=>app.reserve('payment_op_reorg','driver',1),e=>e.code==='PAYOUT_EXCEEDS_ENTITLEMENT');
});

test('riders cannot request driver projections or reserve/reconcile non-refund outflows',async()=>{
  await app.create('payment_scope');const i=await app.prepareIntent('payment_scope');await app.authorize('payment_scope',i);await app.complete('payment_scope');await app.capture('payment_scope');
  await assert.rejects(()=>app.paymentService.plan(app.rider('payment_scope'),'payment_scope',{commandId:app.cid()}),e=>e.code==='PAY_SCOPE_DENIED');
  await assert.rejects(()=>app.paymentService.reserve(app.rider('payment_scope'),'payment_scope',{commandId:app.cid(),kind:'driver',amountCents:1}),e=>e.code==='PAY_SCOPE_DENIED');
  const op=await app.reserve('payment_scope','driver',1);
  await assert.rejects(()=>app.paymentService.reconcileOperation(app.rider('payment_scope'),'payment_scope',{commandId:app.cid(),operationId:op.operationId}),e=>e.code==='PAY_SCOPE_DENIED');
});
test('refund after collected platform payout requires finalized replacement funding; refunded registry state remains canonical',async()=>{
  await app.create('payment_paid_refund');const i=await app.prepareIntent('payment_paid_refund');await app.authorize('payment_paid_refund',i);await app.complete('payment_paid_refund');await app.capture('payment_paid_refund');const p=await app.plan('payment_paid_refund');
  for(const [kind,amount] of [['driver',p.driverCents],['platform',p.platformCents]])await app.reconcileOperation('payment_paid_refund',await app.reserve('payment_paid_refund',kind,amount));
  const refund=await app.reserve('payment_paid_refund','refund',100);assert.ok((await pool.query("SELECT 1 FROM liftd.settlement_funding WHERE trip_id='payment_paid_refund'")).rowCount);await app.reconcileOperation('payment_paid_refund',refund);
  controls.payRevision=2;controls.eventPatch={type:'REFUND_STATE',paymentStatus:7,refundedUnits:refund.amountUnits};assert.equal((await app.capture('payment_paid_refund')).status,'CAPTURED');
  controls.payRevision=3;controls.eventPatch.refundedUnits='1';await assert.rejects(()=>app.capture('payment_paid_refund'),e=>e.code==='REFUND_AUTHORITY_REQUIRED');
});
test('accepted actual meter cannot be silently revised by a fresh signed projection',async()=>{
  await app.create('payment_meter_immutable');const i=await app.prepareIntent('payment_meter_immutable');await app.authorize('payment_meter_immutable',i);await app.complete('payment_meter_immutable');await app.capture('payment_meter_immutable');await app.plan('payment_meter_immutable');
  controls.meterPatch={engagedMeters:1};await assert.rejects(()=>app.plan('payment_meter_immutable'),e=>e.code==='METER_EQUIVOCATION');
});
