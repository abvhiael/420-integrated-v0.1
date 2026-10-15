import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {createAuthenticator, AuthError} from '../src/auth.mjs';
import {createSessionClient} from '../src/session-client.mjs';
import {createTripService} from '../src/service.mjs';
import {createTrip} from '../src/trip.mjs';
const identityKeys = generateKeyPairSync('rsa', {modulusLength: 2048});
const sessionKeys = generateKeyPairSync('rsa', {modulusLength: 2048});
const pem = key => key.export({type: 'spki', format: 'pem'});
const identity = {issuer: 'https://identity.example', audience: 'liftd-api', keys: {identity_v1: pem(identityKeys.publicKey)}};
const sessionAuthority = {issuer: 'https://sessions.example', audience: 'liftd-api', keys: {session_v1: pem(sessionKeys.publicKey)}};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(claims, key = identityKeys.privateKey, header = {alg: 'RS256', typ: 'JWT', kid: 'identity_v1'}) {
  const body = `${encode(header)}.${encode(claims)}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
}
const access = patch => ({iss: identity.issuer, aud: 'liftd-api', sub: 'rider_1', iat: 100, nbf: 100, exp: 300,
  jti: 'access_1', purpose: 'liftd_access', sessionId: 'session_1', deviceId: 'device_1', accountId: 'account_1', recoveryEpoch: 0, ...patch});
const grant = patch => ({role: 'rider', actions: ['trip.create', 'trip.read', 'trip.cancel'], resource: 'trip:trip_1', expiresAt: 200, revoked: false, ...patch});
const status = (request, patch) => ({iss: sessionAuthority.issuer, aud: 'liftd-api', sub: request.subject,
  iat: 100, nbf: 100, exp: 130, jti: 'status_1', purpose: 'liftd_session_status', sessionId: request.sessionId,
  deviceId: request.deviceId, accountId: request.accountId, recoveryEpoch: 0, nonce: request.nonce,
  tokenDigest: request.tokenDigest, active: true, deviceActive: true, tokenActive: true, grants: [grant()], ...patch});
const signedStatus = claims => jwt(claims, sessionKeys.privateKey, {alg: 'RS256', typ: 'JWT', kid: 'session_v1'});
function setup({accessPatch, statusPatch, resolve, clock = () => 100, grants} = {}) {
  const resolver = resolve ?? (async request => signedStatus(status(request, {...statusPatch, ...(grants ? {grants} : {})})));
  const auth = createAuthenticator({identity, sessionAuthority, resolveSession: resolver, clock});
  return {auth, token: jwt(access(accessPatch))};
}
const permission = {action: 'trip.read', resource: 'trip:trip_1'};
const rejected = (fn, code) => assert.rejects(fn, error => error instanceof AuthError && (!code || error.code === code));
test('independent signed identity plus fresh exact session grant authenticates all three roles', async () => {
  for (const [role, action] of [['rider', 'trip.read'], ['driver', 'trip.start'], ['operator', 'trip.assign']]) {
    const {auth, token} = setup({grants: [grant({role, actions: [action]})]});
    const p = await auth.authorize(token, {action, resource: 'trip:trip_1'});
    assert.equal(p.role, role); assert.equal(p.subject, 'rider_1'); assert.ok(Object.isFrozen(p));
  }
});
test('forged signatures, algorithm/key confusion and token-controlled roles are denied', async () => {
  const {auth} = setup();
  await rejected(() => auth.authorize(jwt(access(), sessionKeys.privateKey), permission), 'INVALID_PROOF');
  for (const header of [{alg: 'none', typ: 'JWT', kid: 'identity_v1'}, {alg: 'HS256', typ: 'JWT', kid: 'identity_v1'},
    {alg: 'RS256', typ: 'JWT', kid: 'unknown'}, {alg: 'RS256', typ: 'JWT', kid: 'identity_v1', jku: 'https://evil.example'}]) {
    await rejected(() => auth.authorize(jwt(access(), identityKeys.privateKey, header), permission));
  }
  for (const patch of [{role: 'operator'}, {grants: [grant({role: 'operator'})]}, {active: true}]) {
    await rejected(() => auth.authorize(jwt(access(patch)), permission));
  }
});
test('issuer, audience, purpose, expiry and claim bounds fail closed', async () => {
  for (const patch of [{iss: 'other'}, {aud: 'doobr-api'}, {purpose: 'other'}, {exp: 100}, {iat: 101}, {nbf: 99},
    {exp: 5000}, {recoveryEpoch: -1}, {sessionId: ''}, {sub: '../bad'}, {iat: '100'}, {exp: 100.5}]) {
    const {auth, token} = setup({accessPatch: patch}); await rejected(() => auth.authorize(token, permission));
  }
});
test('revoked token/session/device, recovery epoch and cross-binding reject reused credentials', async () => {
  for (const patch of [{active: false}, {tokenActive: false}, {deviceActive: false}, {recoveryEpoch: 1},
    {sub: 'other'}, {accountId: 'other'}, {sessionId: 'other'}, {deviceId: 'other'}, {tokenDigest: 'other'}, {nonce: 'other'}]) {
    const {auth, token} = setup({statusPatch: patch}); await rejected(() => auth.authorize(token, permission));
  }
});
test('recovery accepts a newly issued epoch while old tokens remain unusable', async () => {
  const {auth, token} = setup({accessPatch: {recoveryEpoch: 2}, statusPatch: {recoveryEpoch: 2}});
  assert.equal((await auth.authorize(token, permission)).recoveryEpoch, 2);
  await rejected(() => auth.authorize(jwt(access({recoveryEpoch: 1})), permission), 'SESSION_BINDING_MISMATCH');
});
test('fresh nonce prevents cached status replay; revocation checked on every operation', async () => {
  let cached, calls = 0, revoked = false;
  const {auth, token} = setup({resolve: async request => {
    calls++; if (!cached) cached = signedStatus(status(request));
    return calls === 2 ? cached : signedStatus(status(request, {active: !revoked}));
  }});
  await auth.authorize(token, permission);
  await rejected(() => auth.authorize(token, permission), 'SESSION_BINDING_MISMATCH');
  revoked = true; await rejected(() => auth.authorize(token, permission), 'SESSION_REVOKED');
  assert.equal(calls, 3);
});
test('unavailable, malformed, stale and wrong-key session responses deny authority', async () => {
  for (const resolve of [async () => { throw Error('offline'); }, async () => 'broken',
    async r => signedStatus(status(r, {exp: 100})), async r => signedStatus(status(r, {iat: 60, nbf: 60, exp: 120})),
    async r => jwt(status(r))]) {
    const {auth, token} = setup({resolve}); await rejected(() => auth.authorize(token, permission));
  }
});
test('expired/revoked/wildcard/overbroad/duplicate grants and wrong resources deny access', async () => {
  for (const grants of [[grant({revoked: true})], [grant({expiresAt: 100})], [grant({resource: 'trip:other'})],
    [grant({resource: '*'} )], [grant({actions: ['trip.assign']})], [grant(), grant()], []]) {
    const {auth, token} = setup({grants}); await rejected(() => auth.authorize(token, permission));
  }
  const {auth, token} = setup();
  await rejected(() => auth.authorize(token, {action: 'payment.capture', resource: 'trip:trip_1'}), 'PERMISSION_DENIED');
});
test('missing, weak or shared trust roots cannot enable authentication', () => {
  for (const config of [{identity: undefined, sessionAuthority}, {identity, sessionAuthority: identity},
    {identity, sessionAuthority: {...sessionAuthority, keys: identity.keys}},
    {identity: {...identity, keys: {bad: 'not a key'}}, sessionAuthority}]) {
    assert.throws(() => createAuthenticator({...config, resolveSession: async () => ''}), {name: 'AuthError'});
  }
});
test('access expiry during independent lookup is not extended', async () => {
  let now = 100;
  const {auth, token} = setup({accessPatch: {exp: 101}, clock: () => now, resolve: async r => {
    now = 101; return signedStatus(status(r));
  }});
  await rejected(() => auth.authorize(token, permission), 'INVALID_PROOF');
});
function memoryStore() {
  const trips = new Map();
  return {trips, async create(trip) { if (trips.has(trip.id)) throw Error('duplicate'); trips.set(trip.id, trip); },
    async get(id) {return trips.get(id);}, async compareAndSwap(id, revision, next) {
      if (trips.get(id)?.revision !== revision) throw Error('stale'); trips.set(id, next);
    }};
}
test('protected trip service creates/reads/cancels only the authenticated rider own trip', async () => {
  const grants = [grant({resource: 'account:rider_1', actions: ['trip.create']}), grant()];
  const {auth, token} = setup({grants}); const store = memoryStore();
  const service = createTripService({authenticator: auth, store, clock: () => 100});
  await service.create(token, {id: 'trip_1', routeRef: 'private_route', riderId: 'rider_1'});
  assert.equal((await service.read(token, 'trip_1')).riderId, 'rider_1');
  await rejected(() => service.create(token, {id: 'trip_2', routeRef: 'private_route', riderId: 'other'}), 'PERMISSION_DENIED');
  await rejected(() => service.transition(token, 'trip_1', {action: 'assign', expectedRevision: 0, driverId: 'driver_1', vehicleId: 'vehicle_1'}), 'PERMISSION_DENIED');
  assert.equal((await service.transition(token, 'trip_1', {action: 'cancel', expectedRevision: 0})).state, 'CANCELLED');
});
test('driver grant still requires actual assignment; operator assignment does not reveal private route', async () => {
  const store = memoryStore(); await store.create(createTrip({id: 'trip_1', routeRef: 'private_route'}, {subject: 'rider_1', role: 'rider'}));
  const op = setup({accessPatch: {sub: 'op_1'}, grants: [grant({role: 'operator', actions: ['trip.assign']})]});
  const driver = setup({accessPatch: {sub: 'driver_1'}, grants: [grant({role: 'driver', actions: ['trip.read', 'trip.arrive']})]});
  const driverService = createTripService({authenticator: driver.auth, store, clock: () => 100});
  await assert.rejects(() => driverService.read(driver.token, 'trip_1'), error => error.code === 'UNAUTHORIZED');
  const opService = createTripService({authenticator: op.auth, store, clock: () => 100, isPaused: () => false,
    admissionFor: async () => ({tripId: 'trip_1', routeRef: 'private_route', driverId: 'driver_1', vehicleId: 'vehicle_1', allowed: true, expiresAt: 200})});
  assert.deepEqual(await opService.transition(op.token, 'trip_1', {action: 'assign', expectedRevision: 0, driverId: 'driver_1', vehicleId: 'vehicle_1'}),
    {id: 'trip_1', state: 'ASSIGNED', revision: 1});
  assert.equal((await driverService.read(driver.token, 'trip_1')).driverId, 'driver_1');
  await assert.rejects(() => driverService.transition(driver.token, 'trip_1', {action: 'arrive', expectedRevision: 1}), error => error.code === 'SERVICE_PAUSED');
});
test('session HTTPS client pins destination, blocks redirects and bounds responses', async () => {
  let captured;
  const client = createSessionClient({endpoint: 'https://sessions.example/status', credential: 'service-fixture', transport: async (url, options) => {
    captured = {url, options}; return new Response('signed.jwt.proof', {headers: {'content-type': 'application/jwt'}});
  }});
  assert.equal(await client({nonce: 'challenge'}), 'signed.jwt.proof');
  assert.equal(captured.url, 'https://sessions.example/status'); assert.equal(captured.options.redirect, 'error');
  assert.equal(captured.options.method, 'POST'); assert.equal(captured.options.body, '{"nonce":"challenge"}');
  for (const transport of [async () => new Response('x', {status: 401}), async () => new Response('x'),
    async () => new Response('x'.repeat(32769), {headers: {'content-type': 'application/jwt'}}), async () => {throw Error('offline');}]) {
    await rejected(() => createSessionClient({endpoint: 'https://sessions.example/status', credential: 'fixture', transport})({}), 'SESSION_AUTHORITY_UNAVAILABLE');
  }
  for (const endpoint of ['http://sessions.example/status', 'https://user:pass@sessions.example/status', 'https://sessions.example/status?token=x', 'bad']) {
    assert.throws(() => createSessionClient({endpoint, credential: 'fixture'}), {name: 'AuthError'});
  }
});
test('HTTP bearer boundary accepts signed sessions and rejects proxy roles, body claims and query tokens', async () => {
  const {createHttpHandler} = await import('../src/http.mjs');
  const {auth, token} = setup({grants: [grant({resource: 'account:rider_1', actions: ['trip.create']}), grant()]});
  const store = memoryStore(); const handler = createHttpHandler(createTripService({authenticator: auth, store, clock: () => 100}));
  const post = (body, headers = {}, suffix = '') => new Request(`https://liftd.example/v1/rideshare/trips${suffix}`, {method: 'POST',
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers}, body: JSON.stringify(body)});
  const input = {id: 'trip_1', routeRef: 'private_route', riderId: 'rider_1'};
  assert.equal((await handler(post({...input, role: 'operator'}))).status, 400);
  assert.equal((await handler(post(input, {authorization: '', 'x-user': 'rider_1', 'x-role': 'operator'}))).status, 401);
  assert.equal((await handler(post(input, {}, '?token=secret'))).status, 400);
  assert.equal(store.trips.size, 0);
  assert.equal((await handler(post(input))).status, 201);
  const response = await handler(new Request('https://liftd.example/v1/rideshare/trips/trip_1', {headers: {authorization: `Bearer ${token}`}}));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const oversized = await handler(new Request('https://liftd.example/v1/rideshare/trips', {method: 'POST',
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: 'x'.repeat(8193)}));
  assert.equal(oversized.status, 413);
});
test('real HTTPS-client adapter and independent signature verifier compose end to end', async () => {
  let revoked = false;
  const resolveSession = createSessionClient({endpoint: 'https://sessions.example/status', credential: 'test-only-service', transport: async (_, options) => {
    const r = JSON.parse(options.body);
    return new Response(signedStatus(status(r, {deviceActive: !revoked})), {headers: {'content-type': 'application/jwt'}});
  }});
  const auth = createAuthenticator({identity, sessionAuthority, resolveSession, clock: () => 100});
  assert.equal((await auth.authorize(jwt(access()), permission)).role, 'rider');
  revoked = true;
  await rejected(() => auth.authorize(jwt(access()), permission), 'SESSION_REVOKED');
});
test('malformed/ambiguous/oversized bearer proofs and malformed grants are rejected', async () => {
  const {auth} = setup();
  for (const token of ['', 'a.b.c.d', 'x'.repeat(32769), 'e30=.e30.sig']) await rejected(() => auth.authorize(token, permission));
  for (const patch of [{grants: {}}, {grants: [grant({expiresAt: 100.5})]}, {grants: [grant({role: '__proto__'})]},
    {grants: [grant({actions: ['payment.capture']})]}, {grants: [grant({revoked: 'false'})]}, {exp: 131}]) {
    const {auth, token} = setup({statusPatch: patch}); await rejected(() => auth.authorize(token, permission));
  }
});
test('timeout abort and late authorization stop protected writes', async () => {
  const client = createSessionClient({endpoint: 'https://sessions.example/status', credential: 'fixture', timeoutMs: 5,
    transport: async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('timeout'))))});
  await rejected(() => client({}), 'SESSION_AUTHORITY_UNAVAILABLE');
  let now = 100;
  const {auth, token} = setup({clock: () => now, grants: [grant({role: 'operator', actions: ['trip.assign']})]});
  const store = memoryStore(); await store.create(createTrip({id: 'trip_1', routeRef: 'private_route'}, {subject: 'rider_1', role: 'rider'}));
  const service = createTripService({authenticator: auth, store, clock: () => now, isPaused: () => false,
    admissionFor: async () => { now = 130; return {}; }});
  await rejected(() => service.transition(token, 'trip_1', {action: 'assign', expectedRevision: 0, driverId: 'driver_1', vehicleId: 'vehicle_1'}), 'AUTHORIZATION_EXPIRED');
  assert.equal(store.trips.get('trip_1').revision, 0);
});
