#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz/config/gca-register-publish-v1.json"
SRC=ROOT/"hz/generate/src/register-publish.js"
TEST=ROOT/"hz/generate/test/register-publish.test.js"
DOC=ROOT/"docs/architecture/420hz/HZ-GCA-7-REGISTER-PUBLISH.md"
ROAD=ROOT/"docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
P4=ROOT/"hz/config/gca-provenance-consent-rights-v1.json"
P5=ROOT/"hz/config/gca-project-workspace-v1.json"
WEB6=ROOT/"hz/config/gca-generate-studio-ux-v1.json"
CREATIVE=ROOT/"contracts/src/creative"
INDEXER=ROOT/"creative-indexer/package.json"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,SRC,TEST,DOC,ROAD,P4,P5,WEB6,INDEXER]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

required_contracts=[
 "core/CreatorProfileRegistry420.sol","music/WorkRegistry420.sol","music/RecordingRegistry420.sol",
 "rights/ContributorRegistry420.sol","rights/RightsRegistry420.sol","rights/AuthorizationRegistry420.sol",
 "media/MediaManifestRegistry420.sol","media/StorageSourceRegistry420.sol","catalog/CatalogRegistry420.sol"
]
for rel in required_contracts: need((CREATIVE/rel).is_file(),f"missing Creative primitive {rel}")

if not errors:
    m=json.loads(M.read_text());src=SRC.read_text();tests=TEST.read_text();doc=DOC.read_text();road=ROAD.read_text()
    p4=json.loads(P4.read_text());p5=json.loads(P5.read_text());web6=json.loads(WEB6.read_text())
    creative={rel:(CREATIVE/rel).read_text() for rel in required_contracts}

    need(m.get("schema")=="420hz-gca-register-publish-v1","manifest schema drift")
    need(m.get("version")==1,"manifest version drift")
    need(m.get("canonicalStep")=="HZ-GCA-7","canonical step drift")
    need(m.get("qualificationLevel")==2,"HZ-GCA-7 closes a documented Generate milestone and must retain Level 2")
    need(m.get("milestoneRequired") is True,"Generate milestone qualification missing")
    need(m.get("baseMainSha")=="ff61fc1171d422c081f4a5abb9e5828e88949c0f","base-main qualification anchor drift")

    deps=m.get("dependencies",{})
    need(deps.get("priorSteps")==["HZ-GCA-2","HZ-GCA-3","HZ-GCA-4","HZ-GCA-5","HZ-GCA-6"],"prior-step dependency set drift")
    for key in ["creatorProfile","workRegistry","recordingRegistry","contributorRegistry","rightsRegistry","authorizationRegistry","mediaManifestRegistry","storageSourceRegistry","catalogRegistry"]:
        need((ROOT/deps.get(key,"")).is_file(),f"dependency missing/drifted: {key}")

    cp=m.get("creatorProfile",{})
    need(cp.get("mode")=="create-or-select","Creator Profile mode drift")
    need(cp.get("ownerAuthorizationRequired") is True,"Creator Profile owner authorization missing")
    need(cp.get("profileStatusRequired")=="ACTIVE","Creator Profile ACTIVE requirement missing")

    work=m.get("work",{})
    need(work.get("initialStatus")=="PROVISIONAL","Work must start PROVISIONAL")
    need(work.get("activationRequiresFinalizedRights") is True,"Work rights-finalization gate missing")
    for x in ["compositionHash","metadataHash","generationProvenanceCommitment"]:
        need(x in work.get("requiredCommitments",[]),f"Work commitment missing: {x}")
    need(work.get("contributorCreditsRequired") is True,"Work contributor credits missing")

    rights=m.get("rights",{})
    need(rights.get("denominatorBps")==10000,"rights denominator drift")
    need(rights.get("duplicateHoldersForbidden") is True,"duplicate-holder guard missing")
    need(rights.get("explicitHolderAcceptanceRequired") is True,"holder acceptance guard missing")
    need(rights.get("finalizeBeforeActivation") is True,"rights finalization gate missing")
    need(rights.get("workAndRecordingPoolsIndependent") is True,"rights-pool separation missing")

    rec=m.get("recording",{})
    need(rec.get("initialStatus")=="PROVISIONAL","Recording must start PROVISIONAL")
    need(rec.get("activationRequiresFinalizedRights") is True,"Recording rights-finalization gate missing")
    need(rec.get("derivativeAuthorizationFailsClosed") is True,"derivative auth fail-closed rule missing")
    need(rec.get("aiDerivativeRequiresTransformationPermission") is True,"AI derivative transformation gate missing")
    need(rec.get("trainingPermissionDoesNotSubstitute") is True,"training/transformation non-substitution missing")

    prov=m.get("provenance",{})
    need(prov.get("immutablePublicationSnapshot") is True,"published provenance immutability missing")
    for x in ["creatorProfileId","workId","recordingId","creativeProvenanceCommitment","authorizationManifestCommitment","publishedAt","publishedProvenanceCommitment"]:
        need(x in prov.get("publicationFields",[]),f"publication provenance field missing: {x}")

    ai=m.get("aiDisclosure",{})
    need(ai.get("source")=="HZ-GCA-4 generation provenance","AI disclosure source drift")
    need(ai.get("immutableAcrossRegisterPublish") is True,"AI disclosure mutability forbidden")
    need(ai.get("publishedOnRecordingAndReleaseProjection") is True,"AI disclosure publication missing")

    media=m.get("media",{})
    need(media.get("publishOnlyAfterRecordingActive") is True,"media-before-active guard missing")
    need(media.get("storageSourceRequired") is True,"storage source requirement missing")
    need(media.get("externalStorageAuthorityNotClaimed") is True,"external storage authority overclaim")

    cat=m.get("catalog",{})
    need(cat.get("initialStatus")=="DRAFT","Release must start DRAFT")
    need(cat.get("addTrackRequiresActiveRecording") is True,"Release track ACTIVE gate missing")
    need(cat.get("publishRequiresActiveTrackAndMedia") is True,"Release publication gate missing")
    need(cat.get("finalStatus")=="PUBLISHED","Release final status drift")

    orch=m.get("orchestration",{})
    need(orch.get("coordinator")=="RegisterPublishCoordinator420","coordinator drift")
    need(orch.get("localKernel")=="DeterministicCreativeKernel420","local kernel drift")
    need(orch.get("stages")==["PROFILE_READY","WORK_REGISTERED","WORK_RIGHTS_FINALIZED","WORK_ACTIVE","RECORDING_REGISTERED","RECORDING_RIGHTS_FINALIZED","RECORDING_ACTIVE","MEDIA_PUBLISHED","PROVENANCE_FINALIZED","RELEASE_DRAFT","RELEASE_PUBLISHED"],"publication stage order drift")
    rules=" ".join(orch.get("failureBehavior",[]))
    for token in ["generation SUCCEEDED never implies","no PUBLISHED Release exists","retry resumes completed stages"]:
        need(token in rules,f"failure behavior missing: {token}")

    lvl2=m.get("level2",{})
    need("closes the Generate milestone" in lvl2.get("reason",""),"Level-2 milestone reason missing")
    need(lvl2.get("repositoryWide") is False,"Level 2 must remain app-focused")
    need(lvl2.get("fullSolidityInventoryDeferredToLevel3") is True,"full Solidity must remain deferred")
    for x in ["targeted CreativeKernelAcceptance420 Foundry suite","Decision #10 deterministic Creative fixture generation","Creative reference indexer build and projection tests"]:
        need(x in lvl2.get("retainedAppChecks",[]),f"Level-2 retained integration missing: {x}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA7-001..018")
    for i,x in enumerate(inv,1): need(x.startswith(f"HZGCA7-{i:03d} "),f"invariant numbering drift at {i}")

    for token in [
      "class DeterministicCreativeKernel420","class RegisterPublishCoordinator420",
      "selectOrCreateProfile(","registerWork(","proposeCredits(","finalizeSplit(","activateWork(",
      "registerRecording(","activateRecording(","publishMedia(","createRelease(","addTrack(","publishRelease(",
      'profileRef==="SELF"', 'status="RUNNING"', '"RELEASE_PUBLISHED"',
      "finalizeGenerationProvenance420","validateGenerationProvenance420",
      "every rights holder must explicitly accept","AI derivative requires Creative transformation permission",
      "Recording must be ACTIVE before media publication","release track requires DRAFT release and ACTIVE Recording"
    ]:
        need(token in src,f"Register/Publish implementation missing: {token}")

    for token in [
      "complete Generate -> Work -> Recording -> Release flow publishes one release",
      "create-or-select Creator Profile reuses the authorized owner profile",
      "rights splits require exactly 10000 bps and explicit holder acceptance",
      "contributor credits are explicit and accepted",
      "AI disclosure is published without changing",
      "published generation provenance is immutable",
      "derivative Recording fails closed without exact source authorization",
      "AI derivative requires Creative transformation permission",
      "generation success never implies registration or release success",
      "retry resumes failed publication attempt without duplicating",
      "replay of an already-published request is idempotent",
      "media/storage publication occurs only after Recording activation",
      "rejects unsaved or incomplete selected takes"
    ]:
        need(token in tests,f"required HZ-GCA-7 test missing: {token}")

    # Direct Creative interface guards.
    need("function createProfile(" in creative["core/CreatorProfileRegistry420.sol"],"CreatorProfile create API drift")
    need("function registerWork(" in creative["music/WorkRegistry420.sol"],"Work register API drift")
    need("function activateWork(" in creative["music/WorkRegistry420.sol"],"Work activation API drift")
    need("function registerRecording(" in creative["music/RecordingRegistry420.sol"],"Recording register API drift")
    need("function activateRecording(" in creative["music/RecordingRegistry420.sol"],"Recording activation API drift")
    need("function proposeCredit(" in creative["rights/ContributorRegistry420.sol"] and "function acceptCredit(" in creative["rights/ContributorRegistry420.sol"],"Contributor credit APIs drift")
    need("function proposeInitialSplit(" in creative["rights/RightsRegistry420.sol"],"rights proposal API drift")
    need("function acceptInitialShare(" in creative["rights/RightsRegistry420.sol"],"rights acceptance API drift")
    need("function finalizeInitialSplit(" in creative["rights/RightsRegistry420.sol"],"rights finalization API drift")
    need("function canCreateDerivative(" in creative["rights/AuthorizationRegistry420.sol"],"derivative authorization API drift")
    need("function publishMediaManifest(" in creative["media/MediaManifestRegistry420.sol"],"media-manifest API drift")
    need("function addSource(" in creative["media/StorageSourceRegistry420.sol"],"storage-source API drift")
    need("function createRelease(" in creative["catalog/CatalogRegistry420.sol"] and "function publishRelease(" in creative["catalog/CatalogRegistry420.sol"],"catalog release APIs drift")

    need(p4.get("canonicalStep")=="HZ-GCA-4","HZ-GCA-4 provenance prerequisite drift")
    need(p5.get("canonicalStep")=="HZ-GCA-5","HZ-GCA-5 project prerequisite drift")
    need(web6.get("canonicalStep")=="HZ-GCA-6","HZ-GCA-6 UX prerequisite drift")

    need("HZ-GCA-7 is the end of the Generate implementation sequence" in doc,"Level-2 milestone doc missing")
    need("Generate → Creator Profile → Work → Recording → media/storage → Release" in doc,"end-to-end flow doc missing")
    need("A successful generation never implies successful Creative registration." in doc,"registration-success separation missing")
    need("HZ-GCA-8 — Community identity and social graph" in doc,"next canonical step missing")

    need("## HZ-GCA-7 — Register & Publish integration" in road,"canonical roadmap step missing")
    for token in ["create or select Creator Profile","register Work","register Recording","contributor credits","rights split review/acceptance","derivative/source authorization checks","immutable generation-provenance commitment","AI disclosure publication","media manifest/storage publication","catalog release creation","rollback/failure handling"]:
        need(token in road,f"canonical roadmap requirement missing: {token}")
    need("one complete Generate → Work → Recording → Release flow" in road,"canonical exit missing")

    blob=json.dumps(m)+"\n"+src
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-7 must not invent deployed contract addresses")
    need("https://" not in src and "http://" not in src,"HZ-GCA-7 must not invent production endpoints")
    need(m.get("nextCanonicalStep")=="HZ-GCA-8 — Community identity and social graph","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-7 Register Publish integration",
  "qualificationLevel":2,
  "milestone":"Generate",
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
