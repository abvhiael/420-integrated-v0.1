import { createHash } from 'node:crypto';
import type { CanonicalEvent, Decision10Fixture } from './types.js';

function h(input: string): string {
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}

function ev(
  seq: number,
  moduleKey: string,
  eventType: string,
  payload: CanonicalEvent['payload'],
): CanonicalEvent {
  return {
    eventKey: `decision10:${seq}`,
    blockNumber: seq,
    blockHash: h(`decision10:block:${seq}`),
    txHash: h(`decision10:tx:${seq}`),
    logIndex: 0,
    moduleKey,
    eventType,
    payload,
  };
}

export function fixtureEvents(f: Decision10Fixture): CanonicalEvent[] {
  let n = 1;
  const out: CanonicalEvent[] = [];

  const modules: Array<[string, string]> = [
    ['CREATIVE_PROTOCOL_REGISTRY', f.creativeProtocolRegistry],
    ['CREATOR_PROFILE_REGISTRY', f.creatorProfileRegistry],
    ['WORK_REGISTRY', f.workRegistry],
    ['RECORDING_REGISTRY', f.recordingRegistry],
    ['CONTRIBUTOR_REGISTRY', f.contributorRegistry],
    ['RIGHTS_REGISTRY', f.rightsRegistry],
    ['AUTHORIZATION_REGISTRY', f.authorizationRegistry],
    ['LICENSE_REGISTRY', f.licenseRegistry],
    ['ROYALTY_SCHEDULE_REGISTRY', f.royaltyScheduleRegistry],
    ['ROYALTY_VAULT', f.royaltyVault],
    ['ROYALTY_ROUTER', f.royaltyRouter],
  ];
  for (const [moduleKey, address] of modules) {
    out.push(ev(n++, 'CREATIVE_PROTOCOL_REGISTRY', 'MODULE_REGISTERED', { moduleKey, address, version: 1 }));
  }

  const creators: Array<[number, string, string]> = [
    [f.aliceCreatorId, f.aliceAccount, 'Alice'],
    [f.bobCreatorId, f.bobAccount, 'Bob'],
    [f.carolCreatorId, f.carolAccount, 'Carol'],
    [f.producerCreatorId, f.producerAccount, 'Producer'],
    [f.remixerCreatorId, f.remixerAccount, 'Remixer'],
  ];
  for (const [creatorId, account, label] of creators) {
    out.push(ev(n++, 'CREATOR_PROFILE_REGISTRY', 'CREATOR_CREATED', { creatorId, account, label }));
  }

  out.push(ev(n++, 'WORK_REGISTRY', 'WORK_REGISTERED', { workId: f.workId, rightsVersion: 1 }));
  out.push(ev(n++, 'RIGHTS_REGISTRY', 'RIGHTS_VERSION_SET', {
    assetType: 'WORK', assetId: f.workId, rightsVersion: 1,
    shares: JSON.stringify([[f.aliceCreatorId, 6000], [f.bobCreatorId, 4000]]),
  }));
  out.push(ev(n++, 'CONTRIBUTOR_REGISTRY', 'CREDIT_ACCEPTED', { creditId: f.aliceWorkCreditId, assetType: 'WORK', assetId: f.workId, creatorId: f.aliceCreatorId }));
  out.push(ev(n++, 'CONTRIBUTOR_REGISTRY', 'CREDIT_ACCEPTED', { creditId: f.bobWorkCreditId, assetType: 'WORK', assetId: f.workId, creatorId: f.bobCreatorId }));

  out.push(ev(n++, 'RECORDING_REGISTRY', 'RECORDING_REGISTERED', {
    recordingId: f.originalRecordingId, workId: f.workId, recordingClass: 'ORIGINAL', parentRecordingId: null, rightsVersion: 1,
  }));
  out.push(ev(n++, 'RIGHTS_REGISTRY', 'RIGHTS_VERSION_SET', {
    assetType: 'RECORDING', assetId: f.originalRecordingId, rightsVersion: 1,
    shares: JSON.stringify([[f.aliceCreatorId, 7000], [f.producerCreatorId, 3000]]),
  }));
  out.push(ev(n++, 'CONTRIBUTOR_REGISTRY', 'CREDIT_ACCEPTED', { creditId: f.aliceRecordingCreditId, assetType: 'RECORDING', assetId: f.originalRecordingId, creatorId: f.aliceCreatorId }));
  out.push(ev(n++, 'CONTRIBUTOR_REGISTRY', 'CREDIT_ACCEPTED', { creditId: f.producerRecordingCreditId, assetType: 'RECORDING', assetId: f.originalRecordingId, creatorId: f.producerCreatorId }));

  out.push(ev(n++, 'ROYALTY_ROUTER', 'ROYALTY_SETTLED', {
    settlementId: f.originalInitialSettlementId, revenueType: 'DIRECT_SALE', recordingId: f.originalRecordingId, grossWei: '100000000000000000000',
  }));
  out.push(ev(n++, 'LICENSE_REGISTRY', 'LICENSE_ISSUED', {
    licenseId: f.remixLicenseId, offerId: f.remixOfferId, recordingId: f.originalRecordingId, licenseeCreatorId: f.remixerCreatorId, status: 'ACTIVE',
  }));
  out.push(ev(n++, 'ROYALTY_ROUTER', 'ROYALTY_SETTLED', {
    settlementId: f.remixLicenseSettlementId, revenueType: 'REMIX_LICENSE', recordingId: f.originalRecordingId, grossWei: '20000000000000000000',
  }));

  out.push(ev(n++, 'RECORDING_REGISTRY', 'RECORDING_REGISTERED', {
    recordingId: f.remixRecordingId, workId: f.workId, recordingClass: 'REMIX', parentRecordingId: f.originalRecordingId, rightsVersion: 1,
  }));
  out.push(ev(n++, 'RIGHTS_REGISTRY', 'RIGHTS_VERSION_SET', {
    assetType: 'RECORDING', assetId: f.remixRecordingId, rightsVersion: 1,
    shares: JSON.stringify([[f.remixerCreatorId, 8000], [f.carolCreatorId, 2000]]),
  }));
  out.push(ev(n++, 'ROYALTY_ROUTER', 'ROYALTY_SETTLED', {
    settlementId: f.remixSettlementId, revenueType: 'DIRECT_SALE', recordingId: f.remixRecordingId, grossWei: '100000000000000000000',
  }));

  out.push(ev(n++, 'RIGHTS_REGISTRY', 'RIGHTS_TRANSFER_ACCEPTED', {
    transferId: f.rightsTransferId, assetType: 'RECORDING', assetId: f.originalRecordingId,
    fromCreatorId: f.aliceCreatorId, toCreatorId: f.carolCreatorId, bps: 1000, resultingRightsVersion: 2,
  }));
  out.push(ev(n++, 'RIGHTS_REGISTRY', 'RIGHTS_VERSION_SET', {
    assetType: 'RECORDING', assetId: f.originalRecordingId, rightsVersion: 2,
    shares: JSON.stringify([[f.aliceCreatorId, 6000], [f.producerCreatorId, 3000], [f.carolCreatorId, 1000]]),
  }));
  out.push(ev(n++, 'ROYALTY_ROUTER', 'ROYALTY_SETTLED', {
    settlementId: f.originalPostTransferSettlementId, revenueType: 'DIRECT_SALE', recordingId: f.originalRecordingId, grossWei: '40000000000000000000',
  }));

  out.push(ev(n++, 'ROYALTY_VAULT', 'FIXTURE_ECONOMICS_FINALIZED', {
    workPoolWei: f.expectedWorkPoolWei,
    originalPoolWei: f.expectedOriginalPoolWei,
    remixPoolWei: f.expectedRemixPoolWei,
    treasuryWei: f.expectedTreasuryWei,
    vaultBalanceWei: f.expectedVaultBalanceWei,
    aliceWorkWei: f.expectedAliceWorkWei,
    bobWorkWei: f.expectedBobWorkWei,
    aliceOriginalWei: f.expectedAliceOriginalWei,
    producerOriginalWei: f.expectedProducerOriginalWei,
    carolOriginalWei: f.expectedCarolOriginalWei,
    remixerRemixWei: f.expectedRemixerRemixWei,
    carolRemixWei: f.expectedCarolRemixWei,
  }));

  return out;
}
