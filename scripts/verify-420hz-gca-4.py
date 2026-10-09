#!/usr/bin/env python3
from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz/config/gca-provenance-consent-rights-v1.json"
SRC=ROOT/"hz/generate/src/provenance.js"
JOBS=ROOT/"hz/generate/src/jobs.js"
PROVIDER=ROOT/"hz/generate/src/provider.js"
TEST=ROOT/"hz/generate/test/provenance.test.js"
DOC=ROOT/"docs/architecture/420hz/HZ-GCA-4-PROVENANCE-CONSENT-AI-RIGHTS.md"
ROAD=ROOT/"docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
P14=ROOT/"hz/config/gca-ai-disclosure-v1.json"
P15=ROOT/"hz/config/gca-provenance-v1.json"
P16=ROOT/"hz/config/gca-rights-consent-v1.json"
AI=ROOT/"contracts/src/ai/AIModelRegistry.sol"
AUTH=ROOT/"contracts/src/creative/rights/AuthorizationRegistry420.sol"
LIC=ROOT/"contracts/src/creative/rights/LicenseRegistry420.sol"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,SRC,JOBS,PROVIDER,TEST,DOC,ROAD,P14,P15,P16,AI,AUTH,LIC]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(M.read_text())
    src=SRC.read_text()
    jobs=JOBS.read_text()
    provider=PROVIDER.read_text()
    tests=TEST.read_text()
    doc=DOC.read_text()
    road=ROAD.read_text()
    p14=json.loads(P14.read_text())
    p15=json.loads(P15.read_text())
    p16=json.loads(P16.read_text())
    ai=AI.read_text()
    auth=AUTH.read_text()
    lic=LIC.read_text()

    need(m.get("schema")=="420hz-gca-provenance-consent-rights-metadata-v1","schema drift")
    need(m.get("version")==1,"version drift")
    need(m.get("canonicalStep")=="HZ-GCA-4","canonical step drift")
    need(m.get("qualificationLevel")==1,"HZ-GCA-4 must remain Level 1")
    need(m.get("milestoneRequired") is False,"HZ-GCA-4 must not become Level 2")

    d=m.get("dependencies",{})
    need(d.get("priorStep")=="HZ-GCA-3","prior step drift")
    need(d.get("provenancePolicy")=="hz/config/gca-provenance-v1.json","provenance policy dependency drift")
    need(d.get("rightsConsentPolicy")=="hz/config/gca-rights-consent-v1.json","rights policy dependency drift")
    need(d.get("aiDisclosurePolicy")=="hz/config/gca-ai-disclosure-v1.json","disclosure policy dependency drift")

    prov=m.get("provenance",{})
    required=prov.get("requiredFields",[])
    for x in ["provenanceRecordId","provenanceVersion","generationManifestHash","creatorAccountRef","createdAt","provider.providerId","provider.modelId","provider.modelVersion","requestCommitment","resultCommitment","resultManifestHash","aiDisclosureClass","declarationCommitment","artifactCommitments"]:
        need(x in required,f"required provenance field missing: {x}")
    need(prov.get("immutableAtPublication") is True,"publication immutability missing")
    need("never in-place mutation" in prov.get("correctionModel",""),"correction model drift")

    privacy=m.get("privacy",{})
    for x in ["prompt","lyrics","rawReferenceAudio","referenceAudioBytes","privateAudio","audioBytes"]:
        need(x in privacy.get("rawPublicFieldsForbidden",[]),f"private field not forbidden: {x}")
    need(privacy.get("privatePromptLyricsOffChainByDefault") is True,"private prompt/lyrics off-chain rule missing")
    need("explicit public references" in privacy.get("creatorPublication",""),"creator publication rule missing")

    disclosure=m.get("disclosure",{})
    need(disclosure.get("classes")==["HUMAN","AI_ASSISTED","AI_GENERATED","AI_DERIVATIVE"],"AI disclosure classes drift")
    need(disclosure.get("exactPolicy")=="HZ-GCA-1.4","disclosure policy binding drift")
    need(disclosure.get("declarationCommitmentRequired") is True,"declaration commitment requirement missing")

    derivative=m.get("derivative",{})
    need(derivative.get("aiDerivativeRequiresSourceIdentity") is True,"derivative source identity gate missing")
    need(derivative.get("aiDerivativeRequiresAuthorizationRef") is True,"derivative source authorization gate missing")
    need(derivative.get("aiDerivativeRequiresTransformationAuthorization") is True,"transformation gate missing")
    need(derivative.get("transformationAuthority")=="420 Creative Protocol","transformation authority drift")
    need(derivative.get("trainingAuthority")=="420AI ModelRegistry","training authority drift")
    need(derivative.get("transformationAndTrainingNonSubstitutable") is True,"training/transformation separation missing")

    voice=m.get("voiceConsent",{})
    need(voice.get("requiredWhen")=="syntheticVoiceClaim=true","voice claim gate drift")
    for x in ["subjectRef","controllerRef","scopeCommitment","evidenceRef","status","effectiveAt","checkedAt"]:
        need(x in voice.get("requiredFields",[]),f"voice consent field missing: {x}")
    need(voice.get("statusRequired")=="ACTIVE","voice consent must require ACTIVE")
    need(voice.get("expiryFailsClosed") is True,"voice consent expiry must fail closed")
    need(voice.get("noCanonicalVoiceRegistryClaimed") is True,"must not invent voice registry")

    runtime=m.get("runtime",{})
    need(runtime.get("provenanceBuilder")=="buildGenerationProvenance420","builder drift")
    need(runtime.get("publicationFinalizer")=="finalizeGenerationProvenance420","finalizer drift")
    need(runtime.get("jobBridge")=="provenanceFromSucceededJob420","job bridge drift")
    need(runtime.get("succeededJobRequiresCanonicalResultCommitment") is True,"result commitment requirement missing")

    boundaries=" ".join(m.get("authorityBoundaries",[]))
    for token in ["do not grant Creative rights","cannot be inferred from AI training grants","cannot be inferred from Creative transformation/license state","voice/persona consent cannot be inferred","grants no Creative ownership","not publication authority","private prompts/lyrics remain off-chain"]:
        need(token in boundaries,f"authority boundary missing: {token}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA4-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA4-{i:03d} "),f"invariant numbering drift at {i}")

    for token in [
      "export function buildGenerationProvenance420",
      "export function finalizeGenerationProvenance420",
      "export function provenanceFromSucceededJob420",
      "AI_DISCLOSURE_CLASSES_420",
      "FORBIDDEN_PUBLIC_KEYS",
      'disclosure==="AI_DERIVATIVE"',
      "transformationAuthorizationRefs",
      "trainingAuthorizationRefs",
      "synthetic voice/persona claim requires explicit qualified consent evidence",
      "published provenance commitment mismatch",
      "promptPlaintextOffChain:true",
      "lyricsPlaintextOffChain:true"
    ]:
        need(token in src,f"runtime provenance implementation missing: {token}")

    need("executionEvidence: null" in jobs,"generation jobs must reserve execution evidence")
    need("resultCommitment: status.resultCommitment ?? null" in jobs,"result commitment retention missing")
    need("verificationRef: status.verificationRef ?? null" in jobs,"verification ref retention missing")
    need("mockresult:" in provider and "mockverify:" in provider,"deterministic provider provenance commitments missing")

    for token in [
      "private prompt and lyrics keys are rejected",
      "AI_DERIVATIVE requires source identity",
      "training permission never substitutes",
      "synthetic voice/persona claims require active scoped consent evidence",
      "expired voice consent fails closed",
      "creator may publish explicit prompt/lyrics references",
      "publication finalizes exact immutable provenance version",
      "tampering with a published provenance snapshot",
      "SUCCEEDED generation job yields provenance",
      "provenance cannot be created from unfinished generation"
    ]:
        need(token in tests,f"required provenance test missing: {token}")

    need(p14.get("classes",[{}])[0].get("class")=="HUMAN","HZ-GCA-1.4 policy unavailable/drifted")
    need(p15.get("record",{}).get("name")=="GenerationProvenanceRecord","HZ-GCA-1.5 provenance authority unavailable")
    sep=p16.get("trainingVsTransformation",{})
    rules=" ".join(sep.get("rules",[]))
    need("does not authorize model training" in rules,"HZ-GCA-1.6 transformation/training separation drift")
    need("training grant does not authorize transformation" in rules,"HZ-GCA-1.6 reverse separation drift")

    need("TrainingRightsMode" in ai and "isTrainingAuthorized" in ai,"AI training authority surface missing")
    need("AI_TRANSFORM" in auth,"Creative AI transformation permission surface missing")
    need("hasPermissions" in lic,"Creative license permission check missing")

    need("Private prompts, lyric drafts and reference audio remain off-chain by default." in doc,"privacy doc rule missing")
    need("training grant cannot satisfy the transformation requirement" in doc,"training/transformation doc rule missing")
    need("does **not** claim that the repository currently has a canonical production voice/persona consent registry" in doc,"voice registry non-claim missing")
    need("Changing a published field causes validation failure." in doc,"published immutability doc missing")
    need("HZ-GCA-5 — Project workspace, versions, stems and storage" in doc,"next canonical step missing")

    need("## HZ-GCA-4 — Provenance, consent and AI rights metadata" in road,"canonical roadmap step missing")
    for token in ["generation manifest hash","provider/model/version identifier","creator identity/account binding","request/result commitments","AI disclosure class","transformation vs training permission separation","voice/performer-model consent metadata","source Work/Recording/License references","immutable provenance versioning","private prompts/lyrics remain off-chain"]:
        need(token in road,f"canonical roadmap requirement missing: {token}")
    need("Level 1 ordinary app-scoped step" in road,"Level-1 classification missing")

    blob=json.dumps(m)+"\n"+src
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-4 must not invent deployed addresses")
    need("https://" not in src and "http://" not in src,"HZ-GCA-4 must not invent provider endpoints")
    need(m.get("nextCanonicalStep")=="HZ-GCA-5 — Project workspace, versions, stems and storage","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-4 provenance consent AI rights metadata",
  "qualificationLevel":1,
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
