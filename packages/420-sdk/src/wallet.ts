import type { ContractCatalogueEntry420, Sdk420 } from './index.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface WalletProvider420 {
  request<T = unknown>(method: string, params?: readonly unknown[]): Promise<T>;
}

export interface ConnectedWallet420 {
  readonly controller: string;
  readonly chainId: bigint;
}

export interface SmartAccountState420 {
  readonly controller: string;
  readonly smartAccount: string;
  readonly deployed: boolean;
  readonly factoryAddress?: string;
  readonly entryPoint?: string;
  readonly capabilityRegistry?: string;
  readonly authorizationEpoch?: bigint;
  readonly [key: string]: unknown;
}

export interface SessionRequest420 {
  readonly target: string;
  readonly value?: string | bigint;
  readonly data?: string;
}

export interface WalletRuntimeAdapter420 {
  discoverSmartAccount(
    provider: WalletProvider420,
    controller: string,
    config: { readonly factoryAddress: string }
  ): Promise<SmartAccountState420>;
  prepareSessionUserOperation(
    provider: WalletProvider420,
    smartAccount: SmartAccountState420,
    sessionKey: string,
    request: SessionRequest420
  ): Promise<unknown>;
  sendPreparedSessionUserOperation(provider: WalletProvider420, prepared: unknown): Promise<unknown>;
  confirmSessionUserOperation(provider: WalletProvider420, submitted: unknown): Promise<unknown>;
}

export class WalletSdkConfigurationError420 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletSdkConfigurationError420';
  }
}

function normalizeAddress420(value: string, label: string): string {
  if (typeof value !== 'string' || !ADDRESS_RE.test(value)) {
    throw new WalletSdkConfigurationError420(`${label} must be a 20-byte hex address`);
  }
  return value.toLowerCase();
}

function parseChainId420(value: unknown): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new WalletSdkConfigurationError420('connected wallet returned an invalid chain id');
  }
  return BigInt(value);
}

function requireCanonicalContract420(sdk: Sdk420, name: string): ContractCatalogueEntry420 {
  const contract = sdk.contract(name);
  if (!contract || contract.verified !== true) {
    throw new WalletSdkConfigurationError420(`required canonical wallet contract is missing: ${name}`);
  }
  return contract;
}

export interface WalletSdk420 {
  readonly sdk: Sdk420;
  readonly provider: WalletProvider420;
  readonly factory: ContractCatalogueEntry420;
  readonly capabilityRegistry: ContractCatalogueEntry420;
  connect(): Promise<ConnectedWallet420>;
  discoverSmartAccount(controller?: string): Promise<SmartAccountState420>;
  prepareSession(smartAccount: SmartAccountState420, sessionKey: string, request: SessionRequest420): Promise<unknown>;
  sendPreparedSession(prepared: unknown): Promise<unknown>;
  confirmSession(submitted: unknown): Promise<unknown>;
}

export function createWalletSdk420(input: {
  readonly sdk: Sdk420;
  readonly provider: WalletProvider420;
  readonly adapter: WalletRuntimeAdapter420;
  readonly smartAccountFactoryName?: string;
  readonly capabilityRegistryName?: string;
}): WalletSdk420 {
  const { sdk, provider, adapter } = input;
  const factory = requireCanonicalContract420(sdk, input.smartAccountFactoryName ?? 'SmartAccountFactory420');
  const capabilityRegistry = requireCanonicalContract420(sdk, input.capabilityRegistryName ?? 'CapabilityRegistry420');

  let connected: ConnectedWallet420 | null = null;

  async function connect(): Promise<ConnectedWallet420> {
    const [chainIdRaw, accountsRaw] = await Promise.all([
      provider.request<unknown>('eth_chainId'),
      provider.request<unknown>('eth_accounts')
    ]);
    const chainId = parseChainId420(chainIdRaw);
    if (chainId !== sdk.network.chainId) {
      throw new WalletSdkConfigurationError420('connected wallet chain does not match SDK network');
    }
    if (!Array.isArray(accountsRaw) || accountsRaw.length === 0 || typeof accountsRaw[0] !== 'string') {
      throw new WalletSdkConfigurationError420('connected wallet has no available controller account');
    }
    connected = Object.freeze({ controller: normalizeAddress420(accountsRaw[0], 'wallet controller'), chainId });
    return connected;
  }

  async function controller420(explicit?: string): Promise<string> {
    if (explicit !== undefined) return normalizeAddress420(explicit, 'wallet controller');
    return (connected ?? await connect()).controller;
  }

  return Object.freeze({
    sdk,
    provider,
    factory,
    capabilityRegistry,
    connect,
    discoverSmartAccount: async (controller?: string) => {
      const state = await adapter.discoverSmartAccount(provider, await controller420(controller), { factoryAddress: factory.address });
      const account = normalizeAddress420(state.smartAccount, 'smart account');
      if (state.factoryAddress !== undefined && normalizeAddress420(state.factoryAddress, 'smart account factory') !== factory.address.toLowerCase()) {
        throw new WalletSdkConfigurationError420('wallet runtime discovered a non-canonical smart account factory');
      }
      if (state.capabilityRegistry !== undefined && normalizeAddress420(state.capabilityRegistry, 'capability registry') !== capabilityRegistry.address.toLowerCase()) {
        throw new WalletSdkConfigurationError420('wallet runtime discovered a non-canonical capability registry');
      }
      return Object.freeze({ ...state, smartAccount: account });
    },
    prepareSession: (smartAccount, sessionKey, request) => adapter.prepareSessionUserOperation(provider, smartAccount, normalizeAddress420(sessionKey, 'session key'), request),
    sendPreparedSession: (prepared) => adapter.sendPreparedSessionUserOperation(provider, prepared),
    confirmSession: (submitted) => adapter.confirmSessionUserOperation(provider, submitted)
  });
}
