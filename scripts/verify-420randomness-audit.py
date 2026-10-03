#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
errors = []
warnings = []

required = [
    "contracts/src/randomness/RandomnessIds420.sol",
    "contracts/src/randomness/RandomnessRouteRegistry420.sol",
    "contracts/src/randomness/RandomnessProfileRegistry420.sol",
    "contracts/src/randomness/RandomnessRegistry.sol",
    "contracts/src/randomness/RandomnessRouter420.sol",
    "contracts/src/randomness/RandomnessDraw420.sol",
    "contracts/src/interfaces/IRandomnessRouter420.sol",
    "contracts/src/interfaces/IRandomnessVerifier420.sol",
    "contracts/test/Randomness420.t.sol",
    "contracts/test/RandomnessAudit420.t.sol",
    "docs/architecture/protocols/randomness-oracle-interface.md",
]
for path in required:
    if not (root / path).is_file():
        errors.append("missing required file: " + path)

m = json.loads((root / "contracts/config/genesis-dapp-contract-map.json").read_text())
random_apps = [x for x in m.get("apps", []) if x.get("dapp") == "420 Random"]
if len(random_apps) != 1:
    errors.append("420 Random genesis map entry must exist exactly once")
else:
    expected = {
        "RandomnessRegistry.sol","RandomnessIds420.sol","RandomnessRouteRegistry420.sol",
        "RandomnessProfileRegistry420.sol","RandomnessRouter420.sol","RandomnessDraw420.sol",
        "IRandomnessRouter420.sol","IRandomnessVerifier420.sol",
    }
    if set(random_apps[0].get("contracts", [])) != expected:
        errors.append("420 Random genesis contract inventory drift")

ns = json.loads((root / "contracts/config/genesis-address-namespace.json").read_text())
fixed = {x.get("name"): x for x in ns.get("fixedAssignments", [])}
if fixed.get("RandomnessRegistry", {}).get("address", "").lower() != "0x0000000000000000000000000000000000000428":
    errors.append("RandomnessRegistry frozen address drift")

resolved = {x.get("id"): x for x in ns.get("registryResolved", [])}
rr = resolved.get("randomness-router")
if not rr or rr.get("contract") != "RandomnessRouter420.sol":
    errors.append("randomness-router canonical discovery drift")

plan = json.loads((root / "contracts/config/predeploy/predeploy-plan.json").read_text())
pre = next((x for x in plan.get("predeploys", []) if x.get("name") == "RandomnessRegistry"), None)
if not pre:
    errors.append("RandomnessRegistry missing from predeploy plan")
elif pre.get("source") != "randomness/RandomnessRegistry.sol":
    errors.append("RandomnessRegistry predeploy still points at legacy system/RandomnessRegistry.sol")

legacy = root / "contracts/src/system/RandomnessRegistry.sol"
if legacy.exists():
    warnings.append("legacy contracts/src/system/RandomnessRegistry.sol remains historical/orphaned and must not be used for the 0x0428 application predeploy")

artifact = root / "contracts/artifacts/RandomnessRegistry.json"
state = root / "contracts/config/predeploy/RandomnessRegistry-predeploy-state.json"
if not artifact.exists():
    warnings.append("Genesis runtime artifact not yet retained: contracts/artifacts/RandomnessRegistry.json")
if not state.exists():
    warnings.append("Genesis predeploy state not yet retained: contracts/config/predeploy/RandomnessRegistry-predeploy-state.json")

out = {"pass": not errors, "errors": errors, "warnings": warnings}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)
