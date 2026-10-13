import {AuthError, record} from './auth.mjs';
import {createTrip, transitionTrip, participantView} from './trip.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// Protected application boundary. Store must be server-owned; durable CAS is L01.4.
export function createTripService({authenticator, store, clock = () => Math.floor(Date.now() / 1000),
  isPaused = () => true, admissionFor = async () => undefined, eligibilityAdapter}) {
  if (!authenticator || typeof authenticator.authorize !== 'function' || !store ||
    ['create', 'get', 'compareAndSwap'].some(method => typeof store[method] !== 'function')) throw new AuthError('SERVICE_UNAVAILABLE', 503);
  if (eligibilityAdapter !== undefined && typeof eligibilityAdapter?.admissionFor !== 'function') throw new AuthError('SERVICE_UNAVAILABLE', 503);
  const resolveAdmission = eligibilityAdapter?.admissionFor ?? admissionFor;
  const current = principal => {
    const now = clock();
    if (!Number.isSafeInteger(now) || now < 0 || now >= principal.expiresAt) throw new AuthError('AUTHORIZATION_EXPIRED');
    return now;
  };
  const actor = principal => ({subject: principal.subject, role: principal.role === 'operator' ? 'dispatcher' : principal.role});
  return Object.freeze({
    async create(token, input) {
      record(input, ['id', 'routeRef', 'riderId']);
      if (!id(input.riderId)) throw new AuthError('INVALID_REQUEST', 400);
      const principal = await authenticator.authorize(token, {action: 'trip.create', resource: `account:${input.riderId}`});
      const trip = createTrip({id: input.id, routeRef: input.routeRef}, actor(principal));
      current(principal);
      await store.create(trip); return trip;
    },
    async read(token, tripId) {
      if (!id(tripId)) throw new AuthError('INVALID_REQUEST', 400);
      const principal = await authenticator.authorize(token, {action: 'trip.read', resource: `trip:${tripId}`});
      const trip = await store.get(tripId);
      if (!trip) throw new AuthError('TRIP_UNAVAILABLE', 404);
      current(principal);
      return participantView(trip, actor(principal));
    },
    async transition(token, tripId, command) {
      if (!id(tripId)) throw new AuthError('INVALID_REQUEST', 400);
      record(command, ['action', 'expectedRevision', 'driverId', 'vehicleId']);
      if (!['assign', 'arrive', 'start', 'complete', 'cancel'].includes(command.action)) throw new AuthError('INVALID_REQUEST', 400);
      const principal = await authenticator.authorize(token, {action: `trip.${command.action}`, resource: `trip:${tripId}`});
      const trip = await store.get(tripId);
      if (!trip) throw new AuthError('TRIP_UNAVAILABLE', 404);
      const admission = ['assign', 'arrive', 'start'].includes(command.action) ? await resolveAdmission(trip, command, principal) : undefined;
      const now = current(principal);
      const next = transitionTrip(trip, command, actor(principal), {now, paused: isPaused(), admission});
      await store.compareAndSwap(trip.id, trip.revision, next);
      return principal.role === 'operator' ? Object.freeze({id: next.id, state: next.state, revision: next.revision}) : participantView(next, actor(principal));
    },
  });
}
