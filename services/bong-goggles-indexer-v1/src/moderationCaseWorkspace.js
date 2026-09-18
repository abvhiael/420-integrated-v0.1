import { buildModerationCaseDetail } from './moderationCaseDetail.js';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}
function upper(value) { return String(required(value, 'value')).toUpperCase(); }

const TEMPORARY_ACTIONS = new Set(['RESTRICT_INTERACTION', 'TEMP_ACCOUNT_RESTRICTION']);
const RESERVED_ACTIONS = new Set(['ACCOUNT_SUSPENSION']);

export function buildModerationCaseWorkspace(snapshot, caseId, canonical = {}) {
  const detail = buildModerationCaseDetail(snapshot, caseId, canonical);
  const actions = [...detail.actions];
  const latestAction = detail.case.latestActionId
    ? actions.find((item) => String(item.actionId) === String(detail.case.latestActionId)) ?? null
    : null;
  const activeActions = actions.filter((item) => item.state === 'ACTIVE');
  return Object.freeze({
    ...detail,
    latestAction: latestAction ? Object.freeze(structuredClone(latestAction)) : null,
    activeActions: Object.freeze(activeActions.map((item) => Object.freeze(structuredClone(item)))),
    actionCounts: Object.freeze({ total: actions.length, active: activeActions.length }),
    authoritative: false,
  });
}

export async function prepareSafetyActionIntent({
  workspace, actionType, rationaleHash, expiresAt = 0, now, deriveScope, isAuthorized,
} = {}) {
  if (!workspace || workspace.authoritative !== false) throw new Error('non-authoritative case workspace required');
  if (workspace.case?.state !== 'OPEN') throw new Error('open moderation case required');
  if (typeof deriveScope !== 'function') throw new Error('canonical scope derivation function required');
  if (typeof isAuthorized !== 'function') throw new Error('capability authorization function required');

  const normalizedActionType = upper(actionType);
  if (RESERVED_ACTIONS.has(normalizedActionType)) throw new Error('permanent account suspension is reserved');
  const rationale = String(required(rationaleHash, 'rationaleHash'));
  const currentTime = Number(required(now, 'now'));
  if (!Number.isFinite(currentTime) || currentTime < 0) throw new Error('now must be a non-negative number');
  const expiry = Number(expiresAt ?? 0);
  if (!Number.isFinite(expiry) || expiry < 0) throw new Error('expiresAt must be a non-negative number');
  if (TEMPORARY_ACTIONS.has(normalizedActionType) && expiry <= currentTime) {
    throw new Error('temporary moderation action requires future expiry');
  }

  const scope = await deriveScope(
    required(workspace.case.targetType, 'targetType'),
    required(workspace.case.targetId, 'targetId'),
    required(workspace.case.subjectAccount, 'subjectAccount'),
  );
  required(scope, 'scope');
  const actionId = 'ACTION_SAFETY_ACTION_APPLY';
  if (await isAuthorized({ actionId, scope, caseId: workspace.caseId, actionType: normalizedActionType }) !== true) {
    throw new Error('operator lacks action-apply capability');
  }

  return Object.freeze({
    contract: 'BongGogglesSafetyRegistry420',
    method: 'applyAction',
    args: Object.freeze([String(workspace.caseId), normalizedActionType, rationale, expiry]),
    capability: Object.freeze({ actionId, scope: String(scope), authorized: true }),
    rationaleContentIncluded: false,
    walletConfirmationRequired: true,
    signed: false,
    broadcast: false,
    authoritative: false,
  });
}

export async function prepareSafetyActionRevocationIntent({
  workspace, actionId, deriveScope, isAuthorized,
} = {}) {
  if (!workspace || workspace.authoritative !== false) throw new Error('non-authoritative case workspace required');
  if (workspace.case?.state !== 'OPEN') throw new Error('open moderation case required');
  if (typeof deriveScope !== 'function') throw new Error('canonical scope derivation function required');
  if (typeof isAuthorized !== 'function') throw new Error('capability authorization function required');
  const selected = workspace.actions.find((item) => String(item.actionId) === String(required(actionId, 'actionId')));
  if (!selected) throw new Error('moderation action not found');
  if (selected.state !== 'ACTIVE') throw new Error('active moderation action required');

  const scope = await deriveScope(
    required(workspace.case.targetType, 'targetType'),
    required(workspace.case.targetId, 'targetId'),
    required(workspace.case.subjectAccount, 'subjectAccount'),
  );
  required(scope, 'scope');
  const capabilityActionId = 'ACTION_SAFETY_ACTION_REVOKE';
  if (await isAuthorized({ actionId: capabilityActionId, scope, caseId: workspace.caseId, moderationActionId: selected.actionId }) !== true) {
    throw new Error('operator lacks action-revoke capability');
  }

  return Object.freeze({
    contract: 'BongGogglesSafetyRegistry420',
    method: 'revokeAction',
    args: Object.freeze([String(selected.actionId)]),
    capability: Object.freeze({ actionId: capabilityActionId, scope: String(scope), authorized: true }),
    walletConfirmationRequired: true,
    signed: false,
    broadcast: false,
    authoritative: false,
  });
}
