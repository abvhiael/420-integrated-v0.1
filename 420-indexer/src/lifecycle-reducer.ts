import type { DecodedProtocolEvent420 } from './protocol-decoder.js';

export type LifecycleState420 = 'UNKNOWN' | 'PENDING' | 'ACTIVE' | 'PASSED' | 'QUEUED' | 'EXECUTED' | 'COMPLETED' | 'CANCELLED' | 'REVOKED' | 'EXPIRED' | 'FAILED';

export interface LifecycleRule420 {
  eventName: string;
  state: LifecycleState420;
  terminal?: boolean;
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
  'invoiceId','routeId','swapId','transferId','bridgeId','requestId','rightId','licenseId','assetId'
] as const;

export function protocolObjectKey420(event: DecodedProtocolEvent420): string | null {
  // Identity events may contain secondary identifiers (for example
  // PrimaryNameSet has labelHash and CredentialIssued has issuerId). The
  // canonical object key follows the Identity object being mutated, not the
  // first generic identifier present in the event.
  const keys = event.protocol === '420Identity'
    ? ['credentialId','profileId','issuerId'] as const
    : KEY_FIELDS;
  for (const key of keys) {
    const value = event.fields[key];
    if (value !== undefined && value !== null) return `${key}:${String(value).toLowerCase()}`;
  }
  return null;
}

const POLICY_LIST: LifecyclePolicy420[] = [
  { protocol: '420Names', rules: [
    { eventName: 'NameRegistered', state: 'ACTIVE' },
    { eventName: 'NameRenewed', state: 'ACTIVE' },
    { eventName: 'NameTransferred', state: 'ACTIVE' }
  ]},
  { protocol: '420Stake', rules: [
    { eventName: 'StakeCreated', state: 'ACTIVE' },
    { eventName: 'StakeActivated', state: 'ACTIVE' },
    { eventName: 'UnstakeRequested', state: 'PENDING' },
    { eventName: 'StakeWithdrawn', state: 'COMPLETED', terminal: true },
    { eventName: 'StakeSlashed', state: 'FAILED', terminal: true }
  ]},
  { protocol: '420Governance', rules: [
    { eventName: 'CivicProposalRegistered', state: 'ACTIVE' }
  ]},
  { protocol: '420Pay', rules: [
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
    { eventName: 'RightRegistered', state: 'ACTIVE' },
    { eventName: 'LicenseIssued', state: 'ACTIVE' },
    { eventName: 'RightRevoked', state: 'REVOKED', terminal: true },
    { eventName: 'LicenseRevoked', state: 'REVOKED', terminal: true },
    { eventName: 'LicenseExpired', state: 'EXPIRED', terminal: true }
  ]},
  { protocol: '420Randomness', rules: [
    { eventName: 'RandomnessRequested', state: 'PENDING' },
    { eventName: 'RequestCreated', state: 'PENDING' },
    { eventName: 'RandomnessFulfilled', state: 'COMPLETED', terminal: true },
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

function payLifecycleRule420(event: DecodedProtocolEvent420): LifecycleRule420 | null {
  if (event.eventName === 'PaymentAuthorized') return { eventName: event.eventName, state: 'ACTIVE' };
  if (event.eventName !== 'PaymentSet') return null;
  const raw = event.fields.status;
  if (typeof raw !== 'bigint') return null;
  if (raw === 1n) return { eventName: event.eventName, state: 'PENDING' }; // SUBMITTED
  if (raw === 2n || raw === 3n || raw === 4n || raw === 7n) return { eventName: event.eventName, state: 'ACTIVE' };
  if (raw === 5n || raw === 6n) return { eventName: event.eventName, state: 'COMPLETED', terminal: true };
  if (raw === 8n) return { eventName: event.eventName, state: 'FAILED', terminal: true };
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
        : event.protocol === '420Pay'
          ? payLifecycleRule420(event)
          : activePolicy?.rules.find((candidate) => candidate.eventName === event.eventName);
    if (!rule) continue;

    const current = states.get(key);
    if (current?.terminal) continue;
    states.set(key, {
      protocol: event.protocol,
      objectKey: key,
      state: rule.state,
      terminal: Boolean(rule.terminal),
      eventName: event.eventName,
      blockNumber: event.blockNumber,
      transactionIndex: event.transactionIndex,
      logIndex: event.logIndex,
      fields: event.fields
    });
  }

  return [...states.values()].sort((a,b) => a.objectKey.localeCompare(b.objectKey));
}
