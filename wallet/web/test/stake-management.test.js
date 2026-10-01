import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FROZEN_STAKE_ADDRESSES,
  classifyStake420Error,
  createStake420ManagementClient,
  format420,
} from '../core/stake-management.js';
import { keccak256Hex } from '../core/keccak.js';

const ALICE = '0x00000000000000000000000000000000000000aa';
const BOB = '0x00000000000000000000000000000000000000bb';
const VALIDATOR_ID = `0x${'11'.repeat(32)}`;
const NEW_VALIDATOR_ID = `0x${'22'.repeat(32)}`;
const TX = `0x${'ab'.repeat(32)}`;
const BLS = `0x${'42'.repeat(48)}`;
const META = `0x${'77'.repeat(32)}`;
const E18 = 10n ** 18n;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const id = (signature) => keccak256Hex(new TextEncoder().encode(signature)).slice(0, 10);
const bytes32Word = (value) => value.slice(2);

function validatorResult({
  validatorId = VALIDATOR_ID,
  owner = ALICE,
  withdrawal = ALICE,
  ownedBond = 21_000n * E18,
  protocolCredit = 21_000n * E18,
  status = 3,
  registrationBlock = 10n,
  effectiveSlot = 2n,
  activationRotation = 1n,
  scheduledExitRotation = 4n,
  cooldownUntilRotation = 0n,
  exitNoticeRotation = 0n,
  exitEligibleRotation = 0n,
  withdrawalHoldStartBlock = 0n,
  withdrawableBlock = 0n,
  totalSlashed = 0n,
  metadata = META,
} = {}) {
  const head = [
    bytes32Word(validatorId),
    word(18n * 32n),
    addressWord(owner),
    addressWord(withdrawal),
    word(ownedBond),
    word(protocolCredit),
    word(status),
    word(registrationBlock),
    word(effectiveSlot),
    word(activationRotation),
    word(scheduledExitRotation),
    word(cooldownUntilRotation),
    word(exitNoticeRotation),
    word(exitEligibleRotation),
    word(withdrawalHoldStartBlock),
    word(withdrawableBlock),
    word(totalSlashed),
    bytes32Word(metadata),
  ].join('');
  const key = BLS.slice(2).padEnd(128, '0');
  return `0x${head}${word(48)}${key}`;
}

function setup(overrides = {}) {
  let chain = overrides.chain || '0x1a4';
  let accounts = overrides.accounts || [ALICE];
  let block = overrides.block ?? 100n;
  let codeAvailable = overrides.codeAvailable ?? true;
  let receipt = Object.prototype.hasOwnProperty.call(overrides, 'receipt') ? overrides.receipt : { status:'0x1', transactionHash:TX };
  let simulateError = overrides.simulateError || null;
  let current = {
    owner: overrides.owner || ALICE,
    withdrawal: overrides.withdrawal || ALICE,
    ownedBond: overrides.ownedBond ?? 21_000n * E18,
    protocolCredit: overrides.protocolCredit ?? 21_000n * E18,
    status: overrides.status ?? 3,
    registrationBlock: overrides.registrationBlock ?? 10n,
    activationRotation: overrides.activationRotation ?? 1n,
    scheduledExitRotation: overrides.scheduledExitRotation ?? 4n,
    cooldownUntilRotation: overrides.cooldownUntilRotation ?? 0n,
    exitNoticeRotation: overrides.exitNoticeRotation ?? 0n,
    exitEligibleRotation: overrides.exitEligibleRotation ?? 0n,
    withdrawableBlock: overrides.withdrawableBlock ?? 0n,
    totalSlashed: overrides.totalSlashed ?? 0n,
  };
  let pendingCredit = overrides.pendingCredit ?? 21_000n * E18;
  let pendingBeneficiary = overrides.pendingBeneficiary || ALICE;
  const calls = [];
  const sent = [];

  const provider = { async request(method, params = []) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_accounts') return accounts;
    if (method === 'eth_getCode') return codeAvailable ? '0x60006000' : '0x';
    if (method === 'eth_blockNumber') return `0x${block.toString(16)}`;
    if (method === 'eth_estimateGas') return '0x12345';
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_sendTransaction') {
      sent.push(params[0]);
      return TX;
    }
    if (method === 'eth_call') {
      const tx = params[0];
      const data = tx.data.toLowerCase();
      if (simulateError && [
        id('register(bytes32,bytes,address,bytes32)'),
        id('topUpOwnedBond(bytes32)'),
        id('replaceProtocolCredit(bytes32)'),
        id('withdrawBond(bytes32)'),
      ].some((selector) => data.startsWith(selector))) throw new Error(simulateError);

      if (tx.to.toLowerCase() === FROZEN_STAKE_ADDRESSES.stake420) {
        if (data.startsWith(id('validatorRegistry()'))) return `0x${addressWord(FROZEN_STAKE_ADDRESSES.validatorRegistry)}`;
        if (data.startsWith(id('rewardController()'))) return `0x${addressWord(FROZEN_STAKE_ADDRESSES.rewardController)}`;
        if (data.startsWith(id('effectiveBond()'))) return `0x${word(42_000n * E18)}`;
        if (data.startsWith(id('validatorStatus(bytes32)'))) return `0x${word(current.status)}`;
        if (data.startsWith(id('validatorBondComposition(bytes32)'))) {
          return `0x${word(current.ownedBond)}${word(current.protocolCredit)}${word(current.ownedBond + current.protocolCredit)}${word(current.totalSlashed)}`;
        }
        if (data.startsWith(id('validatorLifecycle(bytes32)'))) {
          return `0x${word(current.registrationBlock)}${word(current.activationRotation)}${word(current.scheduledExitRotation)}${word(current.cooldownUntilRotation)}${word(current.exitEligibleRotation)}${word(current.withdrawableBlock)}`;
        }
        if (data.startsWith(id('validatorRewardAccrued(bytes32)'))) return `0x${word(12n * E18)}`;
      }

      if (tx.to.toLowerCase() === FROZEN_STAKE_ADDRESSES.validatorRegistry) {
        if (data.startsWith(id('ownerValidatorId(address)'))) return VALIDATOR_ID;
        if (data.startsWith(id('pendingProtocolCredit(bytes32)'))) return `0x${word(pendingCredit)}`;
        if (data.startsWith(id('pendingCreditBeneficiary(bytes32)'))) return `0x${addressWord(pendingBeneficiary)}`;
        if (data.startsWith(id('getValidator(bytes32)'))) {
          const requested = `0x${data.slice(10, 74)}`;
          if (requested === NEW_VALIDATOR_ID.toLowerCase()) {
            return validatorResult({
              validatorId:NEW_VALIDATOR_ID,
              owner:'0x0000000000000000000000000000000000000000',
              withdrawal:'0x0000000000000000000000000000000000000000',
              ownedBond:0n, protocolCredit:0n, status:0, registrationBlock:0n,
              activationRotation:0n, scheduledExitRotation:0n, cooldownUntilRotation:0n,
              exitNoticeRotation:0n, exitEligibleRotation:0n, withdrawableBlock:0n, metadata:`0x${'0'.repeat(64)}`,
            });
          }
          return validatorResult({ validatorId:VALIDATOR_ID, ...current });
        }
        if ([
          id('register(bytes32,bytes,address,bytes32)'),
          id('topUpOwnedBond(bytes32)'),
          id('replaceProtocolCredit(bytes32)'),
          id('withdrawBond(bytes32)'),
        ].some((selector) => data.startsWith(selector))) return '0x';
      }
      throw new Error(`unexpected eth_call ${tx.to} ${data.slice(0,10)}`);
    }
    throw new Error(`unexpected RPC method ${method}`);
  } };

  const client = createStake420ManagementClient({
    provider,
    chainId:'0x1a4',
    account:ALICE,
    stakeAddress:FROZEN_STAKE_ADDRESSES.stake420,
    validatorRegistryAddress:FROZEN_STAKE_ADDRESSES.validatorRegistry,
    rewardControllerAddress:FROZEN_STAKE_ADDRESSES.rewardController,
  });
  return {
    provider, client, calls, sent,
    setChain(value) { chain = value; },
    setAccounts(value) { accounts = value; },
    setCurrent(value) { current = { ...current, ...value }; },
    setBlock(value) { block = BigInt(value); },
    setCode(value) { codeAvailable = value; },
    setPendingCredit(value, beneficiary = ALICE) { pendingCredit = BigInt(value); pendingBeneficiary = beneficiary; },
  };
}

test('client rejects noncanonical Stake addresses before any RPC use', () => {
  assert.throws(() => createStake420ManagementClient({
    provider:{ request:async () => null }, chainId:'0x1a4', account:ALICE,
    stakeAddress:'0x0000000000000000000000000000000000000999',
    validatorRegistryAddress:FROZEN_STAKE_ADDRESSES.validatorRegistry,
    rewardControllerAddress:FROZEN_STAKE_ADDRESSES.rewardController,
  }), /canonical deployment address mismatch/);
});

test('session verification checks chain, account, bytecode and Stake420 bindings', async () => {
  const rpc = setup();
  assert.equal(await rpc.client.verifySession(), true);
  assert.equal(await rpc.client.validatorIdForAccount(), VALIDATOR_ID);

  rpc.setChain('0x1a5');
  await assert.rejects(rpc.client.verifySession(), /chain changed/);

  const accountDrift = setup();
  accountDrift.setAccounts([BOB]);
  await assert.rejects(accountDrift.client.verifySession(), /account changed/);

  const noCode = setup();
  noCode.setCode(false);
  await assert.rejects(noCode.client.verifySession(), /code unavailable/);
});

test('registration derives exact owned bond from funded protocol credit and broadcasts only after simulation', async () => {
  const rpc = setup({ pendingCredit:21_000n * E18 });
  const quote = await rpc.client.registrationQuote(NEW_VALIDATOR_ID);
  assert.equal(quote.ownedRequired, 21_000n * E18);
  assert.equal(quote.pendingProtocolCredit, 21_000n * E18);

  const submitted = await rpc.client.sendRegistration({
    validatorId:NEW_VALIDATOR_ID,
    blsPubkey:BLS,
    withdrawal:ALICE,
    metadataCommitment:META,
  });
  assert.equal(submitted.stage, 'registration-submitted');
  assert.equal(submitted.txHash, TX);
  assert.equal(rpc.sent.length, 1);
  assert.equal(rpc.sent[0].value, `0x${(21_000n * E18).toString(16)}`);
  assert.ok(rpc.sent[0].data.startsWith(id('register(bytes32,bytes,address,bytes32)')));
  assert.ok(rpc.calls.some(({ method }) => method === 'eth_estimateGas'));
});

test('registration fails closed for wrong credit beneficiary and malformed validator inputs', async () => {
  const wrongBeneficiary = setup({ pendingBeneficiary:BOB });
  await assert.rejects(wrongBeneficiary.client.registrationQuote(NEW_VALIDATOR_ID), /another beneficiary/);
  assert.equal(wrongBeneficiary.sent.length, 0);

  const rpc = setup();
  await assert.rejects(rpc.client.sendRegistration({
    validatorId:NEW_VALIDATOR_ID,
    blsPubkey:'0x1234',
    withdrawal:ALICE,
    metadataCommitment:META,
  }), /BLS public key/);
  assert.equal(rpc.sent.length, 0);
});

test('canonical summary exposes lifecycle, bond, reward, readiness and exit guidance', async () => {
  const rpc = setup({ status:4, exitNoticeRotation:2n, scheduledExitRotation:4n });
  const state = await rpc.client.summary(VALIDATOR_ID);
  assert.equal(state.statusLabel, 'ACTIVE');
  assert.equal(state.bondReady, true);
  assert.equal(state.rewardAccrued, 12n * E18);
  assert.match(state.exitGuidance, /active duty continues through scheduled rotation 4/);
  assert.equal(format420(state.ownedBond), '21000');
});

test('top-up and protocol-credit replacement are owner-only, bounded and simulated', async () => {
  const topupRpc = setup({ ownedBond:20_000n * E18, protocolCredit:21_000n * E18, status:6 });
  const topup = await topupRpc.client.sendTopUp({ validatorId:VALIDATOR_ID, amount420:'1000' });
  assert.equal(topup.stage, 'top-up-submitted');
  assert.equal(topupRpc.sent[0].value, `0x${(1_000n * E18).toString(16)}`);
  assert.ok(topupRpc.sent[0].data.startsWith(id('topUpOwnedBond(bytes32)')));

  const replaceRpc = setup();
  const replaced = await replaceRpc.client.sendReplaceCredit({ validatorId:VALIDATOR_ID, amount420:'420' });
  assert.equal(replaced.stage, 'credit-replacement-submitted');
  assert.ok(replaceRpc.sent[0].data.startsWith(id('replaceProtocolCredit(bytes32)')));

  const notOwner = setup({ owner:BOB });
  await assert.rejects(notOwner.client.sendReplaceCredit({ validatorId:VALIDATOR_ID, amount420:'1' }), /not the validator owner/);
  assert.equal(notOwner.sent.length, 0);
});

test('withdrawal is enabled only by canonical WITHDRAWABLE state and the configured withdrawal account', async () => {
  const ready = setup({ status:9, withdrawableBlock:50n, withdrawal:ALICE });
  const state = await ready.client.summary(VALIDATOR_ID);
  assert.equal(state.canWithdraw, true);
  const submitted = await ready.client.sendWithdraw({ validatorId:VALIDATOR_ID });
  assert.equal(submitted.stage, 'withdrawal-submitted');
  assert.ok(ready.sent[0].data.startsWith(id('withdrawBond(bytes32)')));

  const wrongAccount = setup({ status:9, withdrawableBlock:50n, withdrawal:BOB });
  await assert.rejects(wrongAccount.client.sendWithdraw({ validatorId:VALIDATOR_ID }), /withdrawable only by/);
  assert.equal(wrongAccount.sent.length, 0);

  const hold = setup({ status:8, withdrawableBlock:150n, withdrawal:ALICE });
  await assert.rejects(hold.client.sendWithdraw({ validatorId:VALIDATOR_ID }), /Withdrawal hold is active/);
  assert.equal(hold.sent.length, 0);
});

test('network drift and simulation failure prevent transaction broadcast', async () => {
  const drift = setup({ ownedBond:20_000n * E18, protocolCredit:21_000n * E18, status:6 });
  drift.setChain('0x999');
  await assert.rejects(drift.client.sendTopUp({ validatorId:VALIDATOR_ID, amount420:'1' }), /chain changed/);
  assert.equal(drift.sent.length, 0);

  const reverted = setup({ simulateError:'execution reverted', ownedBond:20_000n * E18, protocolCredit:21_000n * E18, status:6 });
  await assert.rejects(reverted.client.sendTopUp({ validatorId:VALIDATOR_ID, amount420:'1' }), /simulation reverted/);
  assert.equal(reverted.sent.length, 0);
});

test('confirmation and error classification expose explicit transaction recovery states', async () => {
  const rpc = setup();
  const confirmed = await rpc.client.confirm(TX, { attempts:1 });
  assert.equal(confirmed.receipt.status, '0x1');

  const reverted = setup({ receipt:{ status:'0x0' } });
  await assert.rejects(reverted.client.confirm(TX, { attempts:1 }), /transaction reverted/);

  assert.equal(classifyStake420Error({ code:4001, message:'User rejected' }).code, 'USER_REJECTED');
  assert.equal(classifyStake420Error(new Error('420 Stake chain changed')).code, 'NETWORK_CHANGED');
  assert.equal(classifyStake420Error(new Error('420 Stake simulation reverted: nope')).code, 'SIMULATION_FAILED');
});
