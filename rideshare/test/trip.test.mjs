import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, transitionTrip, participantView, publicView } from '../src/trip.mjs';
const rider = {subject: 'rider_1', role: 'rider'};
const driver = {subject: 'driver_1', role: 'driver'};
const dispatcher = {subject: 'dispatch_1', role: 'dispatcher'};
const fresh = () => createTrip({id: 'trip_1', routeRef: 'private_route_1'}, rider);
const admission = {tripId: 'trip_1', driverId: 'driver_1', vehicleId: 'vehicle_1',
  routeRef: 'private_route_1', expiresAt: 200, allowed: true};
const context = {now: 100, paused: false, admission};
const command = (trip, action, extra = {}) => ({action, expectedRevision: trip.revision, ...extra});
const move = (trip, action, actor = driver, ctx = context, extra) => transitionTrip(trip, command(trip, action, extra), actor, ctx);
const assigned = () => move(fresh(), 'assign', dispatcher, context, {driverId: 'driver_1', vehicleId: 'vehicle_1'});
const arrived = () => move(assigned(), 'arrive');
const active = () => move(arrived(), 'start');
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);
test('ordered trip lifecycle is immutable and completion has no financial side effects', () => {
  const first = fresh(); const second = assigned(); const third = move(second, 'arrive');
  const fourth = move(third, 'start'); const fifth = move(fourth, 'complete');
  assert.deepEqual([first.state, second.state, third.state, fourth.state, fifth.state],
    ['REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED']);
  assert.equal(fifth.revision, 4); assert.equal(first.driverId, null);
  assert.ok(Object.isFrozen(fifth)); assert.equal('payment' in fifth, false);
});
test('roles and participant binding reject cross-account actions', () => {
  rejects(() => createTrip({id: 'trip_1', routeRef: 'route_1'}, driver), 'UNAUTHORIZED');
  rejects(() => move(fresh(), 'assign', rider, context, {driverId: 'driver_1', vehicleId: 'vehicle_1'}), 'UNAUTHORIZED');
  rejects(() => move(assigned(), 'arrive', {subject: 'other', role: 'driver'}), 'UNAUTHORIZED');
  rejects(() => move(assigned(), 'cancel', {subject: 'other', role: 'rider'}), 'UNAUTHORIZED');
  rejects(() => move(active(), 'complete', dispatcher), 'UNAUTHORIZED');
});
test('out-of-order, stale and replayed commands do not mutate state', () => {
  const trip = assigned();
  rejects(() => move(trip, 'start'), 'INVALID_TRANSITION');
  const next = move(trip, 'arrive');
  rejects(() => transitionTrip(next, command(trip, 'arrive'), driver, context), 'STALE_REVISION');
  assert.equal(trip.state, 'ASSIGNED');
  for (const terminal of [move(fresh(), 'cancel', rider), move(active(), 'complete')]) {
    rejects(() => move(terminal, 'cancel', rider), 'TERMINAL_TRIP');
  }
});
test('independent admission must be fresh and bound to exact trip, route, driver and vehicle', () => {
  for (const patch of [{allowed: false}, {expiresAt: 100}, {tripId: 'other'},
    {routeRef: 'other'}, {driverId: 'other'}, {vehicleId: 'other'}]) {
    const ctx = {...context, admission: {...admission, ...patch}};
    rejects(() => move(fresh(), 'assign', dispatcher, ctx, {driverId: 'driver_1', vehicleId: 'vehicle_1'}), 'ADMISSION_REQUIRED');
    rejects(() => move(arrived(), 'start', driver, ctx), 'ADMISSION_REQUIRED');
  }
  rejects(() => move(arrived(), 'start', driver, {now: 100, paused: false}), 'INVALID_INPUT');
});
test('pause stops new risk, preserves pre-trip cancellation and in-progress completion', () => {
  const paused = {...context, paused: true, admission: {...admission, allowed: false}};
  rejects(() => move(fresh(), 'assign', dispatcher, paused, {driverId: 'driver_1', vehicleId: 'vehicle_1'}), 'SERVICE_PAUSED');
  rejects(() => move(assigned(), 'arrive', driver, paused), 'SERVICE_PAUSED');
  rejects(() => move(arrived(), 'start', driver, paused), 'SERVICE_PAUSED');
  assert.equal(move(assigned(), 'cancel', rider, paused).state, 'CANCELLED');
  assert.equal(move(arrived(), 'cancel', driver, paused).state, 'CANCELLED');
  assert.equal(move(active(), 'complete', driver, paused).state, 'COMPLETED');
  rejects(() => move(active(), 'cancel', rider, paused), 'ACTIVE_TRIP_REQUIRES_SAFETY_RESOLUTION');
});
test('private routes and identities never appear in public discovery', () => {
  const trip = assigned();
  assert.deepEqual(publicView(trip), {application: 'LIFTd', liveBookingAvailable: false});
  assert.equal(participantView(trip, rider).routeRef, 'private_route_1');
  rejects(() => participantView(trip, dispatcher), 'UNAUTHORIZED');
  rejects(() => participantView(trip, {subject: rider.subject, role: 'driver'}), 'UNAUTHORIZED');
});
test('malformed IDs, extra location fields, self-assignment and invalid snapshots fail closed', () => {
  rejects(() => createTrip({id: 'trip_1', routeRef: 'route_1', latitude: 52}, rider), 'INVALID_INPUT');
  rejects(() => createTrip({id: '../bad', routeRef: 'route_1'}, rider), 'INVALID_INPUT');
  rejects(() => move(fresh(), 'assign', dispatcher, context, {driverId: rider.subject, vehicleId: 'vehicle_1'}), 'INVALID_INPUT');
  rejects(() => publicView({...fresh(), state: 'IN_PROGRESS'}), 'INVALID_TRIP');
  rejects(() => move(arrived(), 'start', driver, {now: NaN, paused: false}), 'INVALID_CONTEXT');
  rejects(() => move(arrived(), 'start', driver, {...context, paused: 'false'}), 'INVALID_CONTEXT');
  rejects(() => move(arrived(), 'start', driver, context, {driverId: 'other'}), 'INVALID_INPUT');
});
test('all state/action/actor combinations enforce the lifecycle and authority matrix', () => {
  const snapshots = [fresh(), assigned(), arrived(), active(), move(active(), 'complete'), move(fresh(), 'cancel', rider)];
  const actors = [rider, driver, dispatcher, {subject: 'stranger', role: 'rider'}, {subject: 'stranger', role: 'driver'}];
  for (const trip of snapshots) for (const action of ['assign', 'arrive', 'start', 'complete', 'cancel']) for (const actor of actors) {
    const permitted = (action === 'assign' && trip.state === 'REQUESTED' && actor === dispatcher) ||
      (action === 'arrive' && trip.state === 'ASSIGNED' && actor === driver) ||
      (action === 'start' && trip.state === 'ARRIVED' && actor === driver) ||
      (action === 'complete' && trip.state === 'IN_PROGRESS' && actor === driver) ||
      (action === 'cancel' && ['REQUESTED', 'ASSIGNED', 'ARRIVED'].includes(trip.state) &&
        (actor === rider || (actor === driver && trip.driverId === driver.subject)));
    const invoke = () => move(trip, action, actor, context, action === 'assign' ? {driverId: 'driver_1', vehicleId: 'vehicle_1'} : undefined);
    if (permitted) assert.equal(invoke().revision, trip.revision + 1);
    else assert.throws(invoke, {name: 'TripError'});
  }
});
test('inherited claims, symbols and accessors cannot bypass the input schema', () => {
  rejects(() => createTrip(Object.create({id: 'trip_1', routeRef: 'route_1'}), rider), 'INVALID_INPUT');
  rejects(() => createTrip({id: 'trip_1', routeRef: 'route_1', [Symbol('private')]: 52}, rider), 'INVALID_INPUT');
  let invoked = false;
  const input = {id: 'trip_1', get routeRef() { invoked = true; return 'route_1'; }};
  rejects(() => createTrip(input, rider), 'INVALID_INPUT');
  assert.equal(invoked, false);
});
test('safe-integer boundaries and malformed admission fail closed', () => {
  for (const revision of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    rejects(() => publicView({...fresh(), revision}), 'INVALID_TRIP');
  }
  rejects(() => move({...assigned(), revision: Number.MAX_SAFE_INTEGER}, 'arrive'), 'REVISION_EXHAUSTED');
  for (const expiresAt of [NaN, Infinity, '200', Number.MAX_SAFE_INTEGER + 1]) {
    rejects(() => move(assigned(), 'arrive', driver, {...context, admission: {...admission, expiresAt}}), 'ADMISSION_REQUIRED');
  }
  const trip = assigned();
  rejects(() => transitionTrip(trip, {action: 'arrive', expectedRevision: '1'}, driver, context), 'STALE_REVISION');
  assert.equal(trip.state, 'ASSIGNED');
});
