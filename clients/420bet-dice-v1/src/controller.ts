import type { Address, Hex } from 'viem';
import {
  DiceV1Client420,
  type DiceParams,
  type PlaceDiceWagerRequest,
  type PlacedDiceWager,
} from './client.js';

export type DicePlayerPhase =
  | 'disconnected'
  | 'validating-session'
  | 'ready'
  | 'submitting'
  | 'waiting-randomness'
  | 'result-ready'
  | 'settled'
  | 'error';

export type DiceBetDraft = DiceParams & {
  stake: bigint;
  maxGrossPayout: bigint;
};

export type SessionValidation = {
  authorized: boolean;
  expiresAt?: bigint;
  reason?: string;
};

export type SessionValidator = (input: {
  account: Address;
  gameVersionId: Hex;
  stake: bigint;
}) => Promise<SessionValidation>;

export type DicePlayerConfig = {
  operatorId: Hex;
  gameVersionId: Hex;
  correlationKey: () => Hex;
  deadlineSeconds: bigint;
};

export type DiceHistoryEntry = {
  wagerId: Hex;
  params: DiceParams;
  stake: bigint;
  maxGrossPayout: bigint;
  transactionHash: Hex;
};

export type DiceVerification = {
  verified: boolean;
  paramsMatch: boolean;
  randomnessFulfilled: boolean;
  settlementMatchesResult: boolean;
  wagerId: Hex;
  roll?: number;
  randomnessRoot?: Hex;
  outcome?: number;
  grossPayout?: bigint;
};

export type DicePlayerState = {
  phase: DicePlayerPhase;
  account?: Address;
  session?: SessionValidation;
  draft: DiceBetDraft;
  active?: DiceHistoryEntry;
  snapshot?: Awaited<ReturnType<DiceV1Client420['snapshot']>>;
  history: DiceHistoryEntry[];
  error?: string;
};

const DEFAULT_DRAFT: DiceBetDraft = {
  rollUnder: true,
  threshold: 5000,
  stake: 0n,
  maxGrossPayout: 0n,
  winGrossPayout: 0n,
};

function assertDraft(draft: DiceBetDraft): void {
  if (draft.threshold <= 0 || draft.threshold >= 10_000) throw new Error('threshold must be between 1 and 9999');
  if (draft.stake <= 0n) throw new Error('stake must be positive');
  if (draft.winGrossPayout <= draft.stake) throw new Error('win gross payout must exceed stake');
  if (draft.maxGrossPayout < draft.winGrossPayout) throw new Error('max gross payout must cover win gross payout');
}

export function winChanceBps(draft: Pick<DiceBetDraft, 'rollUnder' | 'threshold'>): number {
  return draft.rollUnder ? draft.threshold : 10_000 - draft.threshold;
}

export class DicePlayerController420 {
  private stateValue: DicePlayerState = {
    phase: 'disconnected',
    draft: { ...DEFAULT_DRAFT },
    history: [],
  };

  constructor(
    readonly client: DiceV1Client420,
    readonly config: DicePlayerConfig,
    readonly validateSession: SessionValidator,
  ) {}

  get state(): Readonly<DicePlayerState> {
    return this.stateValue;
  }

  async connect(): Promise<Readonly<DicePlayerState>> {
    const account = this.client.walletClient.account.address;
    this.stateValue = { ...this.stateValue, phase: 'validating-session', account, error: undefined };
    return this.revalidateSession();
  }

  disconnect(): void {
    this.stateValue = {
      phase: 'disconnected',
      draft: { ...DEFAULT_DRAFT },
      history: this.stateValue.history,
    };
  }

  setBetDraft(patch: Partial<DiceBetDraft>): Readonly<DicePlayerState> {
    if (this.stateValue.phase === 'submitting') throw new Error('cannot edit while submitting');
    this.stateValue = {
      ...this.stateValue,
      draft: { ...this.stateValue.draft, ...patch },
      error: undefined,
    };
    return this.stateValue;
  }

  async revalidateSession(): Promise<Readonly<DicePlayerState>> {
    const account = this.stateValue.account ?? this.client.walletClient.account.address;
    this.stateValue = { ...this.stateValue, phase: 'validating-session', account, error: undefined };
    const session = await this.validateSession({
      account,
      gameVersionId: this.config.gameVersionId,
      stake: this.stateValue.draft.stake,
    });
    this.stateValue = {
      ...this.stateValue,
      session,
      phase: session.authorized ? 'ready' : 'error',
      error: session.authorized ? undefined : session.reason ?? 'session is not authorized for DiceV1',
    };
    return this.stateValue;
  }

  async submit(): Promise<PlacedDiceWager> {
    if (!this.stateValue.account) throw new Error('wallet not connected');
    assertDraft(this.stateValue.draft);

    const session = await this.validateSession({
      account: this.stateValue.account,
      gameVersionId: this.config.gameVersionId,
      stake: this.stateValue.draft.stake,
    });
    if (!session.authorized) {
      this.stateValue = {
        ...this.stateValue,
        phase: 'error',
        session,
        error: session.reason ?? 'session is not authorized for DiceV1',
      };
      throw new Error(this.stateValue.error);
    }

    this.stateValue = { ...this.stateValue, phase: 'submitting', session, error: undefined };
    const params: DiceParams = {
      rollUnder: this.stateValue.draft.rollUnder,
      threshold: this.stateValue.draft.threshold,
      winGrossPayout: this.stateValue.draft.winGrossPayout,
    };
    const request: PlaceDiceWagerRequest = {
      operatorId: this.config.operatorId,
      gameVersionId: this.config.gameVersionId,
      stake: this.stateValue.draft.stake,
      maxGrossPayout: this.stateValue.draft.maxGrossPayout,
      correlationKey: this.config.correlationKey(),
      deadline: BigInt(Math.floor(Date.now() / 1000)) + this.config.deadlineSeconds,
      params,
    };

    try {
      const placed = await this.client.placeWager(request);
      const active: DiceHistoryEntry = {
        wagerId: placed.wagerId,
        params,
        stake: request.stake,
        maxGrossPayout: request.maxGrossPayout,
        transactionHash: placed.transactionHash,
      };
      this.stateValue = {
        ...this.stateValue,
        phase: 'waiting-randomness',
        active,
        snapshot: undefined,
        history: [active, ...this.stateValue.history.filter((entry) => entry.wagerId !== active.wagerId)],
      };
      return placed;
    } catch (error) {
      this.stateValue = {
        ...this.stateValue,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  }

  async refresh(wagerId = this.stateValue.active?.wagerId): Promise<Readonly<DicePlayerState>> {
    if (!wagerId) throw new Error('no active wager');
    const entry = this.stateValue.history.find((item) => item.wagerId === wagerId);
    if (!entry) throw new Error('wager is not tracked by this controller');

    const snapshot = await this.client.snapshot(wagerId, entry.params);
    let phase: DicePlayerPhase = 'waiting-randomness';
    if (snapshot.resultAvailable) phase = 'result-ready';
    if (snapshot.settlementExists) phase = 'settled';

    this.stateValue = {
      ...this.stateValue,
      phase,
      active: entry,
      snapshot,
      error: undefined,
    };
    return this.stateValue;
  }

  async openHistory(wagerId: Hex): Promise<Readonly<DicePlayerState>> {
    return this.refresh(wagerId);
  }

  verifyRoll(): DiceVerification {
    const active = this.stateValue.active;
    const snapshot = this.stateValue.snapshot;
    if (!active || !snapshot) throw new Error('no loaded wager snapshot');

    const randomnessFulfilled = snapshot.randomnessRequested && snapshot.randomness.fulfilled;
    const settlementMatchesResult = !snapshot.settlementExists || (
      snapshot.resultAvailable
      && snapshot.settlement.outcome === snapshot.result.outcome
      && snapshot.settlement.grossPayout === snapshot.result.grossPayout
    );
    const verified = snapshot.paramsMatch
      && randomnessFulfilled
      && snapshot.resultAvailable
      && settlementMatchesResult;

    return {
      verified,
      paramsMatch: snapshot.paramsMatch,
      randomnessFulfilled,
      settlementMatchesResult,
      wagerId: active.wagerId,
      roll: snapshot.resultAvailable ? snapshot.result.roll : undefined,
      randomnessRoot: snapshot.resultAvailable ? snapshot.result.randomnessRoot : undefined,
      outcome: snapshot.resultAvailable ? snapshot.result.outcome : undefined,
      grossPayout: snapshot.resultAvailable ? snapshot.result.grossPayout : undefined,
    };
  }
}
