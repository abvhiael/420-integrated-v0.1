#!/usr/bin/env python3
import json, pathlib, sys
R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.8-scientific-probabilistic-verification.json"
I=R/"contracts/src/compute/IComputeScientificVerificationAdapter420.sol"
G=R/"contracts/src/compute/ComputeScientificAdapterRegistry420.sol"
Q=R/"contracts/src/compute/ComputeScientificVerificationRouter420.sol"
A=R/"contracts/src/compute/ComputeSampledMeanScientificAdapter420.sol"
DI=R/"contracts/src/compute/IComputeDeterministicVerificationAdapter420.sol"
DG=R/"contracts/src/compute/ComputeDeterministicAdapterRegistry420.sol"
DA=R/"contracts/src/compute/ComputeIntegerSumSquaresAdapter420.sol"
T=R/"contracts/test/ComputeScientificVerificationRouter420.t.sol"
D=R/"docs/compute-market/CMP-1.4.8-SCIENTIFIC-PROBABILISTIC-VERIFICATION.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]
for p in [M,I,G,Q,A,DI,DG,DA,T,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)
m=json.loads(M.read_text()); i=I.read_text(); g=G.read_text(); q=Q.read_text(); a=A.read_text()
di=DI.read_text(); dg=DG.read_text(); da=DA.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text()
definition="Support workload-specific validation where full recomputation is impractical."
if m.get("step")!="CMP-1.4.8": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.8 — Scientific/probabilistic verification\n{definition}" not in r:
    errors.append("roadmap definition drift")
for token in ["adapterKind()","protocolCommitment()","evaluate("]:
    if token not in i: errors.append(f"scientific interface missing {token}")
for token in ["ADAPTER_KIND","codeHash","protocolCommitment","latestRevision","function publish(","function setActive("]:
    if token not in g: errors.append(f"scientific registry missing {token}")
for token in ["samplingAuthority","j.owner == samplingAuthority","a.worker == samplingAuthority","sampleSeedCommitment","function bindAdapter(","function evaluate(","RESULT_COMMITTED","adapterCodeHash","protocolCommitment"]:
    if token not in q: errors.append(f"scientific router missing {token}")
for token in ["OUTCOME_INCONCLUSIVE","OUTCOME_PASS","OUTCOME_FAIL","REQUIRED_SAMPLES","MIN_DATASET_SIZE","MAX_DATASET_SIZE","TOLERANCE_BPS","MAX_RANGE_BPS","sampleIndex(","_verifyLeaf(","_proofDepth(","_isPowerOfTwo("]:
    if token not in a: errors.append(f"reference scientific adapter missing {token}")
for token in ["adapterKind()","ADAPTER_KIND"]:
    if token not in di or token not in dg or token not in da:
        errors.append(f"deterministic family typing missing {token}")
for token in [
 "testSampledProtocolPassesUniformCommittedDatasetWithoutMutatingJob",
 "testSampledProtocolFailsCommittedClaimOutsideTolerance",
 "testHighDispersionIsExplicitlyInconclusive",
 "testWrongSeedProofOrWorkerOutputFailsClosed",
 "testOnlySamplingAuthorityCanFreezeProtocolAndBindingMustPrecedeExecution",
 "testAdapterUpgradeCannotRewriteFrozenScientificProtocol",
 "testDeterministicAndScientificAdaptersCannotMasqueradeAsEachOther",
 "testScientificEvaluationIsSingleUse"
]:
    if token not in t: errors.append(f"test missing {token}")
for forbidden in ["recordVerification(","recordSettlement(","AssetVault420","ComputeSettlement420","slash("]:
    if forbidden in q or forbidden in a: errors.append(f"unrelated authority coupling {forbidden}")
required={"CMP-INV-005","CMP-INV-014","CMP-INV-016","CMP-INV-017","CMP-INV-020","CMP-INV-022","CMP-INV-023","CMP-INV-024","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")
mil=m.get("milestone_relationship",{})
if mil.get("level_2_required_now") is not True or mil.get("milestone")!="CMP-1.4 verification-method integration":
    errors.append("Level 2 milestone missing")
dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]):
    errors.append("unexpected deployment claim")
for h in ["## Canonical definition","## Gap analysis","## Implementation","## Reference sampled-mean protocol","## Level 1 qualification","## Level 2 milestone","## Security and invariant disposition","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")
if "public/non-sensitive" not in d: errors.append("reference privacy limitation not explicit")
if errors:
    print("CMP-1.4.8 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-1.4.8 scientific/probabilistic verification: mechanically consistent")
