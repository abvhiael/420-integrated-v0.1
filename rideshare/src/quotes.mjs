import {randomBytes} from 'node:crypto';
import {AuthError,record} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {checkSchema} from './schema.mjs';
import {quoteAmounts,quoteHash,CANCELLATION_POLICY} from './fare.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail=(code,status=409)=>{throw new AuthError(code,status);};
export function createQuoteService({pool,authenticator,locationService,privateStore,rulesAdapter,viabilityAdapter,quoteSeconds,clock=()=>Math.floor(Date.now()/1000),isPaused=()=>true}) {
  if(!pool||!authenticator||!locationService||!privateStore||!rulesAdapter||!viabilityAdapter||!Number.isSafeInteger(quoteSeconds)||quoteSeconds<1||quoteSeconds>300)fail('QUOTE_CONFIGURATION_REQUIRED',503);
  const time=()=>{const now=clock();if(!Number.isSafeInteger(now)||now<0||now>Number.MAX_SAFE_INTEGER-300)fail('CLOCK_UNAVAILABLE',503);return now;};
  const auth=async(token,action,rider,prior)=>{
    const p=await authenticator.authorize(token,{action,resource:`account:${rider}`});
    if(p.role!=='rider'||p.subject!==rider||(prior&&p.accountId!==prior.accountId)||time()>=p.expiresAt)fail('QUOTE_SCOPE_DENIED',403);return p;
  };
  const read=async(client,quoteId)=>{if(!id(quoteId))fail('INVALID_REQUEST',400);const row=(await client.query('SELECT * FROM liftd.fare_quotes WHERE quote_id=$1',[quoteId])).rows[0];
    if(!row)fail('QUOTE_UNAVAILABLE',404);if(quoteHash(row.payload)!==row.quote_hash)fail('QUOTE_CORRUPT',503);return {...row.payload,quoteHash:row.quote_hash};};
  async function transaction(principal,commandId,action,request,guard,produce) {
    if(!id(commandId))fail('INVALID_REQUEST',400);let client;
    try {
      client=await pool.connect();await client.query('BEGIN');await checkSchema(client);
      await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:quote-command:${principal.subject}:${commandId}`]);await guard();
      const prior=(await client.query('SELECT action,request,result FROM liftd.quote_commands WHERE rider_id=$1 AND command_id=$2',[principal.subject,commandId])).rows[0];
      const binding={...request,accountId:principal.accountId};
      if(prior){if(prior.action!==action||canonical(prior.request)!==canonical(binding))fail('IDEMPOTENCY_CONFLICT');await client.query('COMMIT');return prior.result;}
      const result=await produce(client);await guard();if(action==='issue'&&time()>=result.expiresAt)fail('QUOTE_EXPIRED');
      await client.query('INSERT INTO liftd.quote_commands(rider_id,command_id,action,request,quote_id,result) VALUES($1,$2,$3,$4,$5,$6)',[principal.subject,commandId,action,binding,result.quoteId,result]);
      await client.query('COMMIT');return Object.freeze(result);
    }catch(error){if(client){try{await client.query('ROLLBACK');}catch{}}if(error instanceof AuthError)throw error;fail('QUOTE_UNAVAILABLE',503);}
    finally{client?.release();}
  }
  const service={
    async issue(token,input) {
      record(input,['riderId','routeRef','commandId']);if(![input.riderId,input.routeRef,input.commandId].every(id))fail('INVALID_REQUEST',400);
      const principal=await auth(token,'quote.create',input.riderId);
      const guard=async()=>{await auth(token,'quote.create',input.riderId,principal);if(isPaused())fail('SERVICE_PAUSED');};
      return transaction(principal,input.commandId,'issue',{riderId:input.riderId,routeRef:input.routeRef},guard,async client=>{
        const owned=await privateStore.owned(input.routeRef,principal);
        const route=await locationService.quoteRouteFor(input.routeRef),rules=await rulesAdapter.resolve(principal.subject,route);await guard();
        const issuedAt=time(),expiresAt=Math.min(issuedAt+quoteSeconds,route.scope.expiresAt,rules.expiresAt,owned.expiresAt);
        if(expiresAt<=issuedAt)fail('QUOTE_EXPIRED');
        const payload={quoteId:randomBytes(24).toString('base64url'),riderId:principal.subject,accountId:principal.accountId,routeRef:input.routeRef,issuedAt,expiresAt,
          policyVersion:'v1',rounding:'component-half-up-cent',route:{distanceMeters:route.descriptor.distanceMeters,durationSeconds:route.descriptor.durationSeconds,provenanceRef:route.descriptor.provenanceRef,revision:route.scope.revision,passengerCount:route.scope.passengerCount},
          rules:{rulesRef:rules.rulesRef,revision:rules.revision},amounts:quoteAmounts(route.descriptor,rules),cancellationPolicy:CANCELLATION_POLICY};
        const digest=quoteHash(payload);await guard();if(time()>=expiresAt)fail('QUOTE_EXPIRED');
        await client.query('INSERT INTO liftd.fare_quotes(quote_id,rider_id,account_id,route_ref,issued_at,expires_at,quote_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [payload.quoteId,principal.subject,principal.accountId,input.routeRef,issuedAt,expiresAt,digest,payload]);return {...payload,quoteHash:digest};
      });
    },
    async get(token,quoteId) {
      await checkSchema(pool);const quote=await read(pool,quoteId);const p=await auth(token,'quote.read',quote.riderId);
      if(p.accountId!==quote.accountId)fail('QUOTE_SCOPE_DENIED',403);return Object.freeze(quote);
    },
    async accept(token,quoteId,input) {
      record(input,['riderId','commandId','quoteHash','currency','totalCents','accepted']);
      if(!id(input.riderId)||!id(input.commandId)||typeof input.quoteHash!=='string'||!/^[a-f0-9]{64}$/.test(input.quoteHash)||input.accepted!==true||input.currency!=='CAD'||!Number.isSafeInteger(input.totalCents)||input.totalCents<0)fail('EXPLICIT_CONSENT_REQUIRED',400);
      const principal=await auth(token,'quote.accept',input.riderId);let quote;
      const guard=async()=>{await auth(token,'quote.accept',input.riderId,principal);if(isPaused())fail('SERVICE_PAUSED');if(quote&&time()>=quote.expiresAt)fail('QUOTE_EXPIRED');};
      return transaction(principal,input.commandId,'accept',{quoteId,...input},guard,async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:quote:${quoteId}`]);
        quote=await read(client,quoteId);
        if(quote.riderId!==principal.subject||quote.accountId!==principal.accountId)fail('QUOTE_SCOPE_DENIED',403);
        if(quote.quoteHash!==input.quoteHash||quote.amounts.totalCents!==input.totalCents)fail('QUOTE_CONSENT_MISMATCH',403);
        const currentRoute=await locationService.quoteRouteFor(quote.routeRef),currentRules=await rulesAdapter.resolve(quote.riderId,currentRoute,quote.amounts.transportationCents);
        if(quote.amounts.transportationCents<currentRules.minimumFareCents||canonical(quote.amounts.taxes)!==canonical(currentRules.taxes)||canonical(quote.amounts.passThrough)!==canonical(currentRules.passThrough))fail('QUOTE_RULES_CHANGED',403);
        await guard();const existing=(await client.query('SELECT accepted_at FROM liftd.quote_consents WHERE quote_id=$1',[quoteId])).rows[0];
        const acceptedAt=existing?Number(existing.accepted_at):time();
        if(!existing)await client.query('INSERT INTO liftd.quote_consents(quote_id,rider_id,account_id,quote_hash,accepted_at) VALUES($1,$2,$3,$4,$5)',[quoteId,principal.subject,principal.accountId,quote.quoteHash,acceptedAt]);
        return {quoteId,quoteHash:quote.quoteHash,accepted:true,acceptedAt,currency:'CAD',totalCents:quote.amounts.totalCents};
      });
    },
    async bind(client,trip,principal,quoteId) {
      const quote=await read(client,quoteId);
      if(quote.riderId!==principal.subject||quote.accountId!==principal.accountId||quote.routeRef!==trip.routeRef)fail('QUOTE_SCOPE_DENIED',403);
      if(time()>=quote.expiresAt)fail('QUOTE_EXPIRED');
      const consent=(await client.query('SELECT * FROM liftd.quote_consents WHERE quote_id=$1',[quoteId])).rows[0];if(!consent)fail('EXPLICIT_CONSENT_REQUIRED',403);
      await client.query('INSERT INTO liftd.trip_quotes(trip_id,quote_id) VALUES($1,$2)',[trip.id,quoteId]);
    },
    async assignment(client,trip,command) {
      const row=(await client.query('SELECT quote_id FROM liftd.trip_quotes WHERE trip_id=$1',[trip.id])).rows[0];if(!row)fail('EXPLICIT_CONSENT_REQUIRED',403);
      const quote=await read(client,row.quote_id),route=await locationService.quoteRouteFor(trip.routeRef),rules=await rulesAdapter.resolve(trip.riderId,route,quote.amounts.transportationCents);
      if(quote.amounts.transportationCents<rules.minimumFareCents||canonical(quote.amounts.taxes)!==canonical(rules.taxes)||canonical(quote.amounts.passThrough)!==canonical(rules.passThrough))fail('QUOTE_RULES_CHANGED',403);
      return viabilityAdapter.approve(trip,command,{...quote,route:{...quote.route,distanceMeters:route.descriptor.distanceMeters,durationSeconds:route.descriptor.durationSeconds}},rules);
    },
    async apply(client,next,action,viability) {
      if(viability){if(viability.expiresAt<=time())fail('VIABILITY_EXPIRED',403);
        if(viability.fundingRef){
          const prior=(await client.query('SELECT trip_id FROM liftd.subsidy_bindings WHERE funding_ref=$1',[viability.fundingRef])).rows[0];
          if(prior&&prior.trip_id!==next.id)fail('FUNDING_REPLAY',403);
          if(!prior)await client.query('INSERT INTO liftd.subsidy_bindings(funding_ref,trip_id) VALUES($1,$2)',[viability.fundingRef,next.id]);
        }
        await client.query('INSERT INTO liftd.trip_viability(trip_id,revision,payload) VALUES($1,$2,$3)',[next.id,next.revision,viability]);}
      if(['cancel','expire'].includes(action)) {
        const row=(await client.query('SELECT quote_id FROM liftd.trip_quotes WHERE trip_id=$1',[next.id])).rows[0];if(!row)fail('EXPLICIT_CONSENT_REQUIRED',403);
        const quote=await read(client,row.quote_id);
        await client.query('INSERT INTO liftd.cancellation_assessments(trip_id,quote_id,revision,payload) VALUES($1,$2,$3,$4)',[next.id,row.quote_id,next.revision,{quoteHash:quote.quoteHash,policyVersion:quote.cancellationPolicy.version,action,riderFeeCents:action==='expire'?quote.cancellationPolicy.assignmentExpiryFeeCents:quote.cancellationPolicy.preTripRiderFeeCents,driverEarnedObligations:'preserved',settlementOwner:'L01.8'}]);
      }
    },
  };
  return Object.freeze(service);
}
