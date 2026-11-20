import { prepareSmartAccountExecution } from './execution.js';
import { encodeTokenCreation420, readTokenRecord420, validateTokenCreationEncoding420, TOKEN_MAX_CALLDATA_BYTES_420 } from './token-sdk.js';
import { TOKEN_CREATION_FEE_WEI_420, TOKEN_SERVICE_ID_420, validateTokenRuntime420,
  normalizeTokenReleaseBinding420, verifyTokenRuntime420 } from './token-runtime.js';

// Build an immutable, reviewable draft. This does NOT authorize it or verify chain state.
export function buildTokenDeploymentRequest420(runtimeBinding, draft) {
  const runtime = validateTokenRuntime420(runtimeBinding);
  const creation = encodeTokenCreation420(draft);
  return Object.freeze({serviceId:TOKEN_SERVICE_ID_420, target:runtime.factory.address,
    value:TOKEN_CREATION_FEE_WEI_420, data:creation.data, draft:creation.draft,
    templateId:creation.template.id, configHash:creation.configHash, calldataHash:creation.calldataHash});
}

export async function prepareTokenDeploymentHandoff420(provider, controller, smartAccountState, runtimeBinding, request = {}) {
  const runtime = validateTokenRuntime420(runtimeBinding);
  request=readTokenRecord420(request,['serviceId','target','value','data','draft','templateId','configHash','calldataHash'],'Token deployment request');
  if (request.serviceId !== TOKEN_SERVICE_ID_420) throw Error('canonical 420Token service id required');
  if (typeof request.target !== 'string' || request.target.toLowerCase() !== runtime.factory.address)
    throw Error('verified 420Token factory target required');
  let value;
  try {
    if (typeof request.value !== 'bigint' && !(typeof request.value === 'string' && request.value.length<=78 && /^(0|[1-9][0-9]*|0x[0-9a-fA-F]+)$/.test(request.value))) throw Error('inexact value');
    value = BigInt(request.value);
  } catch { throw Error('420Token deployment requires exactly 42 native 420'); }
  if (value !== TOKEN_CREATION_FEE_WEI_420) throw Error('420Token deployment requires exactly 42 native 420');
  if (typeof request.data !== 'string' || request.data.length>2+TOKEN_MAX_CALLDATA_BYTES_420*2 || !/^0x(?:[0-9a-fA-F]{2})+$/.test(request.data))
    throw Error('420Token factory calldata required');
  const creation = validateTokenCreationEncoding420(request.draft,{data:request.data,
    templateId:request.templateId,configHash:request.configHash,calldataHash:request.calldataHash});
  if (smartAccountState?.expectedChainId != null && BigInt(smartAccountState.expectedChainId) !== BigInt(runtime.chainId))
    throw Error('SmartAccount420 chain differs from Token runtime');
  // Copy/freeze approved configuration before the first await. Do not trust mutable input objects.
  const binding = normalizeTokenReleaseBinding420(runtimeBinding);
  const accountState = Object.freeze({...smartAccountState});
  const before = await verifyTokenRuntime420(provider,binding);
  if (!before.templates.find(t=>t.id===creation.template.id)?.enabled) throw Error('Token template disabled');
  const prepared = await prepareSmartAccountExecution(provider, controller, accountState, {
    target:runtime.factory.address, value, data:creation.data, expectedChainId:runtime.chainId,
  });
  const after = await verifyTokenRuntime420(provider,binding);
  if (!after.templates.find(t=>t.id===creation.template.id)?.enabled) throw Error('Token template disabled during simulation');
  return Object.freeze({...prepared, transaction:Object.freeze({...prepared.transaction}),
    simulation:Object.freeze({...prepared.simulation}),
    serviceId:TOKEN_SERVICE_ID_420, authority:'SmartAccount420', templateRegistry:runtime.templateRegistry.address,
    communityTreasuryVault:runtime.communityTreasuryVault.address, expectedChainId:runtime.chainId,
    draft:creation.draft, template:creation.template, configHash:creation.configHash, calldataHash:creation.calldataHash,
    verificationBlock:after.verificationBlock, release:after.release, confirmationRequired:true});
}
