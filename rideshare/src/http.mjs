import {AuthError} from './auth.mjs';
// Fetch-compatible protected handler; deployment/listeners are not enabled here.
export function createHttpHandler(service, locationService, dispatchAdapter, quoteService) {
  return async request => {
    const reply = (status, value) => new Response(JSON.stringify(value), {status,
      headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
    try {
      const url = new URL(request.url);
      if (url.search || url.hash) throw new AuthError('INVALID_REQUEST', 400);
      const quoteRead=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
      const quoteIssue=url.pathname==='/v1/rideshare/quotes';
      const quoteConsent=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})\/consent$/.exec(url.pathname);
      const availability = url.pathname === '/v1/rideshare/availability';
      const locationPrepare = url.pathname === '/v1/rideshare/routes';
      const locationRead = /^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/coordinates$/.exec(url.pathname);
      const match = /^\/v1\/rideshare\/trips(?:\/([A-Za-z0-9_-]{1,128})(\/transitions)?)?$/.exec(url.pathname);
      if (!match && !locationPrepare && !locationRead && !availability && !quoteIssue && !quoteConsent && !quoteRead) return reply(404, {error: 'NOT_FOUND'});
      if ((locationPrepare || locationRead) && !locationService) return reply(503, {error: 'LOCATION_UNAVAILABLE'});
      if (availability && !dispatchAdapter) return reply(503,{error:'DISPATCH_UNAVAILABLE'});
      if((quoteIssue||quoteConsent||quoteRead)&&!quoteService) return reply(503,{error:'QUOTE_UNAVAILABLE'});
      const authorization = request.headers.get('authorization');
      if (typeof authorization !== 'string' || authorization.length > 32775 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw new AuthError('BEARER_REQUIRED');
      const token = authorization.slice(7);
      if(quoteRead && request.method==='GET') return reply(200,await quoteService.get(token,quoteRead[1]));
      if(quoteRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
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
        body.commandId = commandId;
      }
      if(quoteIssue) return reply(201,await quoteService.issue(token,body));
      if(quoteConsent) return reply(200,await quoteService.accept(token,quoteConsent[1],body));
      if (availability) return reply(200,await dispatchAdapter.setAvailability(token,body));
      if (locationPrepare) return reply(201,await locationService.prepare(token,body));
      return match[2] ? reply(200, await service.transition(token, match[1], body)) : reply(201, await service.create(token, body));
    } catch (error) {
      if (error instanceof AuthError) return reply(error.status, {error: error.code});
      if (error?.name === 'TripError') return reply(error.code === 'UNAUTHORIZED' ? 403 : 409, {error: error.code});
      return reply(503, {error: 'SERVICE_UNAVAILABLE'});
    }
  };
}
