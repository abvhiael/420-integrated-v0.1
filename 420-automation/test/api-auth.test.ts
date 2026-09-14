import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AutomationApiService420, AutomationCredentialRegistry420, AutomationJobRegistry420,
  deriveAutomationJobId420, digestAutomationBearer420, validateAutomationCredentialRecord420,
  type AutomationApiPrincipal420, type AutomationAuthPolicy420, type AutomationCredentialRecord420, type AutomationJobDefinition420,
} from '../src/index.js';

const issuedAt = '2026-09-14T00:00:00Z';
const expiresAt = '2026-09-15T00:00:00Z';
const nowMs = Date.parse('2026-09-14T12:00:00Z');
const fixture = (label: string) => `${label}-${'x'.repeat(32)}`;
const readValue = fixture('read');
const submitValue = fixture('submit');
const manageValue = fixture('manage');
const adminValue = fixture('admin');

const policy: AutomationAuthPolicy420 = {
  expectedChainId: 420n, environment: 'testnet', audience: '420automation', maxCredentials: 20,
  applicationBindings: [
    { applicationId: 'app.alpha', ownerIds: ['owner.alpha'], protocolIds: ['protocol.alpha'] },
    { applicationId: 'app.beta', ownerIds: ['owner.beta'], protocolIds: ['protocol.beta'] },
  ],
};

function credential(id: string, value: string, scopes: readonly string[], applicationId = 'app.alpha', overrides: Partial<AutomationCredentialRecord420> = {}): AutomationCredentialRecord420 {
  return { schemaVersion: '1.0.0', applicationId, credentialId: id, chainId: '420', environment: 'testnet', audience: '420automation', scopes, issuedAt, expiresAt, secretSha256: digestAutomationBearer420(value), status: 'ACTIVE', revision: 1, ...overrides };
}

const envelope = { target: '0x1111111111111111111111111111111111111111', selector: '0x12345678', calldataHash: `0x${'22'.repeat(32)}`, nativeValueWei: 0n, gasLimit: 150000n };
function job(ownerId = 'owner.alpha', protocolId = 'protocol.alpha', createdAt = 1000): AutomationJobDefinition420 {
  const identity = { protocolId, ownerId, triggerClass: 'time' as const, triggerRef: `0x${'33'.repeat(32)}`, envelope };
  return { chainId: 420n, jobId: deriveAutomationJobId420(identity), protocolId, ownerId, triggerClass: 'time', triggerRef: identity.triggerRef, revision: 1, status: 'enabled', envelope, createdAt, updatedAt: createdAt };
}
function registry() {
  return new AutomationCredentialRegistry420(policy, [credential('read-1', readValue, ['automation:read']), credential('submit-1', submitValue, ['automation:read', 'automation:submit']), credential('manage-1', manageValue, ['automation:read', 'automation:manage']), credential('admin-1', adminValue, ['automation:admin'])]);
}
function principalFor(value: string): AutomationApiPrincipal420 {
  const decision = registry().authenticate(value, nowMs); assert.equal(decision.authenticated, true); assert.ok(decision.principal); return decision.principal!;
}

test('AUT-9 authenticates scoped application credentials without storing raw material', () => {
  const credentials = registry(); const decision = credentials.authenticate(readValue, nowMs);
  assert.equal(decision.authenticated, true); assert.equal(decision.principal?.applicationId, 'app.alpha'); assert.deepEqual(decision.principal?.ownerIds, ['owner.alpha']);
  assert.equal(credentials.snapshot().storesBearerSecrets, false); assert.equal(credentials.snapshot().audience, '420automation');
});

test('AUT-9 rejects wrong audience, scope, binding, terminal and expired records', () => {
  assert.match(validateAutomationCredentialRecord420(credential('bad-aud', readValue, ['automation:read'], 'app.alpha', { audience: '420rpc' }), policy).join('|'), /audience/);
  assert.match(validateAutomationCredentialRecord420(credential('bad-scope', readValue, ['rpc:admin']), policy).join('|'), /unsupported Automation scope/);
  assert.match(validateAutomationCredentialRecord420(credential('unbound', readValue, ['automation:read'], 'app.none'), policy).join('|'), /no Automation binding/);
  const revoked = new AutomationCredentialRegistry420(policy, [credential('revoked-1', readValue, ['automation:read'], 'app.alpha', { status: 'REVOKED', terminalAt: '2026-09-14T01:00:00Z', terminalReason: 'operator revoke' })]);
  assert.equal(revoked.authenticate(readValue, nowMs).authenticated, false);
  const expired = new AutomationCredentialRegistry420(policy, [credential('expired-1', readValue, ['automation:read'], 'app.alpha', { expiresAt: '2026-09-14T02:00:00Z' })]);
  assert.equal(expired.authenticate(readValue, nowMs).reason, 'credential is expired');
});

test('AUT-9 read surfaces filter jobs by application binding', () => {
  const jobs = new AutomationJobRegistry420(); const alpha = jobs.register(job()); jobs.register(job('owner.beta', 'protocol.beta', 2000)); const api = new AutomationApiService420(jobs); const read = principalFor(readValue);
  const list = api.handle(read, { operation: 'jobs.list' }, nowMs); assert.equal(list.ok, true); if (list.ok) assert.equal((list.data as unknown[]).length, 1);
  assert.equal(api.handle(read, { operation: 'jobs.get', jobId: alpha.job.jobId }, nowMs).ok, true);
  const hidden = jobs.list().find((entry) => entry.job.ownerId === 'owner.beta')!; const hiddenRead = api.handle(read, { operation: 'jobs.get', jobId: hidden.job.jobId }, nowMs); assert.equal(hiddenRead.ok, false); if (!hiddenRead.ok) assert.equal(hiddenRead.code, 'AUT9_NOT_FOUND');
});

test('AUT-9 submit and manage scopes are separate and binding-aware', () => {
  const jobs = new AutomationJobRegistry420(); const api = new AutomationApiService420(jobs); const submit = principalFor(submitValue);
  assert.equal(api.handle(submit, { operation: 'jobs.register', job: job() }, nowMs).ok, true); const entry = jobs.list()[0];
  assert.equal(api.handle(submit, { operation: 'jobs.set-status', jobId: entry.job.jobId, status: 'disabled' }, nowMs).ok, false);
  const foreign = api.handle(submit, { operation: 'jobs.register', job: job('owner.beta', 'protocol.beta', 2000) }, nowMs); assert.equal(foreign.ok, false); if (!foreign.ok) assert.equal(foreign.code, 'AUT9_FORBIDDEN');
  const manage = principalFor(manageValue); assert.equal(api.handle(manage, { operation: 'jobs.set-status', jobId: entry.job.jobId, status: 'disabled' }, 3000).ok, true); assert.equal(jobs.get(entry.job.jobId)?.job.status, 'disabled');
});

test('AUT-9 admin crosses service bindings but not AUT-1 validation', () => {
  const jobs = new AutomationJobRegistry420(); const api = new AutomationApiService420(jobs); const admin = principalFor(adminValue);
  assert.equal(api.handle(admin, { operation: 'jobs.register', job: job('owner.beta', 'protocol.beta', 2000) }, nowMs).ok, true);
  const malformed = { ...job(), jobId: `0x${'99'.repeat(32)}` }; const rejected = api.handle(admin, { operation: 'jobs.register', job: malformed }, nowMs); assert.equal(rejected.ok, false); if (!rejected.ok) assert.match(rejected.reason, /AUT1_JOB_ID_MISMATCH/);
});

test('AUT-9 rejects unauthenticated and over-fielded requests', () => {
  const api = new AutomationApiService420(new AutomationJobRegistry420()); assert.equal(api.handle(null, { operation: 'jobs.list' }, nowMs).ok, false);
  assert.equal(api.handle(principalFor(readValue), { operation: 'jobs.list', extra: 'forbidden' }, nowMs).ok, false);
  const inspect = api.handle(principalFor(readValue), { operation: 'service.inspect' }, nowMs); assert.equal(inspect.ok, true); if (inspect.ok) assert.equal((inspect.data as { canonicalProtocolAuthority: boolean }).canonicalProtocolAuthority, false);
});
