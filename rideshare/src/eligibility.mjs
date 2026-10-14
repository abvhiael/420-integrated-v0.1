import {randomBytes, createPublicKey} from 'node:crypto';
import {AuthError, record, createAuthorityVerifier} from './auth.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = code => {throw new AuthError(code, 403);};
const common = ['nonce', 'tripId', 'driverId', 'vehicleId', 'routeRef'];
export const VANCOUVER_SCOPE = Object.freeze({country: 'CA', region: 'BC', municipality: 'Vancouver', service: 'liftd-passenger'});
function bind(proof, request, subject) {
  if (proof.sub !== subject || common.some(field => proof[field] !== request[field])) fail('ELIGIBILITY_BINDING_MISMATCH');
}
// Registry state is an independently verified projection, never a new Registry authority.
export function createEligibilityAdapter({driverRegistry, vehicleRegistry, transportAuthority,
  resolveDriver, resolveVehicle, resolveTransport, routeScopeFor,
  clock = () => Math.floor(Date.now() / 1000)}) {
  const driverProof = createAuthorityVerifier(driverRegistry, {purpose: 'liftd_driver_registry',
    fields: [...common, 'accountId', 'recordRef', 'revision', 'active', 'suspended']});
  const vehicleProof = createAuthorityVerifier(vehicleRegistry, {purpose: 'liftd_vehicle_registry',
    fields: [...common, 'recordRef', 'revision', 'active', 'suspended', 'capacity', 'authorizedDriverId']});
  const transportProof = createAuthorityVerifier(transportAuthority, {purpose: 'liftd_transport_eligibility',
    fields: [...common, 'country', 'region', 'municipality', 'service', 'routeScopeRef', 'routeScopeRevision',
      'driverRecordRef', 'driverRevision', 'vehicleRecordRef', 'vehicleRevision', 'driverAccountId',
      'operatorRef', 'approved', 'revoked', 'validUntil']});
  const publicKeys = config => Object.values(config.keys).map(key => createPublicKey(key).export({type: 'spki', format: 'der'}));
  if (publicKeys(transportAuthority).some(key => [...publicKeys(driverRegistry), ...publicKeys(vehicleRegistry)].some(registryKey => key.equals(registryKey)))) throw new AuthError('SEPARATE_TRANSPORT_AUTHORITY_REQUIRED', 503);
  if ([resolveDriver, resolveVehicle, resolveTransport, routeScopeFor].some(fn => typeof fn !== 'function')) throw new AuthError('ELIGIBILITY_AUTHORITY_UNAVAILABLE', 503);
  const adapter = {
    async project(trip, command) {
      record(trip, ['id', 'riderId', 'driverId', 'vehicleId', 'routeRef', 'state', 'revision']);
      record(command, ['action', 'expectedRevision', 'driverId', 'vehicleId']);
      if (!['assign', 'arrive', 'start'].includes(command.action)) fail('INVALID_ADMISSION_ACTION');
      const driverId = command.action === 'assign' ? command.driverId : trip.driverId;
      const vehicleId = command.action === 'assign' ? command.vehicleId : trip.vehicleId;
      if (![trip.id, trip.routeRef, driverId, vehicleId].every(id) || driverId === trip.riderId) fail('INVALID_ELIGIBILITY_INPUT');
      const before = clock();
      if (!integer(before)) throw new AuthError('ELIGIBILITY_AUTHORITY_UNAVAILABLE', 503);
      let scope;
      try { scope = await routeScopeFor(trip.routeRef); }
      catch { throw new AuthError('ROUTE_SCOPE_UNAVAILABLE', 503); }
      record(scope, ['routeRef', 'scopeRef', 'revision', 'country', 'region', 'municipality', 'service',
        'passengerCount', 'expiresAt', 'airport', 'crossBoundary']);
      if (scope.routeRef !== trip.routeRef || !id(scope.scopeRef) || !integer(scope.revision) ||
        Object.entries(VANCOUVER_SCOPE).some(([field, value]) => scope[field] !== value) ||
        !integer(scope.passengerCount) || scope.passengerCount < 1 || scope.airport !== false ||
        scope.crossBoundary !== false || !integer(scope.expiresAt) || scope.expiresAt <= before) fail('OUTSIDE_LAUNCH_SCOPE');
      const request = Object.freeze({nonce: randomBytes(24).toString('base64url'), tripId: trip.id, driverId,
        vehicleId, routeRef: trip.routeRef});
      let signedDriver, signedVehicle;
      try { [signedDriver, signedVehicle] = await Promise.all([resolveDriver(request), resolveVehicle(request)]); }
      catch { throw new AuthError('REGISTRY_AUTHORITY_UNAVAILABLE', 503); }
      let now = clock();
      if (!integer(now) || now < before) throw new AuthError('ELIGIBILITY_AUTHORITY_UNAVAILABLE', 503);
      const driver = driverProof(signedDriver, now), vehicle = vehicleProof(signedVehicle, now);
      bind(driver, request, driverId); bind(vehicle, request, vehicleId);
      if (!id(driver.accountId) || !id(driver.recordRef) || !integer(driver.revision) ||
        driver.active !== true || driver.suspended !== false) fail('DRIVER_INELIGIBLE');
      if (!id(vehicle.recordRef) || !integer(vehicle.revision) || vehicle.active !== true || vehicle.suspended !== false ||
        vehicle.authorizedDriverId !== driverId || !integer(vehicle.capacity) || vehicle.capacity < scope.passengerCount) fail('VEHICLE_INELIGIBLE');
      const transportRequest = Object.freeze({...request, ...VANCOUVER_SCOPE, routeScopeRef: scope.scopeRef,
        routeScopeRevision: scope.revision, driverRecordRef: driver.recordRef, driverRevision: driver.revision,
        vehicleRecordRef: vehicle.recordRef, vehicleRevision: vehicle.revision, driverAccountId: driver.accountId});
      let signedTransport;
      try { signedTransport = await resolveTransport(transportRequest); }
      catch { throw new AuthError('TRANSPORT_AUTHORITY_UNAVAILABLE', 503); }
      now = clock();
      if (!integer(now) || now < before) throw new AuthError('ELIGIBILITY_AUTHORITY_UNAVAILABLE', 503);
      // A slow second lookup cannot extend earlier projections or route-scope validity.
      driverProof(signedDriver, now); vehicleProof(signedVehicle, now);
      const eligibility = transportProof(signedTransport, now);
      bind(eligibility, request, driverId);
      for (const [field, value] of Object.entries(transportRequest)) if (eligibility[field] !== value) fail('ELIGIBILITY_BINDING_MISMATCH');
      if (eligibility.approved !== true || eligibility.revoked !== false || !id(eligibility.operatorRef) ||
        !integer(eligibility.validUntil) || eligibility.validUntil <= now || scope.expiresAt <= now) fail('TRANSPORT_INELIGIBLE');
      const expiresAt = Math.min(driver.exp, vehicle.exp, eligibility.exp, eligibility.validUntil, scope.expiresAt);
      return Object.freeze({
        driver: Object.freeze({id: driverId, accountId: driver.accountId, recordRef: driver.recordRef,
          revision: driver.revision, issuer: driver.iss, expiresAt: driver.exp}),
        vehicle: Object.freeze({id: vehicleId, authorizedDriverId: driverId, recordRef: vehicle.recordRef,
          revision: vehicle.revision, capacity: vehicle.capacity, issuer: vehicle.iss, expiresAt: vehicle.exp}),
        eligibility: Object.freeze({...VANCOUVER_SCOPE, operatorRef: eligibility.operatorRef,
          routeScopeRef: scope.scopeRef, routeScopeRevision: scope.revision, issuer: eligibility.iss, expiresAt}),
        admission: Object.freeze({tripId: trip.id, driverId, vehicleId, routeRef: trip.routeRef, allowed: true, expiresAt}),
      });
    },
  };
  return Object.freeze({project: adapter.project, admissionFor: async (trip, command, principal) => {
    const projection = await adapter.project(trip, command);
    if (principal?.role === 'driver' && (principal.subject !== projection.driver.id || principal.accountId !== projection.driver.accountId)) fail('DRIVER_ACCOUNT_MISMATCH');
    return projection.admission;
  }});
}
