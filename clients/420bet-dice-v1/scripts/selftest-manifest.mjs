import { toBrowserConfig, validateDeploymentManifest } from './deployment-manifest.mjs';

const promoted = {
  schema: '420bet-dice-v1-deployment-v1',
  environment: 'LOCAL',
  status: 'PROMOTED',
  chain: {
    id: 31337,
    name: 'Local Anvil',
    rpcUrl: 'http://127.0.0.1:8545',
    nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
  },
  contracts: {
    dice: '0x1000000000000000000000000000000000000001',
    diceView: '0x1000000000000000000000000000000000000002',
    wagerRouter: '0x1000000000000000000000000000000000000003',
    accessPolicy: '0x1000000000000000000000000000000000000007',
    vault: '0x1000000000000000000000000000000000000004',
    asset: '0x0000000000000000000000000000000000000000',
    betAuthorization: '0x1000000000000000000000000000000000000005',
  },
  ids: {
    gameId: `0x${'11'.repeat(32)}`,
    gameVersionId: `0x${'22'.repeat(32)}`,
    operatorId: `0x${'33'.repeat(32)}`,
  },
  promotion: {
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    deployedAt: '2026-08-31T00:00:00Z',
    deployer: '0x1000000000000000000000000000000000000006',
  },
};

validateDeploymentManifest(promoted);
const config = toBrowserConfig(promoted);
if (config.chainId !== 31337) throw new Error('chainId projection failed');
if (config.contracts.dice !== promoted.contracts.dice) throw new Error('contract projection failed');
if (config.contracts.accessPolicy !== promoted.contracts.accessPolicy) throw new Error('access policy projection failed');
if (config.ids.gameVersionId !== promoted.ids.gameVersionId) throw new Error('ID projection failed');

for (const mutation of [
  (m) => { m.status = 'UNPROMOTED'; },
  (m) => { m.chain.rpcUrl = 'REPLACE_WITH_LIVE_RPC'; },
  (m) => { m.contracts.dice = '0x0000000000000000000000000000000000000000'; },
  (m) => { m.contracts.accessPolicy = '0x0000000000000000000000000000000000000000'; },
  (m) => { m.ids.gameId = `0x${'00'.repeat(32)}`; },
]) {
  const candidate = structuredClone(promoted);
  mutation(candidate);
  let rejected = false;
  try { validateDeploymentManifest(candidate); } catch { rejected = true; }
  if (!rejected) throw new Error('manifest validator accepted an unsafe candidate');
}

console.log('DiceV1 deployment manifest self-test PASS');
