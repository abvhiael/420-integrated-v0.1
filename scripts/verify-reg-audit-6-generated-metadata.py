#!/usr/bin/env python3
"""Mechanical REG-AUDIT-6 catalogue/reference metadata qualification."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "developer-hub/catalogue/local.example.json"
NET = ROOT / "developer-hub/manifests/local.example.json"
ART = ROOT / "contracts/artifacts/ProtocolRegistry.json"
IFACE = ROOT / "contracts/src/interfaces/genesis/IProtocolRegistry420.sol"
PRE = ROOT / "contracts/config/predeploy/ProtocolRegistry-predeploy-state.json"
GEN_CONTRACTS = ROOT / "docs/reference/generated/contracts.md"
GEN_DEPLOY = ROOT / "docs/reference/generated/deployments.md"
GEN_EVENTS = ROOT / "docs/reference/generated/events-errors.md"

ADDRESS = "0x0000000000000000000000000000000000000434"
ARTIFACT_PATH = "contracts/artifacts/ProtocolRegistry.json"
INTERFACE_PATH = "contracts/src/interfaces/genesis/IProtocolRegistry420.sol"

errors: list[str] = []

def fail(msg: str) -> None:
    errors.append(msg)

def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return {}

cat = load(CAT)
net = load(NET)
art = load(ART)
pre = load(PRE)

entries = [x for x in cat.get("contracts", []) if x.get("name") == "ProtocolRegistry"]
if len(entries) != 1:
    fail("catalogue must contain exactly one ProtocolRegistry entry")
else:
    c = entries[0]
    if c.get("address") != ADDRESS: fail("catalogue ProtocolRegistry address is stale")
    if c.get("artifact") != ARTIFACT_PATH: fail("catalogue ProtocolRegistry artifact path is stale")
    if c.get("interface") != INTERFACE_PATH: fail("catalogue ProtocolRegistry interface path is stale")
    if c.get("verified") is not True: fail("catalogue ProtocolRegistry artifact identity must be verified")
    canonical_abi = json.dumps(art.get("abi"), separators=(",", ":"), ensure_ascii=True)
    expected_abi = hashlib.sha256(canonical_abi.encode("utf-8")).hexdigest()
    if c.get("abiSha256") != expected_abi:
        fail(f"catalogue ABI hash mismatch: expected {expected_abi}")

registry = net.get("contracts", {}).get("Registry420", {})
if net.get("network", {}).get("environment") != "local":
    fail("local.example network manifest must remain explicitly local")
if registry.get("address") != ADDRESS:
    fail("network manifest Registry420 address is stale")
if registry.get("version") != "local-example":
    fail("network manifest Registry420 must remain visibly example-scoped")
if registry.get("source") != "deployment-manifest":
    fail("network manifest Registry420 source drifted")

if not ART.is_file(): fail("retained ProtocolRegistry artifact missing")
if not IFACE.is_file(): fail("frozen IProtocolRegistry420 interface missing")
if art.get("predeployAddress") != ADDRESS: fail("artifact predeploy address mismatch")
if pre.get("address") != ADDRESS: fail("predeploy-state address mismatch")
if pre.get("runtimeArtifact") != ARTIFACT_PATH: fail("predeploy-state artifact path mismatch")
if art.get("runtimeCodeHash") != pre.get("runtimeCodeHash"):
    fail("artifact/predeploy runtime code hash mismatch")

active = {
    "catalogue": CAT.read_text(encoding="utf-8"),
    "generated contracts": GEN_CONTRACTS.read_text(encoding="utf-8"),
    "generated deployments": GEN_DEPLOY.read_text(encoding="utf-8"),
    "generated events": GEN_EVENTS.read_text(encoding="utf-8"),
}
for label, text in active.items():
    for stale in (
        "contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json",
        "contracts/src/interfaces/IProtocolRegistry.sol",
        "0x0000000000000000000000000000000000000420",
        "0x0000000000000000000000000000000000000448",
    ):
        if stale in text:
            fail(f"{label} retains stale Registry metadata: {stale}")

contracts_text = active["generated contracts"]
if f"Catalogue address: \`{ADDRESS}\` (**local example only**)" not in contracts_text:
    fail("generated contract reference does not visibly retain local-example scope")
if f"Declared artifact: \`{ARTIFACT_PATH}\` (present)" not in contracts_text:
    fail("generated contract reference does not use retained artifact")
if f"Declared interface: \`{INTERFACE_PATH}\` (present)" not in contracts_text:
    fail("generated contract reference does not use frozen interface")
if "Distributable verified ABI: **YES**" not in contracts_text:
    fail("generated contract reference does not reflect qualified ABI identity")

deploy_text = active["generated deployments"]
if "**None currently available from checked-in evidence.**" not in deploy_text:
    fail("generated deployment reference must fail closed for canonical deployments")
if "not a canonical network deployment" not in deploy_text:
    fail("example deployment row is not visibly non-canonical")

if errors:
    print("REG-AUDIT-6 qualification FAILED", file=sys.stderr)
    for error in errors:
        print(f" - {error}", file=sys.stderr)
    raise SystemExit(1)

print("REG-AUDIT-6 qualification PASS")
print(f"ProtocolRegistry address: {ADDRESS}")
print(f"artifact: {ARTIFACT_PATH}")
print(f"interface: {INTERFACE_PATH}")
print(f"ABI SHA-256: {entries[0]['abiSha256']}")
