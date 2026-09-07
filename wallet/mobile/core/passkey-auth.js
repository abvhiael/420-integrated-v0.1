import { normalizeAddress } from '../../web/core/abi.js';
import { preparePasskeyUserOperationTransport, sendPreparedPasskeyUserOperation } from '../../web/core/passkey-entrypoint-transport.js';

function assertBinding(binding) {
  if (!binding || typeof binding !== 'object') throw new TypeError('passkey binding required');
  if (typeof binding.credentialId !== 'string' || !binding.credentialId) throw new TypeError('passkey credential id required');
  if (typeof binding.credentialIdHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(binding.credentialIdHash)) {
    throw new TypeError('passkey credential id hash required');
  }
  if (typeof binding.rpId !== 'string' || !binding.rpId) throw new TypeError('passkey rpId required');
  if (typeof binding.origin !== 'string' || !/^https:\/\//i.test(binding.origin)) throw new TypeError('https passkey origin required');
  return binding;
}

function createNavigatorLike(adapter) {
  if (!adapter?.passkeys || typeof adapter.passkeys.get !== 'function') throw new Error('mobile passkey capability required');
  return {
    credentials: {
      async get(options) {
        const credential = await adapter.passkeys.get(options);
        if (!credential || typeof credential !== 'object') throw new Error('native passkey assertion unavailable');
        return credential;
      },
    },
  };
}

export async function prepareMobilePasskeyExecution420({
  runtime,
  smartAccountState,
  binding,
  request,
  rpId,
  origin,
  timeout,
} = {}) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (!smartAccountState?.deployed) throw new Error('deployed SmartAccount420 required');
  assertBinding(binding);

  const prepared = await preparePasskeyUserOperationTransport(
    runtime,
    createNavigatorLike(runtime),
    smartAccountState,
    binding,
    request,
    {
      rpId: rpId ?? binding.rpId,
      origin: origin ?? binding.origin,
      timeout,
    },
  );

  if (prepared.signerType !== 'passkey' || !prepared.broadcastReady || !prepared.entryPointSimulation?.simulationPassed) {
    throw new Error('mobile passkey execution did not qualify for broadcast');
  }
  if (normalizeAddress(prepared.smartAccount) !== normalizeAddress(smartAccountState.smartAccount)) {
    throw new Error('mobile passkey execution SmartAccount mismatch');
  }
  if (prepared.advancedBinding?.credentialId !== binding.credentialId) {
    throw new Error('mobile passkey credential binding changed unexpectedly');
  }

  return prepared;
}

export async function sendMobilePasskeyExecution420({ runtime, prepared, transactionSender = null } = {}) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (!prepared || prepared.signerType !== 'passkey') throw new Error('prepared mobile passkey execution required');
  return sendPreparedPasskeyUserOperation(runtime, prepared, transactionSender);
}
