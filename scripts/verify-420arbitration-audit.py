#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []


def need(cond, msg):
    if not cond:
        errors.append(msg)


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


cfg = json.loads(read("contracts/config/420arbitration-genesis.json"))
service_ids = read("contracts/src/libraries/ServiceIds420.sol")
case_src = read("contracts/src/arbitration/ArbitrationCaseRegistry420.sol")
ruling_src = read("contracts/src/arbitration/ArbitrationRulingRegistry420.sol")
policy_src = read("contracts/src/arbitration/ArbitrationPolicyRegistry420.sol")
arch = read("docs/architecture/protocols/arbitration.md")

expected_contracts = [
    "ArbitrationIds420.sol",
    "ArbitrationPolicyRegistry420.sol",
    "ArbitrationCaseRegistry420.sol",
    "ArbitrationRulingRegistry420.sol",
]

need(cfg.get("schema") == "420-arbitration-genesis-v1", "Arbitration config schema drift")
need(cfg.get("class") == "GENESIS_PROTOCOL_AND_USER_APP", "Arbitration app class drift")
need(cfg.get("serviceId") == "420/service/arbitration/v1", "Arbitration service ID drift")
need(cfg.get("contracts") == expected_contracts, "Arbitration contract inventory drift")
need('ARBITRATION = keccak256("420/service/arbitration/v1")' in service_ids, "ServiceIds420 Arbitration ID drift")

invariants = cfg.get("invariants", [])
for i in range(1, 13):
    need(any(x.startswith(f"ARB-INV-{i:03d}:") for x in invariants), f"missing ARB-INV-{i:03d}")

for path in [
    "contracts/src/arbitration/ArbitrationIds420.sol",
    "contracts/src/arbitration/ArbitrationPolicyRegistry420.sol",
    "contracts/src/arbitration/ArbitrationCaseRegistry420.sol",
    "contracts/src/arbitration/ArbitrationRulingRegistry420.sol",
    "contracts/test/ArbitrationGenesis420.t.sol",
    "docs/420ARBITRATION.md",
    "docs/apps/arbitration/architecture.md",
    "docs/apps/arbitration/user-guide.md",
    "docs/apps/arbitration/security.md",
    "docs/apps/arbitration/troubleshooting.md",
    "docs/apps/arbitration/developer/index.md",
    "docs/apps/arbitration/developer/contracts.md",
    "docs/apps/arbitration/developer/api.md",
    "docs/apps/arbitration/developer/events.md",
    "docs/apps/arbitration/deployment-operations.md",
    "docs/apps/arbitration/threat-model.md",
]:
    need((ROOT / path).exists(), f"required Arbitration file missing: {path}")

need("requestedRemedyHash == bytes32(0)" in case_src, "requested-remedy commitment validation missing")
need("EvidenceAlreadyCommitted" in case_src, "duplicate evidence replay guard missing")
need(
    "function getCase(" in case_src and "CaseRecord memory record" in case_src,
    "case inspection getter missing",
)
need("remedyCommitment == bytes32(0)" in ruling_src, "ruling remedy commitment validation missing")
need("maxAppeals > 3" in policy_src, "bounded appeal cap missing")
need("onlyGovernance" in policy_src, "governance policy authority missing")
need(
    "originating protocol" in arch.lower() and "custody" in arch.lower(),
    "authority boundary documentation missing",
)

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(1)

print(
    json.dumps(
        {
            "pass": True,
            "suite": "420Arbitration",
            "canonicalContracts": expected_contracts,
            "invariants": len(invariants),
            "serviceId": cfg["serviceId"],
            "repositoryScope": "source-and-documentation",
            "releaseMaterialization": "blocked-pending-canonical-service-endpoint-and-address-authority",
        },
        indent=2,
    )
)
