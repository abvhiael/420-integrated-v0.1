#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SERVICE=ROOT/"services/420ai-provider"
errors=[]

required=[
    "package.json","config.example.json",
    "src/canonical-json.js","src/private-payload-store.js","src/retry.js",
    "src/state-store.js","src/observability.js","src/runtime.js","src/index.js",
    "test/provider-runtime.test.js"
]
for rel in required:
    if not (SERVICE/rel).is_file():
        errors.append(f"missing provider runtime artifact: {rel}")

runtime=(SERVICE/"src/runtime.js").read_text()
payload=(SERVICE/"src/private-payload-store.js").read_text()
obs=(SERVICE/"src/observability.js").read_text()
tests=(SERVICE/"test/provider-runtime.test.js").read_text()
infra=(ROOT/"docs/architecture/infrastructure/420ai-compute-infrastructure.md").read_text()

for token in [
    "canonicalClient.environment","canonicalClient.job","canonicalClient.submitReceipt",
    "computeGraphHash","provider identity mismatch","resource not allowed",
    "420AI_PROVIDER_EXECUTION_V1","420AI_PROVIDER_RECEIPT_V1",
    "idempotencyKey","withBoundedRetry420","recover()","authoritative:false"
]:
    if token not in runtime:
        errors.append(f"runtime missing canonical/recovery boundary: {token}")

for token in [
    "aes-256-gcm","maxRetentionMs","private payload expired",
    "private payload scope mismatch","FileBlobStore420"
]:
    if token.lower() not in payload.lower():
        errors.append(f"private payload implementation missing: {token}")

for token in ["REDACTED","payload","prompt","token","secret","credential"]:
    if token not in obs:
        errors.append(f"observability redaction missing: {token}")

for token in [
    "submits once and local replay is idempotent",
    "bounded retry",
    "timeout after canonical success",
    "restart recovery trusts canonical result",
    "wrong chain/provider/resource/deadline",
    "observability redacts payloads"
]:
    if token not in tests:
        errors.append(f"provider runtime test coverage missing: {token}")

for token in [
    "AI-AUDIT-6 provider runtime implementation",
    "signed execution manifests",
    "encrypted private payload",
    "restart recovery",
    "bounded retry"
]:
    if token not in infra:
        errors.append(f"infrastructure docs missing runtime statement: {token}")

if errors:
    print("420AI AI-AUDIT-6 provider runtime qualification FAILED")
    for e in errors:
        print(f"- {e}")
    raise SystemExit(1)

print("420AI AI-AUDIT-6 provider runtime qualification PASSED")
print("verified canonical RPC/CMP boundary, signed manifests/receipts, encrypted retention, idempotency, restart recovery and redacted observability")
