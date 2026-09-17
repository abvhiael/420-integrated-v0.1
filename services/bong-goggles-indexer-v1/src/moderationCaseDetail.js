function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function mapFromEntries(entries, field) {
  if (!Array.isArray(entries)) throw new Error(`${field} projection entries required`);
  return new Map(entries);
}

function provenanceOf(item, fallback = null) {
  if (item?.provenance) return clone(item.provenance);
  return fallback ? clone(fallback) : null;
}

function same(value, expected, field) {
  if (String(value) !== String(expected)) throw new Error(`${field} canonical projection mismatch`);
}

export function buildModerationCaseDetail(snapshot, caseId, canonical = {}) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  const cases = mapFromEntries(snapshot.cases, 'cases');
  const reports = mapFromEntries(snapshot.reports, 'reports');
  const actions = mapFromEntries(snapshot.actions, 'actions');
  const appeals = mapFromEntries(snapshot.appeals, 'appeals');
  const safetyCase = cases.get(String(required(caseId, 'caseId')));
  if (!safetyCase) throw new Error('moderation case not found');

  const report = reports.get(String(safetyCase.reportId));
  if (!report) throw new Error('linked moderation report missing');
  if (String(report.caseId ?? '') !== String(safetyCase.caseId)) throw new Error('report/case projection mismatch');
  if (String(report.subjectAccount) !== String(safetyCase.subjectAccount)
    || String(report.targetType) !== String(safetyCase.targetType)
    || String(report.targetId) !== String(safetyCase.targetId)) {
    throw new Error('report/case subject projection mismatch');
  }

  const canonicalCase = canonical.caseRecord ?? null;
  const canonicalReport = canonical.report ?? null;
  if (canonicalCase) {
    same(canonicalCase.caseId, safetyCase.caseId, 'caseId');
    same(canonicalCase.reportId, safetyCase.reportId, 'reportId');
    same(canonicalCase.subjectAccount, safetyCase.subjectAccount, 'subjectAccount');
    same(canonicalCase.targetId, safetyCase.targetId, 'targetId');
  }
  if (canonicalReport) {
    same(canonicalReport.reportId, report.reportId, 'reportId');
    same(canonicalReport.subjectAccount, report.subjectAccount, 'report subjectAccount');
    same(canonicalReport.targetId, report.targetId, 'report targetId');
  }

  const linkedActions = [...actions.values()]
    .filter((action) => String(action.caseId) === String(safetyCase.caseId))
    .sort((a, b) => String(a.actionId).localeCompare(String(b.actionId)));
  const linkedAppeals = [...appeals.values()]
    .filter((appeal) => String(appeal.caseId) === String(safetyCase.caseId))
    .sort((a, b) => String(a.appealId).localeCompare(String(b.appealId)));

  if (safetyCase.latestActionId && !linkedActions.some((action) => String(action.actionId) === String(safetyCase.latestActionId))) {
    throw new Error('latest action projection missing');
  }
  if (safetyCase.pendingAppealId && !linkedAppeals.some((appeal) => String(appeal.appealId) === String(safetyCase.pendingAppealId) && appeal.state === 'PENDING')) {
    throw new Error('pending appeal projection missing');
  }

  const canonicalActions = new Map((canonical.actions ?? []).map((item) => [String(item.actionId), item]));
  const canonicalAppeals = new Map((canonical.appeals ?? []).map((item) => [String(item.appealId), item]));
  for (const action of linkedActions) {
    const hydrated = canonicalActions.get(String(action.actionId));
    if (hydrated) same(hydrated.caseId, safetyCase.caseId, 'action caseId');
  }
  for (const appeal of linkedAppeals) {
    const hydrated = canonicalAppeals.get(String(appeal.appealId));
    if (hydrated) same(hydrated.caseId, safetyCase.caseId, 'appeal caseId');
  }

  const timeline = [
    { type: 'REPORT_SUBMITTED', id: report.reportId, provenance: provenanceOf(report) },
    { type: 'CASE_OPENED', id: safetyCase.caseId, provenance: provenanceOf(safetyCase) },
    ...linkedActions.map((action) => ({
      type: action.state === 'ACTIVE' ? 'ACTION_APPLIED' : 'ACTION_UPDATED',
      id: action.actionId,
      provenance: provenanceOf(action),
      secondaryProvenance: action.revocationProvenance ? clone(action.revocationProvenance) : null,
    })),
    ...linkedAppeals.map((appeal) => ({
      type: appeal.state === 'PENDING' ? 'APPEAL_FILED' : 'APPEAL_RESOLVED',
      id: appeal.appealId,
      provenance: provenanceOf(appeal),
      secondaryProvenance: appeal.resolutionProvenance ? clone(appeal.resolutionProvenance) : null,
    })),
  ];

  if (safetyCase.closedProvenance) {
    timeline.push({ type: 'CASE_CLOSED', id: safetyCase.caseId, provenance: clone(safetyCase.closedProvenance) });
  }

  const evidence = [];
  if (canonicalReport?.evidenceHash) {
    evidence.push(Object.freeze({
      source: 'REPORT',
      reference: String(canonicalReport.evidenceHash),
      contentIncluded: false,
      authoritative: false,
    }));
  }
  for (const action of linkedActions) {
    const hydrated = canonicalActions.get(String(action.actionId));
    if (hydrated?.rationaleHash) {
      evidence.push(Object.freeze({
        source: 'ACTION_RATIONALE',
        actionId: action.actionId,
        reference: String(hydrated.rationaleHash),
        contentIncluded: false,
        authoritative: false,
      }));
    }
  }

  return Object.freeze({
    caseId: safetyCase.caseId,
    report: Object.freeze(clone(report)),
    case: Object.freeze(clone(safetyCase)),
    actions: Object.freeze(linkedActions.map((item) => Object.freeze(clone(item)))),
    appeals: Object.freeze(linkedAppeals.map((item) => Object.freeze(clone(item)))),
    evidence: Object.freeze(evidence),
    timeline: Object.freeze(timeline.map((item) => Object.freeze(item))),
    checkpoint: snapshot.checkpoint ? Object.freeze(clone(snapshot.checkpoint)) : null,
    authoritative: false,
  });
}
