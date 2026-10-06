#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

required_docs = {
    "docs/apps/town/index.md": ["TOWN-AUDIT-10", "architecture.md", "user-guide.md", "operator-guide.md", "known-limitations.md"],
    "docs/apps/town/architecture.md": ["Authority boundary", "Component map", "State machines", "Failure model"],
    "docs/apps/town/authority.md": ["Membership lifecycle", "Roles and permissions", "Treasury boundary", "Events and invariants"],
    "docs/apps/town/api.md": ["/v1 API", "Typed SDK", "Derived projection / indexer surface", "Interruption recovery", "Webhooks"],
    "docs/apps/town/content.md": ["Storage boundary", "Visibility"],
    "docs/apps/town/moderation.md": ["appeal"],
    "docs/apps/town/integrations.md": ["420Identity", "420Storage", "420Search", "420Notifications", "420Messenger"],
    "docs/apps/town/security.md": ["Accepted design risks"],
    "docs/apps/town/web.md": ["wallet"],
    "docs/apps/town/user-guide.md": ["Connect a wallet", "Discover and open a community", "Reports, moderation, and appeals", "Current release boundary"],
    "docs/apps/town/developer-guide.md": ["Build and test", "API", "Errors and failure semantics", "Events", "Integration contracts"],
    "docs/apps/town/operator-guide.md": ["Runtime configuration", "Service health", "Projection and recovery", "Security operations", "Live-testnet handoff"],
    "docs/apps/town/configuration-deployment.md": ["Canonical configuration files", "Environment policy", "Pre-testnet deployment state", "Deployment sequence for TOWN-AUDIT-11", "Rollback"],
    "docs/apps/town/known-limitations.md": ["Live infrastructure", "Authentication", "Webhooks", "Treasury/payment", "Release stages"],
}

for rel, tokens in required_docs.items():
    p = ROOT / rel
    if not p.is_file():
        raise SystemExit(f"missing required Town documentation: {rel}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise SystemExit(f"{rel}: missing required documentation token: {token}")

readme = (ROOT / "town/README.md").read_text(encoding="utf-8")
for token in ["verify-420town-docs.py", "TOWN-AUDIT-10", "TOWN-AUDIT-11", "known-limitations.md"]:
    if token not in readme:
        raise SystemExit(f"town/README.md: missing {token}")

cfg = json.loads((ROOT / "config/420town-genesis.json").read_text(encoding="utf-8"))
if cfg.get("status") != "REPOSITORY_COMPLETE_PRE_TESTNET":
    raise SystemExit("420town genesis status is not repository-complete pre-testnet")
through = cfg.get("implementedThrough", [])
for step in [f"TOWN-AUDIT-{i}" for i in range(1, 11)]:
    if step not in through:
        raise SystemExit(f"420town genesis missing implemented step {step}")
if cfg.get("deferredRoadmap") != ["TOWN-AUDIT-11", "TOWN-AUDIT-12"]:
    raise SystemExit("420town genesis deferred roadmap must contain only live testnet and production release")
if cfg.get("securityConfig") != "config/420town-security-v1.json":
    raise SystemExit("420town genesis security config binding missing")
if cfg.get("documentationRoot") != "docs/apps/town":
    raise SystemExit("420town genesis documentation root binding missing")

roadmap = (ROOT / "docs/420TOWN-ROADMAP.md").read_text(encoding="utf-8")
if "## TOWN-AUDIT-10 — Documentation and exact-head repository qualification" not in roadmap:
    raise SystemExit("TOWN-AUDIT-10 roadmap definition missing")
if "## TOWN-AUDIT-11 — Live testnet qualification" not in roadmap:
    raise SystemExit("TOWN-AUDIT-11 roadmap definition missing")

print("420Town documentation/phase-closeout verifier PASS")
