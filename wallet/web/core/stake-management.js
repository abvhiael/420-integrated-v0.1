import { normalizeAddress, normalizeBytes32, ZERO_ADDRESS, ZERO_BYTES32 } from './abi.js';
import { keccak256Hex } from './keccak.js';

const textBytes = (text) => new TextEncoder().encode(text);
const selector = (signature) => keccak256Hex(textBytes(signature)).slice(2, 10);
const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const uintWord = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => word(normalizeAddress(value));
const bytes32Word = (value) => normalizeBytes32(value).slice(2);

export const FROZEN_STAKE_ADDRESSES = Object.freeze({
  rewardController: '0x0000000000000000000000000000000000000420',
  validatorRegistry: '0x0000000000000000000000000000000000000423',
  stake420: '0x000000000000000000000000000000000000043a',
});

export const STAKE_STATUS = Object.freeze([
  'NONE','REGISTERED','PROBATION','ELIGIBLE','ACTIVE','NORMAL_COOLDOWN','SUSPENDED','EXITED','WITHDRAWAL_HOLD','WITHDRAWABLE',
]);

const SELECTORS = Object.freeze({
  stakeRegistry: selector('validatorRegistry()'),
  stakeRewards: selector('rewardController()'),
  effectiveBond: selector('effectiveBond()'),
  ownerValidatorId: selector('ownerValidatorId(address)'),
  pendingProtocolCredit: selector('pendingProtocolCredit(bytes32)'),
  pendingCreditBeneficiary: selector('pendingCreditBeneficiary(bytes32)'),
  getValidator: selector('getValidator(bytes32)'),
  validatorStatus: selector('validatorStatus(bytes32)'),
  bondComposition: selector('validatorBondComposition(bytes32)'),
  lifecycle: selector('validatorLifecycle(bytes32)'),
  rewardAccrued: selector('validatorRewardAccrued(bytes32)'),
  register: selector('register(bytes32,bytes,address,bytes32)'),
  topUp: selector('topUpOwnedBond(bytes32)'),
  replaceCredit: selector('replaceProtocolCredit(bytes32)'),
  withdraw: selector('withdrawBond(bytes32)'),
});

function checkedChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('420 Stake requires a verified chain ID');
  return BigInt(value);
}

function cleanResult(result, label) {
  if (typeof result !== 'string' || !/^0x(?:[0-9a-fA-F]{64})+$/.test(result)) throw new Error(`invalid 420 Stake ${label} response`);
  return result.slice(2).toLowerCase();
}
const words = (result, label) => {
  const hex = cleanResult(result, label);
  return Array.from({ length: hex.length / 64 }, (_, i) => hex.slice(i * 64, i * 64 + 64));
};
const decodeUintWord = (hex) => BigInt(`0x${hex}`);
const decodeAddressWord = (hex) => normalizeAddress(`0x${hex.slice(-40)}`);
const decodeBytes32Word = (hex) => `0x${hex}`;

function decodeAddress(result, label) {
  const ws = words(result, label);
  if (ws.length !== 1) throw new Error(`invalid 420 Stake ${label} response`);
  return decodeAddressWord(ws[0]);
}
function decodeUint(result, label) {
  const ws = words(result, label);
  if (ws.length !== 1) throw new Error(`invalid 420 Stake ${label} response`);
  return decodeUintWord(ws[0]);
}
function decodeBytes32(result, label) {
  const ws = words(result, label);
  if (ws.length !== 1) throw new Error(`invalid 420 Stake ${label} response`);
  return decodeBytes32Word(ws[0]);
}
function hexQuantity(value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error('negative transaction value');
  return `0x${n.toString(16)}`;
}
function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}
function normalizeBlsPubkey(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{96}$/.test(value)) throw new Error('BLS public key must be exactly 48 bytes');
  return value.toLowerCase();
}
function uintFromDecimal420(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(text)) throw new Error('420 amount must be a non-negative decimal with at most 18 decimals');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + '0'.repeat(18)).slice(0, 18));
}
export function format420(value) {
  const n = BigInt(value);
  const whole = n / 10n ** 18n;
  const fraction = (n % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction.slice(0, 6)}` : whole.toString();
}

function encodeRegister(validatorId, blsPubkey, withdrawal, metadataCommitment) {
  const id = bytes32Word(validatorId);
  const key = normalizeBlsPubkey(blsPubkey).slice(2);
  const keyLength = key.length / 2;
  const keyTail = `${uintWord(keyLength)}${key.padEnd(Math.ceil(keyLength / 32) * 64, '0')}`;
  return `0x${SELECTORS.register}${id}${uintWord(128)}${addressWord(withdrawal)}${bytes32Word(metadataCommitment)}${keyTail}`;
}

function decodeValidator(result) {
  const ws = words(result, 'validator');
  if (ws.length < 18) throw new Error('invalid 420 Stake validator response');
  const status = Number(decodeUintWord(ws[6]));
  if (!Number.isInteger(status) || status < 0 || status >= STAKE_STATUS.length) throw new Error('invalid 420 Stake validator status');
  return Object.freeze({
    validatorId: decodeBytes32Word(ws[0]),
    owner: decodeAddressWord(ws[2]),
    withdrawal: decodeAddressWord(ws[3]),
    ownedBond: decodeUintWord(ws[4]),
    protocolCredit: decodeUintWord(ws[5]),
    status,
    statusLabel: STAKE_STATUS[status],
    registrationBlock: decodeUintWord(ws[7]),
    effectiveSlot: decodeUintWord(ws[8]),
    activationRotation: decodeUintWord(ws[9]),
    scheduledExitRotation: decodeUintWord(ws[10]),
    cooldownUntilRotation: decodeUintWord(ws[11]),
    exitNoticeRotation: decodeUintWord(ws[12]),
    exitEligibleRotation: decodeUintWord(ws[13]),
    withdrawalHoldStartBlock: decodeUintWord(ws[14]),
    withdrawableBlock: decodeUintWord(ws[15]),
    totalSlashed: decodeUintWord(ws[16]),
    metadataCommitment: decodeBytes32Word(ws[17]),
  });
}

function errorText(error) { return String(error?.message || error || 'unknown 420 Stake error'); }

export function classifyStake420Error(error) {
  const message = errorText(error);
  const lower = message.toLowerCase();
  if (error?.code === 4001 || lower.includes('user rejected')) return Object.freeze({ code:'USER_REJECTED', retryable:true, message:'Wallet approval was rejected. Review the staking transaction and try again.' });
  if (lower.includes('chain changed') || lower.includes('wrong network') || lower.includes('verified chain')) return Object.freeze({ code:'NETWORK_CHANGED', retryable:true, message:'The connected network changed. Switch back to the qualified 420 network and reload canonical Stake state.' });
  if (lower.includes('account changed')) return Object.freeze({ code:'ACCOUNT_CHANGED', retryable:true, message:'The connected account changed. Reload validator state before continuing.' });
  if (lower.includes('canonical stake deployment') || lower.includes('code unavailable') || lower.includes('binding mismatch')) return Object.freeze({ code:'DEPLOYMENT_UNVERIFIED', retryable:false, message });
  if (lower.includes('simulation reverted') || lower.includes('gas estimation failed')) return Object.freeze({ code:'SIMULATION_FAILED', retryable:true, message:`Transaction preflight failed: ${message}` });
  if (lower.includes('not confirmed')) return Object.freeze({ code:'CONFIRMATION_TIMEOUT', retryable:true, message });
  if (lower.includes('reverted')) return Object.freeze({ code:'TRANSACTION_REVERTED', retryable:true, message });
  return Object.freeze({ code:'STAKE_ERROR', retryable:true, message });
}

export function createStake420ManagementClient({
  provider,
  chainId,
  account,
  stakeAddress,
  validatorRegistryAddress,
  rewardControllerAddress,
}) {
  if (!provider || typeof provider.request !== 'function') throw new Error('420 Stake RPC unavailable');
  const actor = normalizeAddress(account);
  const expectedChain = checkedChainId(chainId);
  const stake = normalizeAddress(stakeAddress);
  const registry = normalizeAddress(validatorRegistryAddress);
  const rewards = normalizeAddress(rewardControllerAddress);

  if (stake !== FROZEN_STAKE_ADDRESSES.stake420 || registry !== FROZEN_STAKE_ADDRESSES.validatorRegistry || rewards !== FROZEN_STAKE_ADDRESSES.rewardController) {
    throw new Error('420 Stake canonical deployment address mismatch');
  }

  const request = (method, params = []) => provider.request(method, params);

  async function rawCall(to, data, from = actor) {
    return request('eth_call', [{ from, to, data }, 'latest']);
  }

  async function verifySession() {
    if (checkedChainId(await request('eth_chainId')) !== expectedChain) throw new Error('420 Stake chain changed');
    const accounts = await request('eth_accounts');
    if (!Array.isArray(accounts) || !accounts.some((value) => {
      try { return normalizeAddress(value) === actor; } catch { return false; }
    })) throw new Error('420 Stake connected account changed');

    for (const [label, address] of [['Stake420', stake], ['ValidatorRegistry', registry], ['RewardController', rewards]]) {
      const code = await request('eth_getCode', [address, 'latest']);
      if (typeof code !== 'string' || !/^0x[0-9a-fA-F]+$/.test(code) || code === '0x') throw new Error(`420 Stake ${label} code unavailable`);
    }

    const [boundRegistry, boundRewards, effectiveBond] = await Promise.all([
      rawCall(stake, `0x${SELECTORS.stakeRegistry}`),
      rawCall(stake, `0x${SELECTORS.stakeRewards}`),
      rawCall(stake, `0x${SELECTORS.effectiveBond}`),
    ]);
    if (decodeAddress(boundRegistry, 'registry binding') !== registry) throw new Error('420 Stake validator binding mismatch');
    if (decodeAddress(boundRewards, 'reward binding') !== rewards) throw new Error('420 Stake reward binding mismatch');
    if (decodeUint(effectiveBond, 'effective bond') !== 42_000n * 10n ** 18n) throw new Error('420 Stake effective bond mismatch');
    return true;
  }

  async function canonicalCall(to, data, label) {
    await verifySession();
    const result = await rawCall(to, data);
    await verifySession();
    if (typeof result !== 'string') throw new Error(`invalid 420 Stake ${label} response`);
    return result;
  }

  async function validatorIdForAccount() {
    return decodeBytes32(await canonicalCall(registry, `0x${SELECTORS.ownerValidatorId}${addressWord(actor)}`, 'owner validator id'), 'owner validator id');
  }

  async function validator(validatorId) {
    const id = normalizeBytes32(validatorId);
    return decodeValidator(await canonicalCall(registry, `0x${SELECTORS.getValidator}${bytes32Word(id)}`, 'validator'));
  }

  async function summary(validatorId) {
    const id = normalizeBytes32(validatorId);
    const [v, statusRaw, bondRaw, lifecycleRaw, rewardRaw, blockRaw] = await Promise.all([
      validator(id),
      canonicalCall(stake, `0x${SELECTORS.validatorStatus}${bytes32Word(id)}`, 'status'),
      canonicalCall(stake, `0x${SELECTORS.bondComposition}${bytes32Word(id)}`, 'bond composition'),
      canonicalCall(stake, `0x${SELECTORS.lifecycle}${bytes32Word(id)}`, 'lifecycle'),
      canonicalCall(stake, `0x${SELECTORS.rewardAccrued}${bytes32Word(id)}`, 'reward'),
      request('eth_blockNumber'),
    ]);
    const status = Number(decodeUint(statusRaw, 'status'));
    const bond = words(bondRaw, 'bond composition').map(decodeUintWord);
    const lifecycle = words(lifecycleRaw, 'lifecycle').map(decodeUintWord);
    if (bond.length !== 4 || lifecycle.length !== 6) throw new Error('invalid 420 Stake summary response');
    const currentBlock = checkedChainId(blockRaw);
    const activationBlock = v.registrationBlock + 17_640n;
    const activationBlocksRemaining = currentBlock >= activationBlock ? 0n : activationBlock - currentBlock;
    const canWithdraw = status === 9 && v.withdrawableBlock !== 0n && currentBlock >= v.withdrawableBlock && v.withdrawal === actor;
    const exitGuidance = status === 9
      ? (v.withdrawal === actor ? 'Bond is withdrawable by this connected withdrawal account.' : `Bond is withdrawable only by ${v.withdrawal}.`)
      : status === 8
        ? `Withdrawal hold is active until block ${v.withdrawableBlock}.`
        : v.exitNoticeRotation === 0n
          ? 'No finalized voluntary-exit notice is recorded. Exit notices are consensus-owned; use qualified validator operator tooling. Wallet never calls applyExitNotice directly.'
          : status === 4
            ? `Exit notice recorded for rotation ${v.exitNoticeRotation}; active duty continues through scheduled rotation ${v.scheduledExitRotation}.`
            : `Exit notice recorded; canonical lifecycle status is ${STAKE_STATUS[status] || 'UNKNOWN'}.`;

    return Object.freeze({
      ...v,
      status,
      statusLabel: STAKE_STATUS[status],
      ownedBond: bond[0],
      protocolCredit: bond[1],
      effectiveBond: bond[2],
      totalSlashed: bond[3],
      registrationBlock: lifecycle[0],
      activationRotation: lifecycle[1],
      scheduledExitRotation: lifecycle[2],
      cooldownUntilRotation: lifecycle[3],
      exitEligibleRotation: lifecycle[4],
      withdrawableBlock: lifecycle[5],
      rewardAccrued: decodeUint(rewardRaw, 'reward'),
      currentBlock,
      activationBlocksRemaining,
      bondReady: bond[2] === 42_000n * 10n ** 18n,
      canWithdraw,
      exitGuidance,
    });
  }

  async function registrationQuote(validatorId) {
    const id = normalizeBytes32(validatorId);
    if (id === ZERO_BYTES32) throw new Error('validator ID must not be zero');
    const [creditRaw, beneficiaryRaw, existing] = await Promise.all([
      canonicalCall(registry, `0x${SELECTORS.pendingProtocolCredit}${bytes32Word(id)}`, 'pending protocol credit'),
      canonicalCall(registry, `0x${SELECTORS.pendingCreditBeneficiary}${bytes32Word(id)}`, 'pending credit beneficiary'),
      validator(id),
    ]);
    if (existing.status !== 0) throw new Error('validator ID is already registered');
    const credit = decodeUint(creditRaw, 'pending protocol credit');
    const beneficiary = decodeAddress(beneficiaryRaw, 'pending credit beneficiary');
    if (credit > 21_000n * 10n ** 18n) throw new Error('pending protocol credit exceeds canonical maximum');
    if (credit !== 0n && beneficiary !== actor) throw new Error('pending protocol credit belongs to another beneficiary');
    const ownedRequired = 42_000n * 10n ** 18n - credit;
    if (ownedRequired < 21_000n * 10n ** 18n) throw new Error('participant-owned bond is below canonical minimum');
    return Object.freeze({ validatorId:id, pendingProtocolCredit:credit, beneficiary, ownedRequired });
  }

  async function simulate(data, value = 0n) {
    const transaction = { from:actor, to:registry, value:hexQuantity(value), data };
    await verifySession();
    try { await request('eth_call', [transaction, 'latest']); }
    catch (error) { throw new Error(`420 Stake simulation reverted: ${errorText(error)}`); }
    let gas;
    try { gas = await request('eth_estimateGas', [transaction]); }
    catch (error) { throw new Error(`420 Stake gas estimation failed: ${errorText(error)}`); }
    if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid 420 Stake gas estimate');
    await verifySession();
    return Object.freeze({ transaction, gas:gas.toLowerCase(), simulationPassed:true });
  }

  async function submit(data, value = 0n) {
    const prepared = await simulate(data, value);
    await verifySession();
    const txHash = normalizeTxHash(await request('eth_sendTransaction', [prepared.transaction]));
    return Object.freeze({ ...prepared, txHash });
  }

  async function confirm(txHash, options = {}) {
    const hash = normalizeTxHash(txHash);
    const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
    const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
    const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    let receipt = null;
    for (let i = 0; i < attempts; i += 1) {
      receipt = await request('eth_getTransactionReceipt', [hash]);
      if (receipt) break;
      if (i + 1 < attempts) await sleep(delayMs);
    }
    if (!receipt) throw new Error('420 Stake transaction was not confirmed');
    if (receipt.status !== '0x1') throw new Error('420 Stake transaction reverted');
    await verifySession();
    return Object.freeze({ txHash:hash, receipt });
  }

  async function sendRegistration({ validatorId, blsPubkey, withdrawal, metadataCommitment = ZERO_BYTES32 }) {
    const quote = await registrationQuote(validatorId);
    const withdrawalAddress = normalizeAddress(withdrawal);
    if (withdrawalAddress === ZERO_ADDRESS) throw new Error('withdrawal address must not be zero');
    const metadata = normalizeBytes32(metadataCommitment);
    const data = encodeRegister(quote.validatorId, blsPubkey, withdrawalAddress, metadata);
    return Object.freeze({ ...quote, withdrawal:withdrawalAddress, metadataCommitment:metadata, ...(await submit(data, quote.ownedRequired)), stage:'registration-submitted' });
  }

  async function ownedSummary(validatorId) {
    const current = await summary(validatorId);
    if (current.owner !== actor) throw new Error('connected account is not the validator owner');
    return current;
  }

  async function sendTopUp({ validatorId, amount420 }) {
    const current = await ownedSummary(validatorId);
    const amount = uintFromDecimal420(amount420);
    if (amount <= 0n) throw new Error('top-up amount must be greater than zero');
    if (current.effectiveBond + amount > 42_000n * 10n ** 18n) throw new Error('top-up exceeds canonical effective bond');
    return Object.freeze({ amount, ...(await submit(`0x${SELECTORS.topUp}${bytes32Word(validatorId)}`, amount)), stage:'top-up-submitted' });
  }

  async function sendReplaceCredit({ validatorId, amount420 }) {
    const current = await ownedSummary(validatorId);
    const amount = uintFromDecimal420(amount420);
    if (amount <= 0n || amount > current.protocolCredit) throw new Error('replacement amount must be positive and no greater than current protocol credit');
    return Object.freeze({ amount, ...(await submit(`0x${SELECTORS.replaceCredit}${bytes32Word(validatorId)}`, amount)), stage:'credit-replacement-submitted' });
  }

  async function sendWithdraw({ validatorId }) {
    const current = await summary(validatorId);
    if (!current.canWithdraw) throw new Error(current.exitGuidance);
    return Object.freeze({ ...(await submit(`0x${SELECTORS.withdraw}${bytes32Word(validatorId)}`, 0n)), stage:'withdrawal-submitted' });
  }

  return Object.freeze({
    account:actor, stakeAddress:stake, validatorRegistryAddress:registry, rewardControllerAddress:rewards,
    verifySession, validatorIdForAccount, validator, summary, registrationQuote,
    sendRegistration, sendTopUp, sendReplaceCredit, sendWithdraw, confirm,
  });
}
