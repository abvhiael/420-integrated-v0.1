import {createHash} from 'node:crypto';
export class EconomicError extends Error {constructor(code){super(code);this.code=code;}}
const fail=c=>{throw new EconomicError(c)};
const uint=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,35})$/.test(v);
const val=v=>{if(!uint(v))fail('AMOUNT');return BigInt(v)};
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(x);
const sum=(xs)=>xs.reduce((a,x)=>a+x,0n);
export function validateEconomicPolicy(p){
 if(!p||p.schemaVersion!=='420-cmp-s07-policy-v1'||!Array.isArray(p.acceptedProjects)||!Array.isArray(p.sourceSchemes)||!p.economicCaps||!p.quotas||!p.maturity||!p.antiFarming||!p.corrections)fail('SCHEMA');
}
export function authorizePolicy(p){
 validateEconomicPolicy(p);
 if(p.approved!==true||p.testnetFundingApproved!==true||p.payoutsEnabled!==true||p.status!=='GOVERNANCE_APPROVED')fail('POLICY_NOT_APPROVED');
 if(!id(p.approval?.economicGovernanceProposal)||!hex(p.approval?.approvedPolicyDigest)||!hex(p.approval?.approvedProposalTx)||!hex(p.approval?.treasuryAuthorizationTx))fail('GOVERNANCE_EVIDENCE');
 if(!Number.isSafeInteger(p.effectiveEpoch)||p.effectiveEpoch<=0)fail('EPOCH');
 if(!['ALLOWED','PROHIBITED'].includes(p.thirdPartyRewardPolicy)||p.allowDoubleExternalReward!==(p.thirdPartyRewardPolicy==='ALLOWED'))fail('EXTERNAL_REWARD_POLICY');
 if(p.unitScoring?.creditIsCurrency!==false||p.unitScoring?.foldingPointsTo420!==null||p.unitScoring?.boincCreditsTo420!==null)fail('CREDIT_NOT_CURRENCY');
 if(p.treasurySource!=='CMP-6_CANONICAL_FUNDED_VAULT_ONLY')fail('FUNDING');
 if(p.acceptedProjects.length<1||p.sourceSchemes.length<1)fail('NO_APPROVED_PROJECT');
 for(const s of p.sourceSchemes)if(!id(s.sourceId)||!id(s.schemeId)||s.governanceApproved!==true)fail('UNAPPROVED_SCHEME');
 for(const project of p.acceptedProjects)if(!id(project.projectId)||!id(project.sourceId)||!id(project.schemeId)||!uint(project.rewardPerAcceptedWorkUnit)||val(project.rewardPerAcceptedWorkUnit)===0n||!p.sourceSchemes.some(s=>s.sourceId===project.sourceId&&s.schemeId===project.schemeId))fail('PROJECT');
 for(const field of ['totalFundedBudgetUnits','perEpochBudgetUnits','perProjectBudgetUnits','perParticipantBudgetUnits','perWorkUnitBudgetUnits'])if(val(p.economicCaps[field])===0n)fail('UNFUNDED');
 for(const field of ['maxWorksPerParticipantPerEpoch','maxWorksPerProjectPerEpoch','maxWorksPerSourcePerEpoch'])if(!Number.isSafeInteger(p.quotas[field])||p.quotas[field]<1)fail('QUOTA');
 for(const field of ['minimumSourceAgeSeconds','minimumFinalityBlocks','identityChangeCooldownSeconds'])if(!Number.isSafeInteger(p.maturity[field])||p.maturity[field]<1)fail('MATURITY');
 if(Object.values(p.antiFarming).some(x=>x!==true))fail('ANTI_FARM');
 if(p.corrections?.policy!=='HOLD_THEN_GOVERNED_DISPUTE'||p.corrections?.automaticReversal!==false)fail('CORRECTION_POLICY');
 return true;
}
export function simulateBudget(p,works,{treasuryAvailableUnits,epoch,now}={}){
 authorizePolicy(p);
 if(!Array.isArray(works)||works.length>10000||!Number.isSafeInteger(epoch)||epoch<p.effectiveEpoch||!Number.isSafeInteger(now)||!uint(treasuryAvailableUnits))fail('INPUT');
 const seen=new Set(),byProject=new Map(),byWallet=new Map(),bySource=new Map(),totals={project:new Map(),wallet:new Map(),epoch:0n};let total=0n;
 for(const w of works){
  if(!w||!id(w.projectId)||!id(w.sourceId)||!id(w.schemeId)||!id(w.walletCommitment)||!hex(w.canonicalWorkCommitment)||w.chainId!=='420'||w.epoch!==epoch)fail('WORK');
  const pKey=w.sourceId+':'+w.projectId,project=p.acceptedProjects.find(p=>p.projectId===w.projectId&&p.sourceId===w.sourceId&&p.schemeId===w.schemeId);
  if(!project)fail('UNAPPROVED_PROJECT');
  if(!w.providerEvidenceApproved||!w.ownershipVerified||!w.canonicalAttestationValid||!w.uniqueCanonicalWork||!w.finalized||w.revoked||w.correctionPending||w.consumed||!Number.isSafeInteger(w.acceptedAt)||now-w.acceptedAt<p.maturity.minimumSourceAgeSeconds||!Number.isSafeInteger(w.finalityBlocks)||w.finalityBlocks<p.maturity.minimumFinalityBlocks||!Number.isSafeInteger(w.lastIdentityChangeAt)||now-w.lastIdentityChangeAt<p.maturity.identityChangeCooldownSeconds)fail('INELIGIBLE_WORK');
  const unique=w.chainId+':'+w.canonicalWorkCommitment;if(seen.has(unique))fail('DOUBLE_CLAIM');seen.add(unique);
  const price=val(project.rewardPerAcceptedWorkUnit);if(price>val(p.economicCaps.perWorkUnitBudgetUnits))fail('UNIT_CAP');
  const bump=(m,k,cap,amt)=>{let n=(m.get(k)||0n)+amt;if(n>cap)fail('BUDGET_CAP');m.set(k,n)};
  bump(totals.project,pKey,val(p.economicCaps.perProjectBudgetUnits),price);
  bump(totals.wallet,w.walletCommitment,val(p.economicCaps.perParticipantBudgetUnits),price);
  const bumpCount=(m,k,cap)=>{let n=(m.get(k)||0)+1;if(n>cap)fail('QUOTA');m.set(k,n)};
  bumpCount(byProject,pKey,p.quotas.maxWorksPerProjectPerEpoch);bumpCount(byWallet,w.walletCommitment,p.quotas.maxWorksPerParticipantPerEpoch);bumpCount(bySource,w.sourceId,p.quotas.maxWorksPerSourcePerEpoch);
  total+=price;if(total>val(p.economicCaps.perEpochBudgetUnits)||total>val(p.economicCaps.totalFundedBudgetUnits)||total>val(treasuryAvailableUnits))fail('INSUFFICIENT_FUNDING');
 }
 return {schemaVersion:'420-s07-budget-simulation-v1',works:works.length,requiredReserveUnits:total.toString(),remainingTreasuryUnits:(val(treasuryAvailableUnits)-total).toString(),binding:'SIMULATION_ONLY_NO_ENTITLEMENT',payoutEnabled:false,policyDigest:createHash('sha256').update(JSON.stringify(p)).digest('hex')};
}
