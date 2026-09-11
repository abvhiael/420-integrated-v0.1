import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNetworkManifest420, discoverNetwork420 } from '../src/network-discovery.mjs';
import { createContractCatalogue420 } from '../src/contract-catalogue.mjs';
import { loadIntegrationGuideRegistry420, listIntegrationGuides420 } from '../src/integration-guides.mjs';
import { createDashboardSnapshot420 } from '../src/dashboard-model.mjs';
import { createIndexerClient420 } from '../src/indexer-client.mjs';
import { createDebugClient420, createDebugControlView420 } from '../src/debug-control.mjs';
import { createServiceIdentityView420 } from '../src/service-identity.mjs';
import { createCredentialLifecycleView420 } from '../src/credential-lifecycle.mjs';
import { createStatusAggregator420, createStatusControlView420 } from '../src/status-control.mjs';
import { createSecurityQualificationReport420, createSecurityQualificationView420 } from '../src/security-qualification.mjs';
import { createQualificationEvidenceHandoff420, createQualificationHandoffView420 } from '../src/qualification-handoff.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const staticRoot = resolve(here, 'static');
const port = Number(process.env.PORT ?? 4420);

async function runtime420() {
  const network = discoverNetwork420(await loadNetworkManifest420(resolve(root, 'manifests/local.example.json')));
  const catalogue = createContractCatalogue420(JSON.parse(await readFile(resolve(root, 'catalogue/local.example.json'), 'utf8')));
  const guideRegistry = await loadIntegrationGuideRegistry420(resolve(root, 'guides/registry.json'));
  const indexer = createIndexerClient420({ network, transport: {
    async request(endpoint, { method = 'GET' } = {}) {
      const response = await fetch(endpoint, { method, headers: { accept: 'application/json' } });
      let body;
      try { body = await response.json(); } catch { throw new Error(`420Indexer HTTP ${response.status} returned non-JSON`); }
      return { status: response.status, body };
    }
  }});
  const rpcEndpoint = network.rpc[0];
  const rpc = {
    async request(method, params = []) {
      const response = await fetch(rpcEndpoint, { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }) });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
      return payload.result;
    }
  };
  return { network, catalogue, guides: listIntegrationGuides420(guideRegistry), indexer, rpc, debug: createDebugClient420({ network, indexer, rpc }) };
}

async function snapshot420() {
  const { network, catalogue, guides } = await runtime420();
  return createDashboardSnapshot420({ network, contracts: catalogue, guides });
}

async function serviceAuth420() {
  const application = JSON.parse(await readFile(resolve(root, 'service-auth/application.example.json'), 'utf8'));
  const credential = JSON.parse(await readFile(resolve(root, 'service-auth/credential.example.json'), 'utf8'));
  return { application, credential };
}

async function qualification420() {
  const profile = JSON.parse(await readFile(resolve(root, 'qualification/profile.v1.json'), 'utf8'));
  const evidencePath = process.env.DEVHUB_QUALIFICATION_EVIDENCE ? resolve(process.cwd(), process.env.DEVHUB_QUALIFICATION_EVIDENCE) : resolve(root, 'qualification/evidence.example.json');
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  return { profile, evidence };
}

async function serviceProbe420(_name, endpoint) {
  const healthUrl = `${endpoint.replace(/\/$/, '')}/health`;
  const response = await fetch(healthUrl, { method:'GET', headers:{ accept:'application/json' } });
  return { state:response.ok?'healthy':'degraded', live:response.status<500, ready:response.ok, detail:`health HTTP ${response.status}` };
}

function type420(path) {
  return ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' })[extname(path)] ?? 'application/octet-stream';
}

function json420(res, status, value) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  res.end(JSON.stringify(value));
}

function integer420(value, name) {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end('method not allowed'); return; }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/dashboard') { json420(res, 200, await snapshot420()); return; }
    if (url.pathname === '/api/qualification/view') {
      const { profile } = await qualification420();
      json420(res, 200, { qualification:createSecurityQualificationView420(profile), handoff:createQualificationHandoffView420() }); return;
    }
    if (url.pathname === '/api/qualification/report') {
      const { network } = await runtime420(); const { profile, evidence } = await qualification420();
      json420(res, 200, createSecurityQualificationReport420({ profile, evidence, network })); return;
    }
    if (url.pathname === '/api/qualification/handoff') {
      const expectedCommitSha = process.env.DEVHUB_CANDIDATE_SHA;
      if (!expectedCommitSha) { json420(res, 200, { state:'BLOCKED', reason:'DEVHUB_CANDIDATE_SHA is not configured', ...createQualificationHandoffView420() }); return; }
      const { network } = await runtime420(); const { profile, evidence } = await qualification420();
      const report = createSecurityQualificationReport420({ profile, evidence, network });
      json420(res, 200, createQualificationEvidenceHandoff420({ report, evidence, expectedCommitSha, maxAgeSeconds:86400 })); return;
    }
    if (url.pathname.startsWith('/api/qualification')) { json420(res, 404, { error:'qualification route not found' }); return; }
    if (url.pathname === '/api/status/view') { const { network } = await runtime420(); json420(res, 200, createStatusControlView420(network)); return; }
    if (url.pathname === '/api/status/check') { const { network, rpc, indexer } = await runtime420(); json420(res, 200, await createStatusAggregator420({ network, rpc, indexer, serviceProbe:serviceProbe420 }).snapshot()); return; }
    if (url.pathname.startsWith('/api/status')) { json420(res, 404, { error:'status route not found' }); return; }
    if (url.pathname === '/api/service-auth/view') {
      const { application } = await serviceAuth420();
      json420(res, 200, createServiceIdentityView420(application)); return;
    }
    if (url.pathname === '/api/service-auth/credential') {
      const { credential } = await serviceAuth420();
      const at = url.searchParams.get('at') || undefined;
      json420(res, 200, createCredentialLifecycleView420(credential, at)); return;
    }
    if (url.pathname.startsWith('/api/service-auth')) { json420(res, 404, { error:'service-auth route not found' }); return; }
    if (url.pathname.startsWith('/api/debug')) {
      const { debug } = await runtime420();
      if (url.pathname === '/api/debug/view') { json420(res, 200, createDebugControlView420(debug)); return; }
      if (url.pathname === '/api/debug/diagnostics') { json420(res, 200, await debug.diagnostics()); return; }
      if (url.pathname === '/api/debug/transaction') {
        const hash = url.searchParams.get('hash');
        if (!hash) { json420(res, 400, { error:'hash is required' }); return; }
        json420(res, 200, await debug.transaction(hash)); return;
      }
      if (url.pathname === '/api/debug/logs') {
        json420(res, 200, await debug.logs({ address:url.searchParams.get('address')||undefined, limit:integer420(url.searchParams.get('limit'),'limit'), direction:url.searchParams.get('direction')||'desc' })); return;
      }
      if (url.pathname === '/api/debug/events') {
        json420(res, 200, await debug.protocolEvents({ protocol:url.searchParams.get('protocol')||undefined, objectKey:url.searchParams.get('objectKey')||undefined, limit:integer420(url.searchParams.get('limit'),'limit'), direction:url.searchParams.get('direction')||'desc' })); return;
      }
      json420(res, 404, { error:'debug route not found' }); return;
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!/^[a-zA-Z0-9._/-]+$/.test(relative) || relative.includes('..')) { res.writeHead(400).end('bad path'); return; }
    const path = resolve(staticRoot, relative);
    if (!path.startsWith(staticRoot)) { res.writeHead(400).end('bad path'); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type':type420(path), 'cache-control':'no-store' });
    res.end(body);
  } catch (error) {
    const badRequest = ['DebugControlError420','IndexerClientError420','ServiceIdentityError420','CredentialLifecycleError420','StatusControlError420','SecurityQualificationError420','QualificationHandoffError420'].includes(error?.name);
    const status = badRequest ? 400 : (error?.code === 'ENOENT' ? 404 : 500);
    if (req.url?.startsWith('/api/')) { json420(res, status, { error:error.message }); return; }
    res.writeHead(status, { 'content-type':'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'not found' : `dashboard error: ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`420 Developer Hub dashboard: http://127.0.0.1:${port}\n`);
});
