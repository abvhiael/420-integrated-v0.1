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
    "appstore/registry/indexer_source.go",
    "appstore/registry/indexer_source_test.go",
    "appstore/catalog/store.go",
    "appstore/catalog/lifecycle.go",
    "appstore/catalog/lifecycle_test.go",
    "appstore/catalog/presentation_history.go",
    "appstore/catalog/presentation_history_test.go",
    "appstore/curation/policy.go",
    "appstore/security/evidence.go",
    "appstore/wallet/handoff.go",
    "appstore/api/discovery.go",
    "appstore/api/composition.go",
    "appstore/api/composition_test.go",
    "appstore/web/web.go",
    "appstore/publicservice/service.go",
    "appstore/publicservice/service_test.go",
    "appstore/publicservice/dependencies.go",
    "appstore/publicservice/probe.go",
    "appstore/publicservice/probe_test.go",
    "appstore/cmd/appstore420/main.go",
    "appstore/cmd/appstore420/main_test.go",
    "appstore/closeout/closeout_test.go",
    "docs/420APPSTORE-ROADMAP.md",
    "docs/apps/appstore/appstore-2-registry-sync.md",
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
    if audit.get("registry_source") != "420Indexer-backed finalized ProtocolRegistry projection":
        errors.append("APPSTORE-AUDIT-2 Registry source decision missing")
    for phrase in ("repository qualification", "public testnet"):
        if not any(phrase.lower() in str(b).lower() for b in blockers):
            errors.append(f"readiness evidence missing blocker: {phrase}")

main = (ROOT / "appstore/cmd/appstore420/main.go").read_text()
for token in ("APPSTORE_INDEXER_URL", "APPSTORE_VIEW_INPUTS", "APPSTORE_VERIFY_URL", "NewIndexerSource", "appstorecatalog.Open", "NewLifecycle", "lifecycle.Bootstrap", "NewViewSet", "rebuildApplicationViews", "runCatalogueComposition", "appstorepublic.New", "publicService.Handler"):
    if token not in main:
        errors.append(f"APPSTORE-AUDIT-2 production source wiring missing: {token}")

source = (ROOT / "appstore/registry/indexer_source.go").read_text()
for token in ("FinalizedHeight", "CanonicalAuthority", "ProtocolRegistryCanonicalAddress420", "projection.Rebuild"):
    if token not in source:
        errors.append(f"APPSTORE-AUDIT-2 source invariant missing: {token}")

wallet = (ROOT / "appstore/wallet/handoff.go").read_text()
if "hardening.ValidatePublicURL" not in wallet:
    errors.append("wallet handoff no longer uses hardened public URL validation")

curation = (ROOT / "appstore/curation/policy.go").read_text()
if "math.IsNaN" not in curation or "math.IsInf" not in curation:
    errors.append("non-finite rating validation missing")

composition = (ROOT / "appstore/api/composition.go").read_text()
for token in ("ComposeApplications", "LoadCompositionInputs", "DisallowUnknownFields", "catalog.RestoreProjection", "wallet.Build", "security.Build", "curation.Compose", "ViewSet"):
    if token not in composition:
        errors.append(f"APPSTORE-AUDIT-4 composition invariant missing: {token}")

public_service = (ROOT / "appstore/publicservice/service.go").read_text()
for token in ("ModeBlocked", "CanServeCanonical", "CanBrowse", "withoutVerificationEvidence", "StatusTooManyRequests", "appstoreweb.Handler", "appstoreapi.New"):
    if token not in public_service:
        errors.append(f"APPSTORE-AUDIT-5 public service invariant missing: {token}")

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
print("APPSTORE-AUDIT-2 source: 420Indexer-backed finalized ProtocolRegistry projection")
print("APPSTORE-AUDIT-3 lifecycle: persistent restore/rebuild/refresh/history wired")
print("APPSTORE-AUDIT-4 composition: canonical-bound ApplicationView state wired")
print("APPSTORE-AUDIT-5 public service: API/frontend/abuse/dependency composition wired")
print("Current readiness: PARTIAL / remediation required / public testnet pending")
