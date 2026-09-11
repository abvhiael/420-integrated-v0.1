export interface NativeCurrency420 {
  readonly name: string;
  readonly symbol: '420';
  readonly decimals: number;
}

export interface NetworkDiscovery420 {
  readonly schemaVersion: string;
  readonly name: string;
  readonly environment: 'local' | 'devnet' | 'testnet' | 'mainnet';
  readonly chainId: bigint;
  readonly chainIdDecimal: string;
  readonly nativeCurrency: NativeCurrency420;
  readonly rpc: {
    readonly http: readonly string[];
    readonly websocket: readonly string[];
  };
  service(name: string): string | null;
  readonly canRequestFaucet: boolean;
  readonly isProduction: boolean;
}

export interface ContractCatalogueEntry420 {
  readonly name: string;
  readonly protocol: string;
  readonly address: string;
  readonly source: 'genesis' | 'registry' | 'governance' | 'deployment-manifest';
  readonly version: string;
  readonly deploymentBlock: number;
  readonly artifact: string;
  readonly interface: string;
  readonly abiSha256: string;
  readonly verified: true;
}

export interface ContractCatalogue420 {
  readonly schemaVersion: string;
  readonly chainId: bigint;
  readonly chainIdDecimal: string;
  list(): readonly ContractCatalogueEntry420[];
  get(name: string): ContractCatalogueEntry420 | null;
  getByAddress(address: string): ContractCatalogueEntry420 | null;
}

export interface RpcRequest420 {
  readonly method: string;
  readonly params?: readonly unknown[];
}

export interface JsonRpcTransport420 {
  request<T = unknown>(endpoint: string, request: RpcRequest420): Promise<T>;
}

export class SdkConfigurationError420 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SdkConfigurationError420';
  }
}

export interface Sdk420 {
  readonly network: NetworkDiscovery420;
  readonly contracts: ContractCatalogue420;
  readonly rpcHttp: string;
  service(name: string): string | null;
  contract(name: string): ContractCatalogueEntry420 | null;
  contractByAddress(address: string): ContractCatalogueEntry420 | null;
  rpc<T = unknown>(request: RpcRequest420): Promise<T>;
}

export function createSdk420(input: {
  readonly network: NetworkDiscovery420;
  readonly contracts: ContractCatalogue420;
  readonly transport: JsonRpcTransport420;
  readonly rpcEndpoint?: string;
}): Sdk420 {
  const { network, contracts, transport } = input;

  if (network.chainId !== contracts.chainId || network.chainIdDecimal !== contracts.chainIdDecimal) {
    throw new SdkConfigurationError420('network and contract catalogue chain identity mismatch');
  }

  const rpcEndpoint = input.rpcEndpoint ?? network.rpc.http[0];
  if (!rpcEndpoint || !network.rpc.http.includes(rpcEndpoint)) {
    throw new SdkConfigurationError420('SDK RPC endpoint must be declared by network discovery');
  }

  return Object.freeze({
    network,
    contracts,
    rpcHttp: rpcEndpoint,
    service: (name: string) => network.service(name),
    contract: (name: string) => contracts.get(name),
    contractByAddress: (address: string) => contracts.getByAddress(address),
    rpc: <T = unknown>(request: RpcRequest420) => transport.request<T>(rpcEndpoint, request)
  });
}

export * from './wallet.js';
