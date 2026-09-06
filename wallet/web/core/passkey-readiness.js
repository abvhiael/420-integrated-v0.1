import { normalizeAddress } from './abi.js';
import { normalizeRpConfiguration } from './passkeys.js';

const P256_PRECOMPILE = '0x0000000000000000000000000000000000000100';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

function fail(reason, details = {}) {
  return { ready: false, reason, ...details };
}

export function qualifyPasskeyRp({ config, browserOrigin } = {}) {
  if (!config || typeof config !== 'object') return fail('passkey-config-missing');
  if (config.production !== true) return fail('production-mode-required');
  if (!config.origin || !config.rpId) return fail('rp-origin-unconfigured');

  let normalized;
  try {
    normalized = normalizeRpConfiguration({ origin: config.origin, rpId: config.rpId, production: true });
  } catch (error) {
    return fail('invalid-production-rp', { error: error.message });
  }

  if (browserOrigin) {
    let actual;
    try { actual = new URL(browserOrigin).origin; }
    catch { return fail('invalid-browser-origin'); }
    if (actual !== normalized.origin) return fail('browser-origin-mismatch', { expectedOrigin: normalized.origin, actualOrigin: actual });
  }

  return { ready: true, reason: 'rp-qualified', ...normalized };
}

export async function probeP256Precompile(provider) {
  if (!provider?.request) return fail('provider-unavailable');
  // RIP-7212 input is five 32-byte words: message hash, r, s, x, y.
  // An all-zero invalid signature must still return a 32-byte false value when the precompile exists.
  const input = `0x${'0'.repeat(320)}`;
  let result;
  try {
    result = await provider.request('eth_call', [{ to: P256_PRECOMPILE, data: input }, 'latest']);
  } catch (error) {
    return fail('p256-precompile-call-failed', { error: error?.message || String(error) });
  }
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
    return fail('p256-precompile-unavailable', { result: result ?? null });
  }
  return { ready: true, reason: 'p256-precompile-ready', address: P256_PRECOMPILE };
}

export async function qualifyPasskeyVerifier(provider, smartAccountState, { hasCode } = {}) {
  if (!smartAccountState?.deployed) return fail('smart-account-not-deployed');
  let verifier;
  try { verifier = normalizeAddress(smartAccountState.passkeyVerifier || ZERO_ADDRESS); }
  catch { return fail('invalid-passkey-verifier'); }
  if (verifier === ZERO_ADDRESS) return fail('passkey-verifier-unconfigured');

  const codeCheck = hasCode || (async (address) => {
    const code = await provider.request('eth_getCode', [address, 'latest']);
    return typeof code === 'string' && code !== '0x' && !/^0x0*$/.test(code);
  });
  try {
    if (!(await codeCheck(verifier))) return fail('passkey-verifier-no-code', { verifier });
  } catch (error) {
    return fail('passkey-verifier-code-check-failed', { verifier, error: error?.message || String(error) });
  }

  const p256 = await probeP256Precompile(provider);
  if (!p256.ready) return p256;
  return { ready: true, reason: 'verifier-qualified', verifier, p256Precompile: p256.address };
}

export async function qualifyPasskeyProduction({ provider, smartAccountState, runtimeConfig, browserOrigin, hasCode } = {}) {
  if (runtimeConfig?.features?.passkeys !== true) return fail('runtime-passkeys-disabled');
  const rp = qualifyPasskeyRp({ config: runtimeConfig?.passkey, browserOrigin });
  if (!rp.ready) return rp;
  const verifier = await qualifyPasskeyVerifier(provider, smartAccountState, { hasCode });
  if (!verifier.ready) return verifier;
  return {
    ready: true,
    reason: 'production-passkeys-ready',
    origin: rp.origin,
    rpId: rp.rpId,
    verifier: verifier.verifier,
    p256Precompile: verifier.p256Precompile,
  };
}

export { P256_PRECOMPILE };
