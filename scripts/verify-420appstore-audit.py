#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(path):
    p = ROOT / path
    if not p.is_file():
        errors.append(f"missing required file: {path}")
    return p

cfg_path = require("contracts/config/420appstore-genesis.json")
readiness_path = require("testnet/public-services/appstore/readiness.json")

required = [
    "appstore/architecture/model.go",
    "appstore/runtime/service.go",
    "appstore/runtime/rpc_probe.go",
    "appstore/registry/sync.go",
    "appstore/catalog/store.go",
    "appstore/curation/policy.go",
    "appstore/security/evidence.go",
    "appstore/wallet/handoff.go",
    "appstore/api/discovery.go",
    "appstore/web/web.go",
    "appstore/cmd/appstore420/main.go",
    "appstore/closeout/closeout_test.go",
    "docs/420APPSTORE-ROADMAP.md",
    "docs/apps/appstore/appstore-10-closeout.md",
]
for path in required:
    require(path)

if cfg_path.is_file():
    cfg = json.loads(cfg_path.read_text())
    if cfg.get("contractsRequired") is not False:
        errors.append("420AppStore must remain contract-free")
    if cfg.get("canonicalStateAuthority") is not False:
        errors.append("420AppStore must remain non-canonical")
    if cfg.get("serviceId") != "420/service/appstore/v1":
        errors.append("canonical AppStore service ID drifted")
    inv = cfg.get("invariants", [])
    if len(inv) != 13:
        errors.append(f"expected 13 APP invariants, got {len(inv)}")
    for n in range(1, 14):
        token = f"APP-INV-{n:03d}:"
        if not any(str(x).startswith(token) for x in inv):
            errors.append(f"missing invariant {token[:-1]}")

if readiness_path.is_file():
    readiness = json.loads(readiness_path.read_text())
    if readiness.get("implementation_status") != "PARTIAL":
        errors.append("current audit must not claim implementation complete while runtime wiring blockers remain")
    if readiness.get("deployment_status") != "PENDING_PUBLIC_TESTNET":
        errors.append("public-testnet deployment status drifted")
    audit = readiness.get("current_audit", {})
    blockers = audit.get("blockers", [])
    if audit.get("status") != "REMEDIATION_REQUIRED":
        errors.append("current audit remediation status missing")
    for phrase in ("discovery API", "embedded frontend", "Registry Source", "ApplicationView", "public testnet"):
        if not any(phrase.lower() in str(b).lower() for b in blockers):
            errors.append(f"readiness evidence missing blocker: {phrase}")

main = (ROOT / "appstore/cmd/appstore420/main.go").read_text()
if 'Handler: service.Handler()' not in main:
    errors.append("audit assumption changed: production handler wiring must be re-audited")
if '"github.com/420integrated/420-integrated/appstore/api"' in main or '"github.com/420integrated/420-integrated/appstore/web"' in main:
    errors.append("runtime wiring changed without updating audit readiness evidence")

wallet = (ROOT / "appstore/wallet/handoff.go").read_text()
if "hardening.ValidatePublicURL" not in wallet:
    errors.append("wallet handoff no longer uses hardened public URL validation")

curation = (ROOT / "appstore/curation/policy.go").read_text()
if "math.IsNaN" not in curation or "math.IsInf" not in curation:
    errors.append("non-finite rating validation missing")

registry = (ROOT / "appstore/registry/sync.go").read_text()
if "stageVersions" not in registry:
    errors.append("atomic registry staging helper missing")

if errors:
    print("420AppStore audit qualification FAILED")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("420AppStore audit qualification PASS")
print("Canonical boundary: contract-free / non-canonical")
print("Current readiness: PARTIAL / remediation required / public testnet pending")
