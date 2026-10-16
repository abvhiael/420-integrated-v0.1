import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabasePool,migrate} from '../../src/postgres-store.mjs';
import {generateRoots} from './dispatch-fixture.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {createEconomicReconciliationService} from '../../src/economic-reconciliation.mjs';
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
  await assert.rejects(()=>service.reconcile(app.rider(tripId),tripId));
  await assert.rejects(()=>pool.query('DELETE FROM liftd.operation_events WHERE operation_id=$1',[operation.operationId]),e=>e.code==='23514');
 }finally{await pool.end()}
});
