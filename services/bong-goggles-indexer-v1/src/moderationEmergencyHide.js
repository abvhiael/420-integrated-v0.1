function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function normalizeTime(value, field) {
  const n = Number(required(value, field));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a non-negative number`);
  return n;
}

export function buildEmergencyHideWorkspace(snapshot, { now, targets = [] } = {}) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  if (!Array.isArray(snapshot.emergencyHides)) throw new Error('emergency hide projections required');
  if (!Array.isArray(targets)) throw new Error('targets must be an array');
  const currentTime = normalizeTime(now, 'now');
  const projected = new Map(snapshot.emergencyHides);

  const items = targets.map((target) => {
    const scope = String(required(target.scope, 'scope'));
    const hide = projected.get(scope) ?? null;
    const hiddenUntil = hide ? Number(hide.hiddenUntil) : 0;
    const active = Boolean(hide && hiddenUntil > currentTime);
    return Object.freeze({
      scope,
      targetType: required(target.targetType, 'targetType'),
      targetId: required(target.targetId, 'targetId'),
      subjectAccount: required(target.subjectAccount, 'subjectAccount'),
      hiddenUntil: active ? hiddenUntil : 0,
      active,
      presentationHidden: active,
      canonicalContentMutated: false,
      provenance: hide?.provenance ? structuredClone(hide.provenance) : null,
      authoritative: false,
    });
  }).sort((a,b)=>a.scope.localeCompare(b.scope));

  return Object.freeze({
    items: Object.freeze(items),
    count: items.length,
    activeCount: items.filter((item)=>item.active).length,
    now: currentTime,
    authoritative: false,
  });
}

export async function prepareEmergencyHideIntent({
  targetType,
  targetId,
  subjectAccount,
  hiddenUntil,
  now,
  deriveScope,
  isAuthorized,
} = {}) {
  if (typeof deriveScope !== 'function') throw new Error('canonical scope derivation function required');
  if (typeof isAuthorized !== 'function') throw new Error('capability authorization function required');
  const currentTime = normalizeTime(now, 'now');
  const expiry = normalizeTime(hiddenUntil, 'hiddenUntil');
  if (expiry <= currentTime) throw new Error('emergency hide must expire in the future');
  if (expiry > currentTime + 86400) throw new Error('emergency hide exceeds canonical one-day maximum');

  const normalizedTargetType = required(targetType, 'targetType');
  const normalizedTargetId = required(targetId, 'targetId');
  const normalizedSubject = required(subjectAccount, 'subjectAccount');
  const scope = await deriveScope(normalizedTargetType, normalizedTargetId, normalizedSubject);
  required(scope, 'scope');

  const actionId = 'ACTION_SAFETY_EMERGENCY_HIDE';
  if (await isAuthorized({
    actionId,
    scope,
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    subjectAccount: normalizedSubject,
  }) !== true) {
    throw new Error('operator lacks emergency-hide capability');
  }

  return Object.freeze({
    contract: 'BongGogglesSafetyRegistry420',
    method: 'setEmergencyHide',
    args: Object.freeze([normalizedTargetType, String(normalizedTargetId), String(normalizedSubject), expiry]),
    capability: Object.freeze({ actionId, scope: String(scope), authorized: true }),
    presentationOnly: true,
    canonicalContentMutation: false,
    walletConfirmationRequired: true,
    signed: false,
    broadcast: false,
    authoritative: false,
  });
}

export function reconcileEmergencyHideProjection(workspace, { now } = {}) {
  if (!workspace || workspace.authoritative !== false) throw new Error('non-authoritative emergency-hide workspace required');
  const currentTime = normalizeTime(now, 'now');
  return Object.freeze({
    items: Object.freeze(workspace.items.map((item) => Object.freeze({
      ...structuredClone(item),
      active: item.hiddenUntil > currentTime,
      presentationHidden: item.hiddenUntil > currentTime,
      hiddenUntil: item.hiddenUntil > currentTime ? item.hiddenUntil : 0,
      canonicalContentMutated: false,
      authoritative: false,
    }))),
    now: currentTime,
    authoritative: false,
  });
}
