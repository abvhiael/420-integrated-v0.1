import { BongGogglesModerationOperationsProjection } from './moderationOperations.js';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));
}
function checkpointKey(checkpoint) {
  if (!checkpoint) return 'genesis';
  return [
    required(checkpoint.chainId,'checkpoint.chainId'),
    required(checkpoint.blockNumber,'checkpoint.blockNumber'),
    required(checkpoint.blockHash,'checkpoint.blockHash'),
    required(checkpoint.transactionHash,'checkpoint.transactionHash'),
    required(checkpoint.logIndex,'checkpoint.logIndex'),
  ].join(':');
}
function sameCheckpoint(a,b) {
  return checkpointKey(a) === checkpointKey(b);
}

export function moderationIntentFingerprint(intent, expectedCheckpoint) {
  if (!intent || intent.authoritative !== false) throw new Error('non-authoritative moderation intent required');
  return JSON.stringify(stable({
    contract:required(intent.contract,'contract'),
    method:required(intent.method,'method'),
    args:required(intent.args,'args'),
    capability:required(intent.capability,'capability'),
    checkpoint:checkpointKey(expectedCheckpoint),
  }));
}

export function assertPreparedIntentFresh({
  intent,
  preparedCheckpoint,
  currentCheckpoint,
  capabilityProjection,
} = {}) {
  if (!sameCheckpoint(preparedCheckpoint,currentCheckpoint)) throw new Error('stale moderation intent checkpoint');
  if (!capabilityProjection || capabilityProjection.authoritative !== false || !Array.isArray(capabilityProjection.capabilities)) {
    throw new Error('current capability projection required');
  }
  const actionId=String(required(intent?.capability?.actionId,'capability.actionId'));
  const scope=String(required(intent?.capability?.scope,'capability.scope'));
  const current=capabilityProjection.capabilities.find((item)=>String(item.actionId)===actionId&&String(item.scope)===scope);
  if (!current || current.authorized !== true) throw new Error(`stale moderation capability: ${current?.denialReason ?? 'MISSING_CAPABILITY'}`);
  return true;
}

export class ModerationIntentGuard {
  constructor() {
    this.byFingerprint=new Map();
    this.byResource=new Map();
  }

  reserve({ intent, operator, resourceKey, expectedCheckpoint } = {}) {
    const fingerprint=moderationIntentFingerprint(intent,expectedCheckpoint);
    const resource=String(required(resourceKey,'resourceKey'));
    const actor=String(required(operator,'operator')).toLowerCase();
    if (this.byFingerprint.has(fingerprint)) throw new Error('duplicate moderation intent suppressed');
    const existing=this.byResource.get(resource);
    if (existing) {
      throw new Error(`concurrent moderation conflict: ${existing.operator} already reserved ${resource}`);
    }
    const record=Object.freeze({
      fingerprint,
      resourceKey:resource,
      operator:actor,
      checkpoint:checkpointKey(expectedCheckpoint),
      authoritative:false,
    });
    this.byFingerprint.set(fingerprint,record);
    this.byResource.set(resource,record);
    return record;
  }

  release(record) {
    if (!record) return false;
    const current=this.byFingerprint.get(record.fingerprint);
    if (!current) return false;
    this.byFingerprint.delete(record.fingerprint);
    if (this.byResource.get(current.resourceKey)?.fingerprint===record.fingerprint) this.byResource.delete(current.resourceKey);
    return true;
  }
}

export function detectCanonicalLocalDivergence(snapshot, canonical = {}) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  const checks=[
    ['reports','reportId','triageState'],
    ['cases','caseId','state'],
    ['actions','actionId','state'],
    ['appeals','appealId','state'],
    ['emergencyHides','targetScope','hiddenUntil'],
  ];
  const divergences=[];
  for (const [field,idField,stateField] of checks) {
    if (!Array.isArray(snapshot[field])) throw new Error(`${field} projections required`);
    const canonicalItems=canonical[field] ?? [];
    if (!Array.isArray(canonicalItems)) throw new Error(`canonical ${field} must be an array`);
    const remote=new Map(canonicalItems.map((item)=>[String(required(item[idField],idField)),item]));
    for (const [,local] of snapshot[field]) {
      const id=String(required(local[idField],idField));
      const item=remote.get(id);
      if (!item) continue;
      if (String(local[stateField])!==String(item[stateField])) {
        divergences.push(Object.freeze({
          collection:field,id,field:stateField,
          local:String(local[stateField]),canonical:String(item[stateField]),
          authoritative:false,
        }));
      }
    }
  }
  return Object.freeze({
    divergences:Object.freeze(divergences.sort((a,b)=>a.collection.localeCompare(b.collection)||a.id.localeCompare(b.id))),
    converged:divergences.length===0,
    authoritative:false,
  });
}

export function verifyModerationRestart(snapshot) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  const restored=new BongGogglesModerationOperationsProjection();
  restored.restore(snapshot);
  const rebuilt=restored.snapshot();
  const expected=JSON.stringify(stable(snapshot));
  const actual=JSON.stringify(stable(rebuilt));
  if (expected!==actual) throw new Error('moderation restart snapshot divergence');
  return Object.freeze({verified:true,snapshot:rebuilt,authoritative:false});
}

export function buildBoundedOperatorQueues(queues,{limit=100,maxLimit=500}={}) {
  if (!queues || queues.authoritative !== false) throw new Error('non-authoritative moderation queues required');
  const requested=Number(limit);
  const maximum=Number(maxLimit);
  if (!Number.isInteger(requested)||requested<1) throw new Error('queue limit must be a positive integer');
  if (!Number.isInteger(maximum)||maximum<1) throw new Error('maxLimit must be a positive integer');
  if (requested>maximum) throw new Error('queue limit exceeds configured maximum');
  const take=(items)=>Object.freeze((items??[]).slice(0,requested).map((item)=>Object.freeze(structuredClone(item))));
  return Object.freeze({
    untriagedReports:take(queues.untriagedReports),
    openCases:take(queues.openCases),
    pendingAppeals:take(queues.pendingAppeals),
    totals:Object.freeze({...queues.counts}),
    truncated:Object.freeze({
      untriagedReports:(queues.untriagedReports?.length??0)>requested,
      openCases:(queues.openCases?.length??0)>requested,
      pendingAppeals:(queues.pendingAppeals?.length??0)>requested,
    }),
    limit:requested,
    authoritative:false,
  });
}
