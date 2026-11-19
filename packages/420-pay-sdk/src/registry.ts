import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { invoiceView, paymentView } from './abi.js';
import { PAY_SERVICE_ID, createPayReader, type Hex, type PayReadTransport, type PaySnapshot } from './index.js';

export interface PayRpc {
  request(method: string, params: readonly unknown[]): Promise<unknown>;
}

export const PAYMENT_ROUTER = '420/APP/420PAY/PAYMENT_ROUTER';
const NAMES = '420/service/names/v1';
const IDENTITY = '420/service/identity/v1';
export const MERCHANT_REGISTRY = '420/APP/420PAY/MERCHANT_REGISTRY';
type RequiredComponent = typeof invoiceView.component | typeof paymentView.component | typeof PAYMENT_ROUTER;
const NATIVE_QUOTE_SOURCE = '420/APP/420PAY/NATIVE_QUOTE_SOURCE';
type OptionalComponent = typeof MERCHANT_REGISTRY | typeof NATIVE_QUOTE_SOURCE;
type Component = RequiredComponent | OptionalComponent;

const abiWord = (value: bigint) => value.toString(16).padStart(64, '0');
export const MERCHANT_ACTIONS = {
  register: 'registerForController(bytes32,address,address)',
  location: 'setLocation(bytes32,bytes32,bool)',
  role: 'setRole(bytes32,bytes32,address,uint8)'
} as const;
export type MerchantAction =
  | { kind: 'register'; id: Hex; payout: Hex }
  | { kind: 'location'; id: Hex; locationId: Hex; active: boolean }
  | { kind: 'role'; id: Hex; locationId: Hex; account: Hex; role: number };
const zero = '0'.repeat(64);
const addressArgument = (value: Hex) => address(value).slice(2).padStart(64, '0');
export const NATIVE_INVOICE_SIGNATURE = 'payNativeInvoice(bytes32,uint256,uint64,bytes32)';

interface ServiceBinding {
  readonly implementation: Hex;
  readonly codeHash: Hex;
  readonly metadataHash: Hex;
  readonly version: number;
}

export interface PayDeployment {
  readonly chainId: bigint;
  readonly registry: Hex;
  readonly registryCodeHash: Hex;
  readonly origin: string;
  readonly pay: ServiceBinding;
  readonly names: ServiceBinding;
  readonly identity: ServiceBinding;
  readonly components: Readonly<Record<RequiredComponent, Hex> & Partial<Record<OptionalComponent, Hex>>>;
}

export function requirePay(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const hashText = (text: string) => bytesToHex(keccak_256(new TextEncoder().encode(text)));
const hashCode = (code: string) => '0x' + bytesToHex(keccak_256(hexToBytes(code.slice(2))));
const calldata = (signature: string, ...args: string[]): Hex =>
  `0x${hashText(signature).slice(0, 8)}${args.join('')}`;

export function address(value: unknown): Hex {
  requirePay(typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value),
    'Invalid Pay address');
  return value.toLowerCase() as Hex;
}

export function quantity(value: unknown): bigint {
  requirePay(typeof value === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value), 'Invalid RPC quantity');
  return BigInt(value);
}

export function hash(value: unknown): Hex {
  requirePay(typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) && !/^0x0{64}$/i.test(value),
    'Invalid Pay hash');
  return value.toLowerCase() as Hex;
}

function words(raw: unknown, count: number): string[] {
  requirePay(typeof raw === 'string' && raw.length === 2 + count * 64 && /^0x[0-9a-f]+$/i.test(raw),
    'Invalid Registry or identity response');
  return raw.slice(2).toLowerCase().match(/.{64}/g)!;
}

function addressWord(word: string | undefined): Hex {
  requirePay(word?.startsWith('0'.repeat(24)), 'Invalid ABI address padding');
  return address('0x' + word!.slice(24));
}

function uint(word: string | undefined, bits: number): bigint {
  const value = BigInt('0x' + word);
  requirePay(value < 1n << BigInt(bits), 'Invalid ABI integer');
  return value;
}

function serviceBinding(binding: ServiceBinding): ServiceBinding {
  requirePay(Number.isInteger(binding.version) && binding.version > 0 && binding.version <= 0xffffffff,
    'Invalid Registry service version');
  return Object.freeze({
    implementation: address(binding.implementation), version: binding.version,
    codeHash: hash(binding.codeHash), metadataHash: hash(binding.metadataHash)
  });
}

/** Deployment bindings come from verified operator configuration. */
export function createPayRegistry(rpc: PayRpc, deployment: PayDeployment) {
  const { chainId, origin } = deployment;
  requirePay(typeof chainId === 'bigint' && chainId > 0n, 'Invalid Pay chain');
  requirePay(origin.startsWith('https://') && new URL(origin).origin === origin, 'Invalid Pay origin');
  const registry = address(deployment.registry);
  const registryCodeHash = hash(deployment.registryCodeHash);
  const pay = serviceBinding(deployment.pay);
  const names = serviceBinding(deployment.names);
  const identity = serviceBinding(deployment.identity);
  const components = Object.freeze({
    [invoiceView.component]: hash(deployment.components[invoiceView.component]),
    [paymentView.component]: hash(deployment.components[paymentView.component]),
    [PAYMENT_ROUTER]: hash(deployment.components[PAYMENT_ROUTER]),
    [MERCHANT_REGISTRY]: deployment.components[MERCHANT_REGISTRY] === undefined ? undefined :
      hash(deployment.components[MERCHANT_REGISTRY]),
    [NATIVE_QUOTE_SOURCE]: deployment.components[NATIVE_QUOTE_SOURCE] === undefined ? undefined :
      hash(deployment.components[NATIVE_QUOTE_SOURCE])
  });

  async function verifyChain() {
    requirePay(quantity(await rpc.request('eth_chainId', [])) === chainId, 'Pay RPC is on the wrong chain');
  }

  async function latestSnapshot(tag: 'latest' | 'finalized' = 'latest'): Promise<PaySnapshot> {
    await verifyChain();
    const block = await rpc.request('eth_getBlockByNumber', [tag, false]) as { hash?: unknown } | null;
    return Object.freeze({ chainId, blockHash: hash(block?.hash) });
  }

  async function pinned<T>(snapshot: PaySnapshot, operation: (state: {
    call(to: Hex, data: Hex): Promise<unknown>;
    component(id: Component): Promise<Hex>;
    service(id: string, expected: ServiceBinding): Promise<Hex>;
    timestamp: bigint;
    height: bigint;
    blockTag: Readonly<{ blockHash: Hex; requireCanonical: boolean }>;
    verifyCode(target: Hex, expected: Hex): Promise<void>;
  }) => Promise<T>): Promise<T> {
    requirePay(snapshot.chainId === chainId, 'Pay snapshot is on the wrong chain');
    const blockHash = hash(snapshot.blockHash);
    const blockTag = Object.freeze({ blockHash, requireCanonical: true });
    async function blockTime() {
      const block = await rpc.request('eth_getBlockByHash', [blockHash, false]) as {
        hash?: unknown; number?: unknown; timestamp?: unknown;
      } | null;
      requirePay(hash(block?.hash) === blockHash, 'Pay snapshot is unavailable');
      const heightNumber = quantity(block?.number);
      const height = await rpc.request('eth_getBlockByNumber', [block!.number, false]) as { hash?: unknown } | null;
      requirePay(hash(height?.hash) === blockHash, 'Pay snapshot is no longer canonical');
      return { height: heightNumber, timestamp: quantity(block?.timestamp) };
    }
    async function verifyCode(target: Hex, expected: Hex) {
      const code = await rpc.request('eth_getCode', [target, blockTag]);
      requirePay(typeof code === 'string' && /^0x(?:[0-9a-f]{2})+$/i.test(code) && hashCode(code) === expected,
        'Pay deployment runtime code mismatch');
    }
    const call = (to: Hex, data: Hex) => rpc.request('eth_call', [{ to, data }, blockTag]);
    async function component(id: Component) {
      const expected = components[id];
      requirePay(expected, 'Pay component deployment is unavailable');
      const key = hashText(id);
      const [actualId, implementation, codeHash, major, minor, patch, lifecycle] =
        words(await call(registry, calldata('component(bytes32)', key)), 7);
      requirePay(actualId === key && '0x' + codeHash === expected &&
        uint(major, 16) === 1n && uint(minor, 16) === 0n && uint(patch, 16) === 0n &&
        uint(lifecycle, 8) === 2n, 'Pay component binding is inactive or changed');
      const target = addressWord(implementation);
      await verifyCode(target, expected);
      return target;
    }
    async function service(id: string, expected: ServiceBinding) {
      const [implementation, codeHash, metadataHash, version, activatedAt, active] =
        words(await call(registry, calldata('getService(bytes32)', hashText(id))), 6);
      requirePay(uint(active, 8) === 1n && uint(version, 32) === BigInt(expected.version) &&
        uint(activatedAt, 64) <= timestamp && '0x' + codeHash === expected.codeHash &&
        '0x' + metadataHash === expected.metadataHash, 'Registry service binding is inactive or changed');
      const target = addressWord(implementation);
      requirePay(target === expected.implementation, 'Registry service implementation changed');
      await verifyCode(target, expected.codeHash);
      return target;
    }
    await verifyChain();
    const { timestamp, height } = await blockTime();
    await verifyCode(registry, registryCodeHash);
    await service(PAY_SERVICE_ID, pay);
    const result = await operation({ call, component, service, timestamp, height, blockTag, verifyCode });
    await blockTime();
    await verifyChain();
    return result;
  }

  async function checkoutInvoice(state: {
    call(to: Hex, data: Hex): Promise<unknown>;
    component(id: Component): Promise<Hex>;
    timestamp: bigint;
  }, invoiceId: Hex, snapshot: PaySnapshot) {
    const id = hash(invoiceId);
    const target = await state.component(invoiceView.component);
    const reader = createPayReader({ read: ({ calldata }) => state.call(target, calldata) }, snapshot);
    const [invoice, closed] = await Promise.all([
      reader.invoice(id),
      state.call(target, calldata('isClosed(bytes32)', id.slice(2)))
    ]);
    requirePay(invoice?.active && uint(words(closed, 1)[0], 8) === 0n && state.timestamp <= invoice.expiresAt,
      'Invoice is unavailable, closed or expired');
    return invoice;
  }

  async function readMerchant(state: {
    call(to: Hex, data: Hex): Promise<unknown>;
    component(id: Component): Promise<Hex>;
  }, id: Hex) {
    const target = await state.component(MERCHANT_REGISTRY);
    const result = words(await state.call(target, calldata('merchants(bytes32)', hash(id).slice(2))), 6);
    if (result.every(word => word === zero)) return { target, merchant: null };
    const [controller, profile, , status, active] = result;
    const statusCode = uint(status, 8);
    const activeCode = uint(active, 8);
    requirePay(statusCode <= 3n && activeCode <= 1n, 'Invalid merchant registry record');
    return { target, merchant: { controller: addressWord(controller), profileId: '0x' + profile,
      status: ['UNVERIFIED', 'REGISTERED', 'CREDENTIALED', 'REGULATED'][Number(statusCode)]!,
      active: activeCode === 1n } };
  }

  async function merchantRole(state: { call(to: Hex, data: Hex): Promise<unknown> },
    target: Hex, id: Hex, location: string, account: Hex) {
    return uint(words(await state.call(target, calldata('effectiveRole(bytes32,bytes32,address)',
      hash(id).slice(2), location, addressArgument(account))), 1)[0], 8);
  }

  const transport: PayReadTransport = Object.freeze({
    async read({ component, snapshot, calldata: data }: Parameters<PayReadTransport['read']>[0]) {
      requirePay(component === invoiceView.component || component === paymentView.component, 'Unsupported Pay view');
      const view = component === invoiceView.component ? invoiceView : paymentView;
      requirePay(typeof data === 'string' && data.startsWith(view.selector) && data.length === 74, 'Invalid Pay view call');
      hash('0x' + data.slice(10));
      return pinned(snapshot, async state => state.call(await state.component(component), data));
    }
  });

  return Object.freeze({
    chainId, origin, transport, latestSnapshot,
    async paymentRouter(snapshot: PaySnapshot, applicationOrigin: string) {
      requirePay(applicationOrigin === origin, 'Pay origin does not match its verified deployment');
      return pinned(snapshot, state => state.component(PAYMENT_ROUTER));
    },
    async snapshotTime(snapshot: PaySnapshot) {
      return pinned(snapshot, async state => state.timestamp);
    },
    async invoiceForReview(snapshot: PaySnapshot, invoiceId: Hex) {
      return pinned(snapshot, state => checkoutInvoice(state, invoiceId, snapshot));
    },
    async nativeInvoiceQuote(snapshot: PaySnapshot, invoiceId: Hex, payer: Hex, nonce: bigint, issuedAt?: bigint) {
      return pinned(snapshot, async state => {
        const invoice = await checkoutInvoice(state, invoiceId, snapshot);
        const source = await state.component(NATIVE_QUOTE_SOURCE);
        const router = await state.component(PAYMENT_ROUTER);
        const quotedAt = issuedAt ?? state.timestamp;
        requirePay(quotedAt >= 0n && quotedAt <= state.timestamp && state.timestamp - quotedAt <= 42n &&
          quotedAt < 1n << 64n && nonce > 0n && nonce < 1n << 256n, 'Review a fresh checkout quote');
        const args = [hash(invoiceId).slice(2), addressArgument(payer), abiWord(nonce), abiWord(quotedAt)];
        const [id, merchant, payout, amount, deadline] = words(await state.call(source,
          calldata('quoteNative(bytes32,address,uint256,uint64)', ...args)), 5);
        const quoteId = hash('0x' + id);
        const value = uint(amount, 256);
        const expiresAt = uint(deadline, 64);
        requirePay(addressWord(merchant) === invoice.merchant && invoice.currency === '420' && value > 0n &&
          expiresAt >= state.timestamp && expiresAt <= invoice.expiresAt && expiresAt <= quotedAt + 42n,
          'Native checkout quote is invalid or expired');
        const [feeId, protocol, network, provider, conversion, slippage, feeTime, feeExpiry] = words(
          await state.call(source, calldata('feeQuote(bytes32,bytes)', quoteId.slice(2), abiWord(64n),
            abiWord(128n), ...args)), 8);
        requirePay(feeId === id && [protocol, network, provider, conversion, slippage].every(x => uint(x, 256) === 0n) &&
          uint(feeTime, 64) === quotedAt && uint(feeExpiry, 64) === expiresAt, 'Native checkout fees changed');
        const paymentRegistry = await state.component(paymentView.component);
        const zero = '0'.repeat(64);
        const paymentId = hash(await state.call(paymentRegistry,
          calldata('derivePaymentId(bytes32,address,address,address,uint256,address,uint256,bytes32,uint256)',
            args[0]!, args[1]!, merchant!, zero, abiWord(value), zero, abiWord(value), id!, args[2]!)));
        return Object.freeze({ invoiceId, payer: address(payer), recipient: addressWord(payout), router, nonce, quotedAt,
          expiresAt, value, quoteId, paymentId, acceptance: invoice.acceptance,
          data: calldata(NATIVE_INVOICE_SIGNATURE, args[0]!, args[2]!, args[3]!, id!) });
      });
    },
    async invoiceAcceptance(snapshot: PaySnapshot, invoiceId: Hex) {
      const invoice = await createPayReader(transport, snapshot).invoice(invoiceId);
      requirePay(invoice, 'Invoice acceptance policy is unavailable');
      return invoice.acceptance;
    },
    async hostedCheckout(snapshot: PaySnapshot, invoiceId: Hex) {
      return pinned(snapshot, async state => {
        const invoice = await checkoutInvoice(state, invoiceId, snapshot);
        const target = await state.component(MERCHANT_REGISTRY);
        const id = hash(invoice.merchantId).slice(2);
        const [merchantRaw, payoutRaw] = await Promise.all([
          state.call(target, calldata('merchants(bytes32)', id)),
          state.call(target, calldata('currentPayout(bytes32)', id))
        ]);
        const [controller, , , status, active] = words(merchantRaw, 6);
        requirePay(addressWord(controller) === invoice.merchant && uint(status, 8) <= 3n &&
          uint(active, 8) === 1n, 'Invoice merchant binding is unavailable');
        const [primary, version, planHash] = words(payoutRaw, 3);
        requirePay(uint(version, 32) > 0n && '0x' + planHash === invoice.settlementPlanHash,
          'Invoice payout plan has changed');
        return Object.freeze({ invoice, recipient: addressWord(primary), chainTime: state.timestamp });
      });
    },
    async merchantDashboard(snapshot: PaySnapshot, id: Hex, account: Hex, location?: Hex) {
      return pinned(snapshot, async state => {
        const { target, merchant } = await readMerchant(state, id);
        if (!merchant) return null;
        const controller = merchant.controller === address(account);
        const selectedLocation = location ? hash(location).slice(2) : zero;
        const role = merchant.active ? await merchantRole(state, target, id, selectedLocation, account) : 0n;
        requirePay(controller || role === (location ? 2n : 1n) || (location && role === 3n), 'Merchant access denied');
        const locationActive = location ? uint(words(await state.call(target, calldata('activeLocations(bytes32,bytes32)',
          hash(id).slice(2), selectedLocation)), 1)[0], 8) === 1n : false;
        return { ...merchant, controller, role: Number(role), reports: merchant.active && !location && (controller || role === 1n),
          locationActive };
      });
    },
    async merchantTransaction(snapshot: PaySnapshot, account: Hex, action: MerchantAction) {
      return pinned(snapshot, async state => {
        const { target, merchant } = await readMerchant(state, action.id);
        const id = hash(action.id).slice(2);
        if (action.kind === 'register') {
          requirePay(!merchant, 'Merchant is already registered');
          return { target, data: calldata(MERCHANT_ACTIONS.register, id,
            addressArgument(account), addressArgument(action.payout)) };
        }
        requirePay(merchant?.active && merchant.controller === address(account), 'Active merchant controller required');
        if (action.kind === 'location') {
          requirePay(typeof action.active === 'boolean', 'Invalid location action');
          return { target, data: calldata(MERCHANT_ACTIONS.location, id, hash(action.locationId).slice(2), abiWord(action.active ? 1n : 0n)) };
        }
        requirePay(Number.isInteger(action.role) && action.role >= 0 && action.role <= 3 &&
          /^0x[0-9a-f]{64}$/i.test(action.locationId), 'Invalid merchant role');
        return { target, data: calldata(MERCHANT_ACTIONS.role, id, action.locationId.slice(2),
          addressArgument(action.account), abiWord(BigInt(action.role))) };
      });
    },
    async accountBalances(snapshot: PaySnapshot, account: Hex, tokens: readonly { address: Hex; codeHash: Hex }[]) {
      const owner = address(account);
      return pinned(snapshot, async state => {
        const native = quantity(await rpc.request('eth_getBalance', [owner, state.blockTag]));
        const balances = await Promise.all(tokens.map(async token => {
          const target = address(token.address);
          await state.verifyCode(target, hash(token.codeHash));
          const [balance] = words(await state.call(target, calldata('balanceOf(address)', owner.slice(2).padStart(64, '0'))), 1);
          return uint(balance, 256);
        }));
        return [native, ...balances];
      });
    },
    async accountHistory(snapshot: PaySnapshot, account: Hex, through?: bigint, merchantId?: Hex) {
      let owner = address(account);
      const tenant = merchantId && hash(merchantId);
      return pinned(snapshot, async state => {
        if (merchantId) {
          const { target, merchant } = await readMerchant(state, merchantId);
          requirePay(merchant?.active && (merchant.controller === owner ||
            await merchantRole(state, target, merchantId, zero, owner) === 1n), 'Merchant report access denied');
          owner = merchant.controller;
        }
        const last = through ?? state.height;
        requirePay(last >= 0n && last <= state.height, 'Invalid Pay history range');
        const first = last > 127n ? last - 127n : 0n;
        const target = await state.component(paymentView.component);
        const topic = '0x' + hashText('PaymentSet(bytes32,bytes32,uint8)');
        const logs = await rpc.request('eth_getLogs', [{
          address: target, topics: [topic], fromBlock: '0x' + first.toString(16), toBlock: '0x' + last.toString(16)
        }]);
        requirePay(Array.isArray(logs) && logs.length <= 4096, 'Pay history response is unavailable');
        const entries = logs.map(log => {
          const height = quantity(log?.blockNumber);
          const index = quantity(log?.logIndex);
          requirePay(log?.removed === false && address(log.address) === target && height >= first && height <= last &&
            Array.isArray(log.topics) && log.topics.length === 3 && log.topics[0] === topic, 'Invalid Pay history event');
          return { id: hash(log.topics[1]), invoice: hash(log.topics[2]), height, index, block: hash(log.blockHash) };
        }).sort((a, b) => a.height === b.height ? (a.index > b.index ? -1 : a.index < b.index ? 1 : 0) : a.height > b.height ? -1 : 1);
        const seen = new Set<Hex>();
        const unique = entries.filter(event => {
          if (seen.has(event.id)) return false;
          seen.add(event.id);
          return true;
        });
        const blocks = new Map<bigint, Hex>();
        for (const event of entries) {
          requirePay(!blocks.has(event.height) || blocks.get(event.height) === event.block, 'Conflicting Pay history blocks');
          blocks.set(event.height, event.block);
        }
        const heights = [...blocks];
        for (let offset = 0; offset < heights.length; offset += 12) {
          await Promise.all(heights.slice(offset, offset + 12).map(async ([height, expected]) => {
            const block = await rpc.request('eth_getBlockByNumber', ['0x' + height.toString(16), false]) as { hash?: unknown } | null;
            requirePay(hash(block?.hash) === expected, 'Pay history block is no longer canonical');
          }));
        }
        const reader = createPayReader({ read: ({ calldata }) => state.call(target, calldata) }, snapshot);
        const invoices = merchantId ? await state.component(invoiceView.component) : null;
        const invoiceReader = invoices && createPayReader({ read: ({ calldata }) => state.call(invoices, calldata) }, snapshot);
        const payments = [];
        for (let offset = 0; offset < unique.length; offset += 12) {
          const group = await Promise.all(unique.slice(offset, offset + 12).map(async event => {
            const payment = await reader.payment(event.id);
            requirePay(payment && payment.invoiceId === event.invoice, 'Pay history conflicts with the canonical payment');
            if (!merchantId) return payment.payer === owner || payment.merchant === owner ? payment : null;
            if (payment.merchant !== owner) return null;
            const invoice = await invoiceReader?.invoice(payment.invoiceId);
            return invoice && invoice.merchantId === tenant && invoice.merchant === owner ? payment : null;
          }));
          payments.push(...group.filter(payment => payment !== null));
        }
        return { payments, first, last, next: first === 0n ? null : first - 1n };
      });
    },
    async resolveName(snapshot: PaySnapshot, input: string) {
      requirePay(typeof input === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.420$/.test(input.trim()),
        'Invalid 420 name');
      const name = input.trim();
      const label = name.slice(0, -4);
      const key = hashText(label);
      return pinned(snapshot, async state => {
        const namesTarget = await state.service(NAMES, names);
        const [owner, , resolved, profileId, , expiry, length] =
          words(await state.call(namesTarget, calldata('resolve(bytes32)', key)), 7);
        addressWord(owner);
        requirePay(uint(expiry, 64) > state.timestamp && uint(length, 8) === BigInt(label.length),
          '420 name is expired or malformed');
        const recipient = addressWord(resolved);
        let verifiedProfileId: Hex | null = null;
        if (profileId !== '0'.repeat(64)) {
          const identityTarget = await state.service(IDENTITY, identity);
          const [controller, , , primaryName, , , active] =
            words(await state.call(identityTarget, calldata('profiles(bytes32)', profileId!)), 7);
          requirePay(uint(active, 8) === 1n && addressWord(controller) === recipient && primaryName === key,
            '420 Identity profile and name do not agree');
          verifiedProfileId = hash('0x' + profileId);
        }
        return Object.freeze({ name, recipient, verifiedProfileId });
      });
    }
  });
}

export type PayRegistry = ReturnType<typeof createPayRegistry>;
