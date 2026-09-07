function freezeItems(items = []) {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

export function composeMobileScreen420(shellState = {}, context = {}) {
  const view = shellState.view ?? 'home';
  const locked = shellState.locked !== false;
  const accountReady = Boolean(shellState.accountReady);
  const networkReady = Boolean(shellState.networkReady);
  const connectionOrigin = shellState.activeConnectionOrigin ?? null;
  const pendingApprovals = Number(shellState.pendingApprovals ?? 0);

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
    case 'home':
      return Object.freeze({
        ...base,
        subtitle: context.accountLabel ?? 'SmartAccount420',
        actions: freezeItems([{ id: 'send', label: 'Send' }, { id: 'connect', label: 'Connect dApp' }]),
        sections: freezeItems([
          { id: 'balance', label: 'Balance', value: context.balance ?? null },
          { id: 'activity', label: 'Recent activity', count: Number(context.activityCount ?? 0) },
        ]),
      });
    case 'account':
      return Object.freeze({ ...base, title: 'Account', sections: freezeItems([{ id: 'address', label: 'Address', value: context.accountAddress ?? null }]) });
    case 'activity':
      return Object.freeze({ ...base, title: 'Activity', sections: freezeItems([{ id: 'activity', label: 'Transactions', count: Number(context.activityCount ?? 0) }]) });
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
