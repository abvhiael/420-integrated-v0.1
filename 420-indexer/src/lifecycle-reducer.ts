import type { DecodedProtocolEvent420 } from './protocol-decoder.js';

export type LifecycleState420 = 'UNKNOWN' | 'PENDING' | 'ACTIVE' | 'PASSED' | 'QUEUED' | 'EXECUTED' | 'COMPLETED' | 'CANCELLED' | 'REVOKED' | 'EXPIRED' | 'FAILED' | 'CREATED' | 'PAID' | 'FULFILLED' | 'DISPUTED' | 'REFUNDED';

export interface LifecycleRule420 {
  eventName: string;
  state: LifecycleState420;
  terminal?: boolean;
  stateField?: string;
  stateMap?: Readonly<Record<string, LifecycleState420>>;
  terminalFieldValues?: readonly string[];
}

export interface LifecyclePolicy420 {
  protocol: string;
  rules: readonly LifecycleRule420[];
}

export interface LifecycleSnapshot420 {
  protocol: string;
  objectKey: string;
  state: LifecycleState420;
  terminal: boolean;
  eventName: string;
  blockNumber: bigint;
  transactionIndex: number;
  logIndex: number;
  fields: DecodedProtocolEvent420['fields'];
}

const KEY_FIELDS = [
  'objectId','componentId','labelHash','profileId','credentialId','issuerId','validatorId','stakeId','proposalId','paymentId',
  'invoiceId','routeId','swapId','transferId','bridgeId','requestId','rightId','licenseId','assetId',
  'programId','applicationId','awardId','milestoneId'
] as const;

export function protocolObjectKey420(event: DecodedProtocolEvent420): string | null {
  if (event.protocol === '420Market') {
    const key = event.fields.orderId !== undefined ? 'orderId' : 'listingId';
    const value = event.fields[key];
    return value === undefined ? null : `${key}:${String(value).toLowerCase()}`;
  }
  if (event.protocol === '420Rights') {
    if (event.eventName === 'ClaimSuperseded') {
      const oldRightId = event.fields.oldRightId;
      if (oldRightId !== undefined && oldRightId !== null) return `rightId:${String(oldRightId).toLowerCase()}`;
    }
    if (event.eventName === 'SubjectRegistered' || event.eventName === 'SubjectMetadataUpdated') {
      const subjectId = event.fields.subjectId;
      if (subjectId !== undefined && subjectId !== null) return `subjectId:${String(subjectId).toLowerCase()}`;
    }
    if (event.eventName === 'ClaimDeclared' || event.eventName === 'RightHolderTransferred') {
      const rightId = event.fields.rightId;
      if (rightId !== undefined && rightId !== null) return `rightId:${String(rightId).toLowerCase()}`;
    }
    if (event.eventName === 'LicenseGranted' || event.eventName === 'LicenseRevoked' || event.eventName === 'LicenseRenounced') {
      const licenseId = event.fields.licenseId;
      if (licenseId !== undefined && licenseId !== null) return `licenseId:${String(licenseId).toLowerCase()}`;
    }
  }

  // Identity events may contain secondary identifiers (for example
  // PrimaryNameSet has labelHash and CredentialIssued has issuerId). The
  // canonical object key follows the Identity object being mutated, not the
  // first generic identifier present in the event.
  const keys = event.protocol === '420Identity'
    ? ['credentialId','profileId','issuerId'] as const
    : event.protocol === '420Randomness'
      ? ['requestId','profileId','routeId'] as const
      : KEY_FIELDS;
  for (const key of keys) {
    const value = event.fields[key];
    if (value !== undefined && value !== null) return `${key}:${String(value).toLowerCase()}`;
  }
  return null;
}

const POLICY_LIST: LifecyclePolicy420[] = [
  { protocol: '420Market', rules: [
    { eventName: 'ListingPublished', state: 'ACTIVE' },
    { eventName: 'ListingCancelled', state: 'CANCELLED' },
    { eventName: 'OrderCreated', state: 'CREATED' },
    { eventName: 'PaymentRecorded', state: 'PAID' },
    { eventName: 'FulfillmentRecorded', state: 'FULFILLED' },
    { eventName: 'OrderCompleted', state: 'COMPLETED', terminal: true },
    { eventName: 'OrderCancelled', state: 'CANCELLED', terminal: true },
    { eventName: 'OrderDisputed', state: 'DISPUTED' },
    { eventName: 'RefundRecorded', state: 'REFUNDED', terminal: true }
  ]},
  { protocol: '420Names', rules: [
    { eventName: 'NameRegistered', state: 'ACTIVE' },
    { eventName: 'NameRenewed', state: 'ACTIVE' },
    { eventName: 'NameTransferred', state: 'ACTIVE' }
  ]},
  { protocol: '420Stake', rules: [
    { eventName: 'ValidatorRegistered', state: 'PENDING' },
    {
      eventName: 'ConsensusStateApplied',
      state: 'UNKNOWN',
      stateField: 'newStatus',
      stateMap: {
        '1': 'PENDING',
        '2': 'PENDING',
        '3': 'ACTIVE',
        '4': 'ACTIVE',
        '5': 'PENDING',
        '6': 'FAILED',
        '7': 'COMPLETED',
        '8': 'PENDING',
        '9': 'PENDING'
      },
      terminalFieldValues: ['7']
    },
    { eventName: 'ExitNoticeApplied', state: 'PENDING' },
    {
      eventName: 'SlashApplied',
      state: 'FAILED',
      stateField: 'resultingStatus',
      stateMap: {
        '1': 'PENDING',
        '2': 'PENDING',
        '3': 'ACTIVE',
        '4': 'ACTIVE',
        '5': 'PENDING',
        '6': 'FAILED',
        '7': 'COMPLETED',
        '8': 'PENDING',
        '9': 'PENDING'
      },
      terminalFieldValues: ['7']
    },
    { eventName: 'ValidatorBondWithdrawn', state: 'COMPLETED', terminal: true }
  ]},
  { protocol: '420Governance', rules: [
    { eventName: 'CivicProposalRegistered', state: 'ACTIVE' }
  ]},
  { protocol: '420Grants', rules: [
    { eventName: 'ProgramCreated', state: 'ACTIVE' },
    { eventName: 'ApplicationSubmitted', state: 'ACTIVE' },
    { eventName: 'AwardCreated', state: 'ACTIVE' },
    {
      eventName: 'AwardStateChanged',
      state: 'UNKNOWN',
      stateField: 'state',
      stateMap: { '1': 'ACTIVE', '2': 'CANCELLED', '3': 'COMPLETED' },
      terminalFieldValues: ['2','3']
    },
    { eventName: 'MilestoneCreated', state: 'PENDING' },
    { eventName: 'MilestoneClaimed', state: 'ACTIVE' },
    { eventName: 'MilestoneApproved', state: 'ACTIVE' },
    { eventName: 'MilestonePaid', state: 'COMPLETED', terminal: true },
    { eventName: 'MilestoneCancelled', state: 'CANCELLED', terminal: true }
  ]},
  { protocol: '420Pay', rules: [
    {
      eventName: 'PaymentSet',
      state: 'UNKNOWN',
      stateField: 'status',
      stateMap: {
        '1': 'PENDING',
        '2': 'ACTIVE',
        '3': 'ACTIVE',
        '4': 'ACTIVE',
        '5': 'COMPLETED',
        '6': 'COMPLETED',
        '7': 'ACTIVE',
        '8': 'FAILED'
      },
      terminalFieldValues: ['5','6','8']
    },
    { eventName: 'PaymentAuthorized', state: 'ACTIVE' }
  ]},
  { protocol: '420Bridge', rules: [
    { eventName: 'TransferRequested', state: 'PENDING' },
    { eventName: 'BridgeTransferRequested', state: 'PENDING' },
    { eventName: 'TransferFinalized', state: 'COMPLETED', terminal: true },
    { eventName: 'BridgeTransferFinalized', state: 'COMPLETED', terminal: true },
    { eventName: 'TransferCancelled', state: 'CANCELLED', terminal: true },
    { eventName: 'TransferFailed', state: 'FAILED', terminal: true }
  ]},
  { protocol: '420Rights', rules: [
    { eventName: 'SubjectRegistered', state: 'ACTIVE' },
    { eventName: 'SubjectMetadataUpdated', state: 'ACTIVE' },
    { eventName: 'ClaimDeclared', state: 'ACTIVE' },
    { eventName: 'RightHolderTransferred', state: 'ACTIVE' },
    { eventName: 'ClaimSuperseded', state: 'REVOKED', terminal: true },
    { eventName: 'LicenseGranted', state: 'ACTIVE' },
    { eventName: 'LicenseRevoked', state: 'REVOKED', terminal: true },
    { eventName: 'LicenseRenounced', state: 'REVOKED', terminal: true }
  ]},
  { protocol: '420Randomness', rules: [
    { eventName: 'RandomnessRequested', state: 'PENDING' },
    { eventName: 'RandomnessRequestCreated', state: 'PENDING' },
    { eventName: 'RandomnessFallbackActivated', state: 'ACTIVE' },
    { eventName: 'RandomnessFulfilled', state: 'COMPLETED', terminal: true },
    { eventName: 'RandomnessResolved', state: 'COMPLETED', terminal: true },
    { eventName: 'RandomnessRequestVoided', state: 'EXPIRED', terminal: true },
    { eventName: 'RequestCreated', state: 'PENDING' },
    { eventName: 'RequestFulfilled', state: 'COMPLETED', terminal: true },
    { eventName: 'RequestCancelled', state: 'CANCELLED', terminal: true },
    { eventName: 'RequestExpired', state: 'EXPIRED', terminal: true }
  ]}
];

export const LIFECYCLE_POLICIES_420: ReadonlyMap<string, LifecyclePolicy420> = new Map(POLICY_LIST.map((p) => [p.protocol, p]));

function governanceLifecycleRule420(event: DecodedProtocolEvent420): LifecycleRule420 | null {
  if (event.eventName === 'CivicProposalRegistered') {
    return { eventName: event.eventName, state: 'ACTIVE' };
  }
  if (event.eventName !== 'CivicProposalStateChanged') return null;
  const raw = event.fields.newState;
  if (typeof raw !== 'bigint') return null;
  if (raw === 1n) return { eventName: event.eventName, state: 'ACTIVE' };
  if (raw === 2n) return { eventName: event.eventName, state: 'PASSED' };
  if (raw === 3n) return { eventName: event.eventName, state: 'FAILED', terminal: true };
  if (raw === 4n) return { eventName: event.eventName, state: 'QUEUED' };
  if (raw === 5n) return { eventName: event.eventName, state: 'EXECUTED', terminal: true };
  return null;
}

function compareOrder(a: DecodedProtocolEvent420, b: DecodedProtocolEvent420): number {
  if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;
  if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
  return a.logIndex - b.logIndex;
}

export function reduceProtocolLifecycle420(events: readonly DecodedProtocolEvent420[], policy?: LifecyclePolicy420): LifecycleSnapshot420[] {
  const ordered = [...events].sort(compareOrder);
  const states = new Map<string, LifecycleSnapshot420>();

  for (const event of ordered) {
    const key = protocolObjectKey420(event);
    if (!key) continue;
    const activePolicy = policy ?? LIFECYCLE_POLICIES_420.get(event.protocol);
    const rule = policy
      ? activePolicy?.rules.find((candidate) => candidate.eventName === event.eventName)
      : event.protocol === '420Governance'
        ? governanceLifecycleRule420(event)
        : activePolicy?.rules.find((candidate) => candidate.eventName === event.eventName);
    if (!rule) continue;

    const current = states.get(key);
    if (current?.terminal) continue;

    const stateFieldValue = rule.stateField === undefined ? undefined : event.fields[rule.stateField];
    const stateFieldKey = stateFieldValue === undefined || stateFieldValue === null ? undefined : String(stateFieldValue);
    const resolvedState = stateFieldKey === undefined ? rule.state : (rule.stateMap?.[stateFieldKey] ?? rule.state);
    const resolvedTerminal = Boolean(rule.terminal) ||
      (stateFieldKey !== undefined && Boolean(rule.terminalFieldValues?.includes(stateFieldKey)));

    states.set(key, {
      protocol: event.protocol,
      objectKey: key,
      state: resolvedState,
      terminal: resolvedTerminal,
      eventName: event.eventName,
      blockNumber: event.blockNumber,
      transactionIndex: event.transactionIndex,
      logIndex: event.logIndex,
      fields: event.fields
    });
  }

  return [...states.values()].sort((a,b) => a.objectKey.localeCompare(b.objectKey));
}
