import { Contract, JsonRpcProvider, getAddress } from 'ethers';
import type { CanonicalStatePort420, CanonicalWork420, Hex32 } from './types.js';

const B32 = /^0x[0-9a-fA-F]{64}$/;
const ZERO = '0x' + '00'.repeat(32);
const AI_STATES = ['NONE','CREATED','FUNDED','MATCHED','ACCEPTED','RUNNING','RESULT_COMMITTED','VERIFIED','SETTLED','CANCELLED','EXPIRED','FAILED','DISPUTED','REFUNDED'] as const;
const COMPUTE_STATES = ['NONE','CREATED','MATCHED','ACCEPTED','RUNNING','RESULT_COMMITTED','VERIFIED','SETTLED','FAILED','DISPUTED','REFUNDED'] as const;
const PROVIDER_STATES = ['NONE','REGISTERED','ACTIVE','SUSPENDED','RETIRED'] as const;

const AI_JOBS_ABI = ['function getJob(bytes32) view returns (tuple(address requester,bytes32 modelVersionId,bytes32 workloadClass,bytes32 requestHash,bytes32 privacyPolicyId,bytes32 verificationProfileId,uint256 maxSpend,uint64 deadline,bytes32 fundingRef,uint256 fundedAmount,bytes32 computeRequestId,bytes32 computeJobId,bytes32 providerId,bytes32 resultHash,bytes32 resultManifestHash,bytes32 disputeRef,uint8 status))'];
const AI_PROVIDERS_ABI = ['function getProvider(bytes32) view returns (tuple(address operatorAccount,address settlementAccount,bytes32 metadataHash,bytes32 stakeRef,bytes32 computeProviderRef,uint64 createdAt,uint32 revision,uint8 state,bool exists))'];
const COMPUTE_JOBS_ABI = ['function getJob(bytes32) view returns (tuple(bytes32 matchId,bytes32 requestId,bytes32 providerId,bytes32 resourceId,bytes32 outputCommitment,bytes32 resultManifestHash,uint64 createdAt,uint8 state,bool exists))'];
const COMPUTE_REQUESTS_ABI = ['function getRequest(bytes32) view returns (tuple(address requester,bytes32 workloadClass,bytes32 resourceRequirementId,bytes32 inputCommitment,uint256 maxSpend420,uint64 deadline,bytes32 privacyPolicyId,bytes32 verificationProfileId,bytes32 providerConstraintHash,bytes32 fundingRef,uint256 fundedAmount,uint64 createdAt,uint8 state,bool exists))'];
const COMPUTE_PROVIDERS_ABI = ['function getProvider(bytes32) view returns (tuple(address operatorAccount,address settlementAccount,bytes32 metadataHash,bytes32 stakeRef,uint64 createdAt,uint32 revision,uint8 state,bool exists))'];

export interface CanonicalRPCAddresses420 {
  aiJobs: string;
  aiProviders: string;
  computeJobs: string;
  computeRequests: string;
  computeProviders: string;
}
export interface CanonicalRPCConfig420 {
  chainId: bigint;
  addresses: CanonicalRPCAddresses420;
  /** Registry/deployment-manifest verified addresses; never infer Compute addresses from historical predeploy allocations. */
  verifiedComputeAddresses: readonly string[];
  confirmations: number;
}
function id(x: string): Hex32 { if (!B32.test(x) || x.toLowerCase() === ZERO) throw new Error('invalid canonical identity'); return x.toLowerCase() as Hex32; }
function address(x: string): string { const a = getAddress(x); if (a === '0x0000000000000000000000000000000000000000') throw new Error('zero canonical address'); return a; }
function state<T extends string>(states: readonly T[], n: bigint): T { const s = states[Number(n)]; if (!s) throw new Error('unknown canonical state'); return s; }

/** Read-only, pinned-block RPC hydration; constructor requires externally verified registry/deployment resolution. */
export class CanonicalRPCState420 implements CanonicalStatePort420 {
  readonly addresses: CanonicalRPCAddresses420;
  constructor(readonly rpc: JsonRpcProvider, readonly config: CanonicalRPCConfig420) {
    if (config.chainId <= 0n || !Number.isSafeInteger(config.confirmations) || config.confirmations < 1) throw new Error('invalid chain/finality configuration');
    this.addresses = Object.fromEntries(Object.entries(config.addresses).map(([key,value]) => [key,address(value)])) as unknown as CanonicalRPCAddresses420;
    if (this.addresses.aiJobs.toLowerCase() !== '0x0000000000000000000000000000000000000431' || this.addresses.aiProviders.toLowerCase() !== '0x000000000000000000000000000000000000042f') throw new Error('frozen AI address mismatch');
    const allow = new Set(config.verifiedComputeAddresses.map(x => address(x).toLowerCase()));
    for (const a of [this.addresses.computeJobs,this.addresses.computeRequests,this.addresses.computeProviders]) if (!allow.has(a.toLowerCase())) throw new Error('unverified Compute contract address');
    if (new Set(Object.values(this.addresses).map(x=>x.toLowerCase())).size !== 5) throw new Error('duplicate canonical addresses');
  }
  async getCanonicalWork(aiJobId: Hex32, computeJobId: Hex32): Promise<CanonicalWork420> {
    id(aiJobId); id(computeJobId);
    const network = await this.rpc.getNetwork();
    if (network.chainId !== this.config.chainId) throw new Error('canonical RPC chain mismatch');
    const tip = await this.rpc.getBlockNumber();
    const height = tip - this.config.confirmations;
    if (height < 0) throw new Error('insufficient canonical confirmations');
    const block = await this.rpc.getBlock(height);
    if (!block?.hash) throw new Error('canonical block unavailable');
    const options = {blockTag: height};
    const jobs = new Contract(this.addresses.aiJobs, AI_JOBS_ABI, this.rpc);
    const providers = new Contract(this.addresses.aiProviders, AI_PROVIDERS_ABI, this.rpc);
    const cjobs = new Contract(this.addresses.computeJobs, COMPUTE_JOBS_ABI, this.rpc);
    const crequests = new Contract(this.addresses.computeRequests, COMPUTE_REQUESTS_ABI, this.rpc);
    const cproviders = new Contract(this.addresses.computeProviders, COMPUTE_PROVIDERS_ABI, this.rpc);
    const [a,c] = await Promise.all([jobs.getJob(aiJobId,options),cjobs.getJob(computeJobId,options)]);
    if (!c.exists || a.computeJobId.toLowerCase() !== computeJobId.toLowerCase()) throw new Error('canonical AI/Compute job mismatch');
    const [p,r,cp] = await Promise.all([providers.getProvider(a.providerId,options),crequests.getRequest(c.requestId,options),cproviders.getProvider(c.providerId,options)]);
    if (!p.exists || !r.exists || !cp.exists || p.computeProviderRef.toLowerCase() !== c.providerId.toLowerCase() || a.computeRequestId.toLowerCase() !== c.requestId.toLowerCase() || r.requester.toLowerCase() !== a.requester.toLowerCase() || cp.operatorAccount.toLowerCase() !== p.operatorAccount.toLowerCase()) throw new Error('canonical identity/request/operator binding mismatch');
    const after = await this.rpc.getBlock(height);
    if (!after?.hash || after.hash !== block.hash) throw new Error('canonical block reorganization detected');
    return {
      provider: {providerId:id(a.providerId),operatorAccount:address(p.operatorAccount) as `0x${string}`,settlementAccount:address(p.settlementAccount) as `0x${string}`,stakeRef:p.stakeRef,computeProviderRef:p.computeProviderRef,state:state(PROVIDER_STATES,p.state)},
      aiJob: {jobId:aiJobId,requester:address(a.requester) as `0x${string}`,modelVersionId:id(a.modelVersionId),workloadClass:a.workloadClass,requestHash:a.requestHash,privacyPolicyId:a.privacyPolicyId,verificationProfileId:a.verificationProfileId,maxSpend420:a.maxSpend,deadline:Number(a.deadline),computeRequestId:a.computeRequestId,computeJobId:a.computeJobId,providerId:a.providerId,state:state(AI_STATES,a.status) as CanonicalWork420['aiJob']['state']},
      computeJob: {jobId:computeJobId,requestId:c.requestId,providerId:c.providerId,resourceId:c.resourceId,state:state(COMPUTE_STATES,c.state) as CanonicalWork420['computeJob']['state'],outputCommitment:c.outputCommitment,resultManifestHash:c.resultManifestHash},
      computeRequest: {requestId:c.requestId,requester:address(r.requester) as `0x${string}`,workloadClass:r.workloadClass,inputCommitment:r.inputCommitment,maxSpend420:r.maxSpend420,fundedAmount420:r.fundedAmount,deadline:Number(r.deadline),privacyPolicyId:r.privacyPolicyId,verificationProfileId:r.verificationProfileId}
    };
  }
}
