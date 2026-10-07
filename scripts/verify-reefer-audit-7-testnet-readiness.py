#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OFFICIAL = ROOT / "developer-hub/manifests/testnet.json"
CHAIN = ROOT / "testnet/public/metadata/chain.json"
ENDPOINTS = ROOT / "testnet/services/endpoints.json"
PROTOCOL = ROOT / "config/protocol.json"
LIVE_WORKFLOW = ROOT / ".github/workflows/reefer-review-live-testnet.yml"
RUNNER = ROOT / "scripts/qualify-reefer-review-testnet.py"
TEMPLATE = ROOT / "docs/audit/REEFER-AUDIT-7-LIVE-EVIDENCE-DRAFT.example.json"
PASS_EVIDENCE = ROOT / "docs/audit/REEFER-AUDIT-7-LIVE-TESTNET-EVIDENCE.json"

errors = []

def fail(msg):
    errors.append(msg)

def load(path):
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} invalid JSON: {exc}")
        return {}

for path in [CHAIN, ENDPOINTS, PROTOCOL, LIVE_WORKFLOW, RUNNER, TEMPLATE]:
    if not path.exists():
        fail(f"missing REEFER-AUDIT-7 prerequisite: {path.relative_to(ROOT)}")

workflow = LIVE_WORKFLOW.read_text() if LIVE_WORKFLOW.exists() else ""
runner = RUNNER.read_text() if RUNNER.exists() else ""
for marker in ["workflow_dispatch", "manifest_path", "evidence_draft_path", "qualify-reefer-review-testnet.py", "reefer-audit-7-live-testnet"]:
    if marker not in workflow:
        fail("live workflow missing " + marker)
for marker in ["REEFER_AUDIT_7_LIVE_QUALIFICATION=PASS", "420/service/identity/v1", "420/service/rights/v1", "420/service/resource-protocol/v1", "420/service/search/v1", "420/service/notifications/v1", "420/service/mail/v1"]:
    if marker not in runner:
        fail("live runner missing " + marker)

protocol = load(PROTOCOL)
chain = load(CHAIN)
endpoints = load(ENDPOINTS)

if OFFICIAL.exists():
    manifest = load(OFFICIAL)
    if manifest.get("network", {}).get("environment") != "testnet":
        fail("official testnet manifest exists but environment is not testnet")
    if PASS_EVIDENCE.exists():
        evidence = load(PASS_EVIDENCE)
        if evidence.get("phase") != "REEFER-AUDIT-7" or evidence.get("status") != "PASS":
            fail("retained REEFER-AUDIT-7 evidence is not PASS")
        if not evidence.get("repositorySha"):
            fail("retained REEFER-AUDIT-7 evidence lacks exact repository SHA")
    else:
        fail("official testnet manifest exists but REEFER-AUDIT-7 PASS evidence is missing")
else:
    if PASS_EVIDENCE.exists():
        fail("REEFER-AUDIT-7 PASS evidence exists without official testnet manifest")
    raw = json.dumps({"chain": chain, "endpoints": endpoints, "protocol": protocol})
    if "PLACEHOLDER" not in raw and "REPLACE_" not in raw and "REPLACE" not in raw:
        fail("testnet metadata appears resolved while official manifest is absent")

if errors:
    for err in errors:
        print("ERROR:", err, file=sys.stderr)
    raise SystemExit(1)

if OFFICIAL.exists():
    print("REEFER_AUDIT_7_READINESS=LIVE_EVIDENCE_RETAINED")
    print("liveQualificationComplete=true")
else:
    print("REEFER_AUDIT_7_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST")
    print("liveQualificationComplete=false")
