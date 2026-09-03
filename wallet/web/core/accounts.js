import {
  ZERO_ADDRESS,
  ZERO_BYTES32,
  decodeAddress,
  decodeUint,
  encodeAddressGetter,
  encodeGetAddress,
  encodeUintGetter,
  normalizeAddress,
  normalizeBytes32,
} from './abi.js';

async function call(provider, to, data) {
  return provider.request('eth_call', [{ to: normalizeAddress(to), data }, 'latest']);
}

export async function hasCode(provider, address) {
  const code = await provider.request('eth_getCode', [normalizeAddress(address), 'latest']);
  return typeof code === 'string' && code !== '0x' && !/^0x0*$/.test(code);
}

export async function discoverSmartAccount(provider, controller, config = {}) {
  const factoryAddress = normalizeAddress(config.factoryAddress);
  const owner = normalizeAddress(controller);
  const recoveryAuthority = normalizeAddress(config.recoveryAuthority || ZERO_ADDRESS);
  const salt = normalizeBytes32(config.salt || ZERO_BYTES32);

  if (!(await hasCode(provider, factoryAddress))) {
    throw new Error('canonical SmartAccountFactory420 is not deployed on this network');
  }

  const predicted = decodeAddress(await call(provider, factoryAddress, encodeGetAddress(owner, recoveryAuthority, salt)));
  const deployed = await hasCode(provider, predicted);

  if (!deployed) {
    return { controller: owner, factoryAddress, smartAccount: predicted, deployed: false, recoveryAuthority, salt };
  }

  const [accountOwner, onchainRecoveryAuthority, authorizationEpoch, authorizationPolicyVersion, pendingRecoveryOwner, recoveryExecutableAt, entryPoint, capabilityRegistry] = await Promise.all([
    call(provider, predicted, encodeAddressGetter('owner')).then(decodeAddress),
    call(provider, predicted, encodeAddressGetter('recoveryAuthority')).then(decodeAddress),
    call(provider, predicted, encodeUintGetter('authorizationEpoch')).then(decodeUint),
    call(provider, predicted, encodeUintGetter('authorizationPolicyVersion')).then(decodeUint),
    call(provider, predicted, encodeAddressGetter('pendingRecoveryOwner')).then(decodeAddress),
    call(provider, predicted, encodeUintGetter('recoveryExecutableAt')).then(decodeUint),
    call(provider, predicted, encodeAddressGetter('entryPoint')).then(decodeAddress),
    call(provider, predicted, encodeAddressGetter('capabilityRegistry')).then(decodeAddress),
  ]);

  return {
    controller: owner,
    factoryAddress,
    smartAccount: predicted,
    deployed: true,
    owner: accountOwner,
    controllerIsOwner: accountOwner === owner,
    recoveryAuthority: onchainRecoveryAuthority,
    authorizationEpoch,
    authorizationPolicyVersion,
    pendingRecoveryOwner,
    recoveryExecutableAt,
    entryPoint,
    capabilityRegistry,
    salt,
  };
}
