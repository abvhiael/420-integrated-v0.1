import {
  prepareSessionUserOperationTransport,
  readEntryPointUserOpHash,
  revalidatePreparedSession,
} from './entrypoint-transport.js';
import {
  selectBundlerProvider,
  sendBundlerUserOperation,
  readBundlerUserOperationReceipt,
} from './bundler-transport.js';
import { normalizeAddress } from './abi.js';

export async function sendPreparedSessionViaBundler(provider, prepared, endpoints, options = {}) {
  if (!prepared?.broadcastReady || !prepared?.entryPointSimulation?.simulationPassed) throw new Error('Wallet signed session preparation required');
  const chain = await provider.request('eth_chainId');
  if (options.chainId != null && BigInt(chain) !== BigInt(options.chainId)) throw new Error('wallet chain changed before Bundler selection');
  const accounts = await provider.request('eth_accounts');
  if (!Array.isArray(accounts) || !accounts.some((account) => normalizeAddress(account) === normalizeAddress(prepared.signer))) {
    throw new Error('session signer is not available in the connected wallet');
  }
  await revalidatePreparedSession(provider, prepared);
  const currentHash = await readEntryPointUserOpHash(provider, prepared.entryPoint, { ...prepared.userOperation, signature: '0x' });
  if (currentHash !== prepared.userOpHash.toLowerCase()) throw new Error('canonical UserOperation hash changed after signing');
  const selected = await selectBundlerProvider(endpoints, prepared.entryPoint, options);
  const submitted = await sendBundlerUserOperation(selected, prepared.userOperation, currentHash);
  return {
    ...prepared,
    ...submitted,
    txHash: null,
    bundlerProvider: selected,
    // Submission is not inclusion. The transaction hash is obtained only from a verified receipt.
  };
}

export async function sendSessionViaBundler(provider, smartAccountState, sessionKey, request, endpoints, options = {}) {
  const prepared = await prepareSessionUserOperationTransport(provider, smartAccountState, sessionKey, request, options);
  return sendPreparedSessionViaBundler(provider, prepared, endpoints, options);
}

export async function confirmSessionViaBundler(submitted) {
  if (!submitted?.bundlerProvider || submitted.transport !== 'bundler') throw new Error('Bundler submission required');
  const receipt = await readBundlerUserOperationReceipt(submitted.bundlerProvider, submitted.userOpHash);
  if (receipt === null) return { ...submitted, included: false, receipt: null, txHash: null };
  return { ...submitted, included: true, receipt, txHash: receipt.transactionHash, executionSucceeded: receipt.success };
}
