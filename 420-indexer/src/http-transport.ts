import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { INDEXER_API_VERSION_420, type IndexerPublicApi420 } from './api-surface.js';
import type { QueryDirection420 } from './query-layer.js';

export interface HttpJsonResponse420 {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiEnvelope420<T> {
  apiVersion: typeof INDEXER_API_VERSION_420;
  data: T;
}

export interface ApiErrorEnvelope420 {
  apiVersion: typeof INDEXER_API_VERSION_420;
  error: { code: string; message: string };
}

const JSON_HEADERS_420 = { 'content-type': 'application/json; charset=utf-8' };

function ok420<T>(data: T, status = 200): HttpJsonResponse420 {
  return { status, headers: JSON_HEADERS_420, body: { apiVersion: INDEXER_API_VERSION_420, data } satisfies ApiEnvelope420<T> };
}

function error420(status: number, code: string, message: string): HttpJsonResponse420 {
  return { status, headers: JSON_HEADERS_420, body: { apiVersion: INDEXER_API_VERSION_420, error: { code, message } } satisfies ApiErrorEnvelope420 };
}

function parseChainId420(raw: string | null): bigint {
  if (!raw || !/^\d+$/.test(raw)) throw new Error('chainId must be an unsigned integer');
  return BigInt(raw);
}

function optionalLimit420(url: URL): number | undefined {
  const raw = url.searchParams.get('limit');
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) throw new Error('limit must be an integer between 1 and 200');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 200) throw new Error('limit must be an integer between 1 and 200');
  return value;
}

function optionalDirection420(url: URL): QueryDirection420 | undefined {
  const raw = url.searchParams.get('direction');
  if (raw === null) return undefined;
  if (raw !== 'asc' && raw !== 'desc') throw new Error('direction must be asc or desc');
  return raw;
}

function optionalBigint420(url: URL, name: string): bigint | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an unsigned integer`);
  return BigInt(raw);
}

function pageRequest420(url: URL) {
  return {
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: optionalLimit420(url),
    direction: optionalDirection420(url)
  };
}

function pathParam420(path: string, pattern: RegExp): string | null {
  const match = pattern.exec(path);
  if (!match?.[1]) return null;
  try { return decodeURIComponent(match[1]); }
  catch { throw new Error('invalid path parameter encoding'); }
}

export async function routeIndexerHttp420(api: IndexerPublicApi420, method: string, requestUrl: string): Promise<HttpJsonResponse420> {
  if (method.toUpperCase() !== 'GET') return error420(405, 'method_not_allowed', 'only GET is supported');

  let url: URL;
  try { url = new URL(requestUrl, 'http://420-indexer.local'); }
  catch { return error420(400, 'invalid_request', 'invalid request URL'); }

  try {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/v1') return ok420({ version: api.version });

    const chainId = parseChainId420(url.searchParams.get('chainId'));

    const receiptHash = pathParam420(path, /^\/v1\/transactions\/([^/]+)\/receipt$/);
    if (receiptHash !== null) {
      const receipt = await api.receipt(chainId, receiptHash);
      return receipt ? ok420(receipt) : error420(404, 'not_found', 'receipt not found');
    }

    const blockId = pathParam420(path, /^\/v1\/blocks\/([^/]+)$/);
    if (blockId !== null) {
      const block = await api.block(chainId, blockId);
      return block ? ok420(block) : error420(404, 'not_found', 'block not found');
    }

    const txHash = pathParam420(path, /^\/v1\/transactions\/([^/]+)$/);
    if (txHash !== null) {
      const transaction = await api.transaction(chainId, txHash);
      return transaction ? ok420(transaction) : error420(404, 'not_found', 'transaction not found');
    }

    const addressValue = pathParam420(path, /^\/v1\/addresses\/([^/]+)$/);
    if (addressValue !== null) {
      const address = await api.address(chainId, addressValue);
      return address ? ok420(address) : error420(404, 'not_found', 'address not found');
    }

    if (path === '/v1/blocks') return ok420(await api.blocks(chainId, pageRequest420(url)));
    if (path === '/v1/transactions') {
      return ok420(await api.transactions(chainId, { ...pageRequest420(url), address: url.searchParams.get('address') ?? undefined }));
    }
    if (path === '/v1/logs') {
      return ok420(await api.logs(chainId, { ...pageRequest420(url), address: url.searchParams.get('address') ?? undefined }));
    }
    if (path === '/v1/assets/transfers') {
      return ok420(await api.assetTransfers(chainId, {
        ...pageRequest420(url),
        assetKey: url.searchParams.get('assetKey') ?? undefined,
        address: url.searchParams.get('address') ?? undefined,
        beforeBlock: optionalBigint420(url, 'beforeBlock')
      }));
    }
    if (path === '/v1/protocols/events') {
      return ok420(await api.protocolEvents(chainId, {
        ...pageRequest420(url),
        protocol: url.searchParams.get('protocol') ?? undefined,
        objectKey: url.searchParams.get('objectKey') ?? undefined
      }));
    }
    if (path === '/v1/search') {
      const q = url.searchParams.get('q')?.trim() ?? '';
      if (!q) return error420(400, 'invalid_request', 'q is required');
      return ok420(await api.search(chainId, q, optionalLimit420(url)));
    }

    return error420(404, 'not_found', 'route not found');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid request';
    return error420(400, 'invalid_request', message);
  }
}

function writeJson420(response: ServerResponse, result: HttpJsonResponse420): void {
  response.writeHead(result.status, result.headers);
  response.end(JSON.stringify(result.body));
}

export function createIndexerHttpServer420(api: IndexerPublicApi420): Server {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      writeJson420(response, await routeIndexerHttp420(api, request.method ?? 'GET', request.url ?? '/'));
    } catch {
      writeJson420(response, error420(500, 'internal_error', 'internal server error'));
    }
  });
}
