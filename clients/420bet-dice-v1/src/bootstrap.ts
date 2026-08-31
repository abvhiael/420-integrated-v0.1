import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { DiceV1Client420 } from './client.js';
import { DicePlayerController420, type SessionValidation } from './controller.js';
import { DicePlayerShell420 } from './shell.js';
import '../dice420.css';

const betAuthorizationAbi = [
  {
    type: 'function',
    name: 'isGameAuthorized',
    stateMutability: 'view',
    inputs: [
      { name: 'principal', type: 'address' },
      { name: 'actionId', type: 'bytes32' },
      { name: 'gameId', type: 'bytes32' },
      { name: 'gameVersionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type DiceBootstrapConfig420 = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    dice: Address;
    diceView: Address;
    wagerRouter: Address;
    vault: Address;
    asset: Address;
    betAuthorization: Address;
  };
  ids: {
    gameId: Hex;
    gameVersionId: Hex;
    operatorId: Hex;
  };
  deadlineSeconds?: bigint;
  rootSelector?: string;
};

export type DiceBootstrapResult420 = {
  client: DiceV1Client420;
  controller: DicePlayerController420;
  shell: DicePlayerShell420;
};

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    __420_DICE_CONFIG__?: DiceBootstrapConfig420;
  }
}

const ACTION_PLACE = keccak256(toBytes('BET_PLACE'));

function assertConfig(config: DiceBootstrapConfig420 | undefined): asserts config is DiceBootstrapConfig420 {
  if (!config) throw new Error('window.__420_DICE_CONFIG__ is not configured');
  if (!config.rpcUrl) throw new Error('rpcUrl is required');
  if (!config.ids.gameId || !config.ids.gameVersionId || !config.ids.operatorId) throw new Error('Dice IDs are required');
}

export async function bootstrapDiceV1420(
  config = window.__420_DICE_CONFIG__,
): Promise<DiceBootstrapResult420> {
  assertConfig(config);
  if (!window.ethereum) throw new Error('No EIP-1193 wallet provider detected');

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts.length) throw new Error('Wallet returned no account');
  const account = getAddress(accounts[0]);

  const chain = defineChain({
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
  });

  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: custom(window.ethereum),
  });

  const client = new DiceV1Client420(publicClient, walletClient, {
    dice: getAddress(config.contracts.dice),
    diceView: getAddress(config.contracts.diceView),
    wagerRouter: getAddress(config.contracts.wagerRouter),
    vault: getAddress(config.contracts.vault),
    asset: getAddress(config.contracts.asset),
  });

  const validateSession = async ({ stake }: { account: Address; gameVersionId: Hex; stake: bigint }): Promise<SessionValidation> => {
    const authorized = await publicClient.readContract({
      address: getAddress(config.contracts.betAuthorization),
      abi: betAuthorizationAbi,
      functionName: 'isGameAuthorized',
      args: [account, ACTION_PLACE, config.ids.gameId, config.ids.gameVersionId, stake],
    });
    return {
      authorized,
      reason: authorized ? undefined : 'wallet/session lacks scoped BET_PLACE capability for DiceV1',
    };
  };

  const controller = new DicePlayerController420(
    client,
    {
      operatorId: config.ids.operatorId,
      gameVersionId: config.ids.gameVersionId,
      correlationKey: () => keccak256(toBytes(`${account}:${Date.now()}:${crypto.randomUUID()}`)),
      deadlineSeconds: config.deadlineSeconds ?? 300n,
    },
    validateSession,
  );

  const root = document.querySelector<HTMLElement>(config.rootSelector ?? '#dice420');
  if (!root) throw new Error(`Dice root not found: ${config.rootSelector ?? '#dice420'}`);

  const shell = new DicePlayerShell420(root, controller);
  await controller.connect();
  shell.render();

  return { client, controller, shell };
}

if (typeof window !== 'undefined' && window.__420_DICE_CONFIG__) {
  void bootstrapDiceV1420().catch((error) => {
    const root = document.querySelector<HTMLElement>(window.__420_DICE_CONFIG__?.rootSelector ?? '#dice420');
    if (root) root.textContent = error instanceof Error ? error.message : String(error);
    console.error(error);
  });
}
