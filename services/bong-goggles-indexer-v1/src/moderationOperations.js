function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function key(value) {
  return String(required(value, 'id'));
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function sourcePosition(log) {
  return Object.freeze({
    chainId: required(log.chainId, 'chainId'),
    blockNumber: required(log.blockNumber, 'blockNumber'),
    blockHash: required(log.blockHash, 'blockHash'),
    transactionHash: required(log.transactionHash, 'transactionHash'),
    transactionIndex: required(log.transactionIndex, 'transactionIndex'),
    logIndex: required(log.logIndex, 'logIndex'),
    eventName: required(log.eventName, 'eventName'),
  });
}

export class BongGogglesModerationOperationsProjection {
  constructor() {
    this.reports = new Map();
    this.cases = new Map();
    this.actions = new Map();
    this.appeals = new Map();
    this.emergencyHides = new Map();
    this.checkpoint = null;
  }

  apply(log) {
    const eventName = required(log?.eventName, 'eventName');
    const args = log.args ?? {};
    const provenance = sourcePosition(log);

    switch (eventName) {
      case 'ReportSubmitted': {
        const reportId = key(args.reportId);
        this.reports.set(reportId, {
          reportId,
          reporter: required(args.reporter, 'reporter'),
          subjectAccount: required(args.subjectAccount, 'subjectAccount'),
          targetType: required(args.targetType, 'targetType'),
          targetId: required(args.targetId, 'targetId'),
          reasonCode: required(args.reasonCode, 'reasonCode'),
          caseId: null,
          triageState: 'UNTRIAGED',
          provenance,
          authoritative: false,
        });
        break;
      }
      case 'CaseOpened': {
        const caseId = key(args.caseId);
        const reportId = key(args.reportId);
        const report = this.reports.get(reportId);
        if (!report) throw new Error('canonical report projection required before CaseOpened');
        report.caseId = caseId;
        report.triageState = 'CASE_OPENED';
        this.cases.set(caseId, {
          caseId,
          reportId,
          subjectAccount: report.subjectAccount,
          targetType: report.targetType,
          targetId: report.targetId,
          policyVersion: required(args.policyVersion, 'policyVersion'),
          openedBy: required(args.operator, 'operator'),
          state: 'OPEN',
          latestActionId: null,
          pendingAppealId: null,
          provenance,
          authoritative: false,
        });
        break;
      }
      case 'SafetyActionApplied': {
        const actionId = key(args.actionId);
        const caseId = key(args.caseId);
        const safetyCase = this.cases.get(caseId);
        if (!safetyCase) throw new Error('canonical case projection required before SafetyActionApplied');
        this.actions.set(actionId, {
          actionId,
          caseId,
          actionType: required(args.actionType, 'actionType'),
          appliedBy: required(args.operator, 'operator'),
          expiresAt: args.expiresAt ?? 0,
          state: 'ACTIVE',
          provenance,
          authoritative: false,
        });
        safetyCase.latestActionId = actionId;
        break;
      }
      case 'SafetyActionRevoked': {
        const actionId = key(args.actionId);
        const action = this.actions.get(actionId);
        if (!action || action.caseId !== key(args.caseId)) throw new Error('canonical action projection mismatch');
        action.state = 'REVOKED';
        action.revokedBy = required(args.operator, 'operator');
        action.revocationProvenance = provenance;
        break;
      }
      case 'CaseClosed': {
        const caseId = key(args.caseId);
        const safetyCase = this.cases.get(caseId);
        if (!safetyCase) throw new Error('canonical case projection required before CaseClosed');
        if (safetyCase.pendingAppealId) throw new Error('cannot project closed case with pending appeal');
        safetyCase.state = 'CLOSED';
        safetyCase.closedBy = required(args.operator, 'operator');
        safetyCase.closedProvenance = provenance;
        break;
      }
      case 'AppealFiled': {
        const appealId = key(args.appealId);
        const caseId = key(args.caseId);
        const safetyCase = this.cases.get(caseId);
        if (!safetyCase) throw new Error('canonical case projection required before AppealFiled');
        if (safetyCase.pendingAppealId) throw new Error('duplicate pending appeal projection');
        this.appeals.set(appealId, {
          appealId,
          caseId,
          appellant: required(args.appellant, 'appellant'),
          state: 'PENDING',
          provenance,
          authoritative: false,
        });
        safetyCase.pendingAppealId = appealId;
        break;
      }
      case 'AppealResolved': {
        const appealId = key(args.appealId);
        const appeal = this.appeals.get(appealId);
        if (!appeal || appeal.caseId !== key(args.caseId)) throw new Error('canonical appeal projection mismatch');
        appeal.state = String(required(args.result, 'result'));
        appeal.resolvedBy = required(args.operator, 'operator');
        appeal.resolutionProvenance = provenance;
        const safetyCase = this.cases.get(appeal.caseId);
        if (!safetyCase) throw new Error('canonical case projection required for appeal resolution');
        safetyCase.pendingAppealId = null;
        if (String(args.result).toUpperCase() === 'OVERTURNED' || Number(args.result) === 2) {
          safetyCase.state = 'RESOLVED';
          const action = safetyCase.latestActionId ? this.actions.get(safetyCase.latestActionId) : null;
          if (action && action.state === 'ACTIVE') action.state = 'REVOKED_BY_APPEAL';
        }
        break;
      }
      case 'EmergencyHideSet': {
        const scope = key(args.targetScope);
        this.emergencyHides.set(scope, {
          targetScope: scope,
          hiddenUntil: required(args.hiddenUntil, 'hiddenUntil'),
          operator: required(args.operator, 'operator'),
          provenance,
          authoritative: false,
        });
        break;
      }
      default:
        return false;
    }

    this.checkpoint = provenance;
    return true;
  }

  operatorQueues() {
    const untriagedReports = [...this.reports.values()]
      .filter((report) => report.triageState === 'UNTRIAGED')
      .sort((a, b) => a.reportId.localeCompare(b.reportId));
    const openCases = [...this.cases.values()]
      .filter((item) => item.state === 'OPEN')
      .sort((a, b) => a.caseId.localeCompare(b.caseId));
    const pendingAppeals = [...this.appeals.values()]
      .filter((appeal) => appeal.state === 'PENDING')
      .sort((a, b) => a.appealId.localeCompare(b.appealId));

    return Object.freeze({
      untriagedReports: Object.freeze(untriagedReports.map((item) => Object.freeze(clone(item)))),
      openCases: Object.freeze(openCases.map((item) => Object.freeze(clone(item)))),
      pendingAppeals: Object.freeze(pendingAppeals.map((item) => Object.freeze(clone(item)))),
      counts: Object.freeze({
        untriagedReports: untriagedReports.length,
        openCases: openCases.length,
        pendingAppeals: pendingAppeals.length,
      }),
      authoritative: false,
    });
  }

  snapshot() {
    const entries = (map) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      reports: entries(this.reports),
      cases: entries(this.cases),
      actions: entries(this.actions),
      appeals: entries(this.appeals),
      emergencyHides: entries(this.emergencyHides),
      checkpoint: this.checkpoint ? clone(this.checkpoint) : null,
      authoritative: false,
    };
  }

  restore(snapshot) {
    if (!snapshot || snapshot.authoritative !== false) throw new Error('invalid moderation operations snapshot');
    for (const field of ['reports', 'cases', 'actions', 'appeals', 'emergencyHides']) {
      if (!Array.isArray(snapshot[field])) throw new Error(`invalid moderation snapshot ${field}`);
    }
    this.reports = new Map(clone(snapshot.reports));
    this.cases = new Map(clone(snapshot.cases));
    this.actions = new Map(clone(snapshot.actions));
    this.appeals = new Map(clone(snapshot.appeals));
    this.emergencyHides = new Map(clone(snapshot.emergencyHides));
    this.checkpoint = snapshot.checkpoint ? clone(snapshot.checkpoint) : null;
  }
}
