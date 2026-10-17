import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {generateRoots} from './dispatch-fixture.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {createEconomicReconciliationService,auditEconomicHistory} from '../../src/economic-reconciliation.mjs';
test('L03.4 real PostgreSQL reconciliation of trip, quote, payment, payout and authorizations',async()=>{
 assert.ok(process.env.LIFTD_DATABASE_URL);
 const pool=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});
 try{
  await migrate(pool);
  const controls={now:100,quotes:true,pay:true,economics:true,encryptionKey:Buffer.alloc(32,12).toString('base64')};
  const app=paymentFixture(pool,[...generateRoots(),...generateRoots()],controls);
  const service=createEconomicReconciliationService({pool,authenticator:app.authenticator,clock:()=>controls.now});
  const tripId='eco_'+Date.now();
  await app.create(tripId);
  const intent=await app.prepareIntent(tripId,200);
  await app.authorize(tripId,intent);
  await app.complete(tripId);
  await app.capture(tripId);
  const plan=await app.plan(tripId);
  const before=await service.reconcile(app.operator(tripId),tripId);
  assert.equal(before.status,'RECONCILED');
  assert.equal(before.assetConserved,true);
  assert.equal(before.driverCents,'0');
  const operation=await app.reserve(tripId,'driver',plan.driverCents);
  await app.reconcileOperation(tripId,operation);
  const after=await service.reconcile(app.operator(tripId),tripId);
  assert.equal(after.driverCents,String(plan.driverCents));
  assert.notEqual(after.historyDigest,before.historyDigest);
  const query=async sql=>(await pool.query(sql,[tripId])).rows;
  const q=(await pool.query('SELECT q.payload,q.quote_hash FROM liftd.trip_quotes b JOIN liftd.fare_quotes q USING(quote_id) WHERE b.trip_id=$1',[tripId])).rows[0];
  const base={tripEvents:await query('SELECT * FROM liftd.events WHERE trip_id=$1 ORDER BY revision'),trip:(await query('SELECT snapshot FROM liftd.trips WHERE trip_id=$1'))[0].snapshot,quote:q.payload,quoteHash:q.quote_hash,
   intents:await query('SELECT * FROM liftd.payment_intents WHERE trip_id=$1'),
   operations:await query('SELECT * FROM liftd.pay_operations WHERE trip_id=$1'),
   plans:await query('SELECT * FROM liftd.payout_projections WHERE trip_id=$1'),
   funding:await query('SELECT * FROM liftd.settlement_funding WHERE trip_id=$1'),
   events:await query('SELECT e.* FROM liftd.payment_events e JOIN liftd.payment_intents i ON i.intent_id=e.intent_id WHERE i.trip_id=$1'),
   operationEvents:await query('SELECT e.* FROM liftd.operation_events e JOIN liftd.pay_operations o ON o.operation_id=e.operation_id WHERE o.trip_id=$1'),
   receipts:(await pool.query('SELECT * FROM liftd.financial_receipts')).rows,
   timing:(await query('SELECT * FROM liftd.trip_financial_timing WHERE trip_id=$1'))[0]};
  assert.equal(auditEconomicHistory(base).status,'RECONCILED');
  const altered=structuredClone(base);altered.quote.amounts.transportationCents+=1;
  assert.throws(()=>auditEconomicHistory(altered),{code:'ECONOMIC_QUOTE_CORRUPT'});
  const duplicate=structuredClone(base);duplicate.operations.push(duplicate.operations[0]);
  assert.throws(()=>auditEconomicHistory(duplicate),{code:'ECONOMIC_REPLAY'});
  const theft=structuredClone(base);theft.operations[0].amount_cents=9999999;
  assert.throws(()=>auditEconomicHistory(theft),{code:'ECONOMIC_OPERATION_BINDING'});
  const payout=structuredClone(base);payout.plans[0].payload.driverCents+=1;
  assert.throws(()=>auditEconomicHistory(payout),{code:'ECONOMIC_PLAN_HASH_CORRUPT'});
  await assert.rejects(()=>service.reconcile(app.rider(tripId),tripId));
  const pending='eco_pending_'+Date.now();
  await app.create(pending);
  const pendingIntent=await app.prepareIntent(pending);
  await app.authorize(pending,pendingIntent);
  await app.complete(pending);
  await assert.rejects(()=>service.reconcile(app.operator(pending),pending),{code:'ECONOMIC_FINALITY_REQUIRED'});

  await assert.rejects(()=>pool.query('DELETE FROM liftd.operation_events WHERE operation_id=$1',[operation.operationId]),e=>e.code==='23514');
 }finally{await pool.end()}
});
