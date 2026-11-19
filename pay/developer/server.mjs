import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createPayReader, createPayRegistry } from '../../packages/420-pay-sdk/dist/index.js';
import { createPayDeveloperService } from './service.mjs';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const chainId = BigInt(config.deployment.chainId);
const rpcUrl = new URL(config.rpcUrl);
if (rpcUrl.protocol !== 'https:' || rpcUrl.username || rpcUrl.password || rpcUrl.hash)
  throw new Error('Configure an approved HTTPS Pay RPC');
let serial = 0;
const rpc = { async request(method, params) {
  const id = ++serial;
  const response = await fetch(rpcUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  if (!response.ok) throw new Error('Pay RPC unavailable');
  const body = await response.json();
  if (body.id !== id || body.jsonrpc !== '2.0' || body.error || !Object.hasOwn(body, 'result'))
    throw new Error('Invalid Pay RPC response');
  return body.result;
} };
const registry = createPayRegistry(rpc, { ...config.deployment, chainId });
const service = createPayDeveloperService({
  file: config.database, origin: registry.origin, chainId,
  credentials: config.credentials, ingestTokenHash: config.ingestTokenHash, endpoints: config.endpoints,
  async readInvoice(credential, id) {
    const latest = await registry.merchantDashboard(await registry.latestSnapshot(), credential.merchantId, credential.controller);
    if (!latest?.controller || !latest.active) return null;
    const final = await registry.latestSnapshot('finalized');
    const invoice = await createPayReader(registry.transport, final).invoice(id);
    if (invoice?.merchantId !== credential.merchantId || invoice.merchant !== credential.controller) return null;
    return registry.merchantInvoice(final, credential.merchantId, credential.controller, id);
  },
  async readEvent(input) {
    return registry.developerPaymentEvent({ chainId, blockHash: input.blockHash }, input.txHash, BigInt(input.logIndex));
  },
  async canonicalBlock(height) {
    const checkChain = async () => {
      if (BigInt(await rpc.request('eth_chainId', [])) !== chainId) throw new Error('Unexpected Pay chain');
    };
    await checkChain();
    const number = '0x' + BigInt(height).toString(16);
    const final = await rpc.request('eth_getBlockByNumber', ['finalized', false]);
    const block = await rpc.request('eth_getBlockByNumber', [number, false]);
    await checkChain();
    return block?.number === number ? { hash: block.hash, finalized: final && BigInt(final.number) >= BigInt(height) } : null;
  }
});

const server = createServer(async (req, res) => {
  try {
    if (!req.url?.startsWith('/')) throw new Error('Invalid target');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 8192) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const response = await service.handle(new Request('http://localhost' + req.url, {
      method: req.method, headers: req.headers, body: bytes ? Buffer.concat(chunks) : undefined
    }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch {
    res.writeHead(400, { 'cache-control': 'no-store' }).end();
  }
});
server.requestTimeout = 15_000;
server.listen(config.port ?? 8080, '127.0.0.1');
let working = false;
const worker = setInterval(async () => {
  if (working) return;
  working = true;
  try { await service.reconcile(); }
  catch { console.error('Pay canonicality check unavailable'); }
  try { await service.deliver(); }
  catch { console.error('Pay webhook delivery unavailable'); }
  finally { working = false; }
}, 1000);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    clearInterval(worker);
    server.close();
    const close = setInterval(() => {
      if (working) return;
      clearInterval(close);
      service.close();
    }, 100);
  });
}
