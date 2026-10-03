#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESC = ROOT / "420-indexer/descriptors/grants420-v1.json"
CATALOG = ROOT / "wallet/web/core/genesis-app-catalog.js"
HANDOFF = ROOT / "wallet/web/core/grants-handoff.js"
INDEXER_DESC = ROOT / "420-indexer/src/grants-descriptors.ts"
INDEXER_READ = ROOT / "420-indexer/src/grants-read-model.ts"
INDEXER_API = ROOT / "420-indexer/src/api-surface.ts"
INDEXER_HTTP = ROOT / "420-indexer/src/http-transport.ts"
INDEXER_PROTOCOL = ROOT / "420-indexer/src/protocol-decoder.ts"
INDEXER_LIFECYCLE = ROOT / "420-indexer/src/lifecycle-reducer.ts"
INDEXER_EXPORTS = ROOT / "420-indexer/src/index.ts"
INDEXER_TEST = ROOT / "420-indexer/test/grants420-integration.test.ts"
WALLET_TEST = ROOT / "wallet/web/test/grants-handoff.test.js"
GRANTS_CFG = ROOT / "contracts/config/420grants-genesis.json"
DAPP_MAP = ROOT / "contracts/config/genesis-dapp-contract-map.json"

errors = []

def need(cond, msg):
    if not cond:
        errors.append(msg)

def read(path):
    return path.read_text(encoding="utf-8")

manifest = json.loads(read(DESC))
catalog = read(CATALOG)
handoff = read(HANDOFF)
indexer_desc = read(INDEXER_DESC)
indexer_read = read(INDEXER_READ)
indexer_api = read(INDEXER_API)
indexer_http = read(INDEXER_HTTP)
indexer_protocol = read(INDEXER_PROTOCOL)
indexer_lifecycle = read(INDEXER_LIFECYCLE)
indexer_exports = read(INDEXER_EXPORTS)
indexer_test = read(INDEXER_TEST)
wallet_test = read(WALLET_TEST)
grants_cfg = json.loads(read(GRANTS_CFG))
dapp_map = json.loads(read(DAPP_MAP))

need(manifest.get("schema") == "420-grants-artifact-descriptor-v1", "Grants descriptor schema drift")
need(manifest.get("descriptorVersion") == 1, "Grants descriptor version drift")
need(manifest.get("protocol") == "420Grants", "Grants descriptor protocol drift")
need(manifest.get("authority") == "artifact_events_only_addresses_resolved_by_registry", "Grants descriptor authority drift")

expected_contracts = {
    "GrantProgramRegistry420",
    "GrantApplicationRegistry420",
    "GrantAwardRegistry420",
    "GrantMilestoneRegistry420",
}
contracts = manifest.get("contracts", [])
need({c.get("contractName") for c in contracts} == expected_contracts, "Grants descriptor contract set drift")

for contract in contracts:
    name = contract["contractName"]
    artifact_path = ROOT / "contracts/out" / f"{name}.sol" / f"{name}.json"
    need(artifact_path.exists(), f"compiled Grants artifact missing: {name}")
    if not artifact_path.exists():
        continue
    artifact = json.loads(read(artifact_path))
    events = [x for x in artifact.get("abi", []) if x.get("type") == "event"]
    actual = {}
    for event in events:
        signature = event["name"] + "(" + ",".join(i["type"] for i in event.get("inputs", [])) + ")"
        actual[signature] = event
    expected_events = contract.get("events", [])
    need(len(actual) == len(expected_events), f"compiled Grants event count drift: {name}")
    for expected in expected_events:
        signature = expected["signature"]
        event = actual.get(signature)
        need(event is not None, f"compiled Grants event missing: {name}.{signature}")
        if event is None:
            continue
        actual_inputs = [
            {"name": i.get("name"), "type": i.get("type"), "indexed": bool(i.get("indexed"))}
            for i in event.get("inputs", [])
        ]
        need(actual_inputs == expected.get("inputs"), f"compiled Grants event input/indexing drift: {signature}")

need("'420/service/grants/v1'" in catalog, "Wallet catalogue missing canonical Grants service")
need("name: '420 Grants'" in catalog, "Wallet catalogue missing Grants display identity")
need("category: 'finance'" in catalog, "Wallet Grants category drift")

need("prepareSmartAccountExecution" in handoff, "Grants handoff no longer uses Wallet SmartAccount execution")
need("GRANTS_SERVICE_ID_420 = '420/service/grants/v1'" in handoff, "Grants handoff service identity drift")
need("must not transfer native value" in handoff, "Grants handoff native-value fail-closed boundary missing")
for forbidden in ("eth_sendTransaction", "privateKey", "new Wallet(", "signTransaction"):
    need(forbidden not in handoff, f"Grants handoff acquired independent signing/broadcast authority: {forbidden}")
need("authority: 'SmartAccount420'" in handoff, "Grants handoff authority label drift")

need("420Grants" in indexer_protocol, "Indexer protocol catalogue missing 420Grants")
for key in ("programId","applicationId","awardId","milestoneId"):
    need(key in indexer_lifecycle, f"Indexer lifecycle object key missing: {key}")
need("protocol: '420Grants'" in indexer_lifecycle, "Indexer Grants lifecycle policy missing")
need("grantsDescriptorsFromArtifacts420" in indexer_desc, "Grants artifact descriptor generator missing")
need("bindGrantsDescriptors420" in indexer_desc, "Grants deployment descriptor binding missing")
for fn in ("grantsProgramState420","grantsApplicationState420","grantsAwardState420","grantsMilestoneState420"):
    need(fn in indexer_read, f"Grants read model missing: {fn}")
need(indexer_read.count("authoritative: false") >= 8, "Grants read model authority disclaimer drift")
for method in ("grantsProgram","grantsApplication","grantsAward","grantsMilestone"):
    need(method in indexer_api, f"Indexer public API missing Grants method: {method}")
for route in ("/v1/grants/programs/", "/v1/grants/applications/", "/v1/grants/awards/", "/v1/grants/milestones/"):
    need(route.replace("/", "\\/") in indexer_http or route in indexer_http, f"Indexer HTTP route missing: {route}")
need("export * from './grants-descriptors.js';" in indexer_exports, "Grants descriptor export missing")
need("export * from './grants-read-model.js';" in indexer_exports, "Grants read-model export missing")

for token in (
    "Grants descriptor generation rejects ABI/indexing drift",
    "Grants program read model reconstructs",
    "Grants application read model rejects replay",
    "Grants award read model reconstructs terminal state",
    "Grants milestone read model reconstructs claim",
    "generic lifecycle reduction recognizes Grants",
    "Grants HTTP read routes expose non-authoritative client views",
):
    need(token in indexer_test, f"Grants Indexer regression missing: {token}")
for token in (
    "preserves SmartAccount420 as execution authority",
    "fails closed on wrong service identity or native value",
    "rejects empty calldata",
):
    need(token in wallet_test, f"Grants Wallet handoff regression missing: {token}")

need(grants_cfg.get("publicStandaloneApplication") is False, "Grants incorrectly promoted to standalone public application")
integrations = grants_cfg.get("integrations", [])
need(any("Wallet" in x for x in integrations), "Grants Genesis config missing replaceable Wallet/client integration")
need(any("Registry" in x for x in integrations), "Grants Genesis config missing Registry discovery integration")

grants_apps = [x for x in dapp_map.get("apps", []) if x.get("dapp") == "420 Grants"]
need(len(grants_apps) == 1, "Genesis dApp map Grants entry missing or duplicated")
if grants_apps:
    expected_suite = {
        "GrantIds420.sol","GrantAuthorization420.sol","GrantProgramRegistry420.sol",
        "GrantApplicationRegistry420.sol","GrantAwardRegistry420.sol",
        "GrantMilestoneRegistry420.sol","GrantRouter420.sol"
    }
    need(set(grants_apps[0].get("contracts", [])) == expected_suite, "Genesis dApp map Grants contract inventory drift")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass": True,
    "step": "GRANTS-AUDIT-6",
    "walletService": "420/service/grants/v1",
    "walletAuthority": "SmartAccount420",
    "standaloneApplication": False,
    "indexerProtocol": "420Grants",
    "descriptorContracts": sorted(expected_contracts),
    "clientViews": ["program","application","award","milestone"],
    "authority": "non_authoritative_index_projection"
}, indent=2))
