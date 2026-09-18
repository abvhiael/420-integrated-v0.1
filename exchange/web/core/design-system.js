export const STATUS_META = Object.freeze({
  canonical: { label: 'Canonical', tone: 'positive', symbol: '✓', description: 'Confirmed on the current canonical chain.' },
  finalized: { label: 'Finalized', tone: 'positive', symbol: '◆', description: 'Finalized beyond the configured rollback boundary.' },
  stale: { label: 'Stale', tone: 'warning', symbol: '!', description: 'Data exceeded the qualified freshness bound.' },
  reorg: { label: 'Reorg', tone: 'warning', symbol: '↺', description: 'Previously canonical data was orphaned by a chain reorganization.' },
  replacement: { label: 'Replaced', tone: 'info', symbol: '↔', description: 'A canonical replacement record supersedes an affected record.' },
  degraded: { label: 'Degraded', tone: 'danger', symbol: '×', description: 'One or more qualified data or route guarantees are unavailable.' },
  routeHealthy: { label: 'Route healthy', tone: 'positive', symbol: '✓', description: 'The selected execution route reports healthy.' },
  routeUnhealthy: { label: 'Route unhealthy', tone: 'danger', symbol: '×', description: 'The execution route is not safe to submit.' },
  settlementHealthy: { label: 'Settlement healthy', tone: 'positive', symbol: '✓', description: 'Settlement dependencies report healthy.' },
  settlementUnhealthy: { label: 'Settlement unhealthy', tone: 'danger', symbol: '×', description: 'Settlement dependencies are unhealthy.' },
});

export function statusMeta(state) {
  const meta = STATUS_META[state];
  if (!meta) throw new Error(`unknown Exchange status: ${state}`);
  return meta;
}

export function createStatusBadge(documentRef, state, detail = null) {
  const meta = statusMeta(state);
  const badge = documentRef.createElement('span');
  badge.className = 'exchange-status';
  badge.dataset.state = state;
  badge.dataset.tone = meta.tone;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', detail ? `${meta.label}: ${detail}` : meta.description);

  const symbol = documentRef.createElement('span');
  symbol.className = 'exchange-status__symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = meta.symbol;

  const label = documentRef.createElement('span');
  label.textContent = detail ? `${meta.label} · ${detail}` : meta.label;

  badge.append(symbol, label);
  return badge;
}

export function formatCompactHash(value) {
  if (!value) return '—';
  if (typeof value !== 'string' || value.length < 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatTimestamp(value, locale = 'en-CA') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}
