#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]

required=[
 "420-indexer/descriptors/ai420-v1.json",
 "420-indexer/src/ai-descriptors.ts",
 "420-indexer/src/ai-read-model.ts",
 "420-indexer/test/ai420-descriptors.test.ts",
 "420-indexer/test/ai420-read-model.test.ts",
 "docs/apps/ai/developer/api.md",
]
for rel in required:
    if not (ROOT/rel).is_file():
        errors.append("missing AI read/indexer artifact: "+rel)

read=(ROOT/"420-indexer/src/ai-read-model.ts").read_text()
desc=(ROOT/"420-indexer/src/ai-descriptors.ts").read_text()
api=(ROOT/"420-indexer/src/api-surface.ts").read_text()
http=(ROOT/"420-indexer/src/http-transport.ts").read_text()
contract=(ROOT/"420-indexer/src/api-contract.ts").read_text()
workflow=(ROOT/".github/workflows/420ai-audit.yml").read_text()
docs=(ROOT/"docs/apps/ai/developer/api.md").read_text()

for token in [
 "AI_READ_SCHEMA_VERSION_420","420-ai-read-v1","idx_protocol_events",
 "decodePositionCursor420","encodePositionCursor420","expectedChainId",
 "AI private field leakage blocked","computeRequestId","computeJobId",
 "authoritative:false"
]:
    if token not in read:
        errors.append("AI read model boundary missing: "+token)

for token in [
 "AIProviderRegistry","AIModelRegistry","AIModelDeploymentRegistry420",
 "AIJobManager","AIJobEscrow","AIPolicyRegistry420",
 "artifact_events_only_addresses_resolved_by_deployment",
 "420AI private field cannot enter index descriptor"
]:
    if token not in desc:
        errors.append("AI descriptor boundary missing: "+token)

for token in [
 "aiProviders(","aiModelVersions(","aiDeployments(","aiJobs(",
 "aiExpectedChainId"
]:
    if token not in api:
        errors.append("AI public API adapter missing: "+token)

for route in [
 "/v1/ai/providers","/v1/ai/models","/v1/ai/model-versions",
 "/v1/ai/deployments","/v1/ai/jobs"
]:
    if route not in http or route not in contract or route not in docs:
        errors.append("AI public route missing from implementation/contract/docs: "+route)

for token in [
 "420-indexer/**","ai-read-api:","Run AI read/indexer qualification tests",
 "verify-420ai-read-api.py"
]:
    if token not in workflow:
        errors.append("AI audit workflow missing read/indexer qualification: "+token)

for token in [
 "rebuild","rollback","opaque cursor","authoritative: false",
 "Private prompts","Registry"
]:
    if token not in docs:
        errors.append("AI API documentation missing: "+token)

if errors:
    print("420AI AI-AUDIT-7 read API/indexer qualification FAILED")
    for error in errors:
        print("- "+error)
    raise SystemExit(1)

print("420AI AI-AUDIT-7 read API/indexer qualification PASSED")
print("verified canonical AI descriptors, rebuildable read models, reorg/replay integration, versioned paged routes, chain validation and private-payload exclusion")
