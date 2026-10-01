import { normalizeAddress, normalizeBytes32, ZERO_ADDRESS, ZERO_BYTES32 } from './abi.js';
import { keccak256Hex } from './keccak.js';
import { createNames420Client, hash420Label } from './names-client.js';
import { normalize420Name } from './names-send.js';

const textBytes = (text) => new TextEncoder().encode(text);
const selector = (signature) => keccak256Hex(textBytes(signature)).slice(2, 10);
const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const uintWord = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => word(normalizeAddress(value));
const bytes32Word = (value) => normalizeBytes32(value).slice(2);
const boolWord = (value) => uintWord(value ? 1 : 0);

const SELECTORS = Object.freeze({
  makeCommitment: selector('makeCommitment(bytes32,uint8,address,uint64,bytes32,address)'),
  commit: selector('commit(bytes32)'),
  register: selector('register(bytes32,uint8,address,uint64,bytes32)'),
  renew: selector('renew(bytes32,uint64)'),
  setResolution: selector('setResolution(bytes32,address,bytes32,bytes32)'),
  setReverseName: selector('setReverseName(bytes32)'),
  transferName: selector('transferName(bytes32,address)'),
  acceptName: selector('acceptName(bytes32)'),
  commitments: selector('commitments(bytes32)'),
  isAvailable: selector('isAvailable(bytes32)'),
  minCommitmentAge: selector('MIN_COMMITMENT_AGE()'),
  maxCommitmentAge: selector('MAX_COMMITMENT_AGE()'),
  minRegistrationPeriod: selector('MIN_REGISTRATION_PERIOD()'),
  maxRegistrationPeriod: selector('MAX_REGISTRATION_PERIOD()'),
});

function checkedChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('420 Names requires a verified chain ID');
  return BigInt(value);
}

function decodeWord(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid 420 Names ${label} response`);
  return result.toLowerCase();
}

function decodeUint(result, bits = 256) {
  const value = BigInt(decodeWord(result, 'uint'));
  if (value >= (1n << BigInt(bits))) throw new Error('invalid 420 Names integer response');
  return value;
}

function decodeBool(result) {
  const value = decodeUint(result, 8);
  if (value !== 0n && value !== 1n) throw new Error('invalid 420 Names boolean response');
  return value === 1n;
}

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

function normalizeDuration(value) {
  let duration;
  try { duration = BigInt(value); } catch { throw new Error('registration duration must be an integer number of seconds'); }
  if (duration < 0n || duration >= (1n << 64n)) throw new Error('registration duration out of uint64 range');
  return duration;
}

function normalizeSalt(value) {
  const salt = normalizeBytes32(value);
  if (salt === ZERO_BYTES32) throw new Error('registration salt must not be zero');
  return salt;
}

function normalizeReference(value, label) {
  if (value == null || value === '') return ZERO_BYTES32;
  try { return normalizeBytes32(value); } catch { throw new Error(`${label} must be bytes32`); }
}

function errorMessage(error) {
  return String(error?.message || error || 'unknown 420 Names error');
}

export function classifyNames420Error(error) {
  const message = errorMessage(error);
  const lower = message.toLowerCase();
  if (error?.code === 4001 || lower.includes('user rejected')) {
    return Object.freeze({ code: 'USER_REJECTED', retryable: true, message: 'Wallet approval was rejected. Review the transaction and try again.' });
  }
  if (lower.includes('chain changed') || lower.includes('wrong network') || lower.includes('verified chain')) {
    return Object.freeze({ code: 'NETWORK_CHANGED', retryable: true, message: 'The connected network changed. Switch back to the qualified 420 network and reload Names state.' });
  }
  if (lower.includes('account changed') || lower.includes('connected 420 names account')) {
    return Object.freeze({ code: 'ACCOUNT_CHANGED', retryable: true, message: 'The connected account changed. Reload the name before submitting another transaction.' });
  }
  if (lower.includes('commitment is not ready')) {
    return Object.freeze({ code: 'COMMITMENT_TOO_NEW', retryable: true, message });
  }
  if (lower.includes('commitment expired')) {
    return Object.freeze({ code: 'COMMITMENT_EXPIRED', retryable: true, message: 'The commitment expired. Submit a fresh commitment before registering.' });
  }
  if (lower.includes('simulation reverted') || lower.includes('gas estimation failed')) {
    return Object.freeze({ code: 'SIMULATION_FAILED', retryable: true, message: `Transaction preflight failed: ${message}` });
  }
  if (lower.includes('not confirmed')) {
    return Object.freeze({ code: 'CONFIRMATION_TIMEOUT', retryable: true, message });
  }
  if (lower.includes('reverted')) {
    return Object.freeze({ code: 'TRANSACTION_REVERTED', retryable: true, message });
  }
  return Object.freeze({ code: 'NAMES_ERROR', retryable: true, message });
}

export function randomNames420Salt(cryptoLike = globalThis.crypto) {
  if (!cryptoLike || typeof cryptoLike.getRandomValues !== 'function') throw new Error('secure randomness unavailable for registration salt');
  const bytes = new Uint8Array(32);
  cryptoLike.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createNames420ManagementClient({ provider, namesAddress, chainId, account }) {
  if (!provider || typeof provider.request !== 'function') throw new Error('420 Names RPC unavailable');
  const contract = normalizeAddress(namesAddress);
  if (contract === ZERO_ADDRESS) throw new Error('420 Names contract unavailable');
  const actor = normalizeAddress(account);
  const expectedChain = checkedChainId(chainId);
  const reader = createNames420Client({ provider, namesAddress: contract, chainId });

  const request = (method, params = []) => provider.request(method, params);

  async function verifySession() {
    if (checkedChainId(await request('eth_chainId')) !== expectedChain) throw new Error('420 Names chain changed');
    const accounts = await request('eth_accounts');
    if (!Array.isArray(accounts) || !accounts.some((value) => {
      try { return normalizeAddress(value) === actor; } catch { return false; }
    })) {
      throw new Error('connected 420 Names account changed');
    }
    await reader.verifyContract();
  }

  async function call(data, from = actor) {
    await verifySession();
    const result = await request('eth_call', [{ from, to: contract, data }, 'latest']);
    await verifySession();
    return result;
  }

  async function simulate(data) {
    const transaction = { from: actor, to: contract, value: '0x0', data };
    await verifySession();
    let result;
    try {
      result = await request('eth_call', [transaction, 'latest']);
    } catch (error) {
      throw new Error(`420 Names simulation reverted: ${errorMessage(error)}`);
    }
    let gas;
    try {
      gas = await request('eth_estimateGas', [transaction]);
    } catch (error) {
      throw new Error(`420 Names gas estimation failed: ${errorMessage(error)}`);
    }
    if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid 420 Names gas estimate');
    await verifySession();
    return Object.freeze({ transaction, simulation: Object.freeze({ passed: true, result, gas: gas.toLowerCase() }) });
  }

  async function submit(data) {
    const prepared = await simulate(data);
    await verifySession();
    const txHash = normalizeTxHash(await request('eth_sendTransaction', [prepared.transaction]));
    return Object.freeze({ ...prepared, txHash, submitted: true });
  }

  async function confirm(txHash, options = {}) {
    const normalizedHash = normalizeTxHash(txHash);
    const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
    const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
    const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    let receipt = null;
    for (let i = 0; i < attempts; i += 1) {
      receipt = await request('eth_getTransactionReceipt', [normalizedHash]);
      if (receipt) break;
      if (i + 1 < attempts) await sleep(delayMs);
    }
    if (!receipt) throw new Error('420 Names transaction was not confirmed');
    if (receipt.status !== '0x1') throw new Error('420 Names transaction reverted');
    await verifySession();
    return Object.freeze({ txHash: normalizedHash, receipt });
  }

  async function protocolLimits() {
    const [minAge, maxAge, minPeriod, maxPeriod] = await Promise.all([
      call(`0x${SELECTORS.minCommitmentAge}`),
      call(`0x${SELECTORS.maxCommitmentAge}`),
      call(`0x${SELECTORS.minRegistrationPeriod}`),
      call(`0x${SELECTORS.maxRegistrationPeriod}`),
    ]);
    return Object.freeze({
      minCommitmentAge: decodeUint(minAge, 64),
      maxCommitmentAge: decodeUint(maxAge, 64),
      minRegistrationPeriod: decodeUint(minPeriod, 64),
      maxRegistrationPeriod: decodeUint(maxPeriod, 64),
    });
  }

  async function assertDuration(duration) {
    const value = normalizeDuration(duration);
    const limits = await protocolLimits();
    if (value < limits.minRegistrationPeriod || value > limits.maxRegistrationPeriod) {
      throw new Error(`registration duration must be between ${limits.minRegistrationPeriod} and ${limits.maxRegistrationPeriod} seconds`);
    }
    return { value, limits };
  }

  async function makeCommitment({ name, durationSeconds, salt }) {
    const normalizedName = normalize420Name(name);
    const labelHash = hash420Label(normalizedName);
    const labelLength = normalizedName.slice(0, -4).length;
    const normalizedSalt = normalizeSalt(salt);
    const { value: duration, limits } = await assertDuration(durationSeconds);
    const data = `0x${SELECTORS.makeCommitment}${bytes32Word(labelHash)}${uintWord(labelLength)}${addressWord(actor)}${uintWord(duration)}${bytes32Word(normalizedSalt)}${addressWord(actor)}`;
    const commitment = decodeWord(await call(data), 'commitment');
    if (commitment === ZERO_BYTES32) throw new Error('420 Names commitment calculation failed');
    return Object.freeze({ name: normalizedName, labelHash, labelLength, owner: actor, duration, salt: normalizedSalt, commitment, limits });
  }

  async function commitmentState(input) {
    const prepared = await makeCommitment(input);
    const raw = await call(`0x${SELECTORS.commitments}${bytes32Word(prepared.commitment)}`);
    const committedAt = decodeUint(raw, 64);
    const now = BigInt(await reader.chainTime());
    const revealAfter = committedAt === 0n ? 0n : committedAt + prepared.limits.minCommitmentAge;
    const revealBefore = committedAt === 0n ? 0n : committedAt + prepared.limits.maxCommitmentAge;
    return Object.freeze({
      ...prepared,
      committedAt,
      now,
      revealAfter,
      revealBefore,
      ready: committedAt !== 0n && now >= revealAfter && now <= revealBefore,
      expired: committedAt !== 0n && now > revealBefore,
    });
  }

  async function availability(name) {
    const normalizedName = normalize420Name(name);
    const labelHash = hash420Label(normalizedName);
    const raw = await call(`0x${SELECTORS.isAvailable}${bytes32Word(labelHash)}`);
    return Object.freeze({ name: normalizedName, labelHash, available: decodeBool(raw) });
  }

  async function sendCommit(input) {
    const prepared = await makeCommitment(input);
    const available = await availability(prepared.name);
    if (!available.available) throw new Error('420 Name is not currently available');
    const submitted = await submit(`0x${SELECTORS.commit}${bytes32Word(prepared.commitment)}`);
    return Object.freeze({ ...prepared, ...submitted, stage: 'commit-submitted' });
  }

  async function sendRegister(input) {
    const state = await commitmentState(input);
    if (state.committedAt === 0n) throw new Error('registration commitment is missing; submit the commitment first');
    if (state.expired) throw new Error('registration commitment expired');
    if (!state.ready) throw new Error(`registration commitment is not ready until chain time ${state.revealAfter}`);
    const available = await availability(state.name);
    if (!available.available) throw new Error('420 Name is not currently available');
    const data = `0x${SELECTORS.register}${bytes32Word(state.labelHash)}${uintWord(state.labelLength)}${addressWord(actor)}${uintWord(state.duration)}${bytes32Word(state.salt)}`;
    const submitted = await submit(data);
    return Object.freeze({ ...state, ...submitted, stage: 'register-submitted' });
  }

  async function ownedRecord(name) {
    const resolved = await reader.lookup(name);
    if (normalizeAddress(resolved.record.owner) !== actor) throw new Error('connected account is not the current 420 Name owner');
    return resolved;
  }

  async function sendRenew({ name, durationSeconds }) {
    const resolved = await ownedRecord(name);
    const { value: duration } = await assertDuration(durationSeconds);
    const data = `0x${SELECTORS.renew}${bytes32Word(resolved.labelHash)}${uintWord(duration)}`;
    return Object.freeze({ name: normalize420Name(name), labelHash: resolved.labelHash, duration, ...(await submit(data)), stage: 'renew-submitted' });
  }

  async function sendResolution({ name, resolvedAddress, profileId = ZERO_BYTES32, serviceId = ZERO_BYTES32 }) {
    const resolved = await ownedRecord(name);
    const target = normalizeAddress(resolvedAddress);
    const profile = normalizeReference(profileId, 'profileId');
    const service = normalizeReference(serviceId, 'serviceId');
    const data = `0x${SELECTORS.setResolution}${bytes32Word(resolved.labelHash)}${addressWord(target)}${bytes32Word(profile)}${bytes32Word(service)}`;
    return Object.freeze({ name: normalize420Name(name), labelHash: resolved.labelHash, resolvedAddress: target, profileId: profile, serviceId: service, ...(await submit(data)), stage: 'resolution-submitted' });
  }

  async function sendReverse({ name }) {
    const resolved = await reader.lookup(name);
    if (normalizeAddress(resolved.record.resolvedAddress) !== actor) throw new Error('connected account is not the current forward-resolution target');
    const data = `0x${SELECTORS.setReverseName}${bytes32Word(resolved.labelHash)}`;
    return Object.freeze({ name: normalize420Name(name), labelHash: resolved.labelHash, ...(await submit(data)), stage: 'reverse-submitted' });
  }

  async function sendTransfer({ name, newOwner }) {
    const resolved = await ownedRecord(name);
    const target = normalizeAddress(newOwner);
    if (target === actor || target === ZERO_ADDRESS) throw new Error('new owner must be a different nonzero address');
    const data = `0x${SELECTORS.transferName}${bytes32Word(resolved.labelHash)}${addressWord(target)}`;
    return Object.freeze({ name: normalize420Name(name), labelHash: resolved.labelHash, newOwner: target, ...(await submit(data)), stage: 'transfer-submitted' });
  }

  async function sendAccept({ name }) {
    const resolved = await reader.lookup(name);
    if (normalizeAddress(resolved.record.pendingOwner) !== actor) throw new Error('connected account is not the pending 420 Name owner');
    const data = `0x${SELECTORS.acceptName}${bytes32Word(resolved.labelHash)}`;
    return Object.freeze({ name: normalize420Name(name), labelHash: resolved.labelHash, ...(await submit(data)), stage: 'accept-submitted' });
  }

  return Object.freeze({
    account: actor,
    namesAddress: contract,
    reader,
    verifySession,
    protocolLimits,
    availability,
    makeCommitment,
    commitmentState,
    sendCommit,
    sendRegister,
    sendRenew,
    sendResolution,
    sendReverse,
    sendTransfer,
    sendAccept,
    confirm,
  });
}
