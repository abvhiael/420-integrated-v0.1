#!/usr/bin/env python3
import argparse, json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
E=ROOT/"contracts/config/compute-market/cmp-1.4.11-verifier-release-candidate.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

ROLES=[
"ComputeJobRegistry420","ComputeJobIntegerProfileVerification420","ComputeVerifierRegistry420",
"ComputeVerifierCapabilityRegistry420","ComputePolicyRegistry420","ComputeVerifierIndependencePolicy420",
"ComputeIndependentVerifierSelector420","ComputeReplicatedVerification420",
"ComputeDeterministicAdapterRegistry420","ComputeDeterministicVerificationRouter420",
"ComputeScientificAdapterRegistry420","ComputeScientificVerificationRouter420",
"ComputeDisputeResolution420","ComputeVerifierReleaseCandidateWiring420"
]
BINDINGS=[
"jobs_verification_evidence","jobs_verification_policy_registry","bounded_verifier_jobs",
"bounded_verifier_independence_policy","capability_registry_verifier_registry","selector_jobs",
"selector_verifier_registry","selector_capability_registry","selector_independence_policy",
"selector_selection_authority","replicated_selector","replicated_jobs","replicated_verifier_registry",
"replicated_capability_registry","replicated_independence_policy","replicated_selection_authority",
"deterministic_router_jobs","deterministic_router_registry","scientific_router_jobs",
"scientific_router_registry","scientific_sampling_authority","dispute_matches",
"dispute_authorization","dispute_independence_policy","dispute_jobs"
]

def fail(msg):
    print(f"FAIL: {msg}",file=sys.stderr); raise SystemExit(1)

def is_hex(v,n):
    if not isinstance(v,str) or not v.startswith("0x") or len(v)!=2+n*2: return False
    try: int(v[2:],16); return True
    except ValueError: return False

def load():
    if not E.is_file(): fail("missing CMP-1.4.11 manifest")
    data=json.loads(E.read_text())
    if data.get("schema")!="420Integrated.ComputeMarket.CMP-1.4.11.VerifierReleaseCandidate.v1":
        fail("unexpected schema")
    if data.get("step")!="CMP-1.4.11": fail("wrong step")
    if "### CMP-1.4.11 — Release-candidate/deployment readiness" not in ROADMAP.read_text():
        fail("canonical roadmap step missing")
    return data

def repository_ready(d,allow_live=False):
    if d.get("repository_ready") is not True: fail("repository_ready must be true")
    if not allow_live:
        if d.get("live_qualified") is not False: fail("must not claim live qualification")
        if d.get("status")!="REPOSITORY_READY_DEPLOYMENT_BLOCKED":
            fail("repository package must remain deployment-blocked")

    reg=d.get("protocol_registry",{})
    if reg.get("address")!="0x0000000000000000000000000000000000000434":
        fail("ProtocolRegistry frozen address drift")
    if reg.get("publication_api")!="publishRegisteredService":
        fail("noncanonical Registry publication API")
    if not allow_live and reg.get("publication_complete") is not False:
        fail("fabricated ProtocolRegistry publication")

    rc=d.get("release_candidate",{})
    if rc.get("wiring_contract")!="contracts/src/compute/ComputeVerifierReleaseCandidateWiring420.sol":
        fail("wrong wiring contract")
    comps=rc.get("components",[])
    if [x.get("role") for x in comps]!=ROLES: fail("release component graph drift")
    for x in comps:
        src=x.get("source")
        if not isinstance(src,str) or not (ROOT/src).is_file(): fail(f"missing source {src}")
        if not allow_live:
            for fld in ("address","deployment_tx","deployment_block","runtime_code_hash"):
                if x.get(fld) is not None: fail(f"{x['role']}: fabricated {fld}")

    binds=d.get("bindings",{})
    if list(binds.keys())!=BINDINGS: fail("binding inventory drift")
    if not allow_live and any(binds[k] is not None for k in BINDINGS):
        fail("fabricated live binding")

    deps=d.get("dependency_reconciliation",{})
    if deps.get("cmp_1_4_4_internal_release_blocker") is not True:
        fail("CMP-1.4.4 blocker not preserved")
    if not allow_live and deps.get("cmp_1_4_4_signed_verdict_provenance_complete") is not False:
        fail("CMP-1.4.4 falsely marked complete")
    if deps.get("no_fixed_genesis_predeploy_allocated") is not True:
        fail("fixed Genesis predeploy was allocated")
    if deps.get("discovery_path")!="ProtocolRegistry": fail("wrong discovery path")
    if deps.get("validator_stake_is_not_compute_verifier_collateral") is not True:
        fail("validator stake substitution allowed")
    if deps.get("wallet_balance_is_not_compute_verifier_collateral") is not True:
        fail("wallet balance substitution allowed")
    if deps.get("payer_escrow_is_not_compute_verifier_collateral") is not True:
        fail("payer escrow substitution allowed")

    gates=d.get("release_gates",{})
    for k in [
        "cmp_1_4_1_verifier_identity_lifecycle","cmp_1_4_2_verifier_classes_capabilities",
        "cmp_1_4_3_verification_policy_registry","cmp_1_4_5_independent_selection",
        "cmp_1_4_6_replicated_verification","cmp_1_4_7_deterministic_adapters",
        "cmp_1_4_8_scientific_probabilistic","cmp_1_4_9_challenge_appeal",
        "cmp_1_4_10_adversarial_qualification"
    ]:
        if gates.get(k) is not True: fail(f"missing qualified gate {k}")
    if not allow_live:
        for k in ["cmp_1_4_4_signed_verdict_provenance","cmp_1_5_compute_stake_live_source","public_testnet_live"]:
            if gates.get(k) is not False: fail(f"blocked gate {k} must remain false")

    if d.get("milestone_relationship",{}).get("level_2_required_now") is not False:
        fail("unexpected additional Level 2 requirement")

    print("CMP-1.4.11 verifier repository release package: READY / LIVE BLOCKED")

def live_ready(d):
    repository_ready(d,allow_live=True)
    if d.get("live_qualified") is not True or d.get("status")!="LIVE_QUALIFIED":
        fail("live qualification not asserted")
    deps=d["dependency_reconciliation"]; gates=d["release_gates"]
    if deps.get("cmp_1_4_4_signed_verdict_provenance_complete") is not True:
        fail("CMP-1.4.4 still incomplete")
    if gates.get("cmp_1_4_4_signed_verdict_provenance") is not True:
        fail("CMP-1.4.4 live gate closed")
    if deps.get("cmp_1_5_compute_stake_live_source_qualified") is not True:
        fail("CMP-1.5 verifier collateral source unqualified")
    if deps.get("public_testnet_available") is not True: fail("public testnet unavailable")
    net=d["network"]
    if not isinstance(net.get("chain_id"),int) or net["chain_id"]<=0: fail("missing chain id")
    if not net.get("network_name"): fail("missing network name")
    if not isinstance(net.get("rpc_evidence_block"),int): fail("missing evidence block")
    if not is_hex(net.get("rpc_evidence_block_hash"),32): fail("invalid evidence block hash")
    for x in d["release_candidate"]["components"]:
        if not is_hex(x.get("address"),20): fail(f"{x['role']}: invalid address")
        if not is_hex(x.get("deployment_tx"),32): fail(f"{x['role']}: invalid deployment tx")
        if not isinstance(x.get("deployment_block"),int): fail(f"{x['role']}: missing deployment block")
        if not is_hex(x.get("runtime_code_hash"),32): fail(f"{x['role']}: invalid runtime hash")
    if not is_hex(d["release_candidate"].get("graph_hash"),32): fail("missing graph hash")
    for k,v in d["bindings"].items():
        if not is_hex(v,20): fail(f"invalid live binding {k}")
    if d["protocol_registry"].get("publication_complete") is not True:
        fail("Registry publication incomplete")
    if not d["protocol_registry"].get("service_entries"): fail("missing Registry service entries")
    print("CMP-1.4.11 live verifier deployment readiness: PASS")

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--repository-ready",action="store_true")
    args=ap.parse_args(); d=load()
    repository_ready(d) if args.repository_ready else live_ready(d)

if __name__=="__main__": main()
