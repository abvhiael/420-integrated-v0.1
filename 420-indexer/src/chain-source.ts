export type Hex = `0x${string}`;

export interface IndexerBlock {
  number: bigint;
  hash: Hex;
  parentHash: Hex;
  timestamp: bigint;
}

export interface IndexerTransaction {
  hash: Hex;
  blockHash: Hex;
  blockNumber: bigint;
  transactionIndex: number;
  from: Hex;
  to: Hex | null;
  input: Hex;
  value: bigint;
}

export interface IndexerReceipt {
  transactionHash: Hex;
  blockHash: Hex;
  blockNumber: bigint;
  transactionIndex: number;
  status: 0 | 1;
  contractAddress: Hex | null;
  logs: IndexerLog[];
}

export interface IndexerLog {
  address: Hex;
  blockHash: Hex;
  blockNumber: bigint;
  transactionHash: Hex;
  transactionIndex: number;
  logIndex: number;
  topics: Hex[];
  data: Hex;
  removed?: boolean;
}

export interface LogFilter420 {
  fromBlock: bigint;
  toBlock: bigint;
  addresses?: Hex[];
  topics?: Array<Hex | Hex[] | null>;
}

export interface ChainSource420 {
  readonly sourceId: string;
  chainId(): Promise<bigint>;
  blockNumber(): Promise<bigint>;
  finalizedBlockNumber?(): Promise<bigint>;
  getBlockByNumber(blockNumber: bigint): Promise<IndexerBlock | null>;
  getBlockByHash(blockHash: Hex): Promise<IndexerBlock | null>;
  getTransactionByHash(transactionHash: Hex): Promise<IndexerTransaction | null>;
  getTransactionReceipt(transactionHash: Hex): Promise<IndexerReceipt | null>;
  getLogs(filter: LogFilter420): Promise<IndexerLog[]>;
  call(request: { to: Hex; data: Hex }, blockNumber?: bigint): Promise<Hex>;
  getCode(address: Hex, blockNumber?: bigint): Promise<Hex>;
}
