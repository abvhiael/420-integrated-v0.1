#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def read(p): return (ROOT/p).read_text()
road=json.loads(read("docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json"))
step=next((s for s in road["sequence"] if s["id"]=="EXP-NEXT.4"),None)
if not step or step.get("title")!="Production-equivalent deployment, live integration and recovery qualification": errors.append("canonical EXP-NEXT.4 definition mismatch")
audit=json.loads(read("docs/audit/EXP-NEXT.4-live-deployment-recovery.json"))
if audit.get("status")!="NOT_YET_COMPLETE": errors.append("EXP-NEXT.4 must remain NOT_YET_COMPLETE while authoritative live blockers exist")
endpoints=json.loads(read("testnet/services/endpoints.json"))
infra=json.loads(read("testnet/infrastructure/inventory.json"))
indexer=json.loads(read("testnet/public-services/indexer/readiness.json"))
explorer=json.loads(read("testnet/public-services/explorer/readiness.json"))
if infra.get("status")!="PLANNED": errors.append("infrastructure status changed; re-evaluate live blocker record")
if not all(n.get("status")=="UNPROVISIONED" for n in infra.get("nodes",[])): errors.append("some infrastructure is now provisioned; rerun live qualification")
raw=json.dumps(endpoints).upper()
if "PLACEHOLDER" not in raw and "REPLACE_WITH" not in raw: errors.append("endpoint inventory no longer contains placeholders; blocker-only closeout is stale")
if indexer.get("backend",{}).get("live_deployment",{}).get("qualified") is not False: errors.append("Indexer live deployment state changed; re-evaluate")
if explorer.get("backend",{}).get("url")!="REPLACE" or explorer.get("frontend",{}).get("url")!="REPLACE": errors.append("Explorer readiness URLs changed; re-evaluate")
wf=read(".github/workflows/explorer-live-testnet.yml")
required_wf=["release_candidate_sha","ref: ${{ inputs.release_candidate_sha }}","Verify exact release candidate checkout","verify-exp-next-4-live-preflight.py","deployment_manifest_url","recovery_evidence_url","canonical_rpc_url","consensus_witness_url","protocol_registry_code_hash"]
for token in required_wf:
    if token not in wf: errors.append("live workflow missing "+token)
pre=read("scripts/verify-exp-next-4-live-preflight.py")
required_pre=["placeholder/non-production-equivalent","eth_chainId","eth_getBlockByNumber","eth_getCode","eth_getProof","consensus witness divergence","restart_resume","rpc_outage","bounded_reorg","finalized_conflict","rebuild"]
for token in required_pre:
    if token not in pre: errors.append("live preflight missing "+token)
for p in ["docs/audit/templates/EXP-NEXT.4-deployment-manifest.template.json","docs/audit/templates/EXP-NEXT.4-recovery-evidence.template.json"]:
    if not (ROOT/p).exists(): errors.append("missing evidence template "+p)
scope=audit.get("scope",{})
for key in ["production_equivalent_deployment_qualified","live_network_qualified","recovery_deployment_qualified","canonical_authority","genesis_ready_claim"]:
    if scope.get(key) is not False: errors.append("scope overclaim "+key)
out=ROOT/"exp-next-4-repository-evidence"; out.mkdir(exist_ok=True)
(out/"summary.json").write_text(json.dumps({"step":"EXP-NEXT.4","status":audit.get("status"),"external_blockers":audit.get("blockers",[]),"errors":errors},indent=2)+"\n")
if errors:
    print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)
print("EXP-NEXT.4 repository-readiness verifier passed; live qualification remains blocked")
