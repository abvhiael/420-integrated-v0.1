import { createServer } from 'node:http';
import { routePublicFeedHttp } from './publicFeedHttp.js';

const MAX_URL_LENGTH = 2048;
const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'access-control-allow-origin': 'https://bonggoggles.420integrated.org',
  vary: 'Origin',
});

function unavailable() {
  return { status: 503, body: { apiVersion: 'bg-social-read-v1', error: { code: 'unavailable' } } };
}

/**
 * Opt-in HTTP transport. This module deliberately DOES NOT start a listener,
 * connect an indexer, or certify an injected policy. The operator must qualify
 * the canonical view, visibility/moderation policy, freshness and edge origin
 * before enabling the route in a deployment. Without all of the injectable
 * read dependencies, every request returns 503.
 */
export function createPublicFeedHttpServer({ getView, canShowPublicObject, enabled = false } = {}) {
  return createServer(async (request, response) => {
    let result = unavailable();
    try {
      if (enabled === true && typeof getView === 'function' && typeof canShowPublicObject === 'function' &&
          typeof request.url === 'string' && request.url.length <= MAX_URL_LENGTH &&
          request.url.startsWith('/') && !request.url.startsWith('//') &&
          !request.headers.authorization && !request.headers.cookie) {
        result = await routePublicFeedHttp({
          method: request.method, requestUrl: request.url, getView, canShowPublicObject,
        });
      }
    } catch { result = unavailable(); }
    response.writeHead(result.status, JSON_HEADERS);
    response.end(JSON.stringify(result.body));
  });
}
