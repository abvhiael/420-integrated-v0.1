const ES256_ALG = -7;
const PASSKEY_CHALLENGE_DOMAIN = '420/WALLET/PASSKEY_CHALLENGE/V1';

function requireString(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} required`);
  return text;
}

function requireUint(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return number;
}

export function bytesToBase64Url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(view).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value) {
  const text = requireString(value, 'base64url value');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function normalizeRpConfiguration({ origin, rpId, production = false } = {}) {
  const originUrl = new URL(requireString(origin, 'origin'));
  if (originUrl.protocol !== 'https:' && originUrl.hostname !== 'localhost' && originUrl.hostname !== '127.0.0.1') {
    throw new Error('WebAuthn requires HTTPS outside localhost');
  }

  const configuredRpId = rpId ? requireString(rpId, 'rpId').toLowerCase() : originUrl.hostname.toLowerCase();
  const host = originUrl.hostname.toLowerCase();
  const matchesHost = host === configuredRpId || host.endsWith(`.${configuredRpId}`);
  if (!matchesHost) throw new Error('rpId must equal the origin host or be its registrable parent');
  if (production && (host === 'localhost' || host === '127.0.0.1')) {
    throw new Error('production passkeys cannot use localhost relying-party identity');
  }

  return { origin: originUrl.origin, rpId: configuredRpId, production: Boolean(production) };
}

async function sha256Utf8(value, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('Web Crypto SHA-256 unavailable');
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes));
}

export async function buildPasskeyChallenge({
  chainId,
  smartAccount,
  authorizationEpoch,
  operation,
  nonce,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const payload = JSON.stringify({
    domain: PASSKEY_CHALLENGE_DOMAIN,
    chainId: requireUint(chainId, 'chainId'),
    smartAccount: requireString(smartAccount, 'smartAccount').toLowerCase(),
    authorizationEpoch: requireUint(authorizationEpoch, 'authorizationEpoch'),
    operation: requireString(operation, 'operation'),
    nonce: requireString(nonce, 'nonce'),
  });
  return sha256Utf8(payload, cryptoImpl);
}

export function buildRegistrationOptions({
  challenge,
  rp,
  account,
  displayName,
  excludeCredentialIds = [],
} = {}) {
  if (!(challenge instanceof Uint8Array) || challenge.length < 16) throw new Error('registration challenge must be at least 16 bytes');
  const accountId = requireString(account, 'account').toLowerCase();
  const rpConfig = normalizeRpConfiguration(rp);
  const userId = new TextEncoder().encode(accountId);

  return {
    publicKey: {
      challenge,
      rp: { id: rpConfig.rpId, name: '420 Wallet' },
      user: {
        id: userId,
        name: accountId,
        displayName: displayName ? String(displayName) : accountId,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: ES256_ALG }],
      timeout: 120000,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        requireResidentKey: false,
        userVerification: 'required',
      },
      excludeCredentials: excludeCredentialIds.map((id) => ({
        id: base64UrlToBytes(id),
        type: 'public-key',
      })),
    },
  };
}

export function buildAuthenticationOptions({ challenge, rp, credentialIds = [] } = {}) {
  if (!(challenge instanceof Uint8Array) || challenge.length < 16) throw new Error('authentication challenge must be at least 16 bytes');
  const rpConfig = normalizeRpConfiguration(rp);
  const publicKey = {
    challenge,
    rpId: rpConfig.rpId,
    timeout: 120000,
    userVerification: 'required',
  };
  if (credentialIds.length) {
    publicKey.allowCredentials = credentialIds.map((id) => ({ id: base64UrlToBytes(id), type: 'public-key' }));
  }
  return { publicKey };
}

export function serializeRegistrationCredential(credential) {
  if (!credential || credential.type !== 'public-key' || !credential.rawId || !credential.response) {
    throw new Error('invalid WebAuthn registration credential');
  }
  const response = credential.response;
  if (!response.clientDataJSON || !response.attestationObject) throw new Error('incomplete WebAuthn registration response');
  return {
    id: credential.id || bytesToBase64Url(credential.rawId),
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || null,
    clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    attestationObject: bytesToBase64Url(response.attestationObject),
    transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
  };
}

export function serializeAuthenticationCredential(credential) {
  if (!credential || credential.type !== 'public-key' || !credential.rawId || !credential.response) {
    throw new Error('invalid WebAuthn authentication credential');
  }
  const response = credential.response;
  if (!response.clientDataJSON || !response.authenticatorData || !response.signature) {
    throw new Error('incomplete WebAuthn authentication response');
  }
  return {
    id: credential.id || bytesToBase64Url(credential.rawId),
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    authenticatorData: bytesToBase64Url(response.authenticatorData),
    signature: bytesToBase64Url(response.signature),
    userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
  };
}

export async function registerPasskey({ credentials = globalThis.navigator?.credentials, ...input } = {}) {
  if (!credentials?.create) throw new Error('WebAuthn credential creation unavailable');
  const options = buildRegistrationOptions(input);
  const credential = await credentials.create(options);
  if (!credential) throw new Error('passkey registration cancelled');
  return serializeRegistrationCredential(credential);
}

export async function authenticatePasskey({ credentials = globalThis.navigator?.credentials, ...input } = {}) {
  if (!credentials?.get) throw new Error('WebAuthn credential authentication unavailable');
  const options = buildAuthenticationOptions(input);
  const credential = await credentials.get(options);
  if (!credential) throw new Error('passkey authentication cancelled');
  return serializeAuthenticationCredential(credential);
}

export function passkeyAuthorityStatus({ runtimeConfig, smartAccountSupportsP256 = false } = {}) {
  const configured = runtimeConfig?.features?.passkeys === true;
  if (!configured) return { enabled: false, reason: 'runtime-passkeys-disabled' };
  if (!smartAccountSupportsP256) return { enabled: false, reason: 'smart-account-p256-verifier-unavailable' };
  return { enabled: true, reason: 'ready' };
}

export { ES256_ALG, PASSKEY_CHALLENGE_DOMAIN };
