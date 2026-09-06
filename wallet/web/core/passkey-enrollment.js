import { buildRegistrationOptions, bytesToBase64Url, serializeRegistrationCredential } from './passkeys.js';

export async function registerPasskeyForEnrollment({ credentials = globalThis.navigator?.credentials, ...input } = {}) {
  if (!credentials?.create) throw new Error('WebAuthn credential creation unavailable');
  const options = buildRegistrationOptions(input);
  const credential = await credentials.create(options);
  if (!credential) throw new Error('passkey registration cancelled');
  const publicKey = typeof credential.response?.getPublicKey === 'function' ? credential.response.getPublicKey() : null;
  if (!publicKey) throw new Error('authenticator did not expose an ES256 public key for on-chain enrollment');
  return {
    ...serializeRegistrationCredential(credential),
    publicKeySpki: bytesToBase64Url(publicKey),
  };
}
