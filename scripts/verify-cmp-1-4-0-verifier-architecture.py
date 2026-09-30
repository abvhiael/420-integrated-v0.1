#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL = ROOT / "contracts/config/compute-market/cmp-1.4.0-verifier-architecture.json"
DOC = ROOT / "docs/compute-market/CMP-1.4.0-VERIFIER-ARCHITECTURE-RECONCILIATION.md"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

def fail(msg):
    print(f"CMP-1.4.0 verifier architecture verification failed: {msg}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(MODEL.read_text())
if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.4.0.VerifierArchitecture.v1":
    fail("unexpected schema")
if data.get("step") != "CMP-1.4.0":
    fail("wrong step")
expected_definition = "Inventory all existing verifier, policy, selector, attestation and signed-verdict components. Freeze canonical ownership and authority boundaries."
if data.get("canonical_definition") != expected_definition:
    fail("canonical definition drift")

roadmap = ROADMAP.read_text()
if "### CMP-1.4.0 — Verifier architecture reconciliation" not in roadmap or expected_definition not in roadmap:
    fail("detailed roadmap definition missing")

required_components = {
    "contracts/src/compute/ComputeJobVerifierEvidence420.sol",
    "contracts/src/compute/ComputeJobIndependentVerification420.sol",
    "contracts/src/compute/ComputeJobPolicyEnforcedVerification420.sol",
    "contracts/src/compute/ComputeJobIntegerProfileVerification420.sol",
    "contracts/src/compute/ComputeVerifierIndependencePolicy420.sol",
    "contracts/src/compute/ComputePolicyRegistry420.sol",
    "contracts/src/compute/ComputeJobCanonicalWiring420.sol",
}
actual_components = {x.get("source") for x in data.get("existing_components", [])}
if actual_components != required_components:
    fail("existing component inventory mismatch")

for rel in required_components:
    if not (ROOT / rel).is_file():
        fail(f"missing retained source: {rel}")

for key in ("retained_tests", "retained_docs"):
    values = data.get(key)
    if not isinstance(values, list) or not values or len(values) != len(set(values)):
        fail(f"{key} must be non-empty and duplicate-free")
    for rel in values:
        if not (ROOT / rel).is_file():
            fail(f"missing retained path: {rel}")

expected_steps = {f"CMP-1.4.{i}" for i in range(1, 13)}
owners = set()
def walk(value):
    if isinstance(value, dict):
        if "owner_step" in value:
            owners.add(value["owner_step"])
        for v in value.values():
            walk(v)
    elif isinstance(value, list):
        for v in value:
            walk(v)
walk(data.get("canonical_model", {}))
if owners != expected_steps:
    fail(f"future ownership map mismatch: {sorted(owners)}")

required_boundaries = [
    "Vault custody", "settlement", "signed verdict", "beneficiary", "selector",
    "Policy publication", "420Trust", "private", "historical", "Emergency", "Non-AI"
]
boundaries = "\n".join(data.get("authority_boundaries", []))
for token in required_boundaries:
    if token.lower() not in boundaries.lower():
        fail(f"authority boundary missing concept: {token}")

expected_invariants = {
    "CMP-INV-005","CMP-INV-009","CMP-INV-010","CMP-INV-013","CMP-INV-014",
    "CMP-INV-016","CMP-INV-017","CMP-INV-018","CMP-INV-020","CMP-INV-022",
    "CMP-INV-023","CMP-INV-024","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"
}
if set(data.get("frozen_invariants", [])) != expected_invariants:
    fail("frozen invariant set mismatch")

deployment = data.get("deployment_publication", {})
if deployment.get("fixed_genesis_predeploy_created") is not False:
    fail("must not claim fixed Genesis predeploy")
if deployment.get("protocol_registry_publication_claimed") is not False:
    fail("must not claim ProtocolRegistry publication")
if deployment.get("live_deployment_claimed") is not False:
    fail("must not claim live deployment")

doc = DOC.read_text()
for heading in [
    "## Canonical definition","## Repository baseline","## Gap analysis",
    "## Canonical verifier model","## Frozen authority boundaries",
    "## Frozen invariant mapping","## Security, integration and deployment disposition",
    "## Qualification requirements","## Exit criteria","## Completion"
]:
    if heading not in doc:
        fail(f"missing document heading: {heading}")

print("CMP-1.4.0 verifier architecture reconciliation: mechanically consistent")
