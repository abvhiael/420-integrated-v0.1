import { readFile } from 'node:fs/promises';
import { JsonRpcProvider } from 'ethers';
import { VaultRPCEvidence420, type VaultRPCEvidenceConfig420 } from './vault-rpc-evidence.js';
import { VaultReconciliation420, type VaultFundingExpectation420 } from './vault-reconciliation.js';
import type { Hex32 } from './types.js';

/** Read-only qualification tool. An approved manifest must be supplied externally; this tool cannot approve one. */
interface QualificationFixture420 {
  deployment: Omit<VaultRPCEvidenceConfig420, 'chainId'> & {chainId: string};
  funding: Omit<VaultFundingExpectation420, 'amount420'> & {amount420: string};
  settlement?: {settlementRef: Hex32; operationId: Hex32; kind: 'release' | 'refund'};
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid ${label}`);
  return value as Record<string, unknown>;
}
function decimal(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error(`invalid ${label}: decimal string required`);
  return BigInt(value);
}
function fixtureFromJSON(value: unknown): {config: VaultRPCEvidenceConfig420; funding: VaultFundingExpectation420; settlement?: QualificationFixture420['settlement']} {
  const root = object(value,'qualification fixture');
  const deployment=object(root.deployment,'deployment');
  const funding=object(root.funding,'funding');
  const chainId=decimal(deployment.chainId,'chainId');
  const amount420=decimal(funding.amount420,'funding amount');
  const config={...deployment,chainId} as unknown as VaultRPCEvidenceConfig420;
  if (typeof config.confirmations !== 'number' || typeof config.fromBlock !== 'number') throw new Error('invalid pinned deployment height or confirmations');
  const expectation={...funding,amount420} as unknown as VaultFundingExpectation420;
  let settlement: QualificationFixture420['settlement'];
  if (root.settlement !== undefined) {
    const s=object(root.settlement,'settlement');
    if (s.kind !== 'release' && s.kind !== 'refund') throw new Error('invalid settlement kind');
    if (typeof s.operationId !== 'string' || typeof s.settlementRef !== 'string') throw new Error('invalid settlement identifiers');
    settlement={kind:s.kind,operationId:s.operationId as Hex32,settlementRef:s.settlementRef as Hex32};
  }
  return {config,funding:expectation,settlement};
}
export async function qualifyVaultTestnet420(rpc: JsonRpcProvider, rawFixture: unknown): Promise<{chainId:string; pinnedBlock:number; pinnedHash:string; jobId:Hex32; fundingVerified:true; payoutVerified:boolean; payoutTxHash?:Hex32}> {
  const {config,funding,settlement}=fixtureFromJSON(rawFixture);
  const reader=await VaultRPCEvidence420.open(rpc,config);
  const gate=new VaultReconciliation420(reader);
  await gate.verifyFunding(funding);
  let payoutTxHash:Hex32|undefined;
  if (settlement) {
    // Funding-only verification is not proof of payment. Only the claim+withdrawal receipt path can mark payout verified.
    const payout=await gate.verifyPaid(funding,settlement.settlementRef,settlement.operationId,settlement.kind);
    payoutTxHash=payout.txHash;
  }
  return {chainId:config.chainId.toString(),pinnedBlock:reader.height,pinnedHash:reader.blockHash,jobId:funding.jobId,fundingVerified:true,payoutVerified:payoutTxHash!==undefined,...(payoutTxHash?{payoutTxHash}:{})};
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [fixturePath]=process.argv.slice(2);
  const rpcUrl=process.env.AI_VAULT_TESTNET_RPC_URL;
  if (!fixturePath || !rpcUrl || !/^https:\/\//.test(rpcUrl)) {
    console.error('Usage: AI_VAULT_TESTNET_RPC_URL=https://<approved-rpc> node dist/src/qualify-vault-testnet.js <approved-fixture.json>');
    process.exitCode=2;
  } else {
    const rpc=new JsonRpcProvider(rpcUrl);
    try {
      const fixture=JSON.parse(await readFile(fixturePath,'utf8')) as unknown;
      const result=await qualifyVaultTestnet420(rpc,fixture);
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(`Vault testnet qualification FAILED: ${error instanceof Error ? error.message : 'unknown error'}`);
      process.exitCode=1;
    } finally { rpc.destroy(); }
  }
}
