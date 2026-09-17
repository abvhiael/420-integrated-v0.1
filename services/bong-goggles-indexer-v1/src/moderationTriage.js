function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function text(value) {
  return String(required(value, 'value'));
}

export function groupRelatedReports(reports) {
  if (!Array.isArray(reports)) throw new Error('reports must be an array');
  const groups = new Map();
  for (const report of reports) {
    const targetType = text(report.targetType);
    const targetId = text(report.targetId);
    const subjectAccount = text(report.subjectAccount).toLowerCase();
    const reasonCode = text(report.reasonCode);
    const groupingKey = `${targetType}|${targetId}|${subjectAccount}|${reasonCode}`;
    const existing = groups.get(groupingKey) ?? [];
    existing.push(report);
    groups.set(groupingKey, existing);
  }
  return Object.freeze([...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupingKey, items]) => Object.freeze({
      groupingKey,
      reportIds: Object.freeze(items.map((item) => text(item.reportId)).sort()),
      count: items.length,
      duplicateCandidate: items.length > 1,
      authoritative: false,
    })));
}

export function resolveModerationPolicy(reasonCode, policyMap) {
  const code = text(reasonCode);
  if (!policyMap || typeof policyMap !== 'object') throw new Error('moderation policy map required');
  const policyVersion = policyMap[code];
  if (!policyVersion) throw new Error(`no moderation policy version for reason code: ${code}`);
  return Object.freeze({ reasonCode: code, policyVersion: String(policyVersion), authoritative: false });
}

export async function prepareCaseOpenIntent({
  report,
  policyMap,
  deriveScope,
  isAuthorized,
} = {}) {
  if (!report || report.triageState !== 'UNTRIAGED' || report.caseId) throw new Error('untriaged report required');
  if (typeof deriveScope !== 'function') throw new Error('canonical scope derivation function required');
  if (typeof isAuthorized !== 'function') throw new Error('capability authorization function required');

  const policy = resolveModerationPolicy(report.reasonCode, policyMap);
  const targetType = required(report.targetType, 'targetType');
  const targetId = required(report.targetId, 'targetId');
  const subjectAccount = required(report.subjectAccount, 'subjectAccount');
  const scope = await deriveScope(targetType, targetId, subjectAccount);
  required(scope, 'scope');

  const actionId = 'ACTION_SAFETY_CASE_OPEN';
  const authorized = await isAuthorized({ actionId, scope, report });
  if (authorized !== true) throw new Error('operator lacks case-open capability');

  return Object.freeze({
    contract: 'BongGogglesSafetyRegistry420',
    method: 'openCase',
    args: Object.freeze([String(report.reportId), policy.policyVersion]),
    capability: Object.freeze({ actionId, scope: String(scope), authorized: true }),
    walletConfirmationRequired: true,
    signed: false,
    broadcast: false,
    authoritative: false,
  });
}
