import type { Sdk420 } from './index.js';
import { createTreasuryClient420, type TreasuryClient420, type TreasuryProvider420 } from './treasury-runtime.js';
export type { TreasuryClient420, TreasuryProvider420, TreasuryDiscovery420, TreasuryDisbursement420, TreasuryGovernedInput420, TreasuryGovernedAction420, TreasuryReleaseReview420 } from './treasury-runtime.js';
export { TREASURY_SERVICE_ID_420, TREASURY_ROUTER_COMPONENT_420, TREASURY_CAPABILITY_COMPONENT_420, TREASURY_EXECUTION_ACTION_420, TREASURY_EVIDENCE_420 } from './treasury-runtime.js';
export function createTreasurySdk420(input:{sdk:Sdk420;provider:TreasuryProvider420;registryCodeHash:string;releaseExecutor?:{address:string;codeHash:string}|null}):TreasuryClient420 {
  const registry=input.sdk.contract('ProtocolRegistry');
  if (!registry || registry.verified!==true || registry.address.toLowerCase()!=='0x0000000000000000000000000000000000000434' ||
      input.sdk.contracts.chainId!==input.sdk.network.chainId) throw new Error('canonical Treasury Registry and network required');
  return createTreasuryClient420({provider:input.provider,chainId:'0x'+input.sdk.network.chainId.toString(16),registryCodeHash:input.registryCodeHash,releaseExecutor:input.releaseExecutor??null});
}

export * from './treasury-projection.js';
