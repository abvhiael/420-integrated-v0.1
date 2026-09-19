// BG-19 integration: opt-in HTTP route adapter for a PUBLIC DISCOVER feed.
// It is not attached to a listening server. Deployment must provide a current
// canonical view and a server-side visibility/moderation policy; no browser
// input is ever treated as evidence of permission.
const HEX32 = /^0x[0-9a-f]{64}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const MAX_LIMIT = 50;
const HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
const reply = (status, body) => Object.freeze({ status, headers: HEADERS, body });
const fail = (status, code) => reply(status, { apiVersion: 'bg-social-read-v1', error: { code } });

function publicItem(record) {
  const { objectId, author, objectType, status, audienceType, contentHash, version } = record ?? {};
  if (!HEX32.test(objectId ?? '') || !ADDRESS.test(author ?? '') || objectType !== 'POST' || status !== 'ACTIVE' || audienceType !== 'PUBLIC' || !HEX32.test(contentHash ?? '') || !Number.isSafeInteger(version) || version < 1) return null;
  // No private audience reference, materialized row, token, raw content, or
  // recursive provenance is passed through to the anonymous browser response.
  return Object.freeze({ objectId: objectId.toLowerCase(), author: author.toLowerCase(), objectType, status, audienceType, contentHash: contentHash.toLowerCase(), version });
}

/** Return an HTTP response, not an express/Node handler. The caller owns HTTP
 * origin policy, deployment attestation, canonical snapshot freshness, and
 * visibility implementation. Policy must be independently qualified before
 * exposing the route outside a controlled environment.
 */
export async function routePublicFeedHttp({ method, requestUrl, getView, canShowPublicObject } = {}) {
  if (method !== 'GET') return fail(405, 'method_not_allowed');
  let url;
  try { url = new URL(requestUrl, 'http://internal.invalid'); }
  catch { return fail(400, 'invalid_request'); }
  if (url.pathname !== '/v1/public-feed') return fail(404, 'not_found');
  if ([...url.searchParams.keys()].some(key => !['feedClass', 'limit'].includes(key)) || url.searchParams.getAll('feedClass').length > 1 || url.searchParams.getAll('limit').length > 1 || (url.searchParams.get('feedClass') ?? 'DISCOVER') !== 'DISCOVER') return fail(400, 'invalid_request');
  const rawLimit = url.searchParams.get('limit') ?? '20';
  if (!/^[1-9][0-9]*$/.test(rawLimit) || Number(rawLimit) > MAX_LIMIT) return fail(400, 'invalid_request');
  if (typeof getView !== 'function' || typeof canShowPublicObject !== 'function') return fail(503, 'unavailable');
  try {
    const view = await getView();
    if (!view || !(view.feeds instanceof Map) || !(view.socialObjects instanceof Map) || !(view.profiles instanceof Map) || !view.checkpoint || !Number.isSafeInteger(view.checkpoint.indexedBlock) || view.checkpoint.indexedBlock < 0 || !Number.isSafeInteger(view.checkpoint.chainId) || view.checkpoint.chainId <= 0) return fail(503, 'unavailable');
    const entries = view.feeds.get('DISCOVER:*');
    if (!Array.isArray(entries)) return fail(503, 'unavailable');
    const items = [];
    const seen = new Set();
    for (const entry of entries) {
      if (items.length === Number(rawLimit)) break;
      if (!entry || entry.feedClass !== 'DISCOVER' || entry.viewerKey !== '*' || !HEX32.test(entry.objectId ?? '') || seen.has(entry.objectId.toLowerCase())) continue;
      const item = publicItem(view.socialObjects.get(entry.objectId));
      if (!item || !view.profiles.get(item.author)?.active) continue;
      // A missing policy, asynchronous policy rejection, or stale/ambiguous
      // decision must never be interpreted as public visibility.
      if (await canShowPublicObject({ object: view.socialObjects.get(entry.objectId), author: view.profiles.get(item.author), checkpoint: view.checkpoint, anonymous: true }) !== true) continue;
      seen.add(item.objectId);
      items.push(item);
    }
    return reply(200, { apiVersion: 'bg-social-read-v1', data: { feedClass: 'DISCOVER', items, snapshotBlock: view.checkpoint.indexedBlock, hasMore: false, authoritative: false } });
  } catch { return fail(503, 'unavailable'); }
}
