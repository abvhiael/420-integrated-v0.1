#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/"hz"/"config"/"gca-generation-provider-abstraction-v1.json"
PKG=ROOT/"hz"/"generate"/"package.json"
ERRORS=ROOT/"hz"/"generate"/"src"/"errors.js"
SCHEMA=ROOT/"hz"/"generate"/"src"/"schema.js"
PROVIDER=ROOT/"hz"/"generate"/"src"/"provider.js"
JOBS=ROOT/"hz"/"generate"/"src"/"jobs.js"
TEST=ROOT/"hz"/"generate"/"test"/"generation-job.test.js"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-2-GENERATION-PROVIDER-ABSTRACTION.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
ARCH=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1-ARCHITECTURE.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [MANIFEST,PKG,ERRORS,SCHEMA,PROVIDER,JOBS,TEST,DOC,ROADMAP,ARCH]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(MANIFEST.read_text())
    pkg=json.loads(PKG.read_text())
    err=ERRORS.read_text()
    schema=SCHEMA.read_text()
    provider=PROVIDER.read_text()
    jobs=JOBS.read_text()
    tests=TEST.read_text()
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()
    arch=ARCH.read_text()

    need(m.get("schema")=="420hz-gca-generation-provider-abstraction-v1","manifest schema drift")
    need(m.get("version")==1,"manifest version drift")
    need(m.get("canonicalStep")=="HZ-GCA-2","canonical step drift")
    need(m.get("qualificationLevel")==1,"HZ-GCA-2 must remain Level 1")
    need(m.get("milestoneRequired") is False,"HZ-GCA-2 must not independently become a Level-2 milestone")
    need(m.get("providerNeutral") is True,"provider-neutral flag missing")
    need(m.get("providerCanonicalAuthority") is False,"provider canonical-authority guard missing")

    request=m.get("request",{})
    need(request.get("required")==["prompt","durationSec","mode","controls"],"request required fields drift")
    need(request.get("optional")==["lyrics","referenceAudio"],"request optional fields drift")
    need(request.get("controls")==["genres","styles","moods","instrumentation"],"music controls drift")
    need(request.get("modes")==["VOCAL","INSTRUMENTAL"],"generation modes drift")
    need(request.get("durationSec")=={"min":15,"max":1800},"duration bounds drift")
    cid=request.get("clientRequestId",{})
    need(cid.get("deterministic") is True,"client request id must remain deterministic")
    need(cid.get("algorithm")=="sha256(canonical normalized request)","client request id algorithm drift")
    need(cid.get("prefix")=="hzgen:","client request id prefix drift")

    ref=request.get("referenceAudio",{})
    need(ref.get("permittedPaths")==["AUTHORIZED_STORAGE_REF"],"reference-audio permitted path drift")
    need(ref.get("requiredFieldsWhenPresent")==["storageRef","authorizationRef"],"reference-audio authorization fields drift")
    need(ref.get("rawUrlAllowed") is False,"raw reference-audio URL must remain forbidden")

    pd=m.get("providerDescriptor",{})
    for key in ["providerId","providerRevision","models","capacity"]:
        need(key in pd.get("required",[]),f"provider descriptor missing required field {key}")
    for key in ["modelId","modelVersion","maxDurationSec","modes","supportsLyrics","supportsReferenceAudio","referenceAudioPaths","outputKinds"]:
        need(key in pd.get("modelFields",[]),f"model descriptor field missing {key}")
    for key in ["availableSlots","queueDepth","estimatedStartMs"]:
        need(key in pd.get("capacityFields",[]),f"capacity field missing {key}")
    for key in ["providerId","providerRevision","modelId","modelVersion","clientRequestId","requestDigest","amount","asset","capacity","issuedAt","expiresAt"]:
        need(key in pd.get("quoteBinding",[]),f"quote binding missing {key}")
    need(pd.get("capabilityDriftAfterQuote")=="fail closed","provider capability drift must fail closed")

    lifecycle=m.get("lifecycle",{})
    need(lifecycle.get("states")==["DRAFT","QUOTED","SUBMITTED","RUNNING","SUCCEEDED","FAILED","CANCELLED"],"job lifecycle drift")
    need(lifecycle.get("timeoutRepresentation")=="FAILED + TIMEOUT","timeout representation drift")
    need(lifecycle.get("terminal")==["SUCCEEDED","FAILED","CANCELLED"],"terminal state set drift")

    out=m.get("outputManifest",{})
    need(out.get("requiredIdentity")==["providerId","providerRevision","modelId","modelVersion","providerJobRef"],"output identity drift")
    need(out.get("requiredMinimumOutput")==["MIX"],"MIX output requirement drift")
    need(out.get("optionalKinds")==["STEM","LYRICS_TIMING","ARTWORK"],"optional output kinds drift")
    need(out.get("artifactFields")==["kind","storageRef","integrity","label"],"artifact fields drift")
    need(out.get("identityMismatch")=="INTEGRITY_MISMATCH","output mismatch behavior drift")

    expected_errors=[
      "INVALID_REQUEST","INVALID_CLIENT_REQUEST_ID","REFERENCE_AUDIO_NOT_AUTHORIZED",
      "UNSUPPORTED_CAPABILITY","NO_CAPACITY","QUOTE_EXPIRED","QUOTE_MISMATCH",
      "REPLAY_CONFLICT","PROVIDER_UNAVAILABLE","PROVIDER_REJECTED","TIMEOUT",
      "CANCELLED","MALFORMED_RESULT","INTEGRITY_MISMATCH","INTERNAL_ERROR"
    ]
    need(m.get("errorTaxonomy")==expected_errors,"provider-independent error taxonomy drift")

    mock=m.get("mockProvider",{})
    need(mock.get("deterministic") is True,"mock provider must remain deterministic")
    need(mock.get("idempotentSubmit") is True,"mock submit must remain idempotent")
    for fault in ["descriptorUnavailable","quoteUnavailable","submitUnavailable","submitRejected","pollUnavailable","providerFailed","malformedResult","runningPolls"]:
        need(fault in mock.get("supportsFaultInjection",[]),f"mock fault fixture missing {fault}")

    boundaries=" ".join(m.get("authorityBoundaries",[]))
    for token in [
      "not canonical protocol authority",
      "not canonical payment settlement",
      "does not imply VERIFIED/SETTLED/REGISTERED/PUBLISHED",
      "cannot broaden reference-audio authorization path",
      "provider/model/revision/job identity is frozen",
      "provider-specific error states",
      "does not implement HZ-GCA-3"
    ]:
        need(token in boundaries,f"authority boundary missing: {token}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA2-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA2-{i:03d} "),f"invariant numbering drift at {i}")

    need(pkg.get("type")=="module","generation module must remain ESM")
    need(pkg.get("scripts",{}).get("test")=="node --test test/*.test.js","generation test command drift")
    need("npm run check && npm test"==pkg.get("scripts",{}).get("qualify"),"generation qualification command drift")

    # Request/schema implementation.
    for token in [
      'GENERATION_MODES_420 = Object.freeze(["VOCAL", "INSTRUMENTAL"])',
      'REFERENCE_AUDIO_PATHS_420 = Object.freeze(["AUTHORIZED_STORAGE_REF"])',
      'OUTPUT_KINDS_420 = Object.freeze(["MIX", "STEM", "LYRICS_TIMING", "ARTWORK"])',
      "deriveClientRequestId420",
      "buildGenerationRequest420",
      "expectedClientRequestId",
      "referenceAudio.authorizationRef",
      "availableSlots",
      "queueDepth",
      "estimatedStartMs",
      "validateOutputManifest420"
    ]:
        need(token in schema,f"schema implementation missing: {token}")

    # Provider abstraction/mocks.
    for token in [
      "class GenerationProvider420",
      "class DeterministicMockGenerationProvider420",
      "providerRevision",
      "modelVersion",
      "quoteAmount",
      "idempotencyKey",
      "submitByKey",
      "MIX",
      "STEM",
      "LYRICS_TIMING",
      "ARTWORK",
      "malformedResult",
      "providerFailed"
    ]:
        need(token in provider,f"provider abstraction missing: {token}")

    # Job lifecycle/replay/failure behavior.
    for token in [
      '"DRAFT"',
      '"QUOTED"',
      '"SUBMITTED"',
      '"RUNNING"',
      '"SUCCEEDED"',
      '"FAILED"',
      '"CANCELLED"',
      "GenerationJobStore420",
      "GenerationJobManager420",
      "clientRequestId",
      "requestDigest",
      "capabilitiesDigest",
      "submitAttempts",
      "QUOTE_EXPIRED",
      "INTEGRITY_MISMATCH",
      "normalizeProviderError420",
      "TIMEOUT",
      "validateOutputManifest420"
    ]:
        need(token in jobs,f"job manager missing: {token}")

    # Frozen provider-independent taxonomy implementation.
    for code in expected_errors:
        need(f'"{code}"' in err,f"error implementation missing {code}")
    need("normalizeProviderError420" in err,"provider error normalization missing")

    # Exact required test coverage.
    test_tokens=[
      "deterministic client request id is stable",
      "client request id mismatch fails closed",
      "reference audio requires the explicit authorized storage path",
      "instrumental mode rejects lyrics",
      "provider descriptor freezes capability, model version and capacity envelope",
      "provider descriptors cannot advertise unapproved reference-audio paths",
      "quoted lifecycle binds cost, capacity, provider identity and model version",
      "full provider-neutral lifecycle reaches SUCCEEDED",
      "same logical create and submit are replay-safe",
      "transient submit failure stays quoted",
      "transient poll failure is retryable without resubmitting execution",
      "cancellation works before and after provider submission",
      "deadline timeout fails with provider-independent TIMEOUT",
      "provider capability revision drift after quote fails closed",
      "malformed output manifest fails the job",
      "output manifest integrity binds provider/model/job identity",
      "provider-independent error taxonomy is frozen"
    ]
    for token in test_tokens:
        need(token in tests,f"required HZ-GCA-2 test missing: {token}")

    # Architecture consistency.
    need("DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED" in doc,"HZ-GCA-2 lifecycle doc missing")
    need("No provider becomes canonical protocol authority." in doc,"provider authority statement missing")
    need("HZ-GCA-3 remains the owner of canonical 420AI / Compute Market execution integration." in doc,"HZ-GCA-3 ownership boundary missing")
    need("AI transformation permission ≠ training permission" in arch,"retained HZ-GCA-1 architecture separation missing")

    need("## HZ-GCA-2 — Generation job and provider abstraction" in roadmap,"canonical HZ-GCA-2 roadmap step missing")
    need("prompt and optional lyrics" in roadmap,"canonical prompt/lyrics requirement missing")
    need("quoted cost/capacity envelope" in roadmap,"canonical quote/capacity requirement missing")
    need("provider-independent error taxonomy" in roadmap,"canonical error taxonomy requirement missing")
    need("No provider may become canonical protocol authority." in roadmap,"canonical provider authority constraint missing")
    need("provider abstraction + mocks + lifecycle tests + failure/retry tests" in roadmap,"canonical exit requirement missing")
    need("Level 1 ordinary app-scoped step" in roadmap,"HZ-GCA-2 Level-1 classification missing")

    for source in m.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing HZ-GCA-2 source doc: {source}")

    # HZ-GCA-2 must not invent production endpoints/addresses/provider-specific canonical authority.
    blob=json.dumps(m)+"\\n"+schema+"\\n"+provider+"\\n"+jobs
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-2 must not assign a deployed address")
    need("https://" not in provider and "http://" not in provider,"mock provider must not invent external provider endpoints")
    need(m.get("nextCanonicalStep")=="HZ-GCA-3 — 420AI / Compute Market execution adapter","next canonical roadmap step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-2 Generation job and provider abstraction",
  "qualificationLevel":1,
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errorCodes":0 if errors else len(m.get("errorTaxonomy",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
