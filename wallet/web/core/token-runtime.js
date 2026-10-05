export const TOKEN_SERVICE_ID_420 = '420/service/token/v1';
export const TOKEN_CREATION_FEE_WEI_420 = 42n * 10n ** 18n;
export const TOKEN_COMMUNITY_VAULT_ID_420 = '420/treasury/vault/token-creation-community-revenue/v1';

function isAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}

function isHash(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) && !/^0x0{64}$/.test(value);
}

function verifiedContract(item, label) {
  if (!item || !isAddress(item.address) || !isHash(item.codeHash)) throw new Error(`unverified 420Token dependency: ${label}`);
  return Object.freeze({...item});
}

export function validateTokenRuntime420(binding) {
  if (!binding || binding.serviceId !== TOKEN_SERVICE_ID_420) throw new Error('canonical 420Token service id required');
  if (!Number.isInteger(binding.chainId) || binding.chainId <= 0) throw new Error('invalid 420Token chain id');
  if (!Number.isInteger(binding.version) || binding.version !== 1) throw new Error('unsupported 420Token service version');
  if (binding.communityTreasuryVaultId !== TOKEN_COMMUNITY_VAULT_ID_420) throw new Error('canonical 420Token community Treasury vault id required');

  const factory = verifiedContract(binding.factory, 'factory');
  const templates = verifiedContract(binding.templateRegistry, 'template registry');
  const vault = verifiedContract(binding.communityTreasuryVault, 'community Treasury vault');
  const identities = [factory.address, templates.address, vault.address].map((x) => x.toLowerCase());
  if (new Set(identities).size !== identities.length) throw new Error('420Token dependency alias');

  return Object.freeze({
    serviceId: binding.serviceId,
    chainId: binding.chainId,
    version: binding.version,
    factory,
    templateRegistry: templates,
    communityTreasuryVault: vault,
    communityTreasuryVaultId: binding.communityTreasuryVaultId,
  });
}

export function tokenFactoryTarget420(runtime) {
  return validateTokenRuntime420(runtime).factory.address;
}
