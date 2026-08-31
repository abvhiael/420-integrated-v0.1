import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
  parseEventLogs,
  zeroAddress,
} from 'viem';
import { diceAbi, diceViewAbi, wagerRouterAbi } from './abis.js';

const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type DiceParams = {
  rollUnder: boolean;
  threshold: number;
  winGrossPayout: bigint;
};

export type DiceClientAddresses = {
  dice: Address;
  diceView: Address;
  wagerRouter: Address;
  vault: Address;
  asset: Address;
};

export type PlaceDiceWagerRequest = {
  operatorId: Hex;
  gameVersionId: Hex;
  stake: bigint;
  maxGrossPayout: bigint;
  correlationKey: Hex;
  deadline: bigint;
  params: DiceParams;
};

export type PlacedDiceWager = {
  transactionHash: Hex;
  wagerId: Hex;
  reservedLiability: bigint;
  paramsHash: Hex;
};

type ConnectedPublicClient = PublicClient<Transport, Chain>;
type ConnectedWalletClient = WalletClient<Transport, Chain, Account>;

export class DiceV1Client420 {
  constructor(
    readonly publicClient: ConnectedPublicClient,
    readonly walletClient: ConnectedWalletClient,
    readonly addresses: DiceClientAddresses,
  ) {}

  async hashParams(params: DiceParams): Promise<Hex> {
    return this.publicClient.readContract({
      address: this.addresses.dice,
      abi: diceAbi,
      functionName: 'hashParams',
      args: [params],
    });
  }

  async snapshot(wagerId: Hex, params: DiceParams) {
    return this.publicClient.readContract({
      address: this.addresses.diceView,
      abi: diceViewAbi,
      functionName: 'snapshot',
      args: [wagerId, params],
    });
  }

  async approveStake(amount: bigint): Promise<Hex | null> {
    if (this.addresses.asset === zeroAddress) return null;

    return this.walletClient.writeContract({
      address: this.addresses.asset,
      abi: erc20Abi,
      functionName: 'approve',
      args: [this.addresses.vault, amount],
    });
  }

  async placeWager(request: PlaceDiceWagerRequest): Promise<PlacedDiceWager> {
    const paramsHash = await this.hashParams(request.params);
    const transactionHash = await this.walletClient.writeContract({
      address: this.addresses.wagerRouter,
      abi: wagerRouterAbi,
      functionName: 'placeWager',
      args: [{
        operatorId: request.operatorId,
        gameVersionId: request.gameVersionId,
        stake: request.stake,
        maxGrossPayout: request.maxGrossPayout,
        paramsHash,
        correlationKey: request.correlationKey,
        deadline: request.deadline,
      }],
      value: this.addresses.asset === zeroAddress ? request.stake : 0n,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: transactionHash });
    const events = parseEventLogs({
      abi: wagerRouterAbi,
      logs: receipt.logs,
      eventName: 'WagerAcceptanceCompleted',
      strict: true,
    });
    const accepted = events.find((event) => event.address.toLowerCase() === this.addresses.wagerRouter.toLowerCase());
    if (!accepted) throw new Error('WagerAcceptanceCompleted not found');

    return {
      transactionHash,
      wagerId: accepted.args.wagerId,
      reservedLiability: accepted.args.reservedLiability,
      paramsHash,
    };
  }
}
