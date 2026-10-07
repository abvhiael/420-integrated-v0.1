#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "creative-indexer/hz-audit-6-reorg-rebuild-bundle.json"
TYPE = ROOT / "creative-indexer/src/types.ts"
BASE = ROOT / "creative-indexer/src/store.ts"
CATALOG = ROOT / "creative-indexer/src/catalog-store.ts"
STREAMING = ROOT / "creative-indexer/src/streaming-settlement-store.ts"
INTEGRATION = ROOT / "creative-indexer/src/hz-indexer-integration.ts"
RPC = ROOT / "creative-indexer/src/rpc-log-source.ts"
SCHEMA = ROOT / "creative-indexer/sql/001_initial.sql"
REORG_TEST = ROOT / "creative-indexer/test/hz-indexer-reorg-rebuild.test.ts"
RPC_TEST = ROOT / "creative-indexer/test/rpc-log-source.test.ts"
README = ROOT / "creative-indexer/README.md"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for p in [BUNDLE, TYPE, BASE, CATALOG, STREAMING, INTEGRATION, RPC, SCHEMA, REORG_TEST, RPC_TEST, README]:
    need(p.is_file(), f"missing required file: {p.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(BUNDLE.read_text())
type_src = TYPE.read_text()
stores = [BASE.read_text(), CATALOG.read_text(), STREAMING.read_text()]
integration = INTEGRATION.read_text()
rpc = RPC.read_text()
schema = SCHEMA.read_text()
reorg_test = REORG_TEST.read_text()
rpc_test = RPC_TEST.read_text()
readme = README.read_text()

need(d.get("schema") == "420.hz.indexer.reorg.rebuild.bundle.v1", "schema drift")
need(d.get("roadmap_step") == "HZ-AUDIT-6", "roadmap step drift")
need(d.get("status") == "REPOSITORY_INDEXER_REORG_REBUILD_READY_LIVE_RPC_EVIDENCE_DEFERRED", "status drift")
need(d.get("repository_ready") is True, "repository readiness missing")
need(d.get("live_qualified") is False, "fabricated live qualification")
need(d.get("projection_role") == "DISPOSABLE_NON_CANONICAL_POSTGRES_PROJECTION", "projection authority drift")

for token in ["parentHash?: string", "transactionIndex?: number", "finalized?: boolean"]:
    need(token in type_src, f"CanonicalEvent metadata missing: {token}")

need("tx_index INTEGER NOT NULL DEFAULT 0" in schema, "event journal transaction index missing")
need("event_journal_canonical_order_idx" in schema, "canonical journal ordering index missing")

for i, store in enumerate(stores):
    need("event.transactionIndex ?? 0" in store, f"store {i} does not persist transaction index")
    need("event.parentHash ?? null" in store, f"store {i} does not persist parent hash")
    need("event.finalized ?? false" in store, f"store {i} still fabricates finality")

for token in [
    "class HzIndexerIntegration420",
    "findForkBlock",
    "refusing reorg across finalized block",
    "loadCanonicalEvents",
    "resetAll",
    "rebuildFromJournal",
    "validateOrderedBatch",
    "not ordered by block/transaction/log position",
    "BASE_EVENTS",
    "CATALOG_EVENTS",
    "STREAMING_EVENTS",
]:
    need(token in integration, f"integration coordinator missing invariant: {token}")

for token in [
    "class RpcCanonicalEventSource420",
    "eth_getLogs",
    "eth_getBlockByNumber",
    "removed log",
    "does not match canonical header",
    "transactionIndex",
    "parentHash",
    "finalized",
]:
    need(token in rpc, f"RPC source missing invariant: {token}")

for token in [
    "replaces a non-finalized canonical tail",
    "journal rebuild must reproduce the complete post-reorg HZ projection",
    "refuses reorgs across finalized indexed blocks",
    "rejects non-canonical block transaction log ordering",
    "0xorphaned-settlement",
    "0xcanonical-settlement",
]:
    need(token in reorg_test, f"reorg test missing coverage: {token}")

for token in [
    "canonically ordered events with block lineage and finality",
    "rejects removed logs and header/hash disagreement",
    "eth_getLogs",
    "finalized",
]:
    need(token in rpc_test, f"RPC test missing coverage: {token}")

need("non-canonical" in readme.lower(), "README must retain non-canonical projection boundary")

level2 = d.get("level_2", {})
need(level2.get("required") is False, "HZ-AUDIT-6 should not repeat the just-completed Level-2 milestone")

live = d.get("live_evidence", {})
need(live.get("required_in_step") == "HZ-AUDIT-7", "live evidence owner drift")
for key in ["rpc_url", "network", "chain_id"]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
need(live.get("deployed_addresses") == {}, "fabricated deployed addresses present")
for key in ["observed_blocks", "observed_reorgs", "production_rebuild_receipts"]:
    need(live.get(key) == [], f"fabricated live list present: {key}")

out = {
    "pass": not errors,
    "step": "HZ-AUDIT-6",
    "checks": {
        "canonical_order": "block/transaction/log",
        "reorg_policy": "replace non-finalized canonical tail",
        "finalized_policy": "fail closed",
        "rebuild": "full HZ projection from canonical journal",
        "rpc_source": "eth_getLogs + block-header verification + decoder boundary",
        "level_2_required": False,
        "live_evidence_deferred_to": "HZ-AUDIT-7",
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
