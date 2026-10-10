export const COMMERCE_API_SCHEMA_420 = '420-commerce-api-v1' as const;
export interface CommerceChallenge420 { nonce: string; expiresAt: number; address: string; chainId: string; origin: string }
export interface CommerceWallet420 {
  readonly address: string;
  signMessage(message: string): Promise<string>;
}
export interface CommerceEnvelope420<T> { schema: typeof COMMERCE_API_SCHEMA_420; data: T }
export interface CommercePage420<T> {
  schema: typeof COMMERCE_API_SCHEMA_420; authoritative: false; state: 'ready' | 'empty';
  provenance: { authoritative: false; chainId: string; state: 'ready' | 'stale' | 'halted'; height: number; blockHash: string; finalizedHeight: number; updatedAt: number };
  items: T[]; nextOffset: number | null;
}
export interface CommerceProduct420 { product_id: string; store_id: string; sku: string; description: string; media: string[]; listing: Record<string, unknown> | null; availability: 'canonical_reservation_required'; authoritative: false }
export interface CommerceStore420 { store_id: string; slug: string; theme_id: string; public_description: string; avatar_object_id: string | null; banner_object_id: string | null }
export interface CommerceCartLine420 { listingId: string; revision: number; quantity: string }
export interface CommerceOrderPlan420 {
  attemptId: string; orderId: string; state: string; expiresAt: number; paymentAllowed: false; reserved: false;
  intent: { chainId: string; target: string; method: 'createOrder'; args: readonly unknown[]; requiresWalletAuthorization: true; canonicalAuthority: false };
}
export interface CommerceTransactionPlan420 {
  expiresAt: number; controller: string; merchantId?: string; payout?: string; productId?: string; productVersion?: number; metadataHash?: string; listingId?: string; revision?: number;
  provenance: {chainId: string; blockHash: string; blockNumber: number; finalized: true};
  intent: {chainId: string; target: string; contract: string; method: string; args: readonly unknown[]; data: string; requiresWalletAuthorization: true; canonicalAuthority: false};
}
export interface CommerceListingChange420 {
  version: number; method: 'createListing' | 'reviseListing'; listingId: string; revision?: number; sellerProfileId?: string; itemClass?: string; assetRef?: string;
  policyId: string; adapterId: string; quoteAsset: string; unitPrice: string; quantity: string; expiresAt: number;
}
export interface CommerceStatus420 { attemptId: string; orderId?: string; state: string; paid: boolean; reserved: boolean; paymentAllowed?: boolean; invoiceId?: string | null; paymentId?: string | null; receiptHash?: string | null; provenance?: {chainId: string; blockHash: string; blockNumber: number; finalized: true} }
export class CommerceApiError420 extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); this.name = 'CommerceApiError420'; }
}

// These three canonical interfaces contain only static ABI words. Independent
// encoding prevents a service plan's calldata from overriding reviewed arguments.
export function encodeCommerceMerchantTransaction420(method: string, args: readonly unknown[]): string {
  const layout: Record<string, {selector: string; types: string[]}> = {
    register: {selector: '3aa8cd8b', types: ['b32','b32','b32','address']},
    createListing: {selector: 'fb5ef79a', types: ['b32','b32','b32','b32','b32','b32','b32','b32','address','uint256','uint256','uint64']},
    reviseListing: {selector: '1e81e74f', types: ['b32','b32','b32','b32','b32','address','uint256','uint256','uint64']},
  };
  const spec = layout[method];
  if (!spec || args.length !== spec.types.length) throw new CommerceApiError420('invalid_transaction_plan', 0);
  const words = spec.types.map((type, index) => {
    const value = String(args[index]);
    if (type === 'b32' && /^0x[0-9a-f]{64}$/.test(value)) return value.slice(2);
    if (type === 'address' && /^0x[0-9a-f]{40}$/.test(value)) return value.slice(2).padStart(64, '0');
    if (type.startsWith('uint') && /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < 2n ** BigInt(type.slice(4))) return BigInt(value).toString(16).padStart(64, '0');
    throw new CommerceApiError420('invalid_transaction_plan', 0);
  });
  return '0x' + spec.selector + words.join('');
}

export function commerceSigningMessage420(challenge: CommerceChallenge420, method: string, path: string, bodyHash: string): string {
  return ['420Commerce request v1', `Origin: ${challenge.origin}`, `Chain: ${challenge.chainId}`, `Wallet: ${challenge.address}`, `Nonce: ${challenge.nonce}`, `Expires: ${challenge.expiresAt}`, `Method: ${method}`, `Path: ${path}`, `Body-SHA256: ${bodyHash}`].join('\n');
}
export function createCommerceSdk420(input: {
  baseUrl: string; origin: string; chainId: string; wallet?: CommerceWallet420;
  fetcher?: typeof fetch; now?: () => number;
  host?: { network: { chainIdDecimal: string }; contract(name: string): { address: string; version: string; verified: true } | null };
}) {
  const base = new URL(input.baseUrl), origin = new URL(input.origin);
  if ((base.protocol !== 'https:' && base.hostname !== '127.0.0.1') || origin.origin !== input.origin || !/^[1-9][0-9]*$/.test(input.chainId) || base.username || base.password) throw new CommerceApiError420('invalid_configuration', 0);
  const fetcher = input.fetcher ?? fetch, now = input.now ?? Date.now;
  const read = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!path.startsWith('/v1/') || path.includes('..') || path.includes('://')) throw new CommerceApiError420('invalid_path', 0);
    const response = await fetcher(new URL(path, base), { ...init, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000) });
    const result = await response.json() as { schema?: string; data?: T; error?: { code?: string } };
    if (!response.ok) throw new CommerceApiError420(result.error?.code ?? 'service_unavailable', response.status);
    if (result.schema !== COMMERCE_API_SCHEMA_420 || result.data === undefined) throw new CommerceApiError420('invalid_response', response.status);
    return result.data;
  };
  const signed = async <T>(method: string, path: string, value?: unknown, contentType = 'application/json'): Promise<T> => {
    if (!input.wallet || !/^0x[0-9a-fA-F]{40}$/.test(input.wallet.address)) throw new CommerceApiError420('wallet_required', 0);
    const address = input.wallet.address.toLowerCase();
    const challenge = await read<CommerceChallenge420>('/v1/auth/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: input.origin }, body: JSON.stringify({ wallet: address }) });
    if (challenge.chainId !== input.chainId || challenge.origin !== input.origin || challenge.address !== address || !/^[a-f0-9]{64}$/.test(challenge.nonce) || !Number.isSafeInteger(challenge.expiresAt) || challenge.expiresAt <= now() || challenge.expiresAt > now() + 120000) throw new CommerceApiError420('challenge_mismatch', 0);
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value === undefined ? '' : JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
    const bodyHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const signature = await input.wallet.signMessage(commerceSigningMessage420(challenge, method, path, bodyHash));
    if (challenge.expiresAt <= now()) throw new CommerceApiError420('signature_expired', 0);
    const init: RequestInit = { method, headers: { Origin: input.origin, 'Content-Type': contentType, 'X-Commerce-Wallet': address, 'X-Commerce-Nonce': challenge.nonce, 'X-Commerce-Signature': signature } };
    if (method !== 'GET') init.body = Uint8Array.from(bytes);
    return read<T>(path, init);
  };
  const query = (filters: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, String(value));
    return params.size ? `?${params}` : '';
  };
  const objectId = (value: string) => { if (!/^[a-f0-9]{64}$/.test(value)) throw new CommerceApiError420('invalid_id', 0); return value; };
  const merchantPath = (storeId: string) => `/v1/merchant/storefronts/${objectId(storeId)}`;
  const chainPlan = (plan: CommerceTransactionPlan420, contractName: string, method: string, expectedArgs: readonly unknown[]) => {
    const contract = input.host?.contract(contractName), intent = plan.intent;
    if (!input.wallet || !contract || contract.verified !== true || !contract.version || input.host?.network.chainIdDecimal !== input.chainId || plan.controller?.toLowerCase() !== input.wallet.address.toLowerCase() || !Number.isSafeInteger(plan.expiresAt) || plan.expiresAt <= now() || plan.expiresAt > now() + 60000 || !plan.provenance || plan.provenance.chainId !== input.chainId || plan.provenance.finalized !== true || !/^0x[0-9a-f]{64}$/.test(plan.provenance.blockHash) || !intent || intent.chainId !== input.chainId || intent.contract !== contractName || intent.target?.toLowerCase() !== contract.address.toLowerCase() || intent.method !== method || intent.requiresWalletAuthorization !== true || intent.canonicalAuthority !== false || !/^0x[0-9a-f]+$/.test(intent.data) || JSON.stringify(intent.args) !== JSON.stringify(expectedArgs)) throw new CommerceApiError420('invalid_transaction_plan', 0);
    if (intent.data !== encodeCommerceMerchantTransaction420(method, expectedArgs)) throw new CommerceApiError420('invalid_transaction_plan', 0);
    return plan;
  };
  return Object.freeze({
    schema: COMMERCE_API_SCHEMA_420,
    storefronts: (filters: { query?: string; offset?: number; limit?: number } = {}) => read<CommercePage420<CommerceStore420>>('/v1/storefronts' + query(filters)),
    storefront: (slug: string) => { if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) throw new CommerceApiError420('invalid_slug', 0); return read<CommerceStore420>(`/v1/storefronts/${slug}`); },
    search: (filters: { query?: string; offset?: number; limit?: number; storeId?: string; category?: string } = {}) => read<CommercePage420<CommerceProduct420>>('/v1/search' + query(filters)),
    product: (productId: string) => read<CommercePage420<CommerceProduct420>>(`/v1/products/${objectId(productId)}`),
    categories: () => read<{ items: { category_id: string; slug: string; parent_id: string | null; sort_order: number }[]; authoritative: false }>('/v1/categories'),
    availability: (productId: string) => read<{ listingId: string; revision: number; available: string; reservationRequired: true; authority: 'Market.InventoryReservation420'; provenance: { chainId: string; blockHash: string; blockNumber: number; finalized: true } }>(`/v1/products/${objectId(productId)}/availability`),
    createStore: (merchantId: string, slug: string) => signed<CommerceStore420>('POST', '/v1/merchant/storefronts', { merchantId, slug }),
    merchantIdentity: (merchantId: string) => { if (!/^0x[0-9a-f]{64}$/.test(merchantId)) throw new CommerceApiError420('invalid_id', 0); return signed<{registered: boolean; merchant: Record<string, unknown>; store: Record<string, unknown> | null}>('GET', `/v1/merchant/identity/${merchantId}`); },
    registrationPlan: async (change: {merchantId: string; profileId: string; metadataHash: string; payout: string}) => {
      const plan = await signed<CommerceTransactionPlan420>('POST', '/v1/merchant/registration', change);
      return chainPlan(plan, 'MerchantRegistry420', 'register', [change.merchantId, change.profileId, change.metadataHash, change.payout.toLowerCase()]);
    },
    listingPlan: async (storeId: string, productId: string, change: CommerceListingChange420, metadataHash: string) => {
      const plan = await signed<CommerceTransactionPlan420>('POST', merchantPath(storeId) + `/products/${objectId(productId)}/listing-plan`, change);
      const sale = '0x6e36660fe6a85ad1f0554774375fe0e67440db0f7aeaee8659d5de63a032a364';
      const args = change.method === 'createListing' ? [change.listingId, change.sellerProfileId, change.itemClass, change.assetRef, metadataHash, change.policyId, sale, change.adapterId, change.quoteAsset.toLowerCase(), change.unitPrice, change.quantity, change.expiresAt] : [change.listingId, metadataHash, change.policyId, sale, change.adapterId, change.quoteAsset.toLowerCase(), change.unitPrice, change.quantity, change.expiresAt];
      if (plan.productId !== productId || plan.productVersion !== change.version || plan.metadataHash !== metadataHash || plan.listingId !== change.listingId || plan.revision !== (change.method === 'createListing' ? 1 : Number(change.revision) + 1)) throw new CommerceApiError420('invalid_transaction_plan', 0);
      return chainPlan(plan, 'ListingRegistry420', change.method, args);
    },
    merchantListing: (storeId: string, listingId: string) => { if (!/^0x[0-9a-f]{64}$/.test(listingId)) throw new CommerceApiError420('invalid_id', 0); return signed<{listingId: string; listing: Record<string, unknown>; provenance: Record<string, unknown>}>('GET', merchantPath(storeId) + `/listings/${listingId}`); },
    merchantOperations: (storeId: string) => signed<{items: Array<Record<string, unknown>>;totalCount:number;nextOffset:number|null;provenance:Record<string, unknown>}>('GET', merchantPath(storeId)+'/operations/orders'),
    arbitrationPrepare: (storeId:string,attemptId:string,request:{remedyHash:string}) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/orders/'+objectId(attemptId)+'/arbitration/prepare',request),
    arbitrationBind: (storeId:string,attemptId:string,request:{caseId:string}) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/orders/'+objectId(attemptId)+'/arbitration/bind',request),
    arbitrationEvidence: (storeId:string,attemptId:string,request:{evidenceHash:string}) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/orders/'+objectId(attemptId)+'/arbitration/evidence',request),
    arbitrationAppeal: (storeId:string,attemptId:string) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/orders/'+objectId(attemptId)+'/arbitration/appeal',{}),
    merchantDisputes: (storeId: string) => signed<{items:Array<Record<string,unknown>>;partial:boolean;authority:string;provenance:Record<string,unknown>}>('GET',merchantPath(storeId)+'/operations/disputes'),
    merchantNotificationPreferences: (storeId:string) => signed<Record<string,unknown>>('GET',merchantPath(storeId)+'/operations/notifications/preferences'),
    setMerchantNotificationPreferences: (storeId:string,enabled:boolean) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/notifications/preferences',{enabled}),
    merchantNotifications: (storeId:string,limit=25,cursor:string|null=null) => signed<Record<string,unknown>>('GET',merchantPath(storeId)+'/operations/notifications'+(cursor?'?limit='+encodeURIComponent(String(limit))+'&cursor='+encodeURIComponent(cursor):'?limit='+encodeURIComponent(String(limit)))),
    markMerchantNotification: (storeId:string,eventId:string,read:boolean) => signed<Record<string,unknown>>('POST',merchantPath(storeId)+'/operations/notifications/'+objectId(eventId)+'/read',{read}),
    merchantRefunds: (storeId: string) => signed<{items:Array<Record<string, unknown>>;partial:boolean;refundAuthority:string;provenance:Record<string,unknown>}>('GET',merchantPath(storeId)+'/operations/refunds'),
    merchantAnalytics: (storeId: string, offset=0, limit=100) => signed<{totals:Record<string, unknown>;byAsset:Record<string, unknown>;partial:boolean;totalCount:number;nextOffset:number|null;offset:number;limit:number;provenance:Record<string, unknown>}>('GET',merchantPath(storeId)+'/operations/analytics?offset='+encodeURIComponent(String(offset))+'&limit='+encodeURIComponent(String(limit))),
    merchantIntegrations: (storeId: string) => signed<Record<string, unknown>>('GET',merchantPath(storeId)+'/operations/integrations'),
    merchantRemedy: (storeId: string,attemptId: string,kind:'refund'|'dispute',request?:{amount:string;reasonHash:string}|{disputeHash:string}) => signed<Record<string, unknown>>('POST',merchantPath(storeId)+'/operations/orders/'+objectId(attemptId)+'/'+kind,request??{}),
    merchantBuilder: (storeId: string) => signed<Record<string, unknown>>('GET', merchantPath(storeId) + '/builder'),
    merchantStore: (storeId: string) => signed<Record<string, unknown>>('GET', merchantPath(storeId)),
    merchantSection: (storeId: string, section: 'branding' | 'categories' | 'products' | 'media') => signed<Record<string, unknown>>('GET', merchantPath(storeId) + '/' + section),
    merchantMedia: (storeId: string, mediaId: string) => signed<{ objectId: string; contentType: 'image/png'; dataBase64: string }>('GET', merchantPath(storeId) + '/media/' + objectId(mediaId)),
    updateStore: (storeId: string, change: { version: number; status: 'draft' | 'published'; slug: string; designVersion?: number; categoryVersions?: {category_id: string; version: number}[] }) => signed('PATCH', merchantPath(storeId), change),
    branding: (storeId: string, change: { version: number; avatar?: string; banner?: string; theme: 'default' | 'light' | 'dark'; description: string }) => signed('POST', merchantPath(storeId) + '/branding', change),
    delegate: (storeId: string, change: { wallet: string; scopes: ('branding' | 'catalogue' | 'categories' | 'media')[]; expiresAt: number }) => signed('POST', merchantPath(storeId) + '/delegates', change),
    category: (storeId: string, change: { id?: string; version?: number; slug: string; parent?: string; globalTaxonomy?: string; order: number; visibility: 'public' | 'hidden' }) => signed('POST', merchantPath(storeId) + '/categories', change),
    saveProduct: (storeId: string, change: { id?: string; version?: number; sku: string; description: string; media: string[]; category?: string; listingId?: string; revision?: number; publishState: 'draft' | 'published' }) => signed('POST', merchantPath(storeId) + '/products', change),
    variant: (storeId: string, productId: string, change: { id?: string; version?: number; options: Record<string, string>; sku: string; listingId?: string }) => signed('POST', merchantPath(storeId) + `/products/${objectId(productId)}/variants`, change),
    upload: (storeId: string, bytes: Uint8Array, mime: 'image/png' | 'image/jpeg' | 'image/webp') => signed<{ objectId: string; contentHash: string; contentType: 'image/png' }>('POST', merchantPath(storeId) + '/media', bytes, mime),
    cart: (change: { id?: string; version?: number; storeId: string; lines: CommerceCartLine420[] }) => signed<{ cart_id: string; version: number; reserved: false }>('POST', '/v1/carts', change),
    prepareCheckout: async (cartId: string, cartVersion: number, idempotencyKey: string) => {
      const contract = input.host?.contract('OrderRegistry420');
      if (!contract || contract.verified !== true || !/^0x[0-9a-fA-F]{40}$/.test(contract.address) || !contract.version || input.host?.network.chainIdDecimal !== input.chainId) throw new CommerceApiError420('canonical_market_unavailable', 0);
      const result = await signed<{ attempts: CommerceOrderPlan420[]; paid: false }>('POST', '/v1/checkout/prepare', { cartId, cartVersion, idempotencyKey });
      if (result.paid !== false || !Array.isArray(result.attempts) || result.attempts.length < 1 || result.attempts.length > 20) throw new CommerceApiError420('invalid_order_plan', 0);
      for (const plan of result.attempts) {
        const intent = plan.intent;
        if (('paid' in plan && plan.paid !== false) || plan.reserved !== false || plan.paymentAllowed !== false || plan.expiresAt <= now() || !intent || intent.chainId !== input.chainId || typeof intent.target !== 'string' || intent.target.toLowerCase() !== contract.address.toLowerCase() || intent.method !== 'createOrder' || intent.requiresWalletAuthorization !== true || intent.canonicalAuthority !== false || !Array.isArray(intent.args) || intent.args.length !== 6 || intent.args[0] !== plan.orderId || !/^0x[0-9a-f]{64}$/.test(String(intent.args[0])) || !/^0x[0-9a-f]{64}$/.test(String(intent.args[1])) || !Number.isInteger(intent.args[2]) || Number(intent.args[2]) < 1 || !/^[1-9][0-9]*$/.test(String(intent.args[3])) || !/^0x[0-9a-f]{40}$/.test(String(intent.args[4])) || !/^[1-9][0-9]*$/.test(String(intent.args[5]))) throw new CommerceApiError420('invalid_order_plan', 0);
      }
      return result;
    },
    checkoutStatus: (attemptId: string) => signed<CommerceStatus420>('GET', `/v1/checkout/${objectId(attemptId)}`),
    saveDelivery: (attemptId: string, value: { address: string; contact: string }) => signed('PUT', `/v1/checkout/${objectId(attemptId)}/delivery`, value),
    delivery: (attemptId: string) => signed<{ address: string; contact: string }>('GET', `/v1/checkout/${objectId(attemptId)}/delivery`),
  });
}
