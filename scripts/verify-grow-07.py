#!/usr/bin/env python3
"""GROW-07 explicit cross-app boundary guard."""
from pathlib import Path
import json
import re

root=Path(__file__).resolve().parents[1]
def content(path):return (root/path).read_text(encoding="utf-8")
def ensure(ok,message):
    if not ok:raise AssertionError(message)

matrix=content("docs/audit/420GROW-GROW-07-CROSS-APP-MATRIX.md")
identity=content("docs/audit/420GROW-GROW-02-IDENTITY-DECISION.md")
backend=content("grow/service/handler.go")
ui=content("grow/web/app.js")
config=content("grow/web/runtime-config.js")
wallet=content("wallet/web/core/genesis-app-catalog.js")
consumer=content("grow/location/consumer.go")
ensure(all(x in matrix for x in ("420Location","Registry","420Verify","Wallet","wrong-network","GROW-08")), "integration matrix incomplete")
ensure("CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID" in identity, "canonical Grow identity changed")
ensure("func New(" in backend and "grow.Read(ctx, source)" in backend, "public SDK adapter bypass")
ensure('http.MethodGet' in backend and 'http.StatusMethodNotAllowed' in backend,"read-only method restriction absent")
ensure('"/v1/grow/places"' in backend and 'NextOffset' in backend, "bounded discovery contract changed")
ensure("ProvenanceAvailable" in consumer and "ErrInvalidProjection" in consumer, "public provenance/precision validation missing")
ensure('"registryRecordId"' in consumer and 'Verified' not in consumer, "registry provenance incorrectly promoted")
ensure('Not independently verified' in ui and 'textContent' in ui, "web verification or safe rendering contract changed")
ensure('credentials:"omit"' in ui and 'configOrigin' in ui, "browser request security changed")
ensure('enabled:false' in config, "unqualified live publication enabled")
ensure("NO_CANONICAL_SERVICE_ID" in wallet, "Wallet Grow unresolved identity missing")
ensure("420grow" not in json.dumps(json.loads(content("config/genesis-applications.json"))).lower(), "Grow admitted to frozen app catalog")
ensure("420grow" not in json.dumps(json.loads(content("config/genesis-consumer-services.json"))).lower(), "Grow admitted to service catalog")
ensure(not re.search(r"(?i)420/service/grow|\\bgrow\\b",content("contracts/src/libraries/ServiceIds420.sol")),"unapproved chain service ID")
print("GROW-07 cross-app boundary guard: PASS")
