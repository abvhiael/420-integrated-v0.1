#!/usr/bin/env python3
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/"compute/web"
REQ=["index.html","app.js","styles.css","runtime-config.json","security-headers.json","core/config.js","core/read-api.js","core/job-api.js","core/handoff.js","core/participation.js","core/dashboard.js","core/controller.js"]
def fail(m):raise SystemExit("CMP-8 verification failed: "+m)
for p in REQ:
    if not (WEB/p).is_file():fail("missing "+p)
html=(WEB/"index.html").read_text()
for token in ["Researcher / job owner submission","Worker onboarding & participation","Verifier operations","Research project management","Worker health","jobs completed","CPU contribution","GPU contribution","projects supported","Result & verification status","Reputation & stake"]:
    if token.lower() not in html.lower():fail("required human surface missing: "+token)
cfg=json.loads((WEB/"runtime-config.json").read_text())
if cfg.get("schemaVersion")!="420-compute-web-runtime-v1" or cfg.get("writeActionsEnabled") is not False:fail("default runtime must be fail-closed")
if any(cfg.get("contracts",{}).get(k) is not None for k in ("workerRegistry","researchProjectRegistry","verifierRegistry")):fail("unresolved canonical addresses must remain null")
participation=(WEB/"core/participation.js").read_text()
for token in ("--cpu-percent","--gpu-percent","projectPreferences","LOCAL_PREFERENCE_ONLY","canonicalAssignmentRequired"):
    if token not in participation:fail("participation loop missing "+token)
read=(WEB/"core/read-api.js").read_text()
for route in ("/v1/compute/jobs","/v1/compute/workers","/v1/compute/verifiers","/v1/compute/research/projects","/v1/compute/rewards","/v1/compute/contributions","/reputation","/stake"):
    if route not in read:fail("read API route missing "+route)
handoff=(WEB/"core/handoff.js").read_text()
for token in ("requiresWalletAuthorization:true","canonicalState:false","secretMaterialManaged:false","canonical write runtime is not enabled"):
    if token not in handoff:fail("Wallet handoff boundary missing "+token)
indexer=(ROOT/"420-indexer/src/compute-app-read-model.ts").read_text()
for token in ("computeJobs420","computeWorkers420","computeVerifiers420","computeResearchProjects420","computeRewards420","computeContributions420","computeReputationReference420","computeStakeReference420","authoritative:false"):
    if token not in indexer:fail("application read model missing "+token)
decoder=(ROOT/"420-indexer/src/protocol-decoder.ts").read_text()
if "'int256'" not in decoder or "int256FromWord420" not in decoder:fail("signed reputation decoder missing")
if re.search(r"\.innerHTML\s*=|document\.write\s*\(|eval\s*\(|new Function\s*\(", "\n".join((WEB/p).read_text() for p in REQ if p.endswith(".js"))):fail("unsafe browser primitive")
print("CMP-8 420Compute application inventory: PASS")
