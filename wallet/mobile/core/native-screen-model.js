function freezeItems(items = []) {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeAssets(items = []) {
  return freezeItems(items.map((item) => ({
    symbol: item.symbol ?? null,
    name: item.name ?? null,
    balance: item.balance ?? null,
    fiatValue: item.fiatValue ?? null,
  })));
}

function normalizeApps(items = []) {
  return freezeItems(items.map((item) => ({
    id: item.id ?? null,
    name: item.name ?? null,
    url: typeof item.url === 'string' && item.url.startsWith('https://') ? item.url : null,
    category: item.category ?? null,
  })));
}

function normalizeActivity(items = []) {
  return freezeItems(items.map((item) => ({
    id: item.id ?? null,
    kind: item.kind ?? 'user-operation',
    status: item.status ?? 'unknown',
    chainId: item.chainId ?? null,
    hash: item.hash ?? null,
    timestamp: item.timestamp ?? null,
  })));
}

export function composeMobileScreen420(shellState = {}, context = {}) {
  const view = shellState.view ?? 'wallet';
  const locked = shellState.locked !== false;
  const accountReady = Boolean(shellState.accountReady);
  const networkReady = Boolean(shellState.networkReady);
  const connectionOrigin = shellState.activeConnectionOrigin ?? null;
  const pendingApprovals = safeCount(shellState.pendingApprovals);

  const base = {
    view,
    locked,
    title: '420 Wallet',
    connectionOrigin,
    pendingApprovals,
    actions: [],
    sections: [],
  };

  if (locked) {
    return Object.freeze({
      ...base,
      title: 'Unlock 420 Wallet',
      subtitle: accountReady && networkReady ? 'ready to unlock' : 'preparing wallet',
      actions: freezeItems(accountReady && networkReady ? [{ id: 'unlock', label: 'Unlock wallet' }] : []),
      sections: freezeItems([]),
    });
  }

  switch (view) {
    case 'wallet':
      return Object.freeze({
        ...base,
        subtitle: context.accountLabel ?? 'SmartAccount420',
        actions: freezeItems([
          { id: 'send', label: 'Send' },
          { id: 'receive', label: 'Receive' },
          { id: 'connect', label: 'Connect dApp' },
        ]),
        sections: freezeItems([
          { id: 'portfolio', label: 'Portfolio', totalValue: context.totalValue ?? null, assets: normalizeAssets(context.assets) },
          { id: 'activity', label: 'Recent activity', count: safeCount(context.activityCount) },
        ]),
      });
    case 'apps':
      return Object.freeze({
        ...base,
        title: 'Apps',
        subtitle: '420 Integrated ecosystem',
        sections: freezeItems([
          { id: 'featured-apps', label: 'Featured', apps: normalizeApps(context.apps) },
        ]),
      });
    case 'activity':
      return Object.freeze({
        ...base,
        title: 'Activity',
        sections: freezeItems([
          { id: 'user-operations', label: 'UserOperations', count: safeCount(context.activityCount), items: normalizeActivity(context.activity) },
        ]),
      });
    case 'security':
      return Object.freeze({
        ...base,
        title: 'Security',
        subtitle: 'Device and account security',
        sections: freezeItems([
          { id: 'passkeys', label: 'Passkeys', count: safeCount(context.passkeyCount), status: context.passkeyStatus ?? 'unknown' },
          { id: 'sessions', label: 'Sessions', count: safeCount(context.sessionCount), status: context.sessionStatus ?? 'unknown' },
          { id: 'permissions', label: 'dApp permissions', count: safeCount(context.permissionCount) },
          { id: 'recovery', label: 'Recovery', status: context.recoveryStatus ?? 'unknown' },
          { id: 'device', label: 'Device', status: context.deviceStatus ?? 'unknown' },
        ]),
        actions: freezeItems([
          { id: 'manage-passkeys', label: 'Manage passkeys' },
          { id: 'manage-sessions', label: 'Manage sessions' },
          { id: 'manage-permissions', label: 'Manage permissions' },
          { id: 'manage-recovery', label: 'Recovery settings' },
        ]),
      });
    case 'account':
      return Object.freeze({ ...base, title: 'Account', sections: freezeItems([{ id: 'address', label: 'Address', value: context.accountAddress ?? null }]) });
    case 'connect':
      return Object.freeze({ ...base, title: 'Connect dApp', sections: freezeItems([{ id: 'connection', label: 'Connected origin', value: connectionOrigin }]) });
    case 'approvals':
      return Object.freeze({ ...base, title: 'Approvals', sections: freezeItems([{ id: 'pending', label: 'Pending approvals', count: pendingApprovals }]) });
    case 'settings':
      return Object.freeze({ ...base, title: 'Settings', actions: freezeItems([{ id: 'lock', label: 'Lock wallet' }]) });
    default:
      throw new Error(`unsupported mobile screen view: ${view}`);
  }
}
