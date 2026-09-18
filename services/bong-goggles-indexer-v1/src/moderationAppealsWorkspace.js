import { buildModerationCaseWorkspace } from './moderationCaseWorkspace.js';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}
function sameAddress(a, b) {
  return String(required(a, 'address')).toLowerCase() === String(required(b, 'address')).toLowerCase();
}

export function buildModerationAppealsWorkspace(snapshot, { canonical = {}, operator = null } = {}) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  if (!Array.isArray(snapshot.appeals) || !Array.isArray(snapshot.cases)) throw new Error('moderation appeal projections required');

  const cases = new Map(snapshot.cases);
  const canonicalAppeals = new Map((canonical.appeals ?? []).map((item) => [String(item.appealId), item]));
  const pending = snapshot.appeals
    .map(([, appeal]) => appeal)
    .filter((appeal) => appeal.state === 'PENDING')
    .map((appeal) => {
      const safetyCase = cases.get(String(appeal.caseId));
      if (!safetyCase) throw new Error('pending appeal case projection missing');
      const hydrated = canonicalAppeals.get(String(appeal.appealId));
      if (hydrated) {
        if (String(hydrated.caseId) !== String(appeal.caseId)) throw new Error('appeal canonical case mismatch');
        if (String(hydrated.state ?? 'PENDING').toUpperCase() !== 'PENDING' && Number(hydrated.state) !== 0) {
          throw new Error('appeal canonical state mismatch');
        }
      }
      const openerBlocked = operator ? sameAddress(operator, safetyCase.openedBy) : false;
      return Object.freeze({
        appealId: String(appeal.appealId),
        caseId: String(appeal.caseId),
        appellant: appeal.appellant,
        caseOpenedBy: safetyCase.openedBy,
        subjectAccount: safetyCase.subjectAccount,
        targetType: safetyCase.targetType,
        targetId: safetyCase.targetId,
        state: 'PENDING',
        operatorEligibleBySeparationOfDuty: operator ? !openerBlocked : null,
        provenance: structuredClone(appeal.provenance),
        authoritative: false,
      });
    })
    .sort((a, b) => a.appealId.localeCompare(b.appealId));

  return Object.freeze({
    pendingAppeals: Object.freeze(pending),
    count: pending.length,
    operator: operator ? String(operator) : null,
    authoritative: false,
  });
}

export function buildAppealCaseWorkspace(snapshot, appealId, canonical = {}) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  const appeals = new Map(snapshot.appeals);
  const appeal = appeals.get(String(required(appealId, 'appealId')));
  if (!appeal) throw new Error('moderation appeal not found');
  const workspace = buildModerationCaseWorkspace(snapshot, appeal.caseId, canonical);
  if (!workspace.appeals.some((item) => String(item.appealId) === String(appeal.appealId))) {
    throw new Error('appeal/case workspace mismatch');
  }
  return Object.freeze({
    appeal: Object.freeze(structuredClone(appeal)),
    caseWorkspace: workspace,
    authoritative: false,
  });
}

export async function prepareAppealResolutionIntent({
  appealWorkspace,
  operator,
  uphold,
  deriveScope,
  isAuthorized,
} = {}) {
  if (!appealWorkspace || appealWorkspace.authoritative !== false) throw new Error('non-authoritative appeal workspace required');
  const appeal = appealWorkspace.appeal;
  const caseWorkspace = appealWorkspace.caseWorkspace;
  if (!appeal || appeal.state !== 'PENDING') throw new Error('pending appeal required');
  if (!caseWorkspace?.case || caseWorkspace.case.state !== 'OPEN') throw new Error('open moderation case required');
  if (typeof uphold !== 'boolean') throw new Error('uphold must be boolean');
  if (typeof deriveScope !== 'function') throw new Error('canonical scope derivation function required');
  if (typeof isAuthorized !== 'function') throw new Error('capability authorization function required');

  const resolver = required(operator, 'operator');
  if (sameAddress(resolver, caseWorkspace.case.openedBy)) {
    throw new Error('case opener cannot resolve appeal');
  }

  const scope = await deriveScope(
    required(caseWorkspace.case.targetType, 'targetType'),
    required(caseWorkspace.case.targetId, 'targetId'),
    required(caseWorkspace.case.subjectAccount, 'subjectAccount'),
  );
  required(scope, 'scope');

  const actionId = 'ACTION_SAFETY_APPEAL_RESOLVE';
  if (await isAuthorized({
    actionId,
    scope,
    operator: resolver,
    caseId: caseWorkspace.caseId,
    appealId: appeal.appealId,
  }) !== true) {
    throw new Error('operator lacks appeal-resolve capability');
  }

  return Object.freeze({
    contract: 'BongGogglesSafetyRegistry420',
    method: 'resolveAppeal',
    args: Object.freeze([String(appeal.appealId), uphold]),
    resolution: uphold ? 'UPHOLD' : 'OVERTURN',
    capability: Object.freeze({ actionId, scope: String(scope), authorized: true }),
    canonicalConfirmationRequired: true,
    localResultFinal: false,
    walletConfirmationRequired: true,
    signed: false,
    broadcast: false,
    authoritative: false,
  });
}
