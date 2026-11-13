import {resolveExtensionRecipient420,assertExtensionRecipientSnapshot420} from './extension-recipient-resolver.js';
import {packExtensionUserOpFees420} from './extension-fee-preflight.js';
import { normalizeAddress } from './abi.js';
import { discoverSmartAccount } from './accounts.js';
import { preparePasskeyUserOperationTransport } from './passkey-entrypoint-transport.js';

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  if (data !== undefined) error.data = data;
  return error;
}

function txRequest(request = {}) {
  const tx = Array.isArray(request.params) ? request.params[0] : null;
  if (!tx || typeof tx !== 'object') throw rpcError(-32602, 'transaction object required');
  if (!tx.to) throw rpcError(-32602, 'transaction target required');
  return {
    from: tx.from ? normalizeAddress(tx.from) : null,
    target: normalizeAddress(tx.to),
    value: tx.value ?? '0x0',
    data: tx.data ?? '0x',
    gasFees:tx.gasFees??null,
    expectedNonce:tx.expectedNonce??null,
    accountGasLimits:tx.accountGasLimits??null,
    preVerificationGas:tx.preVerificationGas??null,
    recipientSnapshot:tx.recipientSnapshot??null,
  };
}

function grantedAccount(accounts, requested = null) {
  const granted = (Array.isArray(accounts) ? accounts : []).map(normalizeAddress);
  if (!granted.length) throw rpcError(4100, 'origin has no granted wallet accounts');
  if (requested == null) return granted[0];
  const account = normalizeAddress(requested);
  if (!granted.includes(account)) throw rpcError(4100, 'requested signing account is not granted to this origin');
  return account;
}

function rpcQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function toRpcUserOperation(userOperation) {
  return {
    sender: userOperation.sender,
    nonce: rpcQuantity(userOperation.nonce),
    initCode: userOperation.initCode,
    callData: userOperation.callData,
    accountGasLimits: userOperation.accountGasLimits,
    preVerificationGas: rpcQuantity(userOperation.preVerificationGas),
    gasFees: userOperation.gasFees,
    paymasterAndData: userOperation.paymasterAndData,
    signature: userOperation.signature,
  };
}

function validHash(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

async function waitForUserOperationReceipt(provider, userOpHash, { timeoutMs = 120000, pollMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await provider.request('eth_getUserOperationReceipt', [userOpHash]);
    if (receipt) {
      const txHash = receipt?.receipt?.transactionHash ?? receipt?.transactionHash;
      if (!validHash(txHash)) throw rpcError(-32603, 'bundler returned a user operation receipt without a transaction hash');
      if (receipt.success === false) throw rpcError(-32603, 'SmartAccount420 user operation failed', receipt);
      return txHash.toLowerCase();
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw rpcError(4900, 'SmartAccount420 UserOperation receipt still pending; do not rebroadcast automatically', {userOpHash:userOpHash.toLowerCase(),pending:true});
}

export function createExtensionLocalAuthority420({
  provider,
  navigatorLike,
  smartAccountConfig,
  loadPasskeyBinding,
  persistPasskeyBinding,
  signMessage = null,
  signTypedData = null,
  receiptOptions = {},
  onUserOperationSubmitted = null,
  qualifiedNamesRuntime = null,
} = {}) {
  if (!provider || typeof provider.request !== 'function') throw new Error('extension authority provider required');
  if (!navigatorLike?.credentials || typeof navigatorLike.credentials.get !== 'function') throw new Error('extension WebAuthn authority required');
  if (!smartAccountConfig || typeof smartAccountConfig !== 'object') throw new Error('extension SmartAccount configuration required');
  if (typeof loadPasskeyBinding !== 'function') throw new Error('extension passkey binding loader required');
  if (typeof persistPasskeyBinding !== 'function') throw new Error('extension passkey binding persistence required');

  return async function executeLocalAuthority420(request, context = {}) {
    if (request?.method === 'eth_sendTransaction') {
      const tx = txRequest(request);
      const controller = grantedAccount(context.accounts, tx.from);
      const smartAccount = await discoverSmartAccount(provider, controller, smartAccountConfig);
      if (!smartAccount?.deployed || !smartAccount.controllerIsOwner) {
        throw rpcError(4100, 'granted account is not the current SmartAccount420 owner');
      }
      const binding = await loadPasskeyBinding({ account: controller, smartAccount: smartAccount.smartAccount, context });
      if (!binding) throw rpcError(4100, 'no active local passkey binding is available for this SmartAccount420');

      if(tx.gasFees){
        if(typeof tx.gasFees!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(tx.gasFees))
          throw rpcError(-32602,'invalid packed UserOperation gas fees');
        const priority='0x'+tx.gasFees.slice(2,34),maximum='0x'+tx.gasFees.slice(34,66);
        if(packExtensionUserOpFees420({maxFeePerGas:maximum,maxPriorityFeePerGas:priority}).toLowerCase()!==tx.gasFees.toLowerCase())
          throw rpcError(-32602,'invalid signed fee caps');
      }
      const assertReviewedRecipient=async()=>{
        if(!tx.recipientSnapshot)return;
        if(tx.recipientSnapshot.recipient!==tx.target)
          throw rpcError(4100,'signed transaction target differs from confirmed resolved name');
        const resolved=await resolveExtensionRecipient420(provider,{
          input:tx.recipientSnapshot.input,chainId:context.chainId,
          qualifiedNamesConfig:qualifiedNamesRuntime,
        });
        assertExtensionRecipientSnapshot420(tx.recipientSnapshot,resolved);
      };
      await assertReviewedRecipient();
      const prepared = await preparePasskeyUserOperationTransport(
        provider,
        navigatorLike,
        smartAccount,
        binding,
        { target: tx.target, value: tx.value, data: tx.data,
          ...(tx.gasFees?{gasFees:tx.gasFees}:{}),
          ...(tx.expectedNonce?{expectedNonce:tx.expectedNonce}:{}),
          accountGasLimits:tx.accountGasLimits,
          preVerificationGas:tx.preVerificationGas,
          expectedChainId:context.chainId,
          requireBundlerGasEstimate:true,
        },
        { rpId: binding.rpId, origin: binding.origin },
      );
      if (!prepared?.broadcastReady || !prepared?.entryPointSimulation?.simulationPassed) {
        throw rpcError(-32603, 'local passkey UserOperation did not qualify for broadcast');
      }

      await assertReviewedRecipient();
      const rpcUserOperation = toRpcUserOperation(prepared.userOperation);
      const userOpHash = await provider.request('eth_sendUserOperation', [rpcUserOperation, prepared.entryPoint]);
      if (!validHash(userOpHash)) throw rpcError(-32603, 'bundler returned an invalid UserOperation hash');
      if (userOpHash.toLowerCase() !== prepared.userOpHash.toLowerCase()) {
        throw rpcError(-32603, 'bundler UserOperation hash does not match the locally signed canonical hash');
      }
      await persistPasskeyBinding(prepared.advancedBinding, { account: controller, context });
      // Persist the submission identity before waiting for a bundler receipt, so
      // service-worker suspension or an RPC outage does not erase transaction history.
      if(typeof onUserOperationSubmitted==='function'){
        await onUserOperationSubmitted({
          userOpHash:userOpHash.toLowerCase(),sender:prepared.userOperation.sender,
          entryPoint:prepared.entryPoint,entryPointVersion:'0.7',
          nonce:'0x'+BigInt(prepared.nonce).toString(16),
          nonceKey:'0x'+BigInt(prepared.nonceKey).toString(16),
          nonceSequence:'0x'+(BigInt(prepared.nonce)&((1n<<64n)-1n)).toString(16),
          gasFees:prepared.userOperation.gasFees,
          callData:prepared.userOperation.callData,
          initCode:prepared.userOperation.initCode,
          target:prepared.target,value:'0x'+BigInt(prepared.value).toString(16),data:prepared.data,
          source:'extension-local-passkey',
        },context);
      }

      try {
        return await waitForUserOperationReceipt(provider, userOpHash, receiptOptions);
      } catch (error) {
        // Submission happened before receipt tracking. Preserve the signed operation
        // identity on timeout/outage, without misreporting it as a failed transfer.
        if (error?.code !== -32603 && error?.code !== 4001) {
          error.data = {...(error.data && typeof error.data==='object' ? error.data : {}),
            userOpHash:userOpHash.toLowerCase(),pending:true};
        }
        throw error;
      }
    }

    if (request?.method === 'personal_sign') {
      const params = Array.isArray(request.params) ? request.params : [];
      if (params.length < 2) throw rpcError(-32602, 'personal_sign requires message and account');
      const account = grantedAccount(context.accounts, params[1]);
      if (typeof signMessage !== 'function') {
        throw rpcError(4200, 'personal_sign requires a configured local ECDSA signing authority; RPC fallback is forbidden');
      }
      return signMessage({ account, message: params[0], context });
    }

    if (request?.method === 'eth_signTypedData_v4') {
      const params = Array.isArray(request.params) ? request.params : [];
      if (params.length < 2) throw rpcError(-32602, 'eth_signTypedData_v4 requires account and typed data');
      const account = grantedAccount(context.accounts, params[0]);
      if (typeof signTypedData !== 'function') {
        throw rpcError(4200, 'eth_signTypedData_v4 requires a configured local ECDSA signing authority; RPC fallback is forbidden');
      }
      return signTypedData({ account, typedData: params[1], context });
    }

    throw rpcError(4200, `unsupported local authority method: ${request?.method}`);
  };
}

export { toRpcUserOperation as serializeExtensionUserOperation420, waitForUserOperationReceipt as waitForExtensionUserOperationReceipt420 };
