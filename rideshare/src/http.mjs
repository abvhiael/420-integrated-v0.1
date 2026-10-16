import {AuthError} from './auth.mjs';
// Fetch-compatible protected handler; deployment/listeners are not enabled here.
export function createHttpHandler(service, locationService, dispatchAdapter, quoteService, paymentService, safetyService, riderPreferencesService, onboardingService, onboardingReviewService, driverOfferService, communicationService, operatorConsoleService, travelHandoffService, supportCaseService) {
  return async request => {
    const reply = (status, value) => new Response(JSON.stringify(value), {status,
      headers: {'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
    try {
      const url = new URL(request.url);
      if (url.search || url.hash) throw new AuthError('INVALID_REQUEST', 400);
      const offerRead=new RegExp('^/v1/rideshare/drivers/([A-Za-z0-9_-]{1,128})/offers' + String.fromCharCode(36)).exec(url.pathname);
      const offerRespond=new RegExp('^/v1/rideshare/drivers/([A-Za-z0-9_-]{1,128})/offers/([A-Za-z0-9_-]{1,128})/response' + String.fromCharCode(36)).exec(url.pathname);
      const availabilityRead=new RegExp('^/v1/rideshare/drivers/([A-Za-z0-9_-]{1,128})/availability' + String.fromCharCode(36)).exec(url.pathname);
      const onboardingReview = /^\/v1\/rideshare\/drivers\/([A-Za-z0-9_-]{1,128})\/onboarding\/review$/.exec(url.pathname);
      const onboarding = /^\/v1\/rideshare\/drivers\/([A-Za-z0-9_-]{1,128})\/onboarding$/.exec(url.pathname);
      const preferences = new RegExp('^/v1/rideshare/riders/([A-Za-z0-9_-]{1,128})/preferences' + String.fromCharCode(36)).exec(url.pathname);
      const travelHandoff=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/travel-handoff(?:\/([A-Za-z0-9_-]{1,128}))?$/.exec(url.pathname);
      const operator=/^\/v1\/rideshare\/operator\/trips\/([A-Za-z0-9_-]{1,128})(?:\/(incidents|resolve))?$/.exec(url.pathname);
      const messages=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/messages$/.exec(url.pathname);
      const support=new RegExp('^/v1/rideshare/support/cases/([A-Za-z0-9_-]{1,128})(?:/(evidence|escalate|decide|appeal|close))?' + String.fromCharCode(36)).exec(url.pathname);
      const safety=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/safety(?:\/(report|resolve|case))?$/.exec(url.pathname);
      const payment=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/payments(?:\/(prepare|consent|reconcile|plan|reserve|operation))?$/.exec(url.pathname);
      const statement=/^\/v1\/rideshare\/drivers\/([A-Za-z0-9_-]{1,128})\/statements\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
      const quoteRead=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
      const quoteIssue=url.pathname==='/v1/rideshare/quotes';
      const quoteConsent=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})\/consent$/.exec(url.pathname);
      const availability = url.pathname === '/v1/rideshare/availability';
      const locationPrepare = url.pathname === '/v1/rideshare/routes';
      const locationRead = /^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/coordinates$/.exec(url.pathname);
      const match = /^\/v1\/rideshare\/trips(?:\/([A-Za-z0-9_-]{1,128})(\/transitions)?)?$/.exec(url.pathname);
      if (!match && !locationPrepare && !locationRead && !availability && !quoteIssue && !quoteConsent && !quoteRead && !payment && !statement && !safety && !preferences && !onboarding && !onboardingReview && !offerRead && !offerRespond && !availabilityRead && !messages && !operator && !travelHandoff && !support) return reply(404, {error: 'NOT_FOUND'});
      if ((locationPrepare || locationRead) && !locationService) return reply(503, {error: 'LOCATION_UNAVAILABLE'});
      if (availability && !dispatchAdapter) return reply(503,{error:'DISPATCH_UNAVAILABLE'});
      if((quoteIssue||quoteConsent||quoteRead)&&!quoteService) return reply(503,{error:'QUOTE_UNAVAILABLE'});
      if(travelHandoff&&!travelHandoffService)return reply(503,{error:'HANDOFF_UNAVAILABLE'});
      if(support&&!supportCaseService)return reply(503,{error:'SUPPORT_UNAVAILABLE'});
      if(operator&&!operatorConsoleService)return reply(503,{error:'OPERATOR_UNAVAILABLE'});
      if(messages&&!communicationService)return reply(503,{error:'MESSAGING_UNAVAILABLE'});
      if(safety&&!safetyService)return reply(503,{error:'SAFETY_UNAVAILABLE'});
      if((offerRead||offerRespond||availabilityRead)&&!driverOfferService)return reply(503,{error:'OFFERS_UNAVAILABLE'});
      if(onboardingReview&&!onboardingReviewService)return reply(503,{error:'ONBOARDING_REVIEW_UNAVAILABLE'});
      if(onboarding&&!onboardingService)return reply(503,{error:'ONBOARDING_UNAVAILABLE'});
      if(preferences&&!riderPreferencesService)return reply(503,{error:'PREFERENCES_UNAVAILABLE'});
      if((payment||statement)&&!paymentService)return reply(503,{error:'PAY_UNAVAILABLE'});
      const authorization = request.headers.get('authorization');
      if (typeof authorization !== 'string' || authorization.length > 32775 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw new AuthError('BEARER_REQUIRED');
      const token = authorization.slice(7);
      if(support&&request.method==='GET'&&!support[2])return reply(200,await supportCaseService.read(token,support[1]));
      if(support&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(travelHandoff&&request.method==='GET'&&travelHandoff[2])return reply(200,await travelHandoffService.verify(token,travelHandoff[1],travelHandoff[2]));
      if(travelHandoff&&(request.method!=='POST'||travelHandoff[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(operator&&request.method==='GET'&&operator[2]!=='resolve')return reply(200,await (operator[2]==='incidents'?operatorConsoleService.incidents(token,operator[1]):operatorConsoleService.snapshot(token,operator[1])));
      if(operator&&(request.method!=='POST'||operator[2]!=='resolve'))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(messages&&request.method==='GET')return reply(200,await communicationService.read(token,messages[1]));
      if(messages&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(availabilityRead&&request.method==='GET')return reply(200,await driverOfferService.readAvailability(token,availabilityRead[1]));
      if(offerRead&&request.method==='GET')return reply(200,await driverOfferService.readOffers(token,offerRead[1]));
      if((offerRead||availabilityRead)&&request.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(offerRespond&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(onboardingReview&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(onboarding&&request.method==='GET')return reply(200,await onboardingService.read(token,onboarding[1]));
      if(onboarding&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(preferences&&request.method==='GET')return reply(200,await riderPreferencesService.read(token,preferences[1]));
      if(preferences&&request.method==='DELETE')return reply(200,await riderPreferencesService.erase(token,preferences[1]));
      if(preferences&&!['PUT'].includes(request.method))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(safety&&request.method==='GET'&&(safety[2]==='case'))return reply(200,await safetyService.read(token,safety[1]));
      if(payment&&request.method==='GET'&&!payment[2])return reply(200,await paymentService.read(token,payment[1]));
      if(statement&&request.method==='GET')return reply(200,await paymentService.statement(token,statement[1],statement[2]));
      if(statement||(payment&&!payment[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(quoteRead && request.method==='GET') return reply(200,await quoteService.get(token,quoteRead[1]));
      if(quoteRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if (locationRead && request.method === 'GET') return reply(200, await locationService.coordinates(token,locationRead[1]));
      if (locationRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if (request.method === 'GET' && match?.[1] && !match[2]) return reply(200, await service.read(token, match[1]));
      if ((!preferences && request.method !== 'POST') || (match?.[1] && !match?.[2])) return reply(405, {error: 'METHOD_NOT_ALLOWED'});
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
      if(support)return reply(support[2]?200:201,await supportCaseService[support[2]||'open'](token,support[1],body));
      if(travelHandoff)return reply(201,await travelHandoffService.prepare(token,travelHandoff[1],body));
      if(operator)return reply(200,await operatorConsoleService.resolve(token,operator[1],body));
      if(messages)return reply(200,await communicationService.send(token,messages[1],body));
      if(offerRespond)return reply(200,await driverOfferService.respondOffer(token,offerRespond[1],offerRespond[2],body));
      if(onboardingReview){if(body.driverId!==onboardingReview[1])throw new AuthError('REVIEW_SCOPE_DENIED',403);return reply(200,await onboardingReviewService.decide(token,body));}
      if(onboarding){if(body.driverId!==onboarding[1])throw new AuthError('ONBOARDING_SCOPE_DENIED',403);return reply(200,await onboardingService.submit(token,body));}
      if(preferences)return reply(200,await riderPreferencesService.update(token,preferences[1],body));
      if(safety){if(request.method!=='POST'||!['report','resolve'].includes(safety[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});return reply(200,await safetyService[safety[2]](token,safety[1],body));}
      if(payment){const method=payment[2]==='operation'?'reconcileOperation':payment[2];return reply(200,await paymentService[method](token,payment[1],body));}
      if(quoteIssue) return reply(201,await quoteService.issue(token,body));
      if(quoteConsent) return reply(200,await quoteService.accept(token,quoteConsent[1],body));
      if (availability) return reply(200,await dispatchAdapter.setAvailability(token,body));
      if (locationPrepare) return reply(201,await locationService.prepare(token,body));
      return match[2] ? reply(200, await service.transition(token, match[1], body)) : reply(201, await service.create(token, body));
    } catch (error) {
      if (error instanceof AuthError || error?.name==='PreferenceError') return reply(error.status, {error: error.code});
      if (error?.name === 'TripError') return reply(error.code === 'UNAUTHORIZED' ? 403 : 409, {error: error.code});
      return reply(503, {error: 'SERVICE_UNAVAILABLE'});
    }
  };
}
).exec(url.pathname);
      const safety=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/safety(?:\/(report|resolve|case))?$/.exec(url.pathname);
      const payment=/^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/payments(?:\/(prepare|consent|reconcile|plan|reserve|operation))?$/.exec(url.pathname);
      const statement=/^\/v1\/rideshare\/drivers\/([A-Za-z0-9_-]{1,128})\/statements\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
      const quoteRead=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
      const quoteIssue=url.pathname==='/v1/rideshare/quotes';
      const quoteConsent=/^\/v1\/rideshare\/quotes\/([A-Za-z0-9_-]{1,128})\/consent$/.exec(url.pathname);
      const availability = url.pathname === '/v1/rideshare/availability';
      const locationPrepare = url.pathname === '/v1/rideshare/routes';
      const locationRead = /^\/v1\/rideshare\/trips\/([A-Za-z0-9_-]{1,128})\/coordinates$/.exec(url.pathname);
      const match = /^\/v1\/rideshare\/trips(?:\/([A-Za-z0-9_-]{1,128})(\/transitions)?)?$/.exec(url.pathname);
      if (!match && !locationPrepare && !locationRead && !availability && !quoteIssue && !quoteConsent && !quoteRead && !payment && !statement && !safety && !preferences && !onboarding && !onboardingReview && !offerRead && !offerRespond && !availabilityRead && !messages && !operator && !travelHandoff && !support) return reply(404, {error: 'NOT_FOUND'});
      if ((locationPrepare || locationRead) && !locationService) return reply(503, {error: 'LOCATION_UNAVAILABLE'});
      if (availability && !dispatchAdapter) return reply(503,{error:'DISPATCH_UNAVAILABLE'});
      if((quoteIssue||quoteConsent||quoteRead)&&!quoteService) return reply(503,{error:'QUOTE_UNAVAILABLE'});
      if(travelHandoff&&!travelHandoffService)return reply(503,{error:'HANDOFF_UNAVAILABLE'});
      if(support&&!supportCaseService)return reply(503,{error:'SUPPORT_UNAVAILABLE'});
      if(operator&&!operatorConsoleService)return reply(503,{error:'OPERATOR_UNAVAILABLE'});
      if(messages&&!communicationService)return reply(503,{error:'MESSAGING_UNAVAILABLE'});
      if(safety&&!safetyService)return reply(503,{error:'SAFETY_UNAVAILABLE'});
      if((offerRead||offerRespond||availabilityRead)&&!driverOfferService)return reply(503,{error:'OFFERS_UNAVAILABLE'});
      if(onboardingReview&&!onboardingReviewService)return reply(503,{error:'ONBOARDING_REVIEW_UNAVAILABLE'});
      if(onboarding&&!onboardingService)return reply(503,{error:'ONBOARDING_UNAVAILABLE'});
      if(preferences&&!riderPreferencesService)return reply(503,{error:'PREFERENCES_UNAVAILABLE'});
      if((payment||statement)&&!paymentService)return reply(503,{error:'PAY_UNAVAILABLE'});
      const authorization = request.headers.get('authorization');
      if (typeof authorization !== 'string' || authorization.length > 32775 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) throw new AuthError('BEARER_REQUIRED');
      const token = authorization.slice(7);
      if(support&&request.method==='GET'&&!support[2])return reply(200,await supportCaseService.read(token,support[1]));
      if(support&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(travelHandoff&&request.method==='GET'&&travelHandoff[2])return reply(200,await travelHandoffService.verify(token,travelHandoff[1],travelHandoff[2]));
      if(travelHandoff&&(request.method!=='POST'||travelHandoff[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(operator&&request.method==='GET'&&operator[2]!=='resolve')return reply(200,await (operator[2]==='incidents'?operatorConsoleService.incidents(token,operator[1]):operatorConsoleService.snapshot(token,operator[1])));
      if(operator&&(request.method!=='POST'||operator[2]!=='resolve'))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(messages&&request.method==='GET')return reply(200,await communicationService.read(token,messages[1]));
      if(messages&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(availabilityRead&&request.method==='GET')return reply(200,await driverOfferService.readAvailability(token,availabilityRead[1]));
      if(offerRead&&request.method==='GET')return reply(200,await driverOfferService.readOffers(token,offerRead[1]));
      if((offerRead||availabilityRead)&&request.method!=='GET')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(offerRespond&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(onboardingReview&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(onboarding&&request.method==='GET')return reply(200,await onboardingService.read(token,onboarding[1]));
      if(onboarding&&request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(preferences&&request.method==='GET')return reply(200,await riderPreferencesService.read(token,preferences[1]));
      if(preferences&&request.method==='DELETE')return reply(200,await riderPreferencesService.erase(token,preferences[1]));
      if(preferences&&!['PUT'].includes(request.method))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(safety&&request.method==='GET'&&(safety[2]==='case'))return reply(200,await safetyService.read(token,safety[1]));
      if(payment&&request.method==='GET'&&!payment[2])return reply(200,await paymentService.read(token,payment[1]));
      if(statement&&request.method==='GET')return reply(200,await paymentService.statement(token,statement[1],statement[2]));
      if(statement||(payment&&!payment[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if(quoteRead && request.method==='GET') return reply(200,await quoteService.get(token,quoteRead[1]));
      if(quoteRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if (locationRead && request.method === 'GET') return reply(200, await locationService.coordinates(token,locationRead[1]));
      if (locationRead) return reply(405,{error:'METHOD_NOT_ALLOWED'});
      if (request.method === 'GET' && match?.[1] && !match[2]) return reply(200, await service.read(token, match[1]));
      if ((!preferences && request.method !== 'POST') || (match?.[1] && !match?.[2])) return reply(405, {error: 'METHOD_NOT_ALLOWED'});
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
      if(support)return reply(support[2]?200:201,await supportCaseService[support[2]||'open'](token,support[1],body));
      if(travelHandoff)return reply(201,await travelHandoffService.prepare(token,travelHandoff[1],body));
      if(operator)return reply(200,await operatorConsoleService.resolve(token,operator[1],body));
      if(messages)return reply(200,await communicationService.send(token,messages[1],body));
      if(offerRespond)return reply(200,await driverOfferService.respondOffer(token,offerRespond[1],offerRespond[2],body));
      if(onboardingReview){if(body.driverId!==onboardingReview[1])throw new AuthError('REVIEW_SCOPE_DENIED',403);return reply(200,await onboardingReviewService.decide(token,body));}
      if(onboarding){if(body.driverId!==onboarding[1])throw new AuthError('ONBOARDING_SCOPE_DENIED',403);return reply(200,await onboardingService.submit(token,body));}
      if(preferences)return reply(200,await riderPreferencesService.update(token,preferences[1],body));
      if(safety){if(request.method!=='POST'||!['report','resolve'].includes(safety[2]))return reply(405,{error:'METHOD_NOT_ALLOWED'});return reply(200,await safetyService[safety[2]](token,safety[1],body));}
      if(payment){const method=payment[2]==='operation'?'reconcileOperation':payment[2];return reply(200,await paymentService[method](token,payment[1],body));}
      if(quoteIssue) return reply(201,await quoteService.issue(token,body));
      if(quoteConsent) return reply(200,await quoteService.accept(token,quoteConsent[1],body));
      if (availability) return reply(200,await dispatchAdapter.setAvailability(token,body));
      if (locationPrepare) return reply(201,await locationService.prepare(token,body));
      return match[2] ? reply(200, await service.transition(token, match[1], body)) : reply(201, await service.create(token, body));
    } catch (error) {
      if (error instanceof AuthError || error?.name==='PreferenceError') return reply(error.status, {error: error.code});
      if (error?.name === 'TripError') return reply(error.code === 'UNAUTHORIZED' ? 403 : 409, {error: error.code});
      return reply(503, {error: 'SERVICE_UNAVAILABLE'});
    }
  };
}
