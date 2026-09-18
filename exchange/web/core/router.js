export const ROUTES = Object.freeze([
  { path: '/', id: 'markets', label: 'Markets', feature: 'markets' },
  { path: '/market', id: 'market', label: 'Market', feature: 'marketDetail' },
  { path: '/swap', id: 'swap', label: 'Swap', feature: 'swap' },
  { path: '/orders', id: 'orders', label: 'Orders', feature: 'limitOrders' },
  { path: '/bridge', id: 'bridge', label: 'Bridge', feature: 'bridge' },
  { path: '/portfolio', id: 'portfolio', label: 'Portfolio', feature: 'portfolio' },
]);

export function routeFor(pathname) {
  const safe = typeof pathname === 'string' && pathname.startsWith('/') && !pathname.includes('\\') ? pathname : '/';
  return ROUTES.find((route) => route.path === safe) ?? ROUTES[0];
}
