import {AuthError} from './auth.mjs';
// Endpoint and credential are administrator-provided trust configuration, never request input.
export function createSessionClient({endpoint, credential, timeoutMs = 3000, transport = fetch}) {
  let url;
  try { url = new URL(endpoint); } catch { throw new AuthError('AUTHORITY_UNAVAILABLE', 503); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    typeof credential !== 'string' || !credential || /[\r\n]/.test(credential) ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 || typeof transport !== 'function') throw new AuthError('AUTHORITY_UNAVAILABLE', 503);
  const pinnedEndpoint = url.href;
  return async request => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await transport(pinnedEndpoint, {method: 'POST', redirect: 'error', signal: controller.signal,
        headers: {'content-type': 'application/json', accept: 'application/jwt', authorization: `Bearer ${credential}`},
        body: JSON.stringify(request)});
      if (response.status !== 200 || !response.body || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/jwt') throw new Error('invalid authority response');
      const reader = response.body.getReader(); let size = 0; const chunks = [];
      try {
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 32768) throw new Error('oversized authority response');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      return Buffer.concat(chunks).toString('utf8');
    } catch { throw new AuthError('SESSION_AUTHORITY_UNAVAILABLE', 503); }
    finally { clearTimeout(timer); }
  };
}
