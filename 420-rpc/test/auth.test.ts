import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RPC9_AUTH_POLICY_420,
  RpcCredentialRegistry420,
  authorizeDerivedRead420,
  authorizeRpcMethod420,
  digestBearerSecret420,
  parseBearerAuthorization420,
  validateRpcCredentialRecord420,
  type RpcCredentialRecord420,
} from '../src/auth.js';

const secret = 'rpc9_test_secret_abcdefghijklmnopqrstuvwxyz012345';
const issuedAt = '2026-09-11T20:00:00.000Z';
const expiresAt = '2026-09-12T20:00:00.000Z';
const now = Date.parse('2026-09-11T23:00:00.000Z');

function credential(overrides: Partial<RpcCredentialRecord420> = {}): RpcCredentialRecord420 {
  return {
    schemaVersion: '1.0.0',
    applicationId: 'devhub-app',
    credentialId: 'rpc-key-1',
    chainId: '420',
    environment: 'testnet',
    audience: '420rpc',
    scopes: ['rpc:read', 'rpc:derived'],
    issuedAt,
    expiresAt,
    secretSha256: digestBearerSecret420(secret),
    status: 'ACTIVE',
    revision: 1,
    ...overrides,
  };
}

test('DEVHUB-16 compatible credential authenticates without storing bearer secret', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential()]);
  const result = registry.authenticate(secret, now);
  assert.equal(result.authenticated, true);
  assert.equal(result.principal?.applicationId, 'devhub-app');
  assert.equal(result.principal?.credentialId, 'rpc-key-1');
  assert.equal(result.principal?.clientKey, 'credential:rpc-key-1');
  assert.equal(registry.snapshot().storesBearerSecrets, false);
});

test('invalid bearer fails closed', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential()]);
  assert.deepEqual(registry.authenticate('rpc9_wrong_secret_abcdefghijklmnopqrstuvwxyz', now), {
    authenticated: false,
    principal: null,
    reason: 'invalid bearer credential',
  });
});

test('anonymous principal receives only configured anonymous scopes', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420);
  const result = registry.authenticate(null, now);
  assert.equal(result.principal?.kind, 'anonymous');
  assert.deepEqual(result.principal?.scopes, ['rpc:read']);
  assert.equal(authorizeRpcMethod420(result.principal!, 'eth_blockNumber').allowed, true);
  assert.equal(authorizeRpcMethod420(result.principal!, 'eth_sendRawTransaction').allowed, false);
  assert.equal(authorizeDerivedRead420(result.principal!).allowed, false);
});

test('scope authorization separates reads, submit, subscriptions and derived reads', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential({ scopes: ['rpc:read', 'rpc:submit', 'rpc:subscribe', 'rpc:derived'] })]);
  const principal = registry.authenticate(secret, now).principal!;
  assert.equal(authorizeRpcMethod420(principal, 'eth_getBalance').allowed, true);
  assert.equal(authorizeRpcMethod420(principal, 'eth_sendRawTransaction').allowed, true);
  assert.equal(authorizeRpcMethod420(principal, 'eth_subscribe').allowed, true);
  assert.equal(authorizeDerivedRead420(principal).allowed, true);
});

test('read-only credential cannot escalate to submission or subscription', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential({ scopes: ['rpc:read'] })]);
  const principal = registry.authenticate(secret, now).principal!;
  assert.equal(authorizeRpcMethod420(principal, 'eth_blockNumber').allowed, true);
  assert.equal(authorizeRpcMethod420(principal, 'eth_sendRawTransaction').reason, 'principal lacks rpc:submit');
  assert.equal(authorizeRpcMethod420(principal, 'eth_subscribe').reason, 'principal lacks rpc:subscribe');
  assert.equal(authorizeDerivedRead420(principal).reason, 'principal lacks rpc:derived');
});

test('wrong chain, environment and audience fail credential validation', () => {
  assert.match(validateRpcCredentialRecord420(credential({ chainId: '1' }))[0] ?? '', /wrong chain/);
  assert.match(validateRpcCredentialRecord420(credential({ environment: 'mainnet' }))[0] ?? '', /wrong environment/);
  assert.match(validateRpcCredentialRecord420(credential({ audience: '420indexer' }))[0] ?? '', /audience/);
});

test('terminal, expired and not-yet-active credentials never authenticate', () => {
  const rotated = credential({ status: 'ROTATED', terminalAt: '2026-09-11T22:00:00.000Z', terminalReason: 'rotated' });
  const revoked = credential({ credentialId: 'rpc-key-2', status: 'REVOKED', terminalAt: '2026-09-11T22:00:00.000Z', terminalReason: 'revoked', secretSha256: digestBearerSecret420(secret + '2') });
  const expired = credential({ credentialId: 'rpc-key-3', issuedAt: '2026-09-10T20:00:00.000Z', expiresAt: '2026-09-11T22:00:00.000Z', secretSha256: digestBearerSecret420(secret + '3') });
  const future = credential({ credentialId: 'rpc-key-4', issuedAt: '2026-09-12T20:00:00.000Z', expiresAt: '2026-09-13T20:00:00.000Z', secretSha256: digestBearerSecret420(secret + '4') });
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [rotated, revoked, expired, future]);
  assert.equal(registry.authenticate(secret, now).reason, 'credential is rotated');
  assert.equal(registry.authenticate(secret + '2', now).reason, 'credential is revoked');
  assert.equal(registry.authenticate(secret + '3', now).reason, 'credential is expired');
  assert.equal(registry.authenticate(secret + '4', now).reason, 'credential is not active yet');
});

test('credential revision cannot regress or change application binding', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential({ revision: 2 })]);
  assert.throws(() => registry.install(credential({ revision: 1 })), /revision cannot regress/);
  assert.throws(() => registry.install(credential({ revision: 3, applicationId: 'other-app' })), /application binding cannot change/);
});

test('bearer parser is strict and bounded', () => {
  assert.equal(parseBearerAuthorization420(`Bearer ${secret}`), secret);
  assert.equal(parseBearerAuthorization420(`bearer ${secret}`), null);
  assert.equal(parseBearerAuthorization420(`Bearer  ${secret}`), null);
  assert.equal(parseBearerAuthorization420('Basic abc'), null);
});

test('unknown or privileged method remains rejected before scope can authorize it', () => {
  const registry = new RpcCredentialRegistry420(DEFAULT_RPC9_AUTH_POLICY_420, [credential({ scopes: ['rpc:admin'] })]);
  const principal = registry.authenticate(secret, now).principal!;
  assert.equal(authorizeRpcMethod420(principal, 'debug_traceTransaction').allowed, false);
  assert.equal(authorizeRpcMethod420(principal, 'eth_sign').allowed, false);
});
