function assertBoolean(value, label) {
  if (value !== true) throw new Error(`${label} required`);
}

export function qualifyMobileDeviceManifest420(manifest = {}) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('mobile device manifest required');
  if (!['ios', 'android'].includes(manifest.platform)) throw new Error('supported mobile platform required');
  const capabilities = manifest.capabilities ?? {};
  const security = manifest.security ?? {};

  if (!['keychain', 'keystore'].includes(capabilities.secureStorage)) throw new Error('native secure storage declaration required');
  assertBoolean(capabilities.passkeys, 'native passkey capability');
  assertBoolean(capabilities.lifecycleResume, 'resume lifecycle capability');
  assertBoolean(capabilities.lifecyclePause, 'pause lifecycle capability');

  if (manifest.platform === 'ios') {
    assertBoolean(capabilities.universalLinks, 'iOS universal links capability');
    if (security.arbitraryHttpLoads !== false) throw new Error('iOS arbitrary HTTP loads must be disabled');
  } else {
    assertBoolean(capabilities.appLinks, 'Android app links capability');
    if (security.cleartextTraffic !== false) throw new Error('Android cleartext traffic must be disabled');
  }

  if (security.exportablePrivateKeys !== false) throw new Error('exportable private keys must be disabled');
  if (security.remoteSignerAuthority !== false) throw new Error('remote signer authority must be disabled');

  return Object.freeze({
    platform: manifest.platform,
    secureStorage: capabilities.secureStorage,
    passkeys: true,
    deepLinks: true,
    lifecycle: true,
    exportablePrivateKeys: false,
    remoteSignerAuthority: false,
    qualified: true,
  });
}
