#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/audit/EXP-1.1-runtime-authority-manifest.json"
SCHEMA = ROOT / "docs/audit/EXP-1-evidence-schema.json"
LAUNCH = ROOT / "testnet/config/launch.json"
EXEC_GEN = ROOT / "testnet/genesis/execution-genesis.json"
CONS_GEN = ROOT / "testnet/genesis/consensus-genesis.json"
SUMS = ROOT / "testnet/genesis/SHA256SUMS.txt"
ENDPOINTS = ROOT / "testnet/services/endpoints.json"
INFRA = ROOT / "testnet/infrastructure/inventory.json"
PUBLIC_STATE = ROOT / "testnet/public/state.json"
INDEXER = ROOT / "config/420indexer-v1.json"
READINESS = ROOT / "testnet/public-services/indexer/readiness.json"
EXPLORER = ROOT / "contracts/config/420explorer-genesis.json"
EXPLORER_MAIN = ROOT / "explorer/cmd/explorer420/main.go"
INDEXER_CLIENT = ROOT / "explorer/indexerclient/client.go"
EVIDENCE = ROOT / "exp-1-1-evidence"

def load(path):
    return json.loads(path.read_text())

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fail(errors, msg):
    errors.append(msg)

def main():
    errors = []
    required = [MANIFEST, SCHEMA, LAUNCH, EXEC_GEN, CONS_GEN, SUMS, ENDPOINTS, INFRA,
                PUBLIC_STATE, INDEXER, READINESS, EXPLORER, EXPLORER_MAIN, INDEXER_CLIENT]
    for path in required:
        if not path.exists():
            fail(errors, f"missing {path.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass": False, "errors": errors}, indent=2))
        raise SystemExit(1)

    m = load(MANIFEST)
    s = load(SCHEMA)
    launch = load(LAUNCH)
    eg = load(EXEC_GEN)
    cg = load(CONS_GEN)
    endpoints = load(ENDPOINTS)
    infra = load(INFRA)
    public = load(PUBLIC_STATE)
    idx = load(INDEXER)
    ready = load(READINESS)
    explorer = load(EXPLORER)

    if m.get("schema") != "420explorer-exp-1.1-runtime-authority-v1":
        fail(errors, "manifest schema drift")
    if m.get("milestone") != "EXP-1.1":
        fail(errors, "manifest milestone drift")
    if m.get("baseline", {}).get("merged_exp_0_main") != "b03e247aa4df0a6a6d978ffad8eedfe2487a3a6b":
        fail(errors, "EXP-0 merged baseline drift")
    if launch.get("network_name") != "420 Integrated Testnet" or launch.get("network_slug") != "420-testnet":
        fail(errors, "launch network identity drift")
    if launch.get("chain_id", {}).get("value") != 420:
        fail(errors, "launch chain ID drift")
    if launch.get("chain_id", {}).get("status") != "CANDIDATE_PENDING_COLLISION_PREFLIGHT":
        fail(errors, "chain-ID launch status changed without EXP-1.1 reconciliation")
    if launch.get("network_id", {}).get("value") != 420:
        fail(errors, "network ID drift")
    if public.get("phase") != "S5-PUBLIC_PREP" or public.get("public_launch_authorized") is not False:
        fail(errors, "public testnet launch state changed without EXP-1.1 reconciliation")

    expected_exec = "65c8efba297009c02dc7ec424f777ba7131f5677a1e11135765ed05de3d06f7e"
    expected_cons = "83da87ffbfbf0ed42a199a99b805c36fb33cd7947cb17bfad73689085531dc9d"
    if sha256(EXEC_GEN) != expected_exec:
        fail(errors, "execution genesis digest mismatch")
    if sha256(CONS_GEN) != expected_cons:
        fail(errors, "consensus genesis digest mismatch")
    sums = SUMS.read_text()
    if expected_exec + "  execution-genesis.json" not in sums:
        fail(errors, "execution genesis checksum authority drift")
    if expected_cons + "  consensus-genesis.json" not in sums:
        fail(errors, "consensus genesis checksum authority drift")
    if eg.get("config", {}).get("chainId") != 420 or cg.get("chain_id") != 420:
        fail(errors, "execution/consensus chain ID mismatch")
    if cg.get("slot_seconds") != 12 or cg.get("slots_per_epoch") != 420 or cg.get("epochs_per_rotation") != 42:
        fail(errors, "consensus timing identity drift")
    if cg.get("genesis_time") != "SET_BY_LAUNCH_CEREMONY":
        fail(errors, "consensus genesis-time placeholder changed without EXP-1.1 update")
    if cg.get("rotation_seed", {}).get("value") != "REPLACE_WITH_32_BYTE_HEX":
        fail(errors, "rotation seed placeholder changed without EXP-1.1 update")

    rpc = endpoints.get("rpc", [])
    if len(rpc) < 3:
        fail(errors, "fewer than three declared public RPC endpoints")
    if any(x.get("status") != "PLACEHOLDER" or not str(x.get("url", "")).startswith("REPLACE_") for x in rpc):
        fail(errors, "RPC endpoint state changed without qualification reconciliation")
    nodes = infra.get("nodes", [])
    rpc_nodes = [x for x in nodes if x.get("role") == "rpc"]
    archive_nodes = [x for x in nodes if x.get("role") == "archive_rpc"]
    if len(rpc_nodes) < 3 or len(archive_nodes) < 1:
        fail(errors, "runtime topology minimum not represented")
    if any(x.get("status") != "UNPROVISIONED" for x in rpc_nodes + archive_nodes):
        fail(errors, "runtime infrastructure provisioning state changed without qualification reconciliation")

    ingest = idx.get("ingestion", {})
    reorg = idx.get("reorgPolicy", {})
    if ingest.get("requiredChainId") != 420 or ingest.get("rejectWrongChain") is not True:
        fail(errors, "Indexer chain identity enforcement drift")
    for key in ("trackHead", "trackSafe", "trackFinalized"):
        if ingest.get(key) is not True:
            fail(errors, f"Indexer finality tracking disabled: {key}")
    if reorg.get("rollbackNonFinalized") is not True or reorg.get("rewriteFinalized") is not False:
        fail(errors, "Indexer reorg/finality policy drift")
    if reorg.get("finalizedConflictBehavior") != "FAIL_CLOSED_DEGRADED":
        fail(errors, "Indexer finalized conflict behavior drift")
    if idx.get("canonicalStateAuthority") is not False:
        fail(errors, "Indexer improperly claims canonical authority")

    backend = ready.get("backend", {})
    if backend.get("url") != "REPLACE" or backend.get("deployment_status") != "PENDING_TESTNET_DEPLOYMENT":
        fail(errors, "Indexer readiness deployment state changed without qualification reconciliation")

    sources = explorer.get("sources", {})
    consumer = explorer.get("indexerConsumer", {})
    if sources.get("chainIndex") != "420Indexer /v1 read API":
        fail(errors, "Explorer chain source drift")
    if sources.get("directExecutionRpcIngestion") is not False:
        fail(errors, "Explorer direct RPC ingestion enabled")
    if consumer.get("service") != "420Indexer" or consumer.get("requiredChainId") != 420:
        fail(errors, "Explorer Indexer consumer identity drift")
    for key in ("independentChainIngestion", "independentCheckpointStore",
                "independentReorgEngine", "independentProtocolDecoderRegistry"):
        if consumer.get(key) is not False:
            fail(errors, f"Explorer authority-boundary violation: {key}")
    if consumer.get("failClosedOnCanonicalAuthorityClaim") is not True:
        fail(errors, "Explorer no longer fails closed on Indexer authority claim")

    main_text = EXPLORER_MAIN.read_text()
    client_text = INDEXER_CLIENT.read_text()
    if 'EXPLORER_INDEXER_URL' not in main_text:
        fail(errors, "Explorer runtime no longer requires Indexer URL")
    forbidden_runtime_keys = ["EXPLORER_RPC_URL", "EXECUTION_RPC_URL", "ETH_RPC_URL"]
    for key in forbidden_runtime_keys:
        if key in main_text:
            fail(errors, f"Explorer direct RPC runtime key introduced: {key}")
    if "Client is 420Explorer's only chain-index data dependency" not in client_text:
        fail(errors, "Indexer-client authority boundary documentation missing")
    if "ErrIndexerAuthorityViolation" not in client_text:
        fail(errors, "Indexer canonical-authority fail-closed guard missing")

    if s.get("schema") != "420explorer-exp-1-evidence-schema-v1":
        fail(errors, "EXP-1 evidence schema drift")
    required_fields = set(s.get("required", []))
    expected_fields = {"milestone","head_sha","chain_id","network_identity","execution_source",
                       "indexer_identity","consensus_source","observed_at_utc","commands_or_workflows",
                       "witnesses","result","artifact_digest"}
    if required_fields != expected_fields:
        fail(errors, "EXP-1 evidence required-field set drift")

    target = m.get("target_network", {})
    if target.get("chain_id") != 420 or target.get("chain_id_launch_status") != launch["chain_id"]["status"]:
        fail(errors, "manifest target network does not match launch authority")
    gi = m.get("genesis_identity", {})
    if gi.get("execution", {}).get("sha256") != expected_exec or gi.get("consensus", {}).get("sha256") != expected_cons:
        fail(errors, "manifest genesis identity drift")
    bounds = m.get("explorer_authority_boundaries", {})
    if any(bounds.get(k) is not False for k in ("direct_execution_rpc_ingestion","independent_chain_ingestion",
                                                "independent_checkpoint_store","independent_reorg_engine",
                                                "independent_protocol_decoder_registry")):
        fail(errors, "manifest Explorer authority boundary drift")
    summary = m.get("summary", {})
    if summary.get("deployment_qualified") is not False or summary.get("live_network_qualified") is not False or summary.get("genesis_qualified") is not False:
        fail(errors, "EXP-1.1 overpromotes qualification level")
    if summary.get("next_step") != "EXP-1.2":
        fail(errors, "EXP-1.1 handoff drift")

    EVIDENCE.mkdir(exist_ok=True)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    result = {
        "schema": "420explorer-exp-1.1-evidence-v1",
        "milestone": "EXP-1.1",
        "head_sha": head,
        "chain_id": 420,
        "network_identity": {
            "network_name": "420 Integrated Testnet",
            "network_slug": "420-testnet",
            "execution_genesis_sha256": expected_exec,
            "consensus_genesis_sha256": expected_cons
        },
        "runtime_target_contract_consistent": not errors,
        "chain_id_collision_preflight_pending": True,
        "runtime_endpoints_resolved": False,
        "deployment_qualified": False,
        "live_network_qualified": False,
        "errors": errors,
        "pass": not errors
    }
    (EVIDENCE / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
