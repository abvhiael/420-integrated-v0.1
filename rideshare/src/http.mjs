import {AuthError} from './auth.mjs';
// Fetch-compatible protected handler; deployment/listeners are not enabled here.
export function createHttpHandler(service, locationService) {
  return async request => {
    const reply = (status, value) => new Response(JSON.stringify(value), {status,
      headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
    try {
      const url = new URL(request.url);
      if (url.search || url.hash) throw new AuthError('INVALID_REQUEST', 400);
      const locationPrepare = url.pathname === '/v1/rideshare/routes';
      const locationRead = /^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/coordinates$/.exec(url.pathname);
      const match = /^\/v1\/rideshare\/trips(?:\/([A-Za-z0-9_-]{1,128})(\/transitions)?)?$/.exec(url.pathname);
      if (!match && !locationPrepare && !locationRead) return reply(404, {error: 'NOT_FOUND'});
      if ((locationPrepare || locationRead) && !locationService) return reply(503, {error: 'LOCATION_UNAVAILABLE'});
      const authorization = request.headers.get('authorization');
      if (typeof authorization !== 'string' || authorization.length > 32775 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw new AuthError('BEARER_REQUIRED');
      const token = authorization.slice(7);
      if (locationRead && request.method === 'GET') return reply(200, await locationService.coordinates(token,locationRead[1]));
      if (locationRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if (request.method === 'GET' && match?.[1] && !match[2]) return reply(200, await service.read(token, match[1]));
      if (request.method !== 'POST' || (match?.[1] && !match?.[2])) return reply(405, {error: 'METHOD_NOT_ALLOWED'});
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) throw new AuthError('INVALID_REQUEST', 400);
      const reader = request.body.getReader(); const chunks = []; let size = 0;
      try {
        while (true) {
          const {value, done} = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 8192) throw new AuthError('REQUEST_TOO_LARGE', 413);
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks))); }
      catch { throw new AuthError('INVALID_REQUEST', 400); }
      const commandId = request.headers.get('idempotency-key');
      if (commandId !== null) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(commandId) || !body || typeof body !== 'object' || Array.isArray(body) ||
          (body.commandId !== undefined && body.commandId !== commandId)) throw new AuthError('INVALID_REQUEST', 400);
        body.…823 tokens truncated…of.pointsDigest!==pointsDigest) fail('LOCATION_BINDING_MISMATCH');
    if(proof.available!==true||proof.ambiguous!==false||!id(proof.provider)||!id(proof.provenanceRef)||!integer(proof.revision)||
      !integer(proof.distanceMeters)||!integer(proof.durationSeconds)||proof.distanceMeters>100000000||proof.durationSeconds>604800||
      Object.entries(VANCOUVER_SCOPE).some(([field,value])=>proof[field]!==value)||proof.airport!==false||proof.crossBoundary!==false) fail('INVALID_ROUTE');
    return Object.freeze({descriptor:Object.freeze({routeRef,...VANCOUVER_SCOPE,precision:'municipality',distanceMeters:proof.distanceMeters,
      durationSeconds:proof.durationSeconds,provider:proof.provider,provenanceRef:proof.provenanceRef}),
      scope:Object.freeze({routeRef,scopeRef:proof.provenanceRef,revision:proof.revision,...VANCOUVER_SCOPE,passengerCount:payload.passengerCount,
        expiresAt:proof.exp,airport:false,crossBoundary:false})});
  }});
}
export function createPrivateLocationStore(pool,{keys,activeKey,retentionSeconds,clock=()=>Math.floor(Date.now()/1000)}) {
  if(!keys||!id(activeKey)||!integer(retentionSeconds)||retentionSeconds<1||retentionSeconds>2592000) fail('PRIVACY_CONFIGURATION_REQUIRED',503);
  const pinned=new Map(Object.entries(keys).map(([key,value])=>[key,Buffer.from(value)]));
  if(!pinned.has(activeKey)||[...pinned].some(([key,value])=>!id(key)||value.length!==32)) fail('PRIVACY_CONFIGURATION_REQUIRED',503);
  const aad=row=>Buffer.from(canonical({routeRef:row.route_ref,riderId:row.rider_id,accountId:row.account_id,expiresAt:Number(row.expires_at)}));
  const alive=row=>{const now=clock();if(!integer(now)||!row||row.tombstoned||!row.sealed||Number(row.expires_at)<=now) fail('LOCATION_EXPIRED');};
  function decrypt(row) {
    alive(row);
    try {
      const key=pinned.get(row.sealed.keyId);if(!key) throw Error('missing key');
      const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(row.sealed.iv,'base64url'));
      decipher.setAAD(aad(row));decipher.setAuthTag(Buffer.from(row.sealed.tag,'base64url'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(row.sealed.ciphertext,'base64url')),decipher.final()]).toString('utf8'));
    } catch {fail('PRIVATE_LOCATION_UNAVAILABLE',503);}
  }
  async function rowFor(routeRef,client=pool,lock=false) {
    if(!id(routeRef)) fail('INVALID_LOCATION',400);
    return (await client.query(`SELECT * FROM liftd.private_locations WHERE route_ref=$1${lock?' FOR UPDATE':''}`,[routeRef])).rows[0];
  }
  return Object.freeze({
    async save(principal,commandId,payload,descriptor,guard) {
      let client;
      try {
        client=await pool.connect();await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='3s'");
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`liftd:location:${principal.subject}:${commandId}`]);
        await guard();
        const prior=(await client.query('SELECT * FROM liftd.private_locations WHERE rider_id=$1 AND command_id=$2 FOR UPDATE',[principal.subject,commandId])).rows[0];
        if(prior) {
          if(prior.account_id!==principal.accountId||canonical(decrypt(prior))!==canonical(payload)) fail('IDEMPOTENCY_CONFLICT',409);
          await client.query('COMMIT');return Object.freeze({...prior.descriptor,expiresAt:Number(prior.expires_at)});
        }
        const now=clock();if(!integer(now)) fail('PRIVACY_CONFIGURATION_REQUIRED',503);
        const row={route_ref:descriptor.routeRef,rider_id:principal.subject,account_id:principal.accountId,expires_at:now+retentionSeconds};
        const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',pinned.get(activeKey),iv);cipher.setAAD(aad(row));
        const ciphertext=Buffer.concat([cipher.update(canonical(payload),'utf8'),cipher.final()]);
        const sealed={keyId:activeKey,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:ciphertext.toString('base64url')};
        await guard();
        await client.query('INSERT INTO liftd.private_locations(route_ref,rider_id,account_id,command_id,expires_at,sealed,descriptor) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [row.route_ref,row.rider_id,row.account_id,commandId,row.expires_at,sealed,descriptor]);
        await client.query('COMMIT');return Object.freeze({...descriptor,expiresAt:row.expires_at});
      } catch(error) {if(client){try{await client.query('ROLLBACK');}catch{}}if(error instanceof AuthError)throw error;fail('PRIVATE_LOCATION_UNAVAILABLE',503);}
      finally{client?.release();}
    },
    async bind(client,trip,principal) {
      const row=await rowFor(trip.routeRef,client,true);alive(row);
      if(row.rider_id!==principal.subject||row.account_id!==principal.accountId||(row.trip_id&&row.trip_id!==trip.id)) fail('LOCATION_SCOPE_DENIED');
      await client.query('UPDATE liftd.private_locations SET trip_id=$1 WHERE route_ref=$2',[trip.id,trip.routeRef]);
    },
    async owned(routeRef,principal,trip) {
      const row=await rowFor(routeRef);alive(row);
      const rider=principal.role==='rider'&&principal.subject===row.rider_id&&principal.accountId===row.account_id;
      const driver=principal.role==='driver'&&trip&&trip.id===row.trip_id&&trip.routeRef===routeRef&&trip.driverId===principal.subject&&
        ['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state);
      if(!rider&&!driver) fail('LOCATION_SCOPE_DENIED');
      return Object.freeze({payload:decrypt(row),riderId:row.rider_id,descriptor:row.descriptor,expiresAt:Number(row.expires_at)});
    },
    async forRouting(routeRef) {
      const row=await rowFor(routeRef);alive(row);
      return Object.freeze({payload:decrypt(row),riderId:row.rider_id});
    },
    async purgeExpired() {
      const now=clock();if(!integer(now))fail('PRIVACY_CONFIGURATION_REQUIRED',503);
      return (await pool.query('UPDATE liftd.private_locations SET sealed=NULL,tombstoned=true WHERE NOT tombstoned AND expires_at<=$1',[now])).rowCount;
    },
  });
}
export function createLocationService({authenticator,tripStore,privateStore,routingAdapter,clock=()=>Math.floor(Date.now()/1000)}) {
  const current=p=>{const now=clock();if(!integer(now)||now>=p.expiresAt)fail('AUTHORIZATION_EXPIRED',401);};
  return Object.freeze({
    async prepare(token,input) {
      const payload=locationPayload(input);
      const permission={action:'route.prepare',resource:`account:${input.riderId}`};
      const principal=await authenticator.authorize(token,permission);current(principal);
      if(principal.subject!==input.riderId||principal.role!=='rider')fail('LOCATION_SCOPE_DENIED');
      const routeRef=randomBytes(24).toString('base64url');
      const result=await routingAdapter.resolve(routeRef,principal.subject,payload);
      const guard=async()=>{const fresh=await authenticator.authorize(token,permission);current(fresh);
        if(fresh.subject!==principal.subject||fresh.accountId!==principal.accountId||fresh.role!=='rider')fail('LOCATION_SCOPE_DENIED');};
      return privateStore.save(principal,input.commandId,payload,result.descriptor,guard);
    },
    async coordinates(token,tripId) {
      const principal=await authenticator.authorize(token,{action:'trip.read',resource:`trip:${tripId}`});current(principal);
      const trip=await tripStore.get(tripId);if(!trip)fail('LOCATION_SCOPE_DENIED');
      if(principal.role==='rider'&&trip.riderId!==principal.subject)fail('LOCATION_SCOPE_DENIED');
      const result=await privateStore.owned(trip.routeRef,principal,trip);current(principal);
      if(clock()>=result.expiresAt)fail('LOCATION_EXPIRED');
      return Object.freeze({...result.payload,expiresAt:result.expiresAt});
    },
    async routeScopeFor(routeRef) {
      const stored=await privateStore.forRouting(routeRef);
      return (await routingAdapter.resolve(routeRef,stored.riderId,stored.payload)).scope;
    },
  });
}
