import { createMobileRuntimeAdapter420 } from './runtime-adapter.js';

function assertPlatformBridge(bridge, platform) {
  if (!bridge || typeof bridge !== 'object') throw new Error(`${platform} native bridge required`);
  const required = [
    ['rpc', bridge.rpc],
    ['secureStorage.get', bridge.secureStorage?.get],
    ['secureStorage.set', bridge.secureStorage?.set],
    ['secureStorage.delete', bridge.secureStorage?.delete],
    ['passkeys.create', bridge.passkeys?.create],
    ['passkeys.get', bridge.passkeys?.get],
    ['sessionSigner.signHash', bridge.sessionSigner?.signHash],
    ['transaction.submit', bridge.transaction?.submit],
    ['openExternalUrl', bridge.openExternalUrl],
    ['lifecycle.onResume', bridge.lifecycle?.onResume],
    ['lifecycle.onPause', bridge.lifecycle?.onPause],
  ];
  for (const [label, value] of required) {
    if (typeof value !== 'function') throw new Error(`${platform} ${label} capability required`);
  }
  return bridge;
}

function createPlatformAdapter420(platform, bridge) {
  const native = assertPlatformBridge(bridge, platform);
  const runtime = createMobileRuntimeAdapter420({
    platform,
    rpc: native.rpc,
    secureStorage: native.secureStorage,
    passkeys: native.passkeys,
    sessionSigner: native.sessionSigner,
    transaction: native.transaction,
    openExternalUrl: native.openExternalUrl,
  });
  return Object.freeze({
    platform,
    runtime,
    lifecycle: Object.freeze({
      onResume(handler) {
        if (typeof handler !== 'function') throw new TypeError('resume handler required');
        return native.lifecycle.onResume(handler);
      },
      onPause(handler) {
        if (typeof handler !== 'function') throw new TypeError('pause handler required');
        return native.lifecycle.onPause(handler);
      },
    }),
  });
}

export function createIosPlatformAdapter420(bridge) {
  return createPlatformAdapter420('ios', bridge);
}

export function createAndroidPlatformAdapter420(bridge) {
  return createPlatformAdapter420('android', bridge);
}
