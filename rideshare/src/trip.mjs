// Internal domain kernel only. A future authenticated service supplies principals,
// independently validated admission decisions and transactional persistence.
export class TripError extends Error {
  constructor(code) { super(code); this.name = 'TripError'; this.code = code; }
}
const fail = code => { throw new TripError(code); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const states = new Set(['REQUESTED', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const keys = (object, allowed) => {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(object)) ||
      Reflect.ownKeys(object).some(key => !allowed.includes(key) ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(object, key), 'value'))) fail('INVALID_INPUT');
};
const principal = actor => {
  keys(actor, ['subject', 'role']);
  if (!id(actor.subject) || !['rider', 'driver', 'dispatcher'].includes(actor.role)) fail('UNAUTHORIZED');
};
function validate(trip) {
  keys(trip, ['id', 'riderId', 'driverId', 'vehicleId', 'routeRef', 'state', 'revision']);
  if (![trip.id, trip.riderId, trip.routeRef].every(id) || !states.has(trip.state) ||
      !Number.isSafeInteger(trip.revision) || trip.revision < 0) fail('INVALID_TRIP');
  if ((trip.driverId === null) !== (trip.vehicleId === null) ||
      (trip.driverId !== null && (!id(trip.driverId) || !id(trip.vehicleId) || trip.driverId === trip.riderId)) ||
      (trip.state === 'REQUESTED' && trip.driverId !== null) ||
      (['ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(trip.state) && trip.driverId === null)) fail('INVALID_TRIP');
}
export function createTrip(input, actor) {
  principal(actor);
  keys(input, ['id', 'routeRef']);
  if (actor.role !== 'rider') fail('UNAUTHORIZED');
  if (![input.id, input.routeRef].every(id)) fail('INVALID_INPUT');
  return Object.freeze({ id: input.id, riderId: actor.subject, driverId: null,
    vehicleId: null, routeRef: input.routeRef, state: 'REQUESTED', revision: 0 });
}
function admitted(admission, trip, driverId, vehicleId, now) {
  keys(admission, ['tripId', 'driverId', 'vehicleId', 'routeRef', 'expiresAt', 'allowed']);
  // This is a validated internal projection, never a client-supplied approval.
  if (admission.allowed !== true || admission.tripId !== trip.id ||
      admission.routeRef !== trip.routeRef || admission.driverId !== driverId ||
      admission.vehicleId !== vehicleId || !Number.isSafeInteger(admission.expiresAt) ||
      admission.expiresAt <= now) fail('ADMISSION_REQUIRED');
}
export function transitionTrip(trip, command, actor, context = {}) {
  validate(trip); principal(actor);
  keys(command, ['action', 'expectedRevision', 'driverId', 'vehicleId']);
  keys(context, ['now', 'paused', 'admission', 'assignmentExpiresAt']);
  if (!Number.isSafeInteger(context.now) || context.now < 0 || typeof context.paused !== 'boolean') fail('INVALID_CONTEXT');
  if (command.expectedRevision !== trip.revision) fail('STALE_REVISION');
  if (trip.revision === Number.MAX_SAFE_INTEGER) fail('REVISION_EXHAUSTED');
  if (['COMPLETED', 'CANCELLED'].includes(trip.state)) fail('TERMINAL_TRIP');
  if (command.action !== 'assign' && ('driverId' in command || 'vehicleId' in command)) fail('INVALID_INPUT');
  let state;
  let driverId = trip.driverId;
  let vehicleId = trip.vehicleId;
  const assignedDriver = actor.role === 'driver' && actor.subject === driverId;
  if (command.action === 'assign') {
    if (actor.role !== 'dispatcher') fail('UNAUTHORIZED');
    if (trip.state !== 'REQUESTED') fail('INVALID_TRANSITION');
    if (context.paused) fail('SERVICE_PAUSED');
    if (![command.driverId, command.vehicleId].every(id) || command.driverId === trip.riderId) fail('INVALID_INPUT');
    admitted(context.admission, trip, command.driverId, command.vehicleId, context.now);
    driverId = command.driverId; vehicleId = command.vehicleId; state = 'ASSIGNED';
  } else if (command.action === 'arrive' || command.action === 'start') {
    if (!assignedDriver) fail('UNAUTHORIZED');
    if (trip.state !== (command.action === 'arrive' ? 'ASSIGNED' : 'ARRIVED')) fail('INVALID_TRANSITION');
    if (context.paused) fail('SERVICE_PAUSED');
    admitted(context.admission, trip, driverId, vehicleId, context.now);
    state = command.action === 'arrive' ? 'ARRIVED' : 'IN_PROGRESS';
  } else if (command.action === 'complete') {
    if (!assignedDriver) fail('UNAUTHORIZED');
    if (trip.state !== 'IN_PROGRESS') fail('INVALID_TRANSITION');
    state = 'COMPLETED'; // Completion records a trip outcome; never captures funds.
  } else if (command.action === 'expire') {
    if (actor.role !== 'dispatcher') fail('UNAUTHORIZED');
    if (trip.state !== 'ASSIGNED' || !Number.isSafeInteger(context.assignmentExpiresAt) || context.assignmentExpiresAt < 0 || context.assignmentExpiresAt > context.now) fail('ASSIGNMENT_NOT_EXPIRED');
    state = 'CANCELLED';
  } else if (command.action === 'cancel') {
    if (!(actor.role === 'rider' && actor.subject === trip.riderId) && !assignedDriver) fail('UNAUTHORIZED');
    if (trip.state === 'IN_PROGRESS') fail('ACTIVE_TRIP_REQUIRES_SAFETY_RESOLUTION');
    state = 'CANCELLED'; // Pre-trip exit remains available during a pause/revocation.
  } else fail('INVALID_TRANSITION');
  return Object.freeze({ ...trip, driverId, vehicleId, state, revision: trip.revision + 1 });
}
export function participantView(trip, actor) {
  validate(trip); principal(actor);
  if (!(actor.role === 'rider' && actor.subject === trip.riderId) &&
      !(actor.role === 'driver' && actor.subject === trip.driverId)) fail('UNAUTHORIZED');
  return Object.freeze({ ...trip });
}
export function publicView(trip) {
  validate(trip);
  // No trip ID, participant IDs, route reference, vehicle or coordinates in discovery.
  return Object.freeze({ application: 'LIFTd', liveBookingAvailable: false });
}
