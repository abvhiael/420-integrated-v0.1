import type { DecodedProtocolEvent420 } from './protocol-decoder.js';

export type LifecycleState420 = 'UNKNOWN' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REVOKED' | 'EXPIRED' | 'FAILED';

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
  'objectId','componentId','labelHash','profileId','validatorId','stakeId','proposalId','paymentId',
  'invoiceId','routeId','swapId','transferId','bridgeId','requestId','rightId','licenseId','assetId'
] as const;

export function protocolObjectKey420(event: DecodedProtocolEvent420): string | null {
  for (const key of KEY_FIELDS) {
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
    { eventName: 'ProposalCreated', state: 'PENDING' },
    { eventName: 'CivicProposalCreated', state: 'PENDING' },
    { eventName: 'ProposalQueued', state: 'PENDING' },
    { eventName: 'ProposalExecuted', state: 'COMPLETED', terminal: true },
    { eventName: 'CivicProposalExecuted', state: 'COMPLETED', terminal: true },
    { eventName: 'ProposalCancelled', state: 'CANCELLED', terminal: true },
    { eventName: 'CivicProposalCancelled', state: 'CANCELLED', terminal: true }
  ]},
  { protocol: '420Pay', rules: [
    { eventName: 'PaymentCreated', state: 'PENDING' },
    { eventName: 'PaymentAuthorized', state: 'ACTIVE' },
    { eventName: 'PaymentSettled', state: 'COMPLETED', terminal: true },
    { eventName: 'PaymentRefunded', state: 'COMPLETED', terminal: true },
    { eventName: 'PaymentCancelled', state: 'CANCELLED', terminal: true },
    { eventName: 'PaymentExpired', state: 'EXPIRED', terminal: true }
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
    const rule = activePolicy?.rules.find((candidate) => candidate.eventName === event.eventName);
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
