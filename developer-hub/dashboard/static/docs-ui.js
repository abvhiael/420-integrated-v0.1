import { loadDeveloperHelpBundle, resolveDeveloperHelp } from './docs-help.js';

const labels = {
  'CTX-DEV-001': 'Developer guide',
  'CTX-DEV-002': 'Contracts & interfaces',
  'CTX-DEV-003': 'Deployment workflow',
  'CTX-DEV-004': 'Diagnostics & correlation',
  'CTX-DEV-005': 'API fallback & reliability',
  'CTX-DEV-006': 'Generated reference',
  'CTX-DEV-007': 'Networks & manifests',
  'CTX-DEV-008': 'Events & finality'
};

async function loadDashboardContext(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('/api/dashboard', { cache: 'no-store' });
  if (!response.ok) throw new Error(`dashboard ${response.status}`);
  return response.json();
}

export async function initDeveloperDocs(fetchImpl = globalThis.fetch) {
  const host = document.querySelector('#docs-help');
  const status = document.querySelector('#docs-help-status');
  if (!host || !status) return;
  host.replaceChildren();
  try {
    const [dashboard, bundle] = await Promise.all([
      loadDashboardContext(fetchImpl),
      loadDeveloperHelpBundle(fetchImpl)
    ]);
    const environment = dashboard?.network?.environment;
    status.textContent = `documentation context: ${environment || 'unknown'} · current`;
    for (const contextualId of Object.keys(labels)) {
      const resolved = resolveDeveloperHelp(bundle, contextualId, environment, 'current');
      const node = document.createElement(resolved.available ? 'a' : 'span');
      node.className = `card${resolved.available ? '' : ' unavailable'}`;
      node.textContent = resolved.available ? labels[contextualId] : `${labels[contextualId]} · unavailable`;
      node.dataset.contextualId = contextualId;
      if (resolved.available) {
        node.href = resolved.url;
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
        node.dataset.authority = resolved.authority;
      } else {
        node.ariaDisabled = 'true';
        node.dataset.reason = resolved.reason;
      }
      host.append(node);
    }
  } catch (error) {
    status.textContent = `documentation unavailable: ${error.message}`;
  }
}

if (typeof document !== 'undefined') initDeveloperDocs();
