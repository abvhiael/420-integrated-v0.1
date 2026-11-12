import { normalizeAddress, ZERO_ADDRESS } from './abi.js';
import { readDeployedSmartAccountState } from './accounts.js';
import { summarizeRecoveryState } from './recovery.js';

const SELECTOR_SET_RECOVERY_AUTHORITY = '67bdcc3f';
const SELECTOR_PROPOSE_RECOVERY = '7ee76082';
const SELECTOR_CANCEL_RECOVERY = '0ba234d6';
const SELECTOR_FINALIZE_RECOVERY = 'e2ccb305';

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

function addressWord(value) {
  return normalizeAddress(value).slice(2).padStart(64, '0');
}

function assertDeployed(state) {
  if (!state?.deployed) throw new Error('SmartAccount420 must be deployed before recovery management');
  return normalizeAddress(state.smartAccount);
}

function assertOwnerActor(state, actor) {
  const connected = normalizeAddress(actor);
  const owner = normalizeAddress(state?.owner);
  if (!state?.controllerIsOwner || connected !== owner) throw new Error('connected account is not the on-chain SmartAccount420 owner');
  return connected;
}

function assertRecoveryActor(state, actor) {
  const connected = normalizeAddress(actor);
  const authority = normalizeAddress(state?.recoveryAuthority || ZERO_ADDRESS);
  if (authority === ZERO_ADDRESS || connected !== authority) throw new Error('connected account is not the configured recovery authority');
  return connected;
}

async function simulateRecoveryTransaction(provider, from, to, data) {
  const transaction = { from, to, value: '0x0', data };
  try {
    await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`SmartAccount420 recovery simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`SmartAccount420 recovery gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid recovery gas estimate');
  return { transaction, gas: gas.toLowerCase() };
}

async function submitRecoveryTransaction(provider, prepared) {
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

async function waitForReceipt(provider, txHash, options = {}) {
  const normalizedHash = normalizeTxHash(txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let i = 0; i < attempts; i += 1) {
    const receipt = await provider.request('eth_getTransactionReceipt', [normalizedHash]);
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error('SmartAccount420 recovery transaction reverted');
      return { txHash: normalizedHash, receipt };
    }
    if (i + 1 < attempts) await sleep(delayMs);
  }
  throw new Error('SmartAccount420 recovery transaction was not confirmed');
}

export async function prepareSetRecoveryAuthority(provider, actor, smartAccountState, newAuthority) {
  const account = assertDeployed(smartAccountState);
  const from = assertOwnerActor(smartAccountState, actor);
  const authority = normalizeAddress(newAuthority);
  if (authority === normalizeAddress(smartAccountState.recoveryAuthority || ZERO_ADDRESS)) throw new Error('new recovery authority must differ from current authority');
  const data = `0x${SELECTOR_SET_RECOVERY_AUTHORITY}${addressWord(authority)}`;
  const simulation = await simulateRecoveryTransaction(provider, from, account, data);
  return { action: 'setRecoveryAuthority', actor: from, smartAccount: account, newAuthority: authority, before: smartAccountState, ...simulation };
}

export async function sendSetRecoveryAuthority(provider, actor, smartAccountState, newAuthority) {
  return submitRecoveryTransaction(provider, await prepareSetRecoveryAuthority(provider, actor, smartAccountState, newAuthority));
}

export async function confirmSetRecoveryAuthority(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount, { controller: prepared.actor });
  if (after.owner !== normalizeAddress(prepared.before.owner)) throw new Error('owner changed during recovery authority update');
  if (after.recoveryAuthority !== prepared.newAuthority) throw new Error('recovery authority post-confirmation verification failed');
  if (after.pendingRecoveryOwner !== ZERO_ADDRESS || after.recoveryExecutableAt !== 0n) throw new Error('recovery authority update did not clear pending recovery state');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch)) throw new Error('authorization epoch changed during recovery authority update');
  return { ...confirmation, smartAccount: after };
}

export async function prepareProposeRecovery(provider, actor, smartAccountState, newOwner) {
  const account = assertDeployed(smartAccountState);
  const from = assertRecoveryActor(smartAccountState, actor);
  const summary = summarizeRecoveryState(smartAccountState);
  if (summary.state !== 'idle') throw new Error('recovery proposal requires idle recovery state');
  const owner = normalizeAddress(newOwner);
  if (owner === ZERO_ADDRESS || owner === normalizeAddress(smartAccountState.owner)) throw new Error('invalid recovery owner');
  const data = `0x${SELECTOR_PROPOSE_RECOVERY}${addressWord(owner)}`;
  const simulation = await simulateRecoveryTransaction(provider, from, account, data);
  return { action: 'proposeRecovery', actor: from, smartAccount: account, newOwner: owner, before: smartAccountState, ...simulation };
}

export async function sendProposeRecovery(provider, actor, smartAccountState, newOwner) {
  return submitRecoveryTransaction(provider, await prepareProposeRecovery(provider, actor, smartAccountState, newOwner));
}

export async function confirmProposeRecovery(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount);
  if (after.owner !== normalizeAddress(prepared.before.owner)) throw new Error('owner changed while proposing recovery');
  if (after.recoveryAuthority !== normalizeAddress(prepared.before.recoveryAuthority)) throw new Error('recovery authority changed while proposing recovery');
  if (after.pendingRecoveryOwner !== prepared.newOwner || after.recoveryExecutableAt === 0n) throw new Error('recovery proposal post-confirmation verification failed');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch)) throw new Error('authorization epoch changed while proposing recovery');
  return { ...confirmation, smartAccount: after };
}

export async function prepareCancelRecovery(provider, actor, smartAccountState) {
  const account = assertDeployed(smartAccountState);
  const from = assertOwnerActor(smartAccountState, actor);
  const summary = summarizeRecoveryState(smartAccountState);
  if (summary.state !== 'pending' && summary.state !== 'ready') throw new Error('no pending recovery exists to cancel');
  const data = `0x${SELECTOR_CANCEL_RECOVERY}`;
  const simulation = await simulateRecoveryTransaction(provider, from, account, data);
  return { action: 'cancelRecovery', actor: from, smartAccount: account, before: smartAccountState, ...simulation };
}

export async function sendCancelRecovery(provider, actor, smartAccountState) {
  return submitRecoveryTransaction(provider, await prepareCancelRecovery(provider, actor, smartAccountState));
}

export async function confirmCancelRecovery(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount, { controller: prepared.actor });
  if (after.owner !== normalizeAddress(prepared.before.owner)) throw new Error('owner changed while cancelling recovery');
  if (after.pendingRecoveryOwner !== ZERO_ADDRESS || after.recoveryExecutableAt !== 0n) throw new Error('recovery cancellation post-confirmation verification failed');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch)) throw new Error('authorization epoch changed while cancelling recovery');
  return { ...confirmation, smartAccount: after };
}

export async function prepareFinalizeRecovery(provider, actor, smartAccountState, nowSeconds = Math.floor(Date.now() / 1000)) {
  const account = assertDeployed(smartAccountState);
  const from = assertRecoveryActor(smartAccountState, actor);
  const summary = summarizeRecoveryState(smartAccountState, nowSeconds);
  if (summary.state !== 'ready' || !summary.pendingOwner) throw new Error('recovery is not ready to finalize');
  const data = `0x${SELECTOR_FINALIZE_RECOVERY}`;
  const simulation = await simulateRecoveryTransaction(provider, from, account, data);
  return { action: 'finalizeRecovery', actor: from, smartAccount: account, expectedOwner: summary.pendingOwner, before: smartAccountState, ...simulation };
}

export async function sendFinalizeRecovery(provider, actor, smartAccountState, nowSeconds = Math.floor(Date.now() / 1000)) {
  return submitRecoveryTransaction(provider, await prepareFinalizeRecovery(provider, actor, smartAccountState, nowSeconds));
}

export async function confirmFinalizeRecovery(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount);
  if (after.owner !== prepared.expectedOwner) throw new Error('recovered owner post-confirmation verification failed');
  if (after.recoveryAuthority !== normalizeAddress(prepared.before.recoveryAuthority)) throw new Error('recovery authority changed during recovery finalization');
  if (after.pendingRecoveryOwner !== ZERO_ADDRESS || after.recoveryExecutableAt !== 0n) throw new Error('finalized recovery did not clear pending state');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch) + 1n) throw new Error('recovery finalization did not advance authorization epoch');
  return { ...confirmation, smartAccount: after };
}
