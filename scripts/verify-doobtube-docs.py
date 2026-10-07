#!/usr/bin/env python3
"""DOOBTUBE-10 documentation/deployment/operator closeout verifier."""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    p=ROOT/path
    assert p.exists(), f"missing {path}"
    return p.read_text(encoding="utf-8")

def need(path, phrases):
    text=read(path)
    for phrase in phrases:
        assert phrase in text, f"{path}: missing {phrase!r}"
    return text

root=need("README.md",[
    "## DoobTube",
    "doobtube/README.md",
    "replaceable user-facing video application/client over canonical 420Media",
])
app=need("doobtube/README.md",[
    "# DoobTube",
    "420/service/media/v1",
    "Clean build and qualification",
    "Non-production deployment",
    "python3 -m doobtube.ops.server",
    "NONPRODUCTION_AUTH_NOT_CONFIGURED",
    "DOOBTUBE-11",
])
ref=need("docs/DOOBTUBE-REFERENCE.md",[
    "Architecture/component map",
    "Contracts",
    "Registry and service identities",
    "Roles and permissions",
    "DoobTube API",
    "420Media API interfaces consumed by DoobTube",
    "Events and projections",
    "Persistence schemas",
    "State machines",
    "Security assumptions",
    "Known limitations",
])
user=need("docs/DOOBTUBE-USER-GUIDE.md",[
    "What DoobTube is","Home and discovery","Search","Watching video",
    "Wallet connection","Creator library","Upload","Livestream",
    "Subscriptions","Reports and appeals","Delete/export","Accessibility",
])
dev=need("docs/DOOBTUBE-DEVELOPER-GUIDE.md",[
    "Clean checkout qualification","Static web build","Local non-production deployment",
    "Authorization","Idempotency","Projection integration","Media integration",
    "Database migrations","Adding dependencies","Security","Pull request qualification",
])
operator=need("docs/DOOBTUBE-OPERATOR-GUIDE.md",[
    "Preflight","Build","Launch","Configuration reference","Secrets",
    "Database and migrations","Projection recovery","Livestream recovery",
    "Incident response","Monitoring / SLOs","Troubleshooting","Backup policy",
    "Release manifest",
])
security=need("docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md",[
    "Broken access control","Moderation abuse","Malicious uploads",
    "Secrets / logging / privacy leakage",
])
ops_config=need("doobtube/ops/config.py",[
    "class NonProductionConfig",
    "non-production launcher is loopback-only",
    "production=false",
])
ops_server=need("doobtube/ops/server.py",[
    "Loopback-only DoobTube non-production launcher",
    "NONPRODUCTION_AUTH_NOT_CONFIGURED",
    "cfg.validate()",
    "GET",
])
ops_tests=need("doobtube/tests/test_doobtube_ops.py",[
    "test_nonproduction_config_rejects_non_loopback",
    "test_production_true_is_rejected",
    "test_runtime_config_is_explicitly_nonproduction_and_dependencies_unresolved",
    "test_loopback_server_serves_health_readiness_web_and_rejects_writes",
])

deploy=json.loads(read("doobtube/deploy/nonproduction.example.json"))
assert deploy["schema"]=="doobtube-nonproduction-v1"
assert deploy["production"] is False
assert deploy["bind"]["host"] in {"127.0.0.1","localhost","::1"}
assert 1 <= int(deploy["bind"]["port"]) <= 65535
assert deploy["runtime"]["chainId"]>0
assert deploy["runtime"]["network"]
assert deploy["dependencies"]["420Media"] is False
assert deploy["dependencies"]["420Registry"] is False

manifest=json.loads(read("doobtube/release/manifest-v1.json"))
assert manifest["schema"]=="doobtube-release-manifest-v1"
assert manifest["application"]=="DoobTube"
assert manifest["source_sha"]=="MATERIALIZE_AT_RELEASE"
assert manifest["production"] is False
assert manifest["testnet_ready"] is False
assert manifest["genesis_ready"] is False
assert manifest["production_ready"] is False
assert manifest["service_identity"]["doobtube"] is None
assert manifest["service_identity"]["canonical_media"]=="420/service/media/v1"
assert manifest["contracts"]==[]
assert manifest["reserved_addresses"]==[]
assert manifest["backend"]["database_schema_version"]==2
assert manifest["qualification"]["level3_required"] is True
assert manifest["qualification"]["public_testnet_required"] is True

# Repository docs/config may not create a production claim or secret-bearing deployment.
for path in [
    "doobtube/README.md","docs/DOOBTUBE-REFERENCE.md","docs/DOOBTUBE-USER-GUIDE.md",
    "docs/DOOBTUBE-DEVELOPER-GUIDE.md","docs/DOOBTUBE-OPERATOR-GUIDE.md",
    "doobtube/deploy/nonproduction.example.json","doobtube/release/manifest-v1.json",
]:
    text=read(path)
    assert "DoobTube is production-ready" not in text
    assert not re.search(r'(?i)"?(privateKey|seedPhrase|mnemonic|authorizationToken|rawSecret|apiKey)"?\s*:',text), f"secret-like deployment field in {path}"

road=read("docs/DOOBTUBE-ROADMAP.md")
audit=read("docs/DOOBTUBE-AUDIT.md")
assert "**Status: COMPLETE (Level 1).** Canonical documentation/operator definition" in road
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit
assert "DOCUMENTATION COMPLETE: **YES for repository app scope**" in audit

print("DOOBTUBE-10 Level 1 documentation/deployment/operator verification: PASS")
