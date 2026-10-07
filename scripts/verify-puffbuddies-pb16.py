#!/usr/bin/env python3
from pathlib import Path
import ast,re

ROOT=Path(__file__).resolve().parents[1]
API=(ROOT/"puffbuddies/api/hardening.py").read_text()
DOC=(ROOT/"docs/puffbuddies/PB-16-SECURITY-PRIVACY-AUDIT.md").read_text()

def need(ok,msg):
    if not ok: raise SystemExit("FAIL: "+msg)

need("def _request_id() -> str:" in API,"server-owned request ID helper missing")
need('headers.get("x-request-id"' not in API,"client request ID still trusted")
need('return "pb-" + secrets.token_hex(16)' in API,"request ID entropy contract missing")
for rel in [
 "puffbuddies/tests/test_pb_1_10_privacy.py",
 "puffbuddies/tests/test_pb_1_11_adversarial_state_machine.py",
 "puffbuddies/tests/test_pb_2_11_adversarial_identity_eligibility.py",
 "puffbuddies/tests/test_pb_8_safety_moderation.py",
 "puffbuddies/tests/test_pb_14_backend_api_hardening.py",
 "puffbuddies/tests/test_pb_16_security_privacy_audit.py",
]:
    need((ROOT/rel).is_file(),f"missing retained security surface: {rel}")
need("PB16-F1" in DOC and "server-generated only" in DOC,"audit finding/remediation record missing")
need("PB-17 — Closed testnet" in DOC,"next canonical step missing")
need("Intentionally deferred Level 3" in DOC,"Level-3 boundary missing")
need(not (ROOT/"contracts/src/puffbuddies").exists(),"unexpected PuffBuddies contract surface")
for path in (ROOT/"puffbuddies").rglob("*.py"):
    tree=ast.parse(path.read_text(),filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id in {"eval","exec"}:
            raise SystemExit(f"FAIL: dynamic execution in {path}")
        if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name):
            if (node.func.value.id,node.func.attr)==("os","system") or node.func.value.id=="subprocess":
                raise SystemExit(f"FAIL: process execution in {path}")
print("PASS: PuffBuddies PB-16 security/privacy audit verifier")
