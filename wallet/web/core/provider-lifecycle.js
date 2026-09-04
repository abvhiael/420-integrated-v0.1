const EVENTS = Object.freeze(['accountsChanged', 'chainChanged', 'disconnect']);

export function installProviderLifecycle(provider, handlers = {}) {
  if (!provider || typeof provider.on !== 'function') return () => {};
  const bindings = [];
  for (const eventName of EVENTS) {
    const handler = handlers[eventName];
    if (typeof handler !== 'function') continue;
    provider.on(eventName, handler);
    bindings.push([eventName, handler]);
  }
  return () => {
    if (typeof provider.removeListener !== 'function') return;
    for (const [eventName, handler] of bindings) provider.removeListener(eventName, handler);
  };
}

export function shouldReloadForAccounts(accounts) {
  if (!Array.isArray(accounts)) return true;
  if (accounts.length === 0) return true;
  return typeof accounts[0] !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(accounts[0]);
}

export function installFailClosedBrowserLifecycle(provider = globalThis.ethereum, locationObject = globalThis.location) {
  if (!provider || !locationObject || typeof locationObject.reload !== 'function') return () => {};
  const reload = () => locationObject.reload();
  return installProviderLifecycle(provider, {
    accountsChanged: reload,
    chainChanged: reload,
    disconnect: reload,
  });
}
