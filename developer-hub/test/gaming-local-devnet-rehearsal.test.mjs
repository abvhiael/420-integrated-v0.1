import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamingLocalDevnetRehearsal420, GamingLocalDevnetRehearsalError420 } from '../src/gaming-local-devnet-rehearsal.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId = '420-gaming-game-high_country-v1';

function onboarding() {
  return {
    schemaVersion: '1.0.0', gameId, displayName: 'High Country',
    applicationRelease: {
      schemaVersion: '1.0.0', applicationId, chainId: '420', serviceId: hash('1'), version: 1,
      implementation: address, runtimeCodeHash: hash('2'), metadataHash: hash('3'),
      registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
      publisher: { address }, walletScopes: ['gaming:entitlements:read'],
      appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
    },
    progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
    protocols: ['identity','entitlements','claims','attestations','migration','smart-account']
  };
}

function registration() {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    capabilities: [
      { protocol: 'identity', scope: 'game', actions: ['profile:read'] },
      { protocol: 'smart-account', scope: 'game', actions: ['session:request','session:status'] }
    ],
    compatibility: { gamingProtocol: '420GP/V1', sdkPackage: '@420/gaming-sdk', minimumSdkVersion: '1.0.0', finalityModel: 'GP-16' }
  };
}

function devnet(overrides = {}) {
  return {
    schemaVersion: '1.0.0', profile: 'real15', environment: 'local', chainId: '420',
    consensusTransport: 'devnet-tcp', executionNodes: 15, consensusNodes: 15,
    ...overrides
  };
}

test('GP-17.8 creates deterministic local real15 rehearsal handoff', () => {
  const result = createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet() });
  assert.equal(result.status, 'READY_FOR_LOCAL_DEVNET_REHEARSAL');
  assert.equal(result.gameId, gameId);
  assert.equal(result.devnet.profile, 'real15');
  assert.equal(result.devnet.environment, 'local');
  assert.equal(result.devnet.chainId, '420');
  assert.deepEqual(result.commands, ['npm run devnet:doctor','npm run devnet:plan','npm run devnet:prepare','npm run devnet:smoke']);
});

test('GP-17.8 preserves generated canonical game binding and GP-16 model', () => {
  const result = createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet() });
  assert.deepEqual(result.generatedFiles, ['420-gaming.config.json','src/420-gaming-client.mjs']);
  assert.equal(result.checks.some((check) => check.id === 'FINALITY_MODEL'), true);
  assert.equal(result.checks.some((check) => check.id === 'GUEST_CORE'), true);
});

test('GP-17.8 refuses non-local environments', () => {
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet({ environment: 'testnet' }) }), /must remain local/);
});

test('GP-17.8 refuses wrong chain identity', () => {
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet({ chainId: '1' }) }), /chainId must be 420/);
});

test('GP-17.8 refuses non-real15 or incomplete node topology', () => {
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet({ profile: 'mini' }) }), /must use the DEVHUB-5 real15 profile/);
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet({ executionNodes: 1 }) }), /requires 15 execution and 15 consensus nodes/);
});

test('GP-17.8 refuses alternate consensus transport', () => {
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet({ consensusTransport: 'libp2p' }) }), /deterministic devnet-tcp transport/);
});

test('GP-17.8 remains noncanonical and cannot claim live testnet qualification', () => {
  const result = createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: registration(), devnetProfile: devnet() });
  assert.equal(result.developerHubAuthority, false);
  assert.equal(result.canonicalGrantCreated, false);
  assert.equal(result.canonicalRegistrationCreated, false);
  assert.equal(result.liveTestnetQualified, false);
  assert.match(result.authorityBoundary, /local deterministic rehearsal only/);
});

test('GP-17.8 fails closed on malformed generated integration inputs', () => {
  const bad = registration();
  bad.gameId = '420/GAMING/GAME/OTHER/V1';
  assert.throws(() => createGamingLocalDevnetRehearsal420({ onboardingManifest: onboarding(), registrationProfile: bad, devnetProfile: devnet() }), GamingLocalDevnetRehearsalError420);
});
