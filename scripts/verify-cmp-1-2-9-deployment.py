#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "contracts/config/compute-market/cmp-1.2.9-testnet-deployment-evidence.json"
PROTOCOL = ROOT / "config/protocol.json"
SERVICE_IDS = ROOT / "contracts/src/libraries/ServiceIds420.sol"
REGISTRY = ROOT / "contracts/src/apps/ProtocolRegistry.sol"

HEX40 = re.compile(r"^0x[0-9a-fA-F]{40}$")
HEX64 = re.compile(r"^0x[0-9a-fA-F]{64}$")

errors = []
e = json.loads(EVIDENCE.read_text())
p = json.loads(PROTOCOL.read_text())
service_ids = SERVICE_IDS.read_text()
registry = REGISTRY.read_text()

if e.get("schema") != "cmp-1.2.9-testnet-deployment-evidence-v1":
    errors.append("unexpected evidence schema")
if 'keccak256("420/service/compute-market/v1")' not in service_ids:
    errors.append("canonical COMPUTE_MARKET service id missing")
if "publishRegisteredService(" not in registry:
    errors.append("ProtocolRegistry genesis-grade publication path missing")
if e.get("expected_protocol_registry_address","").lower() != "0x0000000000000000000000000000000000000434":
    errors.append("unexpected ProtocolRegistry frozen address")

public_live = bool(
    p.get("step5",{}).get("substep_5_4",{}).get("public_testnet_live", False)
)
if e.get("deployment_network",{}).get("public_testnet_live") != public_live:
    errors.append("evidence/public protocol testnet-live state mismatch")

seen_roles = set()
for c in e.get("components", []):
    role = c.get("role")
    source = c.get("source")
    if not role or role in seen_roles:
        errors.append("duplicate/missing component role")
        continue
    seen_roles.add(role)
    if not source or not (ROOT / source).is_file():
        errors.append(f"missing component source: {role}:{source}")

required_roles = {
    "ComputeRouter420","ComputeJobRegistry420","ComputeEscrowFunding420",
    "ComputeAcceptedPriceMatch420","ComputeJobMatchedWorkerEvidence420",
    "ComputeJobIntegerProfileVerification420","ComputeDisputeResolution420",
    "ComputeVerifiedEntitlement420","ComputeProviderRegistry420",
    "ComputeNodeRegistry420","ComputeResourceRegistry420","ComputeOfferRegistry420",
    "ComputeAuthorization420","ComputeJobSignedRequestAuthority420",
    "ComputeVerifierIndependencePolicy420","CMPVaultAuthorization420",
    "AssetVault420","VaultRegistry420","VaultAccounting420",
    "VaultPolicyRegistry420","CapabilityRegistry420"
}
missing_roles = sorted(required_roles - seen_roles)
if missing_roles:
    errors.append("missing deployment roles: " + ",".join(missing_roles))

def require_hex40(label, value):
    if not isinstance(value,str) or not HEX40.match(value):
        errors.append(f"{label} missing/invalid address")

def require_hex64(label, value):
    if not isinstance(value,str) or not HEX64.match(value):
        errors.append(f"{label} missing/invalid bytes32")

def require_tx(label, value):
    require_hex64(label, value)

if public_live:
    net = e["deployment_network"]
    if not isinstance(net.get("chain_id"), int) or net["chain_id"] <= 0:
        errors.append("live chain_id missing")
    if not net.get("rpc_url") or not str(net["rpc_url"]).startswith(("http://","https://")):
        errors.append("live rpc_url missing")
    require_hex64("genesis_hash", net.get("genesis_hash"))
    if not isinstance(net.get("head_block"), int) or net["head_block"] < 0:
        errors.append("head_block missing")
    if not isinstance(net.get("finalized_block"), int) or net["finalized_block"] < 0:
        errors.append("finalized_block missing")

    d = e["discovery"]
    require_hex40("router implementation", d.get("implementation_address"))
    require_tx("router deployment tx", d.get("deployment_tx"))
    if not isinstance(d.get("deployment_block"), int) or d["deployment_block"] < 0:
        errors.append("router deployment_block missing")
    for k in ("runtime_code_hash","component_graph_hash","metadata_hash",
              "manifest_hash","dependency_root","interface_hash"):
        require_hex64(k, d.get(k))
    require_tx("registry publish tx", d.get("registry_publish_tx"))
    if not isinstance(d.get("registry_version"), int) or d["registry_version"] <= 0:
        errors.append("registry version missing")
    if d.get("registry_active") is not True:
        errors.append("ComputeMarket Registry publication not active")

    for c in e["components"]:
        require_hex40(c["role"]+" address", c.get("address"))
        require_tx(c["role"]+" deployment tx", c.get("deployment_tx"))
        if not isinstance(c.get("deployment_block"), int) or c["deployment_block"] < 0:
            errors.append(c["role"]+" deployment_block missing")
        require_hex64(c["role"]+" runtime hash", c.get("runtime_code_hash"))

    if not e.get("grants"):
        errors.append("live capability grant inventory missing")
    else:
        for i,g in enumerate(e["grants"]):
            if not g.get("grant_id"):
                errors.append(f"grant[{i}] id missing")
            require_hex40(f"grant[{i}] principal", g.get("principal"))
            for key in ("component_id","action_id","scope_hash"):
                require_hex64(f"grant[{i}] {key}", g.get(key))
            if g.get("active") is not True:
                errors.append(f"grant[{i}] not active")

    for k,v in e.get("live_transactions",{}).items():
        require_tx("live transaction "+k, v)

    for k,v in e.get("required_assertions",{}).items():
        if v is not True:
            errors.append("live assertion not proven: "+k)
else:
    errors.append(
        "LIVE_BLOCKER: repository authority says public_testnet_live=false; "
        "CMP-1.2.9 live deployment qualification cannot pass without canonical chain receipts/state"
    )

print(json.dumps({
    "step":"CMP-1.2.9",
    "public_testnet_live": public_live,
    "source_graph_ready": not any(x.startswith("missing component") for x in errors),
    "pass": not errors,
    "errors": errors
}, indent=2))
sys.exit(0 if not errors else 1)
