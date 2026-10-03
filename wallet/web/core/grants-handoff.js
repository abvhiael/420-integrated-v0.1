import { prepareSmartAccountExecution } from './execution.js';

export const GRANTS_SERVICE_ID_420 = '420/service/grants/v1';

export async function prepareGrantsSmartAccountHandoff420(
  provider,
  controller,
  smartAccountState,
  request = {}
) {
  if (request.serviceId !== GRANTS_SERVICE_ID_420) {
    throw new Error('canonical 420Grants service id required');
  }
  const value = request.value ?? 0n;
  if (BigInt(value) !== 0n) {
    throw new Error('420Grants transaction handoff must not transfer native value');
  }
  if (!request.target) throw new Error('420Grants target required');
  if (!request.data || request.data === '0x') throw new Error('420Grants calldata required');

  const prepared = await prepareSmartAccountExecution(provider, controller, smartAccountState, {
    target: request.target,
    value: 0n,
    data: request.data,
  });
  return {
    serviceId: GRANTS_SERVICE_ID_420,
    authority: 'SmartAccount420',
    ...prepared,
  };
}
