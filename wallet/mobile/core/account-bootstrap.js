import { createMobileProvider420 } from './runtime-adapter.js';
import { discoverSmartAccount } from '../../web/core/accounts.js';
import { prepareSmartAccountCreation, confirmSmartAccountCreation } from '../../web/core/deployment.js';

function assertRuntime(runtime) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (typeof runtime.transaction?.submit !== 'function') throw new Error('native transaction submission capability required');
  return runtime;
}

export async function discoverMobileSmartAccount420({ runtime, controller, config = {} } = {}) {
  assertRuntime(runtime);
  return discoverSmartAccount(createMobileProvider420(runtime), controller, config);
}

export async function prepareMobileSmartAccountCreation420({ runtime, controller, config = {} } = {}) {
  assertRuntime(runtime);
  const provider = createMobileProvider420(runtime);
  const prepared = await prepareSmartAccountCreation(provider, controller, config);
  if (prepared.alreadyDeployed) {
    return Object.freeze({ ...prepared, simulationPassed: true, gasEstimate: null, broadcastReady: false });
  }

  let simulation;
  try {
    simulation = await provider.request('eth_call', [prepared.transaction, 'latest']);
  } catch (error) {
    throw new Error(`SmartAccount420 creation simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  let gasEstimate;
  try {
    gasEstimate = await provider.request('eth_estimateGas', [prepared.transaction]);
  } catch (error) {
    throw new Error(`SmartAccount420 creation gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gasEstimate !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gasEstimate)) throw new Error('invalid SmartAccount420 creation gas estimate');

  return Object.freeze({ ...prepared, simulationResult: simulation, simulationPassed: true, gasEstimate: gasEstimate.toLowerCase(), broadcastReady: true });
}

export async function sendMobileSmartAccountCreation420({ runtime, prepared } = {}) {
  assertRuntime(runtime);
  if (!prepared || prepared.alreadyDeployed) return Object.freeze({ ...prepared, submitted: false, txHash: null });
  if (!prepared.broadcastReady || !prepared.simulationPassed) throw new Error('qualified mobile SmartAccount420 creation required');
  const txHash = await runtime.transaction.submit(prepared.transaction);
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('invalid transaction hash');
  return Object.freeze({ ...prepared, submitted: true, txHash: txHash.toLowerCase() });
}

export async function confirmMobileSmartAccountCreation420({ runtime, submitted, controller, config = {}, options = {} } = {}) {
  assertRuntime(runtime);
  if (!submitted?.submitted || !submitted.txHash) throw new Error('submitted mobile SmartAccount420 creation required');
  return confirmSmartAccountCreation(createMobileProvider420(runtime), submitted.txHash, controller, config, options);
}
