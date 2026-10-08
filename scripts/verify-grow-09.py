#!/usr/bin/env python3
"""GROW-09 documentation closeout, no global documentation inventory."""
from pathlib import Path

root=Path(__file__).resolve().parents[1]
guide=root/"docs/audit/420GROW-GROW-09-OPERATIONS-AND-USER-GUIDE.md"
text=guide.read_text(encoding="utf-8")
required=["architecture","Contracts, events, identities and roles","API and SDK","Build, install and local testing","Environment, startup and deployment","Operations and incident response","Threat model and invariants","User guide","Known limitations and release gates","GROW-10 — Deployment and stage qualification"]
for item in required:
    if item.lower() not in text.lower():raise AssertionError("missing GROW-09 required documentation: "+item)
for path in ["grow/location/consumer.go","grow/service/handler.go","grow/cmd/server/main.go","grow/web/runtime-config.js","grow/web/scripts/build.mjs","grow/web/package.json","docs/audit/420GROW-GROW-05-SERVICE.md"]:
    if not (root/path).is_file():raise AssertionError("missing documented source "+path)
    if path not in text:raise AssertionError("source omitted from guide "+path)
if "enabled:false" not in text or "NO_NEW_PROTOCOL_SERVICE_ID" not in text:raise AssertionError("release or identity guard missing")
if "snapshot-local" not in text or "not a Verify proof" not in text:raise AssertionError("critical privacy/provenance limitations missing")
print("GROW-09 documentation closeout verifier: PASS")
