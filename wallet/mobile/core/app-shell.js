const VALID_VIEWS = new Set(['wallet', 'apps', 'activity', 'security', 'account', 'connect', 'approvals', 'settings']);

function normalizeView(view) {
  if (typeof view !== 'string' || !VALID_VIEWS.has(view)) throw new Error(`unsupported mobile view: ${view}`);
  return view;
}

export function createMobileAppShell420(initial = {}) {
  let state = Object.freeze({
    view: normalizeView(initial.view ?? 'wallet'),
    activeConnectionOrigin: initial.activeConnectionOrigin ?? null,
    pendingApprovals: Number.isInteger(initial.pendingApprovals) && initial.pendingApprovals >= 0 ? initial.pendingApprovals : 0,
    accountReady: Boolean(initial.accountReady),
    networkReady: Boolean(initial.networkReady),
    locked: initial.locked !== false,
  });

  const listeners = new Set();
  function emit(next) {
    state = Object.freeze(next);
    for (const listener of listeners) listener(state);
    return state;
  }

  return Object.freeze({
    getState() { return state; },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('app shell listener required');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate(view) { return emit({ ...state, view: normalizeView(view) }); },
    setConnection(origin) {
      if (origin !== null && (typeof origin !== 'string' || !origin.startsWith('https://'))) throw new Error('https connection origin required');
      return emit({ ...state, activeConnectionOrigin: origin });
    },
    setApprovalCount(count) {
      if (!Number.isInteger(count) || count < 0) throw new Error('non-negative approval count required');
      return emit({ ...state, pendingApprovals: count });
    },
    setReadiness({ accountReady = state.accountReady, networkReady = state.networkReady } = {}) {
      return emit({ ...state, accountReady: Boolean(accountReady), networkReady: Boolean(networkReady) });
    },
    lock() { return emit({ ...state, locked: true, activeConnectionOrigin: null, pendingApprovals: 0 }); },
    unlock() {
      if (!state.accountReady || !state.networkReady) throw new Error('wallet cannot unlock before account and network are ready');
      return emit({ ...state, locked: false });
    },
  });
}

export const MOBILE_APP_VIEWS_420 = Object.freeze([...VALID_VIEWS]);
