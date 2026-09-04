import type { Hex } from 'viem';
import {
  DicePlayerController420,
  type DiceHistoryEntry,
  type DicePlayerState,
  winChanceBps,
} from './controller.js';

export type DicePlayerShellOptions = {
  pollIntervalMs?: number;
  formatAmount?: (value: bigint) => string;
  formatAddress?: (value: string) => string;
};

const OUTCOME_LABELS = ['NONE', 'LOSS', 'PUSH', 'WIN', 'VOID'] as const;

function amountInputToBigInt(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error('amounts must be entered as integer base units');
  return BigInt(trimmed);
}

function shortHex(value?: string): string {
  if (!value) return '—';
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function outcomeLabel(value?: number): string {
  if (value === undefined) return '—';
  return OUTCOME_LABELS[value] ?? `UNKNOWN(${value})`;
}

export class DicePlayerShell420 {
  private timer?: ReturnType<typeof setInterval>;
  private mounted = false;
  private busy = false;

  constructor(
    readonly root: HTMLElement,
    readonly controller: DicePlayerController420,
    readonly options: DicePlayerShellOptions = {},
  ) {}

  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    this.render();
  }

  unmount(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.mounted = false;
    this.root.replaceChildren();
  }

  private formatAmount(value: bigint): string {
    return this.options.formatAmount?.(value) ?? value.toString();
  }

  private formatAddress(value?: string): string {
    if (!value) return 'not connected';
    return this.options.formatAddress?.(value) ?? shortHex(value);
  }

  private startPolling(): void {
    if (this.timer) clearInterval(this.timer);
    const interval = this.options.pollIntervalMs ?? 2_000;
    this.timer = setInterval(() => {
      const phase = this.controller.state.phase;
      if (phase !== 'waiting-randomness' && phase !== 'result-ready') return;
      void this.run(async () => {
        await this.controller.refresh();
      }, false);
    }, interval);
  }

  private stopPollingIfTerminal(): void {
    if (this.controller.state.phase !== 'settled') return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async run(action: () => Promise<void>, rerenderBefore = true): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    if (rerenderBefore) this.render();
    try {
      await action();
    } catch {
      // Controller owns user-visible error state where applicable.
    } finally {
      this.busy = false;
      this.stopPollingIfTerminal();
      this.render();
    }
  }

  private button(label: string, onClick: () => void, disabled = false, className = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.className = `dice420-button ${className}`.trim();
    button.addEventListener('click', onClick);
    return button;
  }

  private metric(label: string, value: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dice420-metric';
    const k = document.createElement('span');
    k.className = 'dice420-metric-label';
    k.textContent = label;
    const v = document.createElement('strong');
    v.textContent = value;
    el.append(k, v);
    return el;
  }

  private input(label: string, value: string, onChange: (value: string) => void, disabled = false): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'dice420-field';
    const title = document.createElement('span');
    title.textContent = label;
    const input = document.createElement('input');
    input.value = value;
    input.disabled = disabled;
    input.inputMode = 'numeric';
    input.addEventListener('change', () => onChange(input.value));
    wrap.append(title, input);
    return wrap;
  }

  private renderWallet(state: Readonly<DicePlayerState>): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'dice420-panel dice420-wallet';
    const h = document.createElement('h2');
    h.textContent = 'wallet & session';
    const account = document.createElement('div');
    account.className = 'dice420-account';
    account.textContent = this.formatAddress(state.account);
    panel.append(h, account);

    if (!state.account) {
      panel.append(this.button('connect wallet', () => {
        void this.run(async () => {
          await this.controller.connect();
        });
      }, this.busy));
    } else {
      const status = document.createElement('div');
      status.className = state.session?.authorized ? 'dice420-status good' : 'dice420-status bad';
      status.textContent = state.session?.authorized ? 'session authorized' : (state.session?.reason ?? 'session not authorized');
      panel.append(status);
      panel.append(this.button('revalidate session', () => {
        void this.run(async () => {
          await this.controller.revalidateSession();
        });
      }, this.busy));
    }
    return panel;
  }

  private renderControls(state: Readonly<DicePlayerState>): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'dice420-panel dice420-controls';
    const h = document.createElement('h2');
    h.textContent = 'dice';
    panel.append(h);

    const editingDisabled = this.busy || state.phase === 'submitting';
    const direction = document.createElement('div');
    direction.className = 'dice420-direction';
    direction.append(
      this.button('roll under', () => {
        this.controller.setBetDraft({ rollUnder: true });
        this.render();
      }, editingDisabled, state.draft.rollUnder ? 'active' : ''),
      this.button('roll over', () => {
        this.controller.setBetDraft({ rollUnder: false });
        this.render();
      }, editingDisabled, !state.draft.rollUnder ? 'active' : ''),
    );
    panel.append(direction);

    const grid = document.createElement('div');
    grid.className = 'dice420-grid';
    grid.append(
      this.input('threshold (1-9999)', String(state.draft.threshold), (value) => {
        this.controller.setBetDraft({ threshold: Number(value) });
        this.render();
      }, editingDisabled),
      this.input('stake (base units)', state.draft.stake.toString(), (value) => {
        try { this.controller.setBetDraft({ stake: amountInputToBigInt(value) }); } catch { /* keep prior valid draft */ }
        this.render();
      }, editingDisabled),
      this.input('win gross payout', state.draft.winGrossPayout.toString(), (value) => {
        try { this.controller.setBetDraft({ winGrossPayout: amountInputToBigInt(value) }); } catch { /* keep prior valid draft */ }
        this.render();
      }, editingDisabled),
      this.input('max gross payout', state.draft.maxGrossPayout.toString(), (value) => {
        try { this.controller.setBetDraft({ maxGrossPayout: amountInputToBigInt(value) }); } catch { /* keep prior valid draft */ }
        this.render();
      }, editingDisabled),
    );
    panel.append(grid);

    const chance = winChanceBps(state.draft);
    const metrics = document.createElement('div');
    metrics.className = 'dice420-metrics';
    metrics.append(
      this.metric('win chance', `${(chance / 100).toFixed(2)}%`),
      this.metric('stake', this.formatAmount(state.draft.stake)),
      this.metric('gross win', this.formatAmount(state.draft.winGrossPayout)),
    );
    panel.append(metrics);

    const canSubmit = state.account && state.session?.authorized && !editingDisabled;
    panel.append(this.button('place wager', () => {
      void this.run(async () => {
        await this.controller.submit();
        this.startPolling();
      });
    }, !canSubmit, 'primary'));
    return panel;
  }

  private renderLive(state: Readonly<DicePlayerState>): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'dice420-panel dice420-live';
    const h = document.createElement('h2');
    h.textContent = 'live wager';
    panel.append(h);

    if (!state.active) {
      const empty = document.createElement('p');
      empty.textContent = 'No active wager.';
      panel.append(empty);
      return panel;
    }

    panel.append(
      this.metric('wager', shortHex(state.active.wagerId)),
      this.metric('phase', state.phase),
    );

    const snapshot = state.snapshot;
    if (!snapshot) {
      const p = document.createElement('p');
      p.textContent = 'Wager accepted. Waiting for canonical chain state…';
      panel.append(p);
    } else if (!snapshot.randomness.fulfilled) {
      const p = document.createElement('p');
      p.className = 'dice420-pending';
      p.textContent = snapshot.randomnessRequested
        ? 'Randomness requested. Waiting for fulfillment…'
        : 'Waiting for randomness request…';
      panel.append(p);
    } else if (!snapshot.resultAvailable) {
      const p = document.createElement('p');
      p.className = 'dice420-pending';
      p.textContent = 'Randomness fulfilled. Waiting for canonical result…';
      panel.append(p);
    } else {
      const result = document.createElement('div');
      result.className = 'dice420-result';
      const roll = document.createElement('div');
      roll.className = 'dice420-roll';
      roll.textContent = String(snapshot.result.roll);
      const outcome = document.createElement('div');
      outcome.className = `dice420-outcome ${outcomeLabel(snapshot.result.outcome).toLowerCase()}`;
      outcome.textContent = outcomeLabel(snapshot.result.outcome);
      result.append(roll, outcome);
      panel.append(result);
      panel.append(this.metric('gross payout', this.formatAmount(snapshot.result.grossPayout)));
    }

    if (snapshot?.settlementExists) {
      const settlement = document.createElement('div');
      settlement.className = 'dice420-settlement';
      settlement.append(
        this.metric('settlement', outcomeLabel(snapshot.settlement.outcome)),
        this.metric('paid', this.formatAmount(snapshot.settlement.grossPayout)),
      );
      panel.append(settlement);
    }

    panel.append(this.button('refresh', () => {
      void this.run(async () => {
        await this.controller.refresh();
      });
    }, this.busy));
    return panel;
  }

  private renderVerification(state: Readonly<DicePlayerState>): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'dice420-panel dice420-verify';
    const h = document.createElement('h2');
    h.textContent = 'verify this roll';
    panel.append(h);

    if (!state.snapshot?.resultAvailable || !state.active) {
      const p = document.createElement('p');
      p.textContent = 'Verification becomes available after a canonical result exists.';
      panel.append(p);
      return panel;
    }

    const verification = this.controller.verifyRoll();
    const badge = document.createElement('div');
    badge.className = verification.verified ? 'dice420-verified good' : 'dice420-verified bad';
    badge.textContent = verification.verified ? 'VERIFIED' : 'NOT VERIFIED';
    panel.append(badge);
    panel.append(
      this.metric('params hash match', verification.paramsMatch ? 'yes' : 'no'),
      this.metric('randomness fulfilled', verification.randomnessFulfilled ? 'yes' : 'no'),
      this.metric('settlement matches', verification.settlementMatchesResult ? 'yes' : 'no'),
      this.metric('randomness root', shortHex(verification.randomnessRoot)),
      this.metric('roll', verification.roll === undefined ? '—' : String(verification.roll)),
      this.metric('outcome', outcomeLabel(verification.outcome)),
      this.metric('gross payout', verification.grossPayout === undefined ? '—' : this.formatAmount(verification.grossPayout)),
    );
    return panel;
  }

  private renderHistoryEntry(entry: DiceHistoryEntry): HTMLElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'dice420-history-row';
    const id = document.createElement('span');
    id.textContent = shortHex(entry.wagerId);
    const stake = document.createElement('span');
    stake.textContent = this.formatAmount(entry.stake);
    row.append(id, stake);
    row.addEventListener('click', () => {
      void this.run(async () => {
        await this.controller.openHistory(entry.wagerId as Hex);
      });
    });
    return row;
  }

  private renderHistory(state: Readonly<DicePlayerState>): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'dice420-panel dice420-history';
    const h = document.createElement('h2');
    h.textContent = 'wager history';
    panel.append(h);
    if (state.history.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No wagers in this local session.';
      panel.append(empty);
    } else {
      state.history.forEach((entry) => panel.append(this.renderHistoryEntry(entry)));
    }
    return panel;
  }

  render(): void {
    if (!this.mounted) return;
    const state = this.controller.state;
    const app = document.createElement('main');
    app.className = 'dice420-app';

    const header = document.createElement('header');
    header.className = 'dice420-header';
    const title = document.createElement('h1');
    title.textContent = '420Bet Dice';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'canonical roll • verifiable randomness • on-chain settlement';
    header.append(title, subtitle);

    const body = document.createElement('div');
    body.className = 'dice420-layout';
    const left = document.createElement('div');
    left.className = 'dice420-column';
    left.append(this.renderWallet(state), this.renderControls(state), this.renderHistory(state));
    const right = document.createElement('div');
    right.className = 'dice420-column';
    right.append(this.renderLive(state), this.renderVerification(state));
    body.append(left, right);

    app.append(header, body);
    if (state.error) {
      const error = document.createElement('div');
      error.className = 'dice420-error';
      error.textContent = state.error;
      app.append(error);
    }
    this.root.replaceChildren(app);
  }
}
