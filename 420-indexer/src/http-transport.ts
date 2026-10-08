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
const MAX_PATH_PARAM_LENGTH_420 = 512;

class InvalidRequest420 extends Error {}

function invalidRequest420(message: string): never {
  throw new InvalidRequest420(message);
}

function ok420<T>(data: T, status = 200): HttpJsonResponse420 {
  return { status, headers: JSON_HEADERS_420, body: { apiVersion: INDEXER_API_VERSION_420, data } satisfies ApiEnvelope420<T> };
}

function error420(status: number, code: string, message: string): HttpJsonResponse420 {
  return { status, headers: JSON_HEADERS_420, body: { apiVersion: INDEXER_API_VERSION_420, error: { code, message } } satisfies ApiErrorEnvelope420 };
}

function parseChainId420(raw: string | null): bigint {
  if (!raw || !/^\d+$/.test(raw)) invalidRequest420('chainId must be an unsigned integer');
  return BigInt(raw);
}

function optionalLimit420(url: URL): number | undefined {
  const raw = url.searchParams.get('limit');
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) invalidRequest420('limit must be an integer between 1 and 200');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 200) invalidRequest420('limit must be an integer between 1 and 200');
  return value;
}

function optionalDirection420(url: URL): QueryDirection420 | undefined {
  const raw = url.searchParams.get('direction');
  if (raw === null) return undefined;
  if (raw !== 'asc' && raw !== 'desc') invalidRequest420('direction must be asc or desc');
  return raw;
}

function optionalBigint420(url: URL, name: string): bigint | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) invalidRequest420(`${name} must be an unsigned integer`);
  return BigInt(raw);
}

function pageRequest420(url: URL) {
  return {
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: optionalLimit420(url),
    direction: optionalDirection420(url)
  };
}

function pathParams420(path: string, pattern: RegExp): string[] | null {
  const match = pattern.exec(path);
  if (!match) return null;
  try {
    const values = match.slice(1).map((value) => decodeURIComponent(value ?? ''));
    if (values.some((value) => value.length > MAX_PATH_PARAM_LENGTH_420)) invalidRequest420('path parameter exceeds maximum length');
    return values;
  } catch (error) {
    if (error instanceof InvalidRequest420) throw error;
    invalidRequest420('invalid path parameter encoding');
  }
}

function pathParam420(path: string, pattern: RegExp): string | null {
  const values = pathParams420(path, pattern);
  return values?.[0] || null;
}

export async function routeIndexerHttp420(api: IndexerPublicApi420, method: string, requestUrl: string): Promise<HttpJsonResponse420> {
  if (method.toUpperCase() !== 'GET') return error420(405, 'method_not_allowed', 'only GET is supported');

  let url: URL;
  try { url = new URL(requestUrl, 'http://420-indexer.local'); }
  catch { return error420(400, 'invalid_request', 'invalid request URL'); }

  try {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/health') return ok420(await api.health());
    if (path === '/v1') return ok420({ version: api.version });

    const chainId = parseChainId420(url.searchParams.get('chainId'));
    if (path === '/ready') {
      const readiness = await api.readiness(chainId);
      return ok420(readiness, readiness.ready ? 200 : 503);
    }
    if (path === '/v1/status') return ok420(await api.status(chainId));

    const receiptHash = pathParam420(path, /^\/v1\/transactions\/([^/]+)\/receipt$/);
    if (receiptHash !== null) {
      const receipt = await api.receipt(chainId, receiptHash);
      return receipt ? ok420(receipt) : error420(404, 'not_found', 'receipt not found');
    }

    const protocolObjectParams = pathParams420(path, /^\/v1\/protocols\/([^/]+)\/objects\/([^/]+)$/);
    if (protocolObjectParams !== null) {
      const [protocol, objectKey] = protocolObjectParams;
      if (!protocol || !objectKey) return error420(400, 'invalid_request', 'protocol and object key are required');
      const object = await api.protocolObject(chainId, protocol, objectKey);
      return object ? ok420(object) : error420(404, 'not_found', 'protocol object not found');
    }


    const computeReputationId = pathParam420(path, /^\/v1\/compute\/reputation\/([^/]+)$/);
    if (computeReputationId !== null) { if(!api.computeReputationReference) return error420(503,'unavailable','Compute reputation surface unavailable'); const value=await api.computeReputationReference(chainId,computeReputationId); return value?ok420(value):error420(404,'not_found','Compute reputation reference not found'); }
    const computeStakeId = pathParam420(path, /^\/v1\/compute\/stake\/([^/]+)$/);
    if (computeStakeId !== null) { if(!api.computeStakeReference) return error420(503,'unavailable','Compute stake surface unavailable'); const value=await api.computeStakeReference(chainId,computeStakeId); return value?ok420(value):error420(404,'not_found','Compute stake reference not found'); }
    const computeWorkerReputation = pathParam420(path, /^\/v1\/compute\/workers\/([^/]+)\/reputation$/);
    if (computeWorkerReputation !== null) { if(!api.computeReputationReferences) return error420(503,'unavailable','Compute reputation surface unavailable'); return ok420(await api.computeReputationReferences(chainId,computeWorkerReputation,pageRequest420(url))); }
    const computeWorkerStake = pathParam420(path, /^\/v1\/compute\/workers\/([^/]+)\/stake$/);
    if (computeWorkerStake !== null) { if(!api.computeStakeReferences) return error420(503,'unavailable','Compute stake surface unavailable'); return ok420(await api.computeStakeReferences(chainId,computeWorkerStake,pageRequest420(url))); }

    const computeJobId = pathParam420(path, /^\/v1\/compute\/jobs\/([^/]+)$/);
    if (computeJobId !== null) { if(!api.computeJob) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeJob(chainId,computeJobId); return value?ok420(value):error420(404,'not_found','Compute job not found'); }
    const computeRequestId = pathParam420(path, /^\/v1\/compute\/requests\/([^/]+)$/);
    if (computeRequestId !== null) { if(!api.computeRequest) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeRequest(chainId,computeRequestId); return value?ok420(value):error420(404,'not_found','Compute request not found'); }
    const computeWorkerId = pathParam420(path, /^\/v1\/compute\/workers\/([^/]+)$/);
    if (computeWorkerId !== null) { if(!api.computeWorker) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeWorker(chainId,computeWorkerId); return value?ok420(value):error420(404,'not_found','Compute worker not found'); }
    const computeVerifierId = pathParam420(path, /^\/v1\/compute\/verifiers\/([^/]+)$/);
    if (computeVerifierId !== null) { if(!api.computeVerifier) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeVerifier(chainId,computeVerifierId); return value?ok420(value):error420(404,'not_found','Compute verifier not found'); }
    const computeProjectId = pathParam420(path, /^\/v1\/compute\/research\/projects\/([^/]+)$/);
    if (computeProjectId !== null) { if(!api.computeResearchProject) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeResearchProject(chainId,computeProjectId); return value?ok420(value):error420(404,'not_found','Compute research project not found'); }
    const computeRewardId = pathParam420(path, /^\/v1\/compute\/rewards\/([^/]+)$/);
    if (computeRewardId !== null) { if(!api.computeReward) return error420(503,'unavailable','Compute indexer surface unavailable'); const value=await api.computeReward(chainId,computeRewardId); return value?ok420(value):error420(404,'not_found','Compute reward not found'); }

    const aiProviderId = pathParam420(path, /^\/v1\/ai\/providers\/([^/]+)$/);
    if (aiProviderId !== null) { const value = await api.aiProvider(chainId, aiProviderId); return value ? ok420(value) : error420(404, 'not_found', 'AI provider not found'); }
    const aiModelVersionId = pathParam420(path, /^\/v1\/ai\/model-versions\/([^/]+)$/);
    if (aiModelVersionId !== null) { const value = await api.aiModelVersion(chainId, aiModelVersionId); return value ? ok420(value) : error420(404, 'not_found', 'AI model version not found'); }
    const aiModelId = pathParam420(path, /^\/v1\/ai\/models\/([^/]+)$/);
    if (aiModelId !== null) { const value = await api.aiModel(chainId, aiModelId); return value ? ok420(value) : error420(404, 'not_found', 'AI model not found'); }
    const aiDeploymentId = pathParam420(path, /^\/v1\/ai\/deployments\/([^/]+)$/);
    if (aiDeploymentId !== null) { const value = await api.aiDeployment(chainId, aiDeploymentId); return value ? ok420(value) : error420(404, 'not_found', 'AI deployment not found'); }
    const aiJobId = pathParam420(path, /^\/v1\/ai\/jobs\/([^/]+)$/);
    if (aiJobId !== null) { const value = await api.aiJob(chainId, aiJobId); return value ? ok420(value) : error420(404, 'not_found', 'AI job not found'); }
    const aiPolicyId = pathParam420(path, /^\/v1\/ai\/policies\/([^/]+)$/);
    if (aiPolicyId !== null) { const value = await api.aiPolicy(chainId, aiPolicyId); return value ? ok420(value) : error420(404, 'not_found', 'AI policy not found'); }
    const aiReputationId = pathParam420(path, /^\/v1\/ai\/reputation\/([^/]+)$/);
    if (aiReputationId !== null) { const value = await api.aiReputation(chainId, aiReputationId); return value ? ok420(value) : error420(404, 'not_found', 'AI reputation not found'); }

    const treasuryBudgetId = pathParam420(path, /^\/v1\/treasury\/budgets\/([^/]+)$/);
    if (treasuryBudgetId !== null) {
      const budget = await api.treasuryBudget(chainId, treasuryBudgetId);
      return budget ? ok420(budget) : error420(404, 'not_found', 'Treasury budget not found');
    }

    const treasuryDisbursementId = pathParam420(path, /^\/v1\/treasury\/disbursements\/([^/]+)$/);
    if (treasuryDisbursementId !== null) {
      const disbursement = await api.treasuryDisbursement(chainId, treasuryDisbursementId);
      return disbursement ? ok420(disbursement) : error420(404, 'not_found', 'Treasury disbursement not found');
    }

    const grantsProgramId = pathParam420(path, /^\/v1\/grants\/programs\/([^/]+)$/);
    if (grantsProgramId !== null) {
      const program = await api.grantsProgram(chainId, grantsProgramId);
      return program ? ok420(program) : error420(404, 'not_found', 'Grants program not found');
    }

    const grantsApplicationId = pathParam420(path, /^\/v1\/grants\/applications\/([^/]+)$/);
    if (grantsApplicationId !== null) {
      const application = await api.grantsApplication(chainId, grantsApplicationId);
      return application ? ok420(application) : error420(404, 'not_found', 'Grants application not found');
    }

    const grantsAwardId = pathParam420(path, /^\/v1\/grants\/awards\/([^/]+)$/);
    if (grantsAwardId !== null) {
      const award = await api.grantsAward(chainId, grantsAwardId);
      return award ? ok420(award) : error420(404, 'not_found', 'Grants award not found');
    }

    const grantsMilestoneId = pathParam420(path, /^\/v1\/grants\/milestones\/([^/]+)$/);
    if (grantsMilestoneId !== null) {
      const milestone = await api.grantsMilestone(chainId, grantsMilestoneId);
      return milestone ? ok420(milestone) : error420(404, 'not_found', 'Grants milestone not found');
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
    if (path === '/v1/compute/jobs') { if(!api.computeJobs) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeJobs(chainId,{...pageRequest420(url),owner:url.searchParams.get('owner')??undefined,status:url.searchParams.get('status')??undefined})); }
    if (path === '/v1/compute/workers') { if(!api.computeWorkers) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeWorkers(chainId,{...pageRequest420(url),operator:url.searchParams.get('operator')??undefined})); }
    if (path === '/v1/compute/verifiers') { if(!api.computeVerifiers) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeVerifiers(chainId,{...pageRequest420(url),authority:url.searchParams.get('authority')??undefined})); }
    if (path === '/v1/compute/research/projects') { if(!api.computeResearchProjects) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeResearchProjects(chainId,{...pageRequest420(url),owner:url.searchParams.get('owner')??undefined})); }
    if (path === '/v1/compute/rewards') { if(!api.computeRewards) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeRewards(chainId,{...pageRequest420(url),beneficiary:url.searchParams.get('beneficiary')??undefined})); }
    if (path === '/v1/compute/contributions') { if(!api.computeContributions) return error420(503,'unavailable','Compute indexer surface unavailable'); return ok420(await api.computeContributions(chainId,{...pageRequest420(url),contributor:url.searchParams.get('contributor')??undefined})); }

    if (path === '/v1/ai/providers') return ok420(await api.aiProviders(chainId, pageRequest420(url)));
    if (path === '/v1/ai/models') return ok420(await api.aiModels(chainId, pageRequest420(url)));
    if (path === '/v1/ai/model-versions') return ok420(await api.aiModelVersions(chainId, pageRequest420(url)));
    if (path === '/v1/ai/deployments') return ok420(await api.aiDeployments(chainId, pageRequest420(url)));
    if (path === '/v1/ai/jobs') return ok420(await api.aiJobs(chainId, pageRequest420(url)));
    if (path === '/v1/ai/policies') return ok420(await api.aiPolicies(chainId, pageRequest420(url)));
    if (path === '/v1/ai/reputation') return ok420(await api.aiReputations(chainId, pageRequest420(url)));
    if (path === '/v1/search') {
      const q = url.searchParams.get('q')?.trim() ?? '';
      if (!q) return error420(400, 'invalid_request', 'q is required');
      return ok420(await api.search(chainId, q, optionalLimit420(url)));
    }

    return error420(404, 'not_found', 'route not found');
  } catch (error) {
    if (error instanceof InvalidRequest420) return error420(400, 'invalid_request', error.message);
    return error420(500, 'internal_error', 'internal server error');
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
