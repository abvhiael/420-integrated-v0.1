export interface Automation12TestnetEnvironment420 {
  chainId: bigint;
  environment: 'testnet';
  expectedGenesisHash: string;
  publicAutomationUrl: string;
  rpcProviderIds: readonly string[];
  oracleProviderIds: readonly string[];
}

export interface Automation12DeploymentEvidence420 {
  automationRevision: string;
  nodeRevision: string;
  rpcRevision: string;
  oracleRevision: string;
  descriptorManifestDigest: string;
  compiledArtifactsDigest: string;
  observedChainId: bigint;
  observedGenesisHash: string;
  readinessReady: boolean;
  schedulerReady: boolean;
  liveWorkerIds: readonly string[];
  registeredJobIds: readonly string[];
  witnessedTriggerClasses: readonly string[];
  apiCompatibilityPassed: boolean;
  rpcCompatibilityPassed: boolean;
  oracleCompatibilityPassed: boolean;
  developerHubCompatibilityPassed: boolean;
  liveJobExecutionPassed: boolean;
  workerLeaseFailoverDrillPassed: boolean;
  replaySuppressionDrillPassed: boolean;
  ambiguousSubmissionRecoveryDrillPassed: boolean;
  wrongChainDrillPassed: boolean;
  finalityConflictDrillPassed: boolean;
  hostileObservationDrillPassed: boolean;
  resourceAbuseDrillPassed: boolean;
  authScopeDrillPassed: boolean;
  readinessRecoveryDrillPassed: boolean;
  telemetryRedactionPassed: boolean;
}

export interface Automation12CloseoutReport420 {
  service: '420Automation';
  phase: 'AUT-12';
  decision: 'go' | 'no-go';
  blockers: readonly string[];
  chainId: string;
  environment: 'testnet';
  automationOrigin: string;
  automationRevision: string;
  nodeRevision: string;
  rpcRevision: string;
  oracleRevision: string;
  liveWorkerCount: number;
  registeredJobCount: number;
  authoritative: false;
  launchAuthority: false;
}

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^(?:sha256:)?[0-9a-fA-F]{64}$/;
const REVISION = /^[0-9a-zA-Z._/+:-]{7,128}$/;
const ID = /^[a-zA-Z0-9._:-]{1,128}$/;

export const REQUIRED_AUT12_TRIGGER_CLASSES_420 = Object.freeze([
  'time',
  'block',
  'event',
  'oracle',
  'manual',
] as const);

function publicHttpsOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid public Automation URL');
  }
  if (url.protocol !== 'https:') throw new Error('public Automation URL must use https:');
  if (url.username || url.password) throw new Error('public Automation URL must not embed credentials');
  if (url.hash) throw new Error('public Automation URL must not contain a fragment');
  return `${url.protocol}//${url.host}`;
}

function validIds(ids: readonly string[]): boolean {
  return ids.length > 0 && new Set(ids).size === ids.length && ids.every((id) => ID.test(id));
}

function validJobIds(ids: readonly string[]): boolean {
  return ids.length > 0 && new Set(ids.map((id) => id.toLowerCase())).size === ids.length && ids.every((id) => HASH32.test(id));
}

function validateRevision(value: string, label: string, blockers: string[]): void {
  if (!REVISION.test(value)) blockers.push(`${label} revision is missing or malformed`);
}

export function validateAutomation12Environment420(input: Automation12TestnetEnvironment420): string[] {
  const errors: string[] = [];
  if (input.chainId !== 420n) errors.push('testnet chain ID must equal 420');
  if (input.environment !== 'testnet') errors.push('environment must equal testnet');
  if (!HASH32.test(input.expectedGenesisHash)) errors.push('expected genesis hash must be a 32-byte hex hash');
  try { publicHttpsOrigin(input.publicAutomationUrl); } catch (error) { errors.push((error as Error).message); }
  if (!validIds(input.rpcProviderIds)) errors.push('RPC provider IDs must be unique and non-empty');
  if (!validIds(input.oracleProviderIds)) errors.push('Oracle provider IDs must be unique and non-empty');
  return errors;
}

export function buildAutomation12CloseoutReport420(
  environment: Automation12TestnetEnvironment420,
  evidence: Automation12DeploymentEvidence420,
): Automation12CloseoutReport420 {
  const blockers = [...validateAutomation12Environment420(environment)];

  validateRevision(evidence.automationRevision, '420Automation', blockers);
  validateRevision(evidence.nodeRevision, 'node420', blockers);
  validateRevision(evidence.rpcRevision, '420RPC', blockers);
  validateRevision(evidence.oracleRevision, '420Oracle', blockers);

  if (!SHA256.test(evidence.descriptorManifestDigest)) blockers.push('descriptor manifest digest is missing or malformed');
  if (!SHA256.test(evidence.compiledArtifactsDigest)) blockers.push('compiled artifacts digest is missing or malformed');
  if (evidence.observedChainId !== environment.chainId) blockers.push('observed chain ID does not match configured testnet chain');
  if (evidence.observedGenesisHash.toLowerCase() !== environment.expectedGenesisHash.toLowerCase()) blockers.push('observed genesis hash does not match configured testnet genesis');
  if (!evidence.readinessReady) blockers.push('420Automation readiness was not traffic-admitting');
  if (!evidence.schedulerReady) blockers.push('Automation scheduler was not ready');
  if (!validIds(evidence.liveWorkerIds)) blockers.push('live Automation worker witnesses must be unique and non-empty');
  if (!validJobIds(evidence.registeredJobIds)) blockers.push('registered Automation job witnesses must be unique 32-byte job IDs');

  const triggerClasses = new Set(evidence.witnessedTriggerClasses);
  for (const triggerClass of REQUIRED_AUT12_TRIGGER_CLASSES_420) {
    if (!triggerClasses.has(triggerClass)) blockers.push(`required trigger compatibility witness missing: ${triggerClass}`);
  }

  const checks: Array<[keyof Automation12DeploymentEvidence420, string]> = [
    ['apiCompatibilityPassed', 'Automation API compatibility was not proven'],
    ['rpcCompatibilityPassed', '420RPC compatibility was not proven'],
    ['oracleCompatibilityPassed', '420Oracle compatibility was not proven'],
    ['developerHubCompatibilityPassed', 'Developer Hub credential compatibility was not proven'],
    ['liveJobExecutionPassed', 'live worker/job execution smoke was not proven'],
    ['workerLeaseFailoverDrillPassed', 'worker lease failover drill was not proven'],
    ['replaySuppressionDrillPassed', 'replay suppression drill was not proven'],
    ['ambiguousSubmissionRecoveryDrillPassed', 'ambiguous submission recovery drill was not proven'],
    ['wrongChainDrillPassed', 'wrong-chain rejection drill was not proven'],
    ['finalityConflictDrillPassed', 'finality-conflict fail-closed drill was not proven'],
    ['hostileObservationDrillPassed', 'hostile observation rejection drill was not proven'],
    ['resourceAbuseDrillPassed', 'resource-abuse rejection drill was not proven'],
    ['authScopeDrillPassed', 'credential/scope isolation drill was not proven'],
    ['readinessRecoveryDrillPassed', 'readiness recovery/hysteresis drill was not proven'],
    ['telemetryRedactionPassed', 'telemetry redaction check was not proven'],
  ];
  for (const [key, message] of checks) if (evidence[key] !== true) blockers.push(message);

  let automationOrigin = 'invalid';
  try { automationOrigin = publicHttpsOrigin(environment.publicAutomationUrl); } catch { /* blocker already recorded */ }

  return Object.freeze({
    service: '420Automation',
    phase: 'AUT-12',
    decision: blockers.length === 0 ? 'go' : 'no-go',
    blockers: Object.freeze(blockers),
    chainId: environment.chainId.toString(),
    environment: 'testnet',
    automationOrigin,
    automationRevision: evidence.automationRevision,
    nodeRevision: evidence.nodeRevision,
    rpcRevision: evidence.rpcRevision,
    oracleRevision: evidence.oracleRevision,
    liveWorkerCount: evidence.liveWorkerIds.length,
    registeredJobCount: evidence.registeredJobIds.length,
    authoritative: false,
    launchAuthority: false,
  });
}
