// BG-19.17 deployment-owned HTTP ingress. Does not listen automatically, terminate
// TLS, trust forwarded headers, implement distributed throttling, or certify the
// injected BG-19.16 canonical/policy readers. Keep disabled until operator gates.
import { createServer } from 'node:http';
import { routePublicFeedHttp } from './publicFeedHttp.js';

const API_VERSION = 'bg-social-read-v1';
const ALLOWED_ORIGIN = 'https://bonggoggles.420integrated.org';
const MAX_URL = 2048;
const HEADER_LIMIT = 8192;
const BASE_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'vary': 'Origin',
});
const errorReply = (status, code) => ({status, body: {apiVersion: API_VERSION, error: {code}}});
const validHost = value => typeof value === 'string' && /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(value) && value.length <= 253;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

/**
 * The edge MUST terminate HTTPS with an attested certificate, send an exact
 * configured internal Host, reject direct public access to this HTTP listener,
 * and enforce a shared/distributed rate limit. Never use X-Forwarded-* as proof
 * of HTTPS, authentication, a client IP, or a qualified service origin.
 *
 * `qualification` must be the server-owned BG-19.16 dependencies object from
 * createPublicFeedQualification; its `configured` flag is necessary but NOT
 * proof that injected canonical/policy readers were independently audited.
 */
export function createPublicFeedDeploymentServer({
  enabled = false, qualification, expectedHost, allowedOrigin = ALLOWED_ORIGIN,
  maxRequestsPerWindow = 30, windowMs = 60_000, requestTimeoutMs = 3_000,
  maxResponseBytes = 64 * 1024, now = Date.now,
} = {}) {
  const configured = enabled === true && qualification?.configured === true &&
    typeof qualification.getView === 'function' &&
    typeof qualification.canShowPublicObject === 'function' &&
    validHost(expectedHost) && allowedOrigin === ALLOWED_ORIGIN &&
    positiveInteger(maxRequestsPerWindow) && positiveInteger(windowMs) &&
    positiveInteger(requestTimeoutMs) && positiveInteger(maxResponseBytes) &&
    typeof now === 'function';
  const counters = new Map(); // process-local only; edge MUST add shared limiting.
  const server = createServer({maxHeaderSize: HEADER_LIMIT, requestTimeout: requestTimeoutMs}, async (request, response) => {
    const headers = {...BASE_HEADERS};
    const origin = request.headers.origin;
    if (origin === allowedOrigin) headers['access-control-allow-origin'] = allowedOrigin;
    const send = (status, body) => {
      if (response.headersSent || response.destroyed) return;
      let bytes;
      try { bytes = Buffer.from(JSON.stringify(body)); }
      catch { status = 503; bytes = Buffer.from(JSON.stringify(errorReply(503, 'unavailable').body)); }
      if (bytes.length > maxResponseBytes) {
        status = 503;
        bytes = Buffer.from(JSON.stringify(errorReply(503, 'unavailable').body));
      }
      response.writeHead(status, {...headers, 'content-length': String(bytes.length)});
      response.end(bytes);
    };
    if (!configured) {send(503, errorReply(503, 'unavailable').body); return;}
    if (request.headers.host !== expectedHost ||
        (origin !== undefined && origin !== allowedOrigin) ||
        request.headers.authorization !== undefined || request.headers.cookie !== undefined ||
        request.headers['proxy-authorization'] !== undefined ||
        request.headers['x-forwarded-user'] !== undefined ||
        request.headers['x-forwarded-email'] !== undefined ||
        request.headers['content-length'] !== undefined || request.headers['transfer-encoding'] !== undefined ||
        typeof request.url !== 'string' || request.url.length > MAX_URL ||
        !request.url.startsWith('/') || request.url.startsWith('//')) {
      send(403, errorReply(403, 'forbidden').body); return;
    }
    // Never trust X-Forwarded-For for identity or throttling. This in-process
    // limit is defense-in-depth, not a substitute for edge distributed limits.
    const key = request.socket.remoteAddress;
    if (typeof key !== 'string' || key.length === 0) {
      send(503, errorReply(503, 'unavailable').body); return;
    }
    try {
      const tick = now();
      if (!Number.isSafeInteger(tick) || tick < 0) throw Error('clock');
      if (counters.size > 10_000) counters.clear();
      const old = counters.get(key);
      const current = !old || tick < old.start || tick - old.start >= windowMs
        ? {start: tick, count: 1} : {start: old.start, count: old.count + 1};
      counters.set(key, current);
      if (current.count > maxRequestsPerWindow) {
        send(429, errorReply(429, 'rate_limited').body); return;
      }
      let timer;
      try {
        const route = routePublicFeedHttp({
          method: request.method, requestUrl: request.url,
          getView: qualification.getView,
          canShowPublicObject: qualification.canShowPublicObject,
        });
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('timeout')), requestTimeoutMs);
        });
        const result = await Promise.race([route, deadline]);
        send(result.status, result.body);
      } finally {clearTimeout(timer);}
    } catch {send(503, errorReply(503, 'unavailable').body);}
  });
  server.headersTimeout = Math.max(requestTimeoutMs, 1_000);
  server.keepAliveTimeout = 1_000;
  return server;
}
