import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNetworkManifest420, discoverNetwork420 } from '../src/network-discovery.mjs';
import { createContractCatalogue420 } from '../src/contract-catalogue.mjs';
import { loadIntegrationGuideRegistry420, listIntegrationGuides420 } from '../src/integration-guides.mjs';
import { createDashboardSnapshot420 } from '../src/dashboard-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const staticRoot = resolve(here, 'static');
const port = Number(process.env.PORT ?? 4420);

async function snapshot420() {
  const network = discoverNetwork420(await loadNetworkManifest420(resolve(root, 'manifests/local.example.json')));
  const catalogue = createContractCatalogue420(JSON.parse(await readFile(resolve(root, 'catalogue/local.example.json'), 'utf8')));
  const guideRegistry = await loadIntegrationGuideRegistry420(resolve(root, 'guides/registry.json'));
  return createDashboardSnapshot420({ network, contracts: catalogue, guides: listIntegrationGuides420(guideRegistry) });
}

function type420(path) {
  return ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' })[extname(path)] ?? 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405).end('method not allowed'); return; }
    if (req.url === '/api/dashboard') {
      res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
      res.end(JSON.stringify(await snapshot420()));
      return;
    }
    const relative = req.url === '/' ? 'index.html' : req.url.slice(1);
    if (!/^[a-zA-Z0-9._/-]+$/.test(relative) || relative.includes('..')) { res.writeHead(400).end('bad path'); return; }
    const path = resolve(staticRoot, relative);
    if (!path.startsWith(staticRoot)) { res.writeHead(400).end('bad path'); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': type420(path), 'cache-control':'no-store' });
    res.end(body);
  } catch (error) {
    res.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type':'text/plain; charset=utf-8' });
    res.end(error?.code === 'ENOENT' ? 'not found' : `dashboard error: ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`420 Developer Hub dashboard: http://127.0.0.1:${port}\n`);
});
