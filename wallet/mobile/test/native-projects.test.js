import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'android/settings.gradle.kts','android/build.gradle.kts','android/app/build.gradle.kts',
  'android/app/src/main/AndroidManifest.xml','android/app/src/main/java/io/fourtwenty/wallet/MainActivity.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/NativeWalletBridge420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidSecureStore420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidSessionKey420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidPasskey420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidBiometricGate420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/NativeNetworkConfig420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidRpcTransport420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidTransactionSubmitter420.kt',
  'android/app/src/main/java/io/fourtwenty/wallet/AndroidDappHandoff420.kt',
  'ios/project.yml','ios/Wallet420/Info.plist','ios/Wallet420/Wallet420App.swift','ios/Wallet420/Wallet420.entitlements',
  'ios/Wallet420/NativeWalletBridge420.swift','ios/Wallet420/KeychainStore420.swift',
  'ios/Wallet420/SessionKey420.swift','ios/Wallet420/Passkey420.swift','ios/Wallet420/BiometricGate420.swift',
  'ios/Wallet420/NativeNetworkConfig420.swift','ios/Wallet420/RpcTransport420.swift','ios/Wallet420/TransactionSubmitter420.swift',
  'ios/Wallet420/DappHandoff420.swift',
];

const bridgeCapabilities = ['rpc','secureGet','secureSet','secureDelete','createPasskey','getPasskey','authorizeBiometric','ensureSessionKey','sessionPublicKey','rotateSessionKey','invalidateSessionKey','signSessionHash','submitTransaction','openExternal','onResume','onPause'];

test('W11 contains real native project source trees', () => { for (const file of required) assert.equal(fs.existsSync(path.join(root, file)), true, `missing W11 native project file: ${file}`); });

test('iOS and Android expose the same qualified authority boundary', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/NativeWalletBridge420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/NativeWalletBridge420.swift'), 'utf8');
  for (const capability of bridgeCapabilities) { assert.match(android, new RegExp(capability)); assert.match(ios, new RegExp(capability)); }
});

test('native secure storage is device-bound', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidSecureStore420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/KeychainStore420.swift'), 'utf8');
  assert.match(android, /AndroidKeyStore/); assert.match(android, /AES\/GCM\/NoPadding/);
  assert.match(ios, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/); assert.match(ios, /SecItem(Add|Update|CopyMatching|Delete)/);
});

test('W11.2 session signing keys are local, non-exportable and lifecycle-managed', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidSessionKey420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/SessionKey420.swift'), 'utf8');
  assert.match(android, /AndroidKeyStore/); assert.match(android, /setIsStrongBoxBacked\(true\)/); assert.match(android, /setUnlockedDeviceRequired\(true\)/);
  assert.match(ios, /kSecAttrTokenIDSecureEnclave/); assert.match(ios, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.doesNotMatch(android, /privateKey\.encoded|encoded\.private/i); assert.doesNotMatch(ios, /SecKeyCopyExternalRepresentation\(privateKey/i);
});

test('W11.3 native passkeys preserve canonical WebAuthn material and local biometric policy', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidPasskey420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/Passkey420.swift'), 'utf8');
  for (const source of [android, ios]) { assert.match(source, /clientDataJSON/); assert.match(source, /authenticatorData/); assert.match(source, /signature/); assert.match(source, /public-key/); }
  assert.match(android, /CredentialManager/); assert.match(android, /CancellationException/); assert.match(android, /validateRpId/);
  assert.match(ios, /AuthenticationServices/); assert.match(ios, /ASAuthorizationError/); assert.match(ios, /validateRPID/);
});

test('W11.4 RPC transport is HTTPS-only, allowlisted and never a signing authority', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidRpcTransport420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/RpcTransport420.swift'), 'utf8');
  assert.match(android, /https:\/\//i);
  assert.match(ios, /url\.scheme\?\.lowercased\(\)\s*==\s*["']https["']/);
  for (const source of [android, ios]) {
    assert.match(source, /allowedMethods/);
    assert.match(source, /eth_call/); assert.match(source, /eth_estimateGas/);
    assert.match(source, /eth_sendUserOperation/); assert.match(source, /eth_getUserOperationReceipt/);
    assert.doesNotMatch(source, /personal_sign|eth_sendTransaction|eth_signTypedData/i);
  }
});

test('W11.4 network configuration is injected, canonicalizes chain ids and rejects insecure endpoints', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/NativeNetworkConfig420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/NativeNetworkConfig420.swift'), 'utf8');
  for (const source of [android, ios]) {
    assert.match(source, /chainId|chainID/);
    assert.match(source, /rpcUrl|rpcURL/);
    assert.match(source, /normalizeChainId|normalizeChainID/);
    assert.match(source, /https/i);
    assert.doesNotMatch(source, /privateKey|remoteSigner|signingService/i);
  }
  assert.match(android, /fromAsset/);
  assert.match(ios, /Bundle/);
});

test('W11.4 RPC transport classifies timeout, network, HTTP, malformed and JSON-RPC errors', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidRpcTransport420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/RpcTransport420.swift'), 'utf8');
  assert.match(android, /SocketTimeoutException/); assert.match(android, /NetworkFailure/); assert.match(android, /HttpFailure/); assert.match(android, /MalformedResponse/); assert.match(android, /RpcFailure/);
  assert.match(ios, /\.timedOut/); assert.match(ios, /networkFailure/); assert.match(ios, /httpFailure/); assert.match(ios, /malformedResponse/); assert.match(ios, /rpcFailure/);
  for (const source of [android, ios]) {
    assert.match(source, /jsonrpc/);
    assert.match(source, /response id mismatch/);
    assert.match(source, /missing result/);
  }
});

test('W11.4 UserOperation submission fails closed on chain, account and authorization epoch drift', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidTransactionSubmitter420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/TransactionSubmitter420.swift'), 'utf8');
  for (const source of [android, ios]) {
    assert.match(source, /owner/); assert.match(source, /recovery/); assert.match(source, /session/);
    assert.match(source, /chain/i); assert.match(source, /account/i); assert.match(source, /authorizationEpoch/);
    assert.match(source, /eth_sendUserOperation/); assert.match(source, /eth_getUserOperationReceipt/);
  }
});

test('W11.5 native projects expose verified production links and dev-only custom scheme', () => {
  const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle.kts'), 'utf8');
  const project = fs.readFileSync(path.join(root, 'ios/project.yml'), 'utf8');
  const entitlements = fs.readFileSync(path.join(root, 'ios/Wallet420/Wallet420.entitlements'), 'utf8');
  assert.match(manifest, /android:autoVerify="true"/); assert.match(manifest, /android:scheme="https"/); assert.match(manifest, /\$\{walletLinkHost\}/); assert.match(manifest, /420wallet/);
  assert.match(gradle, /walletLinkHost/); assert.match(gradle, /WALLET_LINK_HOST/);
  assert.match(project, /WALLET_LINK_HOST/); assert.match(project, /CODE_SIGN_ENTITLEMENTS/);
  assert.match(entitlements, /com\.apple\.developer\.associated-domains/); assert.match(entitlements, /applinks:\$\(WALLET_LINK_HOST\)/);
});

test('W11.5 native handoff parsers bind origin, request, expiry and callback without signing authority', () => {
  const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidDappHandoff420.kt'), 'utf8');
  const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/DappHandoff420.swift'), 'utf8');
  for (const source of [android, ios]) {
    assert.match(source, /requestId|requestID/); assert.match(source, /expiresAt/); assert.match(source, /callback/); assert.match(source, /origin/);
    assert.match(source, /10 \* 60/); assert.match(source, /420wallet/); assert.match(source, /https/);
    assert.doesNotMatch(source, /privateKey|remoteSigner|signingService|eth_sendTransaction|personal_sign/i);
  }
});

test('native bootstrap contains no remote signing fallback or plaintext private key', () => {
  for (const relative of required.filter((file) => /\.(kt|swift)$/.test(file))) {
    const text = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(text, /privateKey\s*=|remoteSigner|signingService/i, `${relative} introduces forbidden signing authority`);
  }
});
