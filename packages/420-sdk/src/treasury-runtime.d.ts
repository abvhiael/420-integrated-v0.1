export interface TreasuryProvider420 { request(method:string, params?:readonly unknown[]):Promise<unknown>; }
export interface TreasuryDiscovery420 { readonly chainId:bigint; readonly block:string; readonly blockHash:string; readonly registry:string; readonly router:string; readonly revision:bigint; readonly budgets:string; readonly disbursements:string; readonly policy:string; readonly authorization:string; readonly capabilityRegistry:string; }
type Integer=bigint|string;
export type TreasuryGovernedInput420 =
  | {kind:'setAssetPolicy'; asset:string; allowed:boolean; maxSingle:Integer; maxEpoch:Integer; epochSeconds:Integer}
  | {kind:'createBudget'; budgetId:string; vaultId:string; category:string; asset:string; ceiling:Integer; validFrom:Integer; validUntil:Integer; civicActionHash:string; metadataHash:string}
  | {kind:'schedule'; disbursementId?:string; budgetId:string; recipient:string; amount:Integer; notBefore:Integer; expiresAt:Integer; civicActionHash:string; purposeHash:string}
  | {kind:'cancel'; disbursementId:string};
export interface TreasuryGovernedAction420 { readonly chainId:bigint; readonly authority:'GovernanceTimelock/Civic'; readonly action:{readonly target:string; readonly value:0n; readonly data:string}; readonly discovery:TreasuryDiscovery420; }
export interface TreasuryDisbursement420 { readonly id:string; readonly budgetId:string; readonly vaultId:string; readonly recipient:string; readonly asset:string; readonly amount:bigint; readonly notBefore:bigint; readonly expiresAt:bigint; readonly civicActionHash:string; readonly purposeHash:string; readonly vaultReleaseHash:string; readonly state:number; readonly evidenceModel:'AUTHORIZED_EXECUTOR_COMMITMENT_ONLY'; readonly independentTransferVerified:false; }
export interface TreasuryReleaseReview420 { readonly chainId:bigint; readonly operator:string; readonly disbursement:TreasuryDisbursement420; readonly commitment:string; readonly evidence:string; readonly target:string; readonly value:0n; readonly data:string; readonly authority:'TreasuryReleaseExecutor420'; readonly evidenceModel:'AUTHORIZED_EXECUTOR_COMMITMENT_ONLY'; readonly independentTransferVerified:false; }
export interface TreasuryClient420 { discover():Promise<TreasuryDiscovery420>; disbursement(id:string):Promise<TreasuryDisbursement420>; prepareGovernedAction(input:TreasuryGovernedInput420):Promise<TreasuryGovernedAction420>; prepareRelease(id:string,smartAccount:string):Promise<TreasuryReleaseReview420>; }
export const TREASURY_SERVICE_ID_420:'420/service/treasury/v1';
export const TREASURY_ROUTER_COMPONENT_420:'420/APP/420TREASURY/TREASURY_ROUTER';
export const TREASURY_CAPABILITY_COMPONENT_420:'420/TREASURY/COMPONENT/V1';
export const TREASURY_EXECUTION_ACTION_420:'420/TREASURY/ACTION/EXECUTE_DISBURSEMENT/V1';
export const TREASURY_EVIDENCE_420:'AUTHORIZED_EXECUTOR_COMMITMENT_ONLY';
export function createTreasuryClient420(input:{provider:TreasuryProvider420; chainId:string; registryCodeHash:string; releaseExecutor?:{address:string;codeHash:string}|null}):TreasuryClient420;
