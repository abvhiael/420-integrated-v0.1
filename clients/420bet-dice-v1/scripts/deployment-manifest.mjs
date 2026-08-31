import fs from 'node:fs';
import path from 'node:path';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

function fail(message) {
  throw new Error(`DiceV1 deployment manifest: ${message}`);
}

export function loadDeploymentManifest(filePath) {
  if (!filePath) fail('manifest path is required');
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) fail(`not found: ${resolved}`);
  const manifest = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  validateDeploymentManifest(manifest);
  return { manifest, resolved };
}

export function validateDeploymentManifest(manifest) {
  if (manifest?.schema !== '420bet-dice-v1-deployment-v1') fail('unexpected schema');
  if (manifest.status !== 'PROMOTED') fail('status must be PROMOTED');
  if (!Number.isInteger(manifest.chain?.id) || manifest.chain.id <= 0) fail('invalid chain.id');
  if (!manifest.chain?.name) fail('chain.name is required');
  if (!/^https?:\/\//.test(manifest.chain?.rpcUrl ?? '')) fail('chain.rpcUrl must be a live http(s) URL');
  if (/REPLACE_WITH|example\.invalid/i.test(manifest.chain.rpcUrl)) fail('placeholder rpcUrl is not allowed');
  if (!manifest.chain?.nativeCurrency?.name || !manifest.chain?.nativeCurrency?.symbol) fail('native currency metadata is required');
  if (!Number.isInteger(manifest.chain?.nativeCurrency?.decimals)) fail('native currency decimals are required');

  for (const key of ['dice', 'diceView', 'wagerRouter', 'vault', 'betAuthorization']) {
    const value = manifest.contracts?.[key];
    if (!/^0x[0-9a-fA-F]{40}$/.test(value ?? '') || value.toLowerCase() === ZERO_ADDRESS) {
      fail(`contracts.${key} must be a nonzero address`);
    }
  }

  const asset = manifest.contracts?.asset;
  if (!/^0x[0-9a-fA-F]{40}$/.test(asset ?? '')) fail('contracts.asset must be an address; zero means native 420');

  for (const key of ['gameId', 'gameVersionId', 'operatorId']) {
    const value = manifest.ids?.[key];
    if (!/^0x[0-9a-fA-F]{64}$/.test(value ?? '') || value.toLowerCase() === ZERO_BYTES32) {
      fail(`ids.${key} must be a nonzero bytes32`);
    }
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(manifest.promotion?.deployer ?? '')) fail('promotion.deployer must be an address');
  if (!/^[0-9a-fA-F]{40}$/.test(manifest.promotion?.sourceCommit ?? '')) fail('promotion.sourceCommit must be a 40-character commit SHA');
  if (Number.isNaN(Date.parse(manifest.promotion?.deployedAt ?? ''))) fail('promotion.deployedAt must be ISO-8601');
}

export function toBrowserConfig(manifest) {
  return {
    chainId: manifest.chain.id,
    chainName: manifest.chain.name,
    rpcUrl: manifest.chain.rpcUrl,
    nativeCurrency: manifest.chain.nativeCurrency,
    contracts: manifest.contracts,
    ids: manifest.ids,
    deadlineSeconds: 300n,
    rootSelector: '#dice420',
  };
}
