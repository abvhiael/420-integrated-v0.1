#!/usr/bin/env python3
import json, pathlib, sys

R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.6-replicated-verification.json"
C=R/"contracts/src/compute/ComputeReplicatedVerification420.sol"
T=R/"contracts/test/ComputeReplicatedVerification420.t.sol"
D=R/"docs/compute-market/CMP-1.4.6-REPLICATED-VERIFICATION.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
errors=[]

for p in [M,C,T,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)

m=json.loads(M.read_text()); c=C.read_text(); t=T.read_text(); d=D.read_text(); r=RM.read_text()
definition="Support independent recomputation and quorum verification."

if m.get("step")!="CMP-1.4.6": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.6 — Replicated / N-of-M verification\n{definition}" not in r:
    errors.append("roadmap definition drift")

for token in [
    "contract ComputeReplicatedVerification420",
    "MAX_COMMITTEE = 16",
    "function freezeCommittee(",
    "function submitRecomputation(",
    "function quorumReached(",
    "INDEPENDENT_VERIFIER()",
    "COMMITTEE_VERIFIER()",
    "RESULT_COMMITTED",
    "votesForResult"
]:
    if token not in c: errors.append(f"contract missing {token}")

for token in [
    "testFreezeExactIndependentTwoOfThreeCommitteeBeforeExecution",
    "testOnlySelectionAuthorityCanFreezeCommittee",
    "testJobPartyCannotBeTheDesignatedCommitteeSelectionAuthority",
    "testThresholdDuplicateAndSharedControllerFailClosed",
    "testMissingCommitteeCapabilityFailsClosed",
    "testVotingRequiresCommittedResultAndFrozenMember",
    "testTwoOfThreeMatchingRecomputationsReachQuorumExactlyOnce",
    "testSplitVotesNeedThresholdOnSameResult",
    "testPartyControllerDriftInvalidatesFrozenCommitteeVotes",
    "testMemberCanVoteOnlyOnceAndSuspensionFailsClosed",
    "testCommitteeCannotBeFrozenAfterExecutionBegins"
]:
    if token not in t: errors.append(f"test missing {token}")

for forbidden in [
    "recordVerification(",
    "recordSettlement(",
    "AssetVault420",
    "ComputeSettlement420",
    "ComputeStake"
]:
    if forbidden in c: errors.append(f"unrelated authority coupling {forbidden}")

if not m.get("milestone_relationship",{}).get("level_2_required_now"):
    errors.append("Level 2 milestone not recorded")

required={"CMP-INV-005","CMP-INV-014","CMP-INV-016","CMP-INV-017","CMP-INV-020","CMP-INV-023","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"}
if set(m.get("invariants",[]))!=required: errors.append("invariant set drift")

dep=m.get("deployment_publication",{})
if any(dep.get(k) is not False for k in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]):
    errors.append("unexpected deployment/publication claim")

for h in ["## Canonical definition","## Gap analysis","## Implementation","## Authority separation","## Level 1 qualification","## Level 2 milestone","## Exit criteria","## Completion"]:
    if h not in d: errors.append(f"missing heading {h}")

if errors:
    print("CMP-1.4.6 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)

print("CMP-1.4.6 replicated N-of-M verification: mechanically consistent")
