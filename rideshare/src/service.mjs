import {AuthError, record} from './auth.mjs';
import {createTrip, transitionTrip, participantView} from './trip.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
// Protected application boundary. Store must be server-owned; durable CAS is L01.4.
export function createTripService({authenticator, store, clock = () => Math.floor(Date.now() / 1000),
  isPaused = () => true, admissionFor = async () => undefined, eligibilityAdapter, privateLocationStore}) {
  if (!authenticator || typeof authenticator.authorize !== 'function' || !store ||
    (typeof store.get !== 'function' || (typeof store.execute !== 'function' && ['create', 'compareAndSwap'].some(method => typeof store[method] !== 'function')))) throw new AuthError('SERVICE_UNAVAILABLE', 503);
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
      record(input, ['id', 'routeRef', 'riderId', 'commandId']);
      if (!id(input.riderId)) throw new AuthError('INVALID_REQUEST', 400);
      const principal = await authenticator.authorize(token, {action: 'trip.create', resource: `account:${input.riderId}`});
      const trip = createTrip({id: input.id, routeRef: input.routeRef}, actor(principal));
      current(principal);
      if (store.execute) {
        const guard = async () => {
          const fresh = await authenticator.authorize(token, {action: 'trip.create', resource: `account:${input.riderId}`});
          if (fresh.subject !== principal.subject || fresh.accountId !== principal.accountId || fresh.role !== principal.role) throw new AuthError('SESSION_BINDING_MISMATCH');
          current(fresh);
        };
        return store.execute({actorId: principal.subject, commandId: input.commandId, tripId: trip.id, action: 'create',
          request: {id: input.id, routeRef: input.routeRef, riderId: input.riderId}, guard,
          afterWrite: privateLocationStore ? (client, next) => privateLocationStore.bind(client, next, principal) : undefined}, async () => trip);
      }
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
      record(command, ['action', 'expectedRevision', 'driverId', 'vehicleId', 'commandId']);
      if (!['assign', 'arrive', 'start', 'complete', 'cancel'].includes(command.action)) throw new AuthError('INVALID_REQUEST', 400);
      const principal = await authenticator.authorize(token, {action: `trip.${command.action}`, resource: `trip:${tripId}`});
      const {commandId, ...domainCommand} = command;
      let lastAdmission, lockedTrip;
      const produce = async trip => {
        if (!trip) throw new AuthError('TRIP_UNAVAILABLE', 404);
        lockedTrip = trip;
        lastAdmission = ['assign', 'arrive', 'start'].includes(command.action) ? await resolveAdmission(trip, domainCommand, principal) : undefined;
        const now = current(principal);
        return transitionTrip(trip, domainCommand, actor(principal), {now, paused: isPaused(), admission: lastAdmission});
      };
      let next;
      if (store.execute) {
        const guard = async () => {
          const fresh = await authenticator.authorize(token, {action: `trip.${command.action}`, resource: `trip:${tripId}`});
          if (fresh.subject !== principal.subject || fresh.accountId !== principal.accountId || fresh.role !== principal.role) throw new AuthError('SESSION_BINDING_MISMATCH');
          if (lastAdmission) lastAdmission = await resolveAdmission(lockedTrip, domainCommand, fresh);
          const now = current(fresh);
          if (lastAdmission && lastAdmission.expiresAt <= now) throw new AuthError('ADMISSION_REQUIRED', 403);
          if (['assign', 'arrive', 'start'].includes(command.action) && isPaused()) throw new AuthError('SERVICE_PAUSED', 409);
        };
        next = await store.execute({actorId: principal.subject, commandId, tripId, action: command.action, request: domainCommand, guard}, produce);
      } else {
        const trip = await store.get(tripId); next = await produce(trip);
        await store.compareAndSwap(trip.id, trip.revision, next);
      }
      return principal.role === 'operator' ? Object.freeze({id: next.id, state: next.state, revision: next.revision}) : participantView(next, actor(principal));
    },
  });
}
