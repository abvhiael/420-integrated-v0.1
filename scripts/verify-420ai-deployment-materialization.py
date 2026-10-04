#!/usr/bin/env python3
from pathlib import Path
import json, sys

root=Path(__file__).resolve().parents[1]
errors=[]
ids=(root/"contracts/src/ai/AIIds420.sol").read_text()
test=(root/"contracts/test/AIDeploymentMaterialization420.t.sol").read_text()
doc=(root/"docs/apps/ai/deployment-operations.md").read_text()
pkg=json.loads((root/"contracts/config/ai/ai-audit-9-deployment-package.json").read_text())
workflow=(root/".github/workflows/420ai-audit.yml").read_text()
ns=json.loads((root/"contracts/config/genesis-address-namespace.json").read_text())

preimages=[
"420/component/ai/provider-registry/v1","420/component/ai/model-registry/v1",
"420/component/ai/job-manager/v1","420/component/ai/job-escrow/v1",
"420/component/ai/reputation-registry/v1","420/component/ai/authorization/v1",
"420/component/ai/policy-registry/v1","420/component/ai/deployment-registry/v1",
"420/component/ai/request-registry/v1","420/component/ai/result-registry/v1",
"420/component/ai/compute-adapter/v1","420/component/ai/router/v1"]
for p in preimages:
    if p not in ids: errors.append("missing AI component id "+p)

frozen={"AIProviderRegistry":"0x000000000000000000000000000000000000042f",
"AIModelRegistry":"0x0000000000000000000000000000000000000430",
"AIJobManager":"0x0000000000000000000000000000000000000431",
"AIJobEscrow":"0x0000000000000000000000000000000000000432",
"AIReputationRegistry":"0x0000000000000000000000000000000000000433"}
actual={x["name"]:x["address"] for x in ns["fixedAssignments"]}
for n,a in frozen.items():
    if actual.get(n)!=a: errors.append(f"frozen address drift {n}")

for token in ["vm.etch(AI_PROVIDER","vm.etch(AI_MODEL","vm.etch(AI_JOB_MANAGER",
"vm.etch(AI_JOB_ESCROW","vm.etch(AI_REPUTATION",
"Types420.Lifecycle.SUSPENDED","setComponentLifecycle",
"publishRegisteredService","bindComputeAdapter","bindVaultAdapter",
"bindSettlementAdapter","bindTrustAdapter","runtimeCodeHash","resolveActive"]:
    if token not in test: errors.append("deployment smoke missing "+token)

if pkg.get("liveFields",{}).get("chainId") is not None:
    errors.append("AI-AUDIT-9 must not invent live chain id")
for key in ["deploymentTransactions","registryPublicationTransactions","dns","apiOrigin"]:
    if pkg.get("liveFields",{}).get(key) is not None: errors.append("live field must remain null: "+key)

if "AI-AUDIT-11" not in doc or "does not claim a live" not in doc:
    errors.append("deployment runbook live boundary missing")
if "deployment-materialization:" not in workflow:
    errors.append("AI deployment qualification job missing")
if "verify-420ai-deployment-materialization.py" not in workflow:
    errors.append("AI deployment verifier not wired")

if errors:
    print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)
print("420AI AI-AUDIT-9 deployment/materialization verifier: PASS")
