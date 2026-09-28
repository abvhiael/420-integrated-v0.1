import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []

cfg = json.loads((root / "config/420indexer-v1.json").read_text())
ready = json.loads((root / "testnet/public-services/indexer/readiness.json").read_text())

if cfg.get("name") != "420Indexer": errors.append("name")
if cfg.get("canonicalStateAuthority") is not False: errors.append("authority")
if cfg.get("ingestion", {}).get("requiredChainId") != 420: errors.append("chain id")
if cfg.get("reorgPolicy", {}).get("rewriteFinalized") is not False: errors.append("finalized rewrite")
if ready.get("service") != "420Indexer": errors.append("readiness service")
if ready.get("status") not in {"GEN11_1F_QUALIFICATION", "EXP_1_4_DEPLOYABLE_RUNTIME_QUALIFICATION", "EXP_1_5_CONSENSUS_PROVIDER_QUALIFICATION", "EXP_1_6_HISTORICAL_PRODUCER_ATTRIBUTION_QUALIFICATION", "EXP_1_7_CROSS_LAYER_TRACEABILITY_QUALIFICATION", "EXP_1_8_RUNTIME_NEGATIVE_DIVERGENCE_QUALIFICATION", "EXP_1_9_CI_QUALIFICATION_AUTOMATION", "EXP_1_10_PHASE_CLOSEOUT_QUALIFICATION"}: errors.append("readiness status")
if ready.get("authority", {}).get("canonical_state") is not False: errors.append("readiness authority")
deployment_status = ready.get("backend", {}).get("deployment_status")
if deployment_status not in {"PENDING_TESTNET_DEPLOYMENT", "DEPLOYABLE_RUNTIME_QUALIFIED_LIVE_TESTNET_PENDING"}:
    errors.append("deployment status")
if deployment_status == "DEPLOYABLE_RUNTIME_QUALIFIED_LIVE_TESTNET_PENDING":
    if ready.get("backend", {}).get("live_deployment", {}).get("qualified") is not False:
        errors.append("live deployment overpromotion")

required_consumers = {"420Explorer", "420Search", "420Analytics", "420Notifications", "420Status"}
if not required_consumers.issubset(set(cfg.get("consumers", []))): errors.append("consumers")

expected_evidence = {
    "wrong_chain",
    "canonical_block_tx_receipt_log_ingestion",
    "checkpoint_restart_resume",
    "nonfinalized_reorg_repair",
    "finalized_conflict_fail_closed",
    "full_rebuild",
    "head_safe_finalized_promotion",
    "registry_backed_historical_decoding",
    "fixed_snapshot_pagination",
    "restart_reorg_integration_fixture",
    "production_http_read_api",
    "first_consumer_420explorer",
}
evidence = ready.get("backend", {}).get("qualification_evidence", {})
for key in expected_evidence:
    if not str(evidence.get(key, "")).startswith("IMPLEMENTED"):
        errors.append(f"qualification evidence: {key}")

if ready.get("consumer_gates", {}).get("420Explorer") != "QUALIFIED_INDEXER_API_CONSUMER":
    errors.append("explorer consumer gate")

print(json.dumps({"pass": not errors, "errors": errors}, indent=2))
sys.exit(1 if errors else 0)
