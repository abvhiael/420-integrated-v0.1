import type { Hex } from './index.js';
import { address, hash, quantity, requirePay, type MerchantAction, type PayRegistry } from './registry.js';

// PaymentRouter420 execution selectors from the retained V3 ABI.
const NATIVE_INVOICE_SELECTOR = '0xfdec5340';
const NATIVE_POS_INVOICE_SELECTOR = '0x313a3d41';
const settlementSelectors = new Set([
  '0xe360bec0', // executeDirectTokenSplitSettlement
  '0x8ef5948b', // executeNativeSplitSettlement
  '0x0b90b30e', // executeSwapSettlement
  '0xfb65182d'  // executeSwapSplitSettlement
]);

export interface PayWalletProvider {
  readonly is420Wallet: boolean;
  request(input: { method: string; params: readonly unknown[] }): Promise<unknown>;
}

/** Uses the origin-bound 420 Wallet extension request and approval flow. */
export function createPayWallet(registry: PayRegistry, provider: PayWalletProvider) {
  requirePay(provider.is420Wallet === true, 'Select the 420 Wallet provider');
  requirePay(globalThis.location?.origin === registry.origin, 'Pay origin does not match its verified deployment');
  const request = (method: string, params: readonly unknown[] = []) => provider.request({ method, params });
  const chainId = `0x${registry.chainId.toString(16)}`;
  let account: Hex | null = null;
  let generation = 0;
  let connecting = false;
  let submitting = false;
  let revoking = false;

  async function verifyNetwork() {
    requirePay(quantity(await request('eth_chainId')) === registry.chainId, '420 Wallet is on the wrong network');
  }

  async function selected(method: string) {
    await verifyNetwork();
    const accounts = await request(method);
    requirePay(Array.isArray(accounts) && accounts.length === 1, 'Select exactly one account in 420 Wallet');
    const selection = address(accounts[0]);
    await verifyNetwork();
    return selection;
  }

  return Object.freeze({
    async connect() {
      requirePay(!revoking && !connecting && !submitting, '420 Wallet operation in progress');
      const ticket = ++generation;
      account = null;
      connecting = true;
      try {
        await registry.paymentRouter(await registry.latestSnapshot(), registry.origin);
        requirePay(ticket === generation, '420 Wallet connection was revoked');
        const approved = await selected('eth_requestAccounts');
        requirePay(await selected('eth_accounts') === approved && ticket === generation,
          '420 Wallet selection changed during connection');
        account = approved;
        return Object.freeze({ account, chainId: registry.chainId });
      } finally {
        connecting = false;
      }
    },

    async submitPayment(input: Readonly<{ data: Hex; value: bigint; expectedTarget?: Hex }>) {
      const { data, value } = input;
      requirePay(!submitting && !revoking && account, 'Connect a selected 420 Wallet account');
      requirePay(typeof data === 'string' && /^0x[0-9a-f]{8}(?:[0-9a-f]{2})*$/i.test(data) &&
        (settlementSelectors.has(data.slice(0, 10).toLowerCase()) ||
          (input.expectedTarget !== undefined &&
            ((data.startsWith(NATIVE_INVOICE_SELECTOR) && data.length === 266) ||
             (data.startsWith(NATIVE_POS_INVOICE_SELECTOR) && data.length === 970)))) &&
        typeof value === 'bigint' && value >= 0n && value < 1n << 256n, 'Invalid Pay transaction');
      const from = account;
      const ticket = generation;
      submitting = true;
      try {
        const to = await registry.paymentRouter(await registry.latestSnapshot(), registry.origin);
        requirePay(input.expectedTarget === undefined || to === address(input.expectedTarget), 'Reviewed payment router changed');
        requirePay(await selected('eth_accounts') === from && ticket === generation,
          '420 Wallet selection changed or was revoked');
        const tx = Object.freeze({ chainId, from, to, data, value: `0x${value.toString(16)}` });
        // 420 Wallet simulates the exact call from its execution account and
        // requires user approval before its local authority can submit it.
        const submissionHash = hash(await request('eth_sendTransaction', [tx]));
        return Object.freeze({ submissionHash, chainId: registry.chainId });
      } finally {
        submitting = false;
      }
    },

    async submitMerchantAction(action: MerchantAction) {
      requirePay(!submitting && !revoking && account, 'Connect a selected 420 Wallet account');
      const from = account;
      const ticket = generation;
      submitting = true;
      try {
        const { target, data } = await registry.merchantTransaction(await registry.latestSnapshot(), from, action);
        requirePay(await selected('eth_accounts') === from && ticket === generation, '420 Wallet selection changed or was revoked');
        const submissionHash = hash(await request('eth_sendTransaction', [
          Object.freeze({ chainId, from, to: target, data, value: '0x0' })
        ]));
        return Object.freeze({ submissionHash, chainId: registry.chainId });
      } finally {
        submitting = false;
      }
    },

    async sendNative(recipient: Hex, value: bigint) {
      const to = address(recipient);
      requirePay(!submitting && !revoking && account, 'Connect a selected 420 Wallet account');
      requirePay(typeof value === 'bigint' && value > 0n && value < 1n << 256n, 'Invalid native send value');
      const from = account;
      const ticket = generation;
      submitting = true;
      try {
        requirePay(await selected('eth_accounts') === from && ticket === generation,
          '420 Wallet selection changed or was revoked');
        const tx = Object.freeze({ chainId, from, to, data: '0x', value: `0x${value.toString(16)}` });
        const submissionHash = hash(await request('eth_sendTransaction', [tx]));
        return Object.freeze({ submissionHash, chainId: registry.chainId });
      } finally {
        submitting = false;
      }
    },

    async revoke() {
      requirePay(!revoking && !connecting, '420 Wallet operation in progress');
      ++generation;
      account = null;
      revoking = true;
      try {
        await request('wallet_revokePermissions', [{ eth_accounts: {} }]);
      } finally {
        revoking = false;
      }
    }
  });
}
