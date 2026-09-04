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

export async function readDeployedSmartAccountState(provider, smartAccount, metadata = {}) {
  const account = normalizeAddress(smartAccount);
  if (!(await hasCode(provider, account))) throw new Error('SmartAccount420 is not deployed at the expected address');

  const [owner, recoveryAuthority, authorizationEpoch, authorizationPolicyVersion, pendingRecoveryOwner, recoveryExecutableAt, entryPoint, capabilityRegistry] = await Promise.all([
    call(provider, account, encodeAddressGetter('owner')).then(decodeAddress),
    call(provider, account, encodeAddressGetter('recoveryAuthority')).then(decodeAddress),
    call(provider, account, encodeUintGetter('authorizationEpoch')).then(decodeUint),
    call(provider, account, encodeUintGetter('authorizationPolicyVersion')).then(decodeUint),
    call(provider, account, encodeAddressGetter('pendingRecoveryOwner')).then(decodeAddress),
    call(provider, account, encodeUintGetter('recoveryExecutableAt')).then(decodeUint),
    call(provider, account, encodeAddressGetter('entryPoint')).then(decodeAddress),
    call(provider, account, encodeAddressGetter('capabilityRegistry')).then(decodeAddress),
  ]);

  const controller = metadata.controller ? normalizeAddress(metadata.controller) : null;
  return {
    ...metadata,
    controller,
    smartAccount: account,
    deployed: true,
    owner,
    controllerIsOwner: Boolean(controller && controller === owner),
    recoveryAuthority,
    authorizationEpoch,
    authorizationPolicyVersion,
    pendingRecoveryOwner,
    recoveryExecutableAt,
    entryPoint,
    capabilityRegistry,
  };
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

  return readDeployedSmartAccountState(provider, predicted, {
    controller: owner,
    factoryAddress,
    salt,
  });
}
