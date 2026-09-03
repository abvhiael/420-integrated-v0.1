import { ZERO_ADDRESS, ZERO_BYTES32, encodeCreateAccount, normalizeAddress, normalizeBytes32 } from './abi.js';
import { discoverSmartAccount, hasCode } from './accounts.js';

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

export async function prepareSmartAccountCreation(provider, controller, config = {}) {
  const owner = normalizeAddress(controller);
  const factoryAddress = normalizeAddress(config.factoryAddress);
  const recoveryAuthority = normalizeAddress(config.recoveryAuthority || ZERO_ADDRESS);
  const salt = normalizeBytes32(config.salt || ZERO_BYTES32);

  if (!(await hasCode(provider, factoryAddress))) {
    throw new Error('canonical SmartAccountFactory420 is not deployed on this network');
  }

  const discovered = await discoverSmartAccount(provider, owner, { factoryAddress, recoveryAuthority, salt });
  return {
    owner,
    factoryAddress,
    recoveryAuthority,
    salt,
    smartAccount: discovered.smartAccount,
    alreadyDeployed: discovered.deployed,
    transaction: discovered.deployed ? null : {
      from: owner,
      to: factoryAddress,
      value: '0x0',
      data: encodeCreateAccount(owner, recoveryAuthority, salt),
    },
  };
}

export async function sendSmartAccountCreation(provider, controller, config = {}) {
  const prepared = await prepareSmartAccountCreation(provider, controller, config);
  if (prepared.alreadyDeployed) return { ...prepared, submitted: false, txHash: null };

  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmSmartAccountCreation(provider, txHash, controller, config = {}, options = {}) {
  const normalizedHash = normalizeTxHash(txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let receipt = null;
  for (let i = 0; i < attempts; i += 1) {
    receipt = await provider.request('eth_getTransactionReceipt', [normalizedHash]);
    if (receipt) break;
    if (i + 1 < attempts) await sleep(delayMs);
  }

  if (!receipt) throw new Error('smart account creation transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('smart account creation transaction reverted');

  const discovered = await discoverSmartAccount(provider, controller, config);
  if (!discovered.deployed) throw new Error('SmartAccount420 code missing after confirmed creation');
  if (!discovered.controllerIsOwner) throw new Error('SmartAccount420 owner does not match connected controller');

  return { txHash: normalizedHash, receipt, smartAccount: discovered };
}
