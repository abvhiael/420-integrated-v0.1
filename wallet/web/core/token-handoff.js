import { prepareSmartAccountExecution } from './execution.js';
import {
  TOKEN_CREATION_FEE_WEI_420,
  TOKEN_SERVICE_ID_420,
  tokenFactoryTarget420,
  validateTokenRuntime420,
} from './token-runtime.js';

export async function prepareTokenDeploymentHandoff420(provider, controller, smartAccountState, runtimeBinding, request = {}) {
  const runtime = validateTokenRuntime420(runtimeBinding);
  if (request.serviceId !== TOKEN_SERVICE_ID_420) throw new Error('canonical 420Token service id required');
  if (!request.target || request.target.toLowerCase() !== tokenFactoryTarget420(runtime).toLowerCase()) {
    throw new Error('verified 420Token factory target required');
  }
  const value = BigInt(request.value ?? -1);
  if (value !== TOKEN_CREATION_FEE_WEI_420) throw new Error('420Token deployment requires exactly 42 native 420');
  if (!request.data || request.data === '0x') throw new Error('420Token factory calldata required');

  const prepared = await prepareSmartAccountExecution(provider, controller, smartAccountState, {
    target: runtime.factory.address,
    value,
    data: request.data,
  });
  return {
    serviceId: TOKEN_SERVICE_ID_420,
    authority: 'SmartAccount420',
    templateRegistry: runtime.templateRegistry.address,
    communityTreasuryVault: runtime.communityTreasuryVault.address,
    ...prepared,
  };
}
