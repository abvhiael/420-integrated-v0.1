import { createPayReader, createPayRegistry, createPayWallet } from '../../packages/420-pay-sdk/dist/index.js';

export const NATIVE = '0x' + '0'.repeat(40);
const HASH = /^0x[0-9a-f]{64}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const receiptStates = new Set(['FINALIZED', 'SETTLED', 'REFUNDED', 'PARTIALLY_REFUNDED']);

export function makeReceipt(payment, account, fixture) {
  if (!payment || !receiptStates.has(payment.status) || !HASH.test(payment.receiptHash) ||
      /^0x0{64}$/.test(payment.receiptHash) || (payment.payer !== account && payment.merchant !== account)) {
    throw new Error('Receipt evidence is unavailable for this account.');
  }
  return {
    source: fixture ? 'fixture' : 'canonical-payment-registry',
    chainId: payment.snapshot.chainId.toString(),
    blockHash: payment.snapshot.blockHash,
    paymentId: payment.id, invoiceId: payment.invoiceId, status: payment.status, receiptHash: payment.receiptHash,
    inputAsset: payment.inputAsset, inputAmount: payment.inputAmount.toString(),
    settlementAsset: payment.settlementAsset, settlementAmount: payment.settlementAmount.toString(),
    tipAmount: payment.tipAmount.toString(), authorizedRefundAmount: payment.refundedAmount.toString()
  };
}

export function formatUnits(amount, decimals) {
  const digits = amount.toString().padStart(decimals + 1, '0');
  if (!decimals) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return digits.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}

export function createConsumerSource(config, provider) {
  const endpoint = new URL(config.rpcUrl);
  const nativeDecimals = 18;
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash ||
      config.origin !== location.origin || !/^[1-9][0-9]*$/.test(config.chainId)) {
    throw new Error('The approved Pay deployment is unavailable on this origin.');
  }
  const tokens = config.tokens ?? [];
  if (!Array.isArray(tokens) || tokens.length > 32 || new Set(tokens.map(token => token.address)).size !== tokens.length ||
      tokens.some(token => !ADDRESS.test(token.address) || token.address === NATIVE || !HASH.test(token.codeHash) ||
        !/^[A-Za-z0-9 ._-]{1,12}$/.test(token.symbol) || !Number.isInteger(token.decimals) ||
        token.decimals < 0 || token.decimals > 36)) throw new Error('Invalid approved asset configuration.');
  const assets = [{ address: NATIVE, symbol: '420', decimals: nativeDecimals }, ...tokens];
  let id = 0;
  const rpc = { async request(method, params) {
    const requestId = ++id;
    const response = await fetch(endpoint, {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })
    });
    if (!response.ok) throw new Error('Pay network data is unavailable.');
    const body = await response.json();
    if (body.jsonrpc !== '2.0' || body.id !== requestId || body.error || !Object.hasOwn(body, 'result')) {
      throw new Error('The Pay network could not verify the request.');
    }
    return body.result;
  } };
  const registry = createPayRegistry(rpc, { ...config, chainId: BigInt(config.chainId) });
  const wallet = createPayWallet(registry, provider);
  const chain = '0x' + registry.chainId.toString(16);

  async function verify(account) {
    const [currentChain, accounts] = await Promise.all([
      provider.request({method: 'eth_chainId'}),
      provider.request({method: 'eth_accounts'})
    ]);
    if (typeof currentChain !== 'string' || currentChain.toLowerCase() !== chain ||
        !Array.isArray(accounts) || accounts.length !== 1 || accounts[0]?.toLowerCase() !== account) {
      throw new Error('Wallet account or network changed. Connect again.');
    }
  }
  return {
    assets,
    connect: wallet.connect,
    disconnect: wallet.revoke,
    async paymentContext(account) {
      await verify(account);
      const snapshot = await registry.latestSnapshot();
      const now = await registry.snapshotTime(snapshot);
      return {
        now,
        resolve: name => registry.resolveName(snapshot, name),
        invoice: id => registry.invoiceForReview(snapshot, id)
      };
    },
    async hostedCheckout(account, invoiceId) {
      await verify(account);
      const snapshot = await registry.latestSnapshot();
      const review = await registry.hostedCheckout(snapshot, invoiceId);
      await verify(account);
      return review;
    },
    async nativeInvoiceQuote(account, invoiceId, nonce, issuedAt) {
      await verify(account);
      const quote = await registry.nativeInvoiceQuote(await registry.latestSnapshot(), invoiceId, account, nonce, issuedAt);
      await verify(account);
      return quote;
    },
    async submitNativeInvoice(account, quote) {
      await verify(account);
      if (quote.payer !== account) throw new Error('Checkout payer changed.');
      return wallet.submitPayment({ data: quote.data, value: quote.value, expectedTarget: quote.router });
    },
    async checkoutConfirmation(account, invoiceId, paymentId) {
      await verify(account);
      let snapshot = await registry.latestSnapshot();
      const acceptance = await registry.invoiceAcceptance(snapshot, invoiceId);
      if (acceptance === 'FINALIZED' || acceptance === 'HIGH_VALUE') {
        snapshot = await registry.latestSnapshot('finalized');
      }
      const payment = await createPayReader(registry.transport, snapshot).payment(paymentId);
      if (payment && (payment.invoiceId !== invoiceId || (payment.payer !== account && payment.merchant !== account))) {
        throw new Error('No matching payment for this invoice and Wallet account.');
      }
      await verify(account);
      return { status: payment?.status ?? null, snapshot, acceptance };
    },
    async sendNative(account, recipient, value) {
      await verify(account);
      return wallet.sendNative(recipient, value);
    },
    async load(account) {
      await verify(account);
      const snapshot = await registry.latestSnapshot();
      await registry.paymentRouter(snapshot, location.origin);
      const [amounts, history] = await Promise.all([
        registry.accountBalances(snapshot, account, tokens),
        registry.accountHistory(snapshot, account)
      ]);
      await verify(account);
      return { snapshot, amounts, history };
    },
    async older(account, snapshot, through) {
      await verify(account);
      const history = await registry.accountHistory(snapshot, account, through);
      await verify(account);
      return history;
    },
    async receipt(account, displayed) {
      await verify(account);
      const snapshot = await registry.latestSnapshot();
      const payment = await createPayReader(registry.transport, snapshot).payment(displayed.id);
      const receipt = makeReceipt(payment, account, false);
      await verify(account);
      return receipt;
    }
  };
}
