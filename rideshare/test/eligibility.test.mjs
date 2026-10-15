import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {createEligibilityAdapter, VANCOUVER_SCOPE} from '../src/eligibility.mjs';
import {createTripService} from '../src/service.mjs';
import {createSessionClient} from '../src/session-client.mjs';
const keys = ['driver', 'vehicle', 'transport'].map(() => generateKeyPairSync('rsa', {modulusLength: 2048}));
const roots = keys.map((key, i) => ({issuer: `https://authority-${i}.example`, audience: 'liftd-api', keys: {v1: key.publicKey.export({type: 'spki', format: 'pem'})}}));
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const signed = (claims, i, header = {alg: 'RS256', typ: 'JWT', kid: 'v1'}) => {
  const body = `${b64(header)}.${b64(claims)}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), keys[i].privateKey).toString('base64url')}`;
};
const trip = {id: 'trip_1', riderId: 'rider_1', driverId: null, vehicleId: null, routeRef: 'route_1', state: 'REQUESTED', revision: 0};
const command = {action: 'assign', expectedRevision: 0, driverId: 'driver_1', vehicleId: 'vehicle_1'};
const scope = patch => ({...VANCOUVER_SCOPE, routeRef: 'route_1', scopeRef: 'scope_1', revision: 1,
  passengerCount: 2, expiresAt: 200, airport: false, crossBoundary: false, ...patch});
function setup(options = {}) {
  let now = 100;
  const common = (request, i, sub, purpose) => ({...request, iss: roots[i].issuer, aud: 'liftd-api', sub,
    iat: 100, nbf: 100, exp: 130, jti: `proof_${i}`, purpose});
  const resolvers = [
    async request => signed({...common(request, 0, request.driverId, 'liftd_driver_registry'), accountId: 'account_1', recordRef: 'driver_record', revision: 1,
      active: true, suspended: false, ...options.driver}, 0),
    async request => signed({...common(request, 1, request.vehicleId, 'liftd_vehicle_registry'), recordRef: 'vehicle_record', revision: 2,
      active: true, suspended: false, capacity: 4, authorizedDriverId: request.driverId, ...options.vehicle}, 1),
    async request => {if (options.late) now = 130; return signed({...common(request, 2, request.driverId, 'liftd_transport_eligibility'),
      operatorRef: 'operator_1', approved: true, revoked: false, validUntil: 180, ...options.transport}, 2);},
  ];
  const adapter = createEligibilityAdapter({driverRegistry: roots[0], vehicleRegistry: roots[1], transportAuthority: roots[2],
    resolveDriver: options.resolveDriver ?? resolvers[0], resolveVehicle: options.resolveVehicle ?? resolvers[1],
    resolveTransport: options.resolveTransport ?? resolvers[2], routeScopeFor: options.routeScopeFor ?? (async () => scope(options.scope)), clock: () => now});
  return {adapter, resolvers};
}
const reject = (fn, code) => assert.rejects(fn, error => error.name === 'AuthError' && (!code || error.code === code));
test('independently signed driver/vehicle projections produce immutable exact Vancouver admission', async () => {
  const {adapter} = setup(); const result = await adapter.project(trip, command);
  assert.equal(result.driver.recordRef, 'driver_record'); assert.equal(result.vehicle.revision, 2);
  assert.deepEqual(result.eligibility.municipality, 'Vancouver');
  assert.deepEqual(result.admission, {tripId: 'trip_1', driverId: 'driver_1', vehicleId: 'vehicle_1', routeRef: 'route_1', allowed: true, expiresAt: 130});
  assert.ok(Object.isFrozen(result.driver)); assert.ok(Object.isFrozen(result));
  assert.equal('licenseNumber' in result.driver, false);
});
test('inactive/suspended drivers, vehicles and driver-vehicle mismatch fail closed', async () => {
  for (const driver of [{active: false}, {suspended: true}, {accountId: ''}, {revision: -1}]) {
    await reject(() => setup({driver}).adapter.admissionFor(trip, command), 'DRIVER_INELIGIBLE');
  }
  for (const vehicle of [{active: false}, {suspended: true}, {authorizedDriverId: 'other'}, {capacity: 1}, {capacity: 1.5}, {revision: -1}]) {
    await reject(() => setup({vehicle}).adapter.admissionFor(trip, command), 'VEHICLE_INELIGIBLE');
  }
});
test('delivery approval, wrong jurisdiction, airports and cross-boundary routes cannot authorize rides', async () => {
  for (const patch of [{service: 'doobr-delivery'}, {municipality: 'Richmond'}, {region: 'AB'}, {country: 'US'},
    {airport: true}, {crossBoundary: true}, {expiresAt: 100}, {passengerCount: 0}, {routeRef: 'other'}]) {
    await reject(() => setup({scope: patch}).adapter.admissionFor(trip, command), 'OUTSIDE_LAUNCH_SCOPE');
  }
  for (const transport of [{service: 'doobr-delivery'}, {municipality: 'Richmond'}, {region: 'AB'}, {country: 'US'}]) {
    await reject(() => setup({transport}).adapter.admissionFor(trip, command), 'ELIGIBILITY_BINDING_MISMATCH');
  }
});
test('transport approval must bind exact registry revisions, account, route, trip and operator', async () => {
  for (const transport of [{driverRecordRef: 'other'}, {driverRevision: 0}, {vehicleRecordRef: 'other'}, {vehicleRevision: 1},
    {driverAccountId: 'other'}, {routeScopeRef: 'other'}, {routeScopeRevision: 0}, {tripId: 'other'}, {routeRef: 'other'},
    {vehicleId: 'other'}, {driverId: 'other'}, {nonce: 'other'}]) {
    await reject(() => setup({transport}).adapter.admissionFor(trip, command), 'ELIGIBILITY_BINDING_MISMATCH');
  }
  for (const transport of [{approved: false}, {revoked: true}, {validUntil: 100}, {operatorRef: ''}]) {
    await reject(() => setup({transport}).adapter.admissionFor(trip, command), 'TRANSPORT_INELIGIBLE');
  }
});
test('forged/wrong-purpose/wrong-audience/expired projections are rejected at each authority', async () => {
  for (const field of ['driver', 'vehicle', 'transport']) for (const patch of [{aud: 'doobr-api'}, {purpose: 'other'}, {iss: 'unapproved'}, {exp: 100}, {iat: 101}]) {
    await reject(() => setup({[field]: patch}).adapter.admissionFor(trip, command));
  }
  await reject(() => setup({resolveDriver: async r => signed({...r}, 1)}).adapter.admissionFor(trip, command));
  await reject(() => setup({driver: {licenseNumber: 'private-data'}}).adapter.admissionFor(trip, command));
});
test('fresh challenge prevents old projection replay and late responses cannot extend eligibility', async () => {
  let cached;
  const base = setup();
  const {adapter} = setup({resolveDriver: async r => cached ??= await base.resolvers[0](r)});
  await adapter.admissionFor(trip, command);
  await reject(() => adapter.admissionFor(trip, command), 'ELIGIBILITY_BINDING_MISMATCH');
  await reject(() => setup({late: true}).adapter.admissionFor(trip, command));
});
test('unavailable route/registry/transport or missing approved keys never create eligibility', async () => {
  for (const patch of [{routeScopeFor: async () => {throw Error('offline');}}, {resolveDriver: async () => {throw Error('offline');}},
    {resolveVehicle: async () => {throw Error('offline');}}, {resolveTransport: async () => {throw Error('offline');}}]) {
    await reject(() => setup(patch).adapter.admissionFor(trip, command));
  }
  assert.throws(() => createEligibilityAdapter({}), {name: 'AuthError'});
});
test('HTTPS registry client composes with actual signature/projection verification', async () => {
  const base = setup();
  const resolver = createSessionClient({endpoint: 'https://registry.example/driver-status', credential: 'fixture-only',
    transport: async (_, options) => new Response(await base.resolvers[0](JSON.parse(options.body)), {headers: {'content-type': 'application/jwt'}})});
  assert.equal((await setup({resolveDriver: resolver}).adapter.admissionFor(trip, command)).allowed, true);
});
test('service rechecks eligibility on assign/arrive/start; revocation preserves cancellation/completion', async () => {
  let revoked = false, calls = 0; const base = setup();
  const {adapter} = setup({resolveTransport: async r => {
    calls++; return revoked ? signed({...r, iss: roots[2].issuer, aud: 'liftd-api', sub: r.driverId, iat: 100, nbf: 100,
      exp: 130, jti: 'revoked', purpose: 'liftd_transport_eligibility', operatorRef: 'operator_1', approved: true, revoked: true, validUntil: 180}, 2) : base.resolvers[2](r);
  }});
  let currentTrip = trip;
  const store = {async get() {return currentTrip;}, async create() {}, async compareAndSwap(_, revision, next) {
    assert.equal(currentTrip.revision, revision); currentTrip = next;
  }};
  // Authenticated principal fixture isolates eligibility seam; L01.2 crypto tests are retained separately.
  const auth = {async authorize(token) {return {subject: token === 'operator' ? 'op_1' : token, role: token === 'operator' ? 'operator' : token === 'rider_1' ? 'rider' : 'driver', accountId: 'account_1', expiresAt: 200};}};
  const service = createTripService({authenticator: auth, store, clock: () => 100, isPaused: () => false, eligibilityAdapter: adapter});
  await service.transition('operator', 'trip_1', command);
  await service.transition('driver_1', 'trip_1', {action: 'arrive', expectedRevision: 1});
  revoked = true;
  await reject(() => service.transition('driver_1', 'trip_1', {action: 'start', expectedRevision: 2}), 'TRANSPORT_INELIGIBLE');
  assert.equal(currentTrip.state, 'ARRIVED');
  await service.transition('rider_1', 'trip_1', {action: 'cancel', expectedRevision: 2});
  assert.equal(calls, 3); assert.equal(currentTrip.state, 'CANCELLED');
  currentTrip = {...trip, driverId: 'driver_1', vehicleId: 'vehicle_1', state: 'IN_PROGRESS', revision: 3};
  await service.transition('driver_1', 'trip_1', {action: 'complete', expectedRevision: 3});
  assert.equal(calls, 3); assert.equal(currentTrip.state, 'COMPLETED');
});

test('driver session account must match registry binding and transport cannot reuse registry signing keys', async () => {
  const {adapter, resolvers} = setup();
  await reject(() => adapter.admissionFor(trip, command, {role: 'driver', subject: 'driver_1', accountId: 'other'}), 'DRIVER_ACCOUNT_MISMATCH');
  assert.throws(() => createEligibilityAdapter({driverRegistry: roots[0], vehicleRegistry: roots[1], transportAuthority: roots[0],
    resolveDriver: resolvers[0], resolveVehicle: resolvers[1], resolveTransport: resolvers[2], routeScopeFor: async () => scope()}),
    error => error.code === 'SEPARATE_TRANSPORT_AUTHORITY_REQUIRED');
});
