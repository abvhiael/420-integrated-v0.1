#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
PRIV = ROOT / "hz" / "config" / "gca-privacy-v1.json"
RC = ROOT / "hz" / "config" / "gca-rights-consent-v1.json"
PROV = ROOT / "hz" / "config" / "gca-provenance-v1.json"
DISC = ROOT / "hz" / "config" / "gca-ai-disclosure-v1.json"
LIFE = ROOT / "hz" / "config" / "gca-generate-lifecycle-v1.json"
OBJECTS = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.7-PRIVACY-MODEL.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors=[]

def need(cond,msg):
    if not cond:
        errors.append(msg)

for p in [PRIV,RC,PROV,DISC,LIFE,OBJECTS,BOUNDARY,DOC,ROADMAP]:
    need(p.is_file(), f"missing {p.relative_to(ROOT)}")

if not errors:
    priv=json.loads(PRIV.read_text())
    rc=json.loads(RC.read_text())
    prov=json.loads(PROV.read_text())
    disc=json.loads(DISC.read_text())
    life=json.loads(LIFE.read_text())
    objects=json.loads(OBJECTS.read_text())
    boundary=json.loads(BOUNDARY.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(priv.get("schema")=="420hz-gca-privacy-v1","privacy schema drift")
    need(priv.get("version")==1,"privacy version drift")
    need(priv.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(priv.get("workPackage")=="HZ-GCA-1.7","work package drift")
    need(priv.get("level")==1,"HZ-GCA-1.7 must remain Level 1")
    need(priv.get("milestoneRequired") is False,"HZ-GCA-1.7 must not become Level-2 milestone")

    prereqs=[
        (rc,"HZ-GCA-1.6"),(prov,"HZ-GCA-1.5"),(disc,"HZ-GCA-1.4"),
        (life,"HZ-GCA-1.3"),(objects,"HZ-GCA-1.2"),(boundary,"HZ-GCA-1.1")
    ]
    for obj,wp in prereqs:
        need(obj.get("workPackage")==wp,f"{wp} prerequisite drift")

    classes=priv.get("classes",[])
    names=[x.get("class") for x in classes]
    expected=["PUBLIC","UNLISTED","PRIVATE","SECRET"]
    need(names==expected,f"privacy class vocabulary/order drift: {names}")
    for x in classes:
        need(isinstance(x.get("meaning"),str) and x["meaning"].strip(),f"{x.get('class')} meaning missing")
        need(isinstance(x.get("defaultIndexable"),bool),f"{x.get('class')} indexability missing")
    need(next(x for x in classes if x["class"]=="PUBLIC")["defaultIndexable"] is True,"PUBLIC must be indexable by default")
    for cls in ["UNLISTED","PRIVATE","SECRET"]:
        need(next(x for x in classes if x["class"]==cls)["defaultIndexable"] is False,f"{cls} must not be broadly indexable")

    rules={x.get("data"):x for x in priv.get("dataRules",[])}
    required={
        "promptText":"PRIVATE","privateLyricsDraft":"PRIVATE","referenceAudio":"PRIVATE",
        "draftOutputAudio":"PRIVATE","privateStems":"PRIVATE","voiceConsentEvidencePayload":"PRIVATE",
        "walletPrivateKey":"SECRET","providerApiCredential":"SECRET","sessionBearerToken":"SECRET",
        "playlistUnlisted":"UNLISTED","playlistPublic":"PUBLIC","awardVoteSecretMaterial":"PRIVATE","awardResult":"PUBLIC"
    }
    for k,v in required.items():
        need(k in rules,f"privacy data rule missing: {k}")
        if k in rules:
            need(rules[k].get("class")==v,f"{k} privacy class drift")

    private_defaults=set(priv.get("privateDefaults",[]))
    for token in ["GenerationProject","GenerationIntent","GenerationOutput","prompts","reference audio","raw consent evidence"]:
        need(token in private_defaults,f"private-by-default item missing: {token}")

    provider=" ".join(priv.get("providerRules",[]))
    for token in ["authenticated encrypted off-chain","assignment-scoped","least-privilege","time-bounded","cross-project","minimum data required"]:
        need(token in provider,f"provider privacy rule missing: {token}")

    enc=" ".join(priv.get("encryptionAndStorage",[]))
    need("Raw private media/content remains off-chain by default" in enc,"off-chain raw private content rule missing")
    need("Low-entropy private data must not rely on an unsalted plain hash" in enc,"low-entropy hash privacy rule missing")
    need("retention/deletion durations are deferred to HZ-GCA-1.8" in enc,"retention deferral missing")

    indexing=" ".join(priv.get("indexingRules",[]))
    for token in ["PRIVATE and SECRET data are excluded","UNLISTED objects are excluded from broad Search","Draft Generate objects remain non-indexable","Search ranking/discovery cannot broaden visibility"]:
        need(token in indexing,f"indexing privacy rule missing: {token}")

    notifications=" ".join(priv.get("notificationRules",[]))
    need("not raw private prompts/audio/stems/consent payloads" in notifications,"notification payload minimization missing")
    need("remain private by default" in notifications,"notification subscription privacy missing")

    logs=" ".join(priv.get("loggingTelemetryRules",[]))
    for token in ["prompts","raw audio bytes","access tokens","wallet secrets","raw consent evidence"]:
        need(token in logs,f"log redaction token missing: {token}")
    need("No debug mode may silently disable" in logs,"debug privacy invariant missing")

    lifecycle=" ".join(priv.get("lifecycleRules",[]))
    need("SUCCEEDED generation content remains private" in lifecycle,"pre-publication privacy lifecycle missing")
    need("PUBLISHED exposes only fields explicitly classified PUBLIC" in lifecycle,"published field boundary missing")
    need("require explicit user/policy action" in lifecycle,"explicit visibility transition missing")

    failures=set(priv.get("failClosedRules",[]))
    for failure in [
        "attempt to public-index PRIVATE or SECRET data fails closed",
        "attempt to broad-index UNLISTED data fails closed",
        "provider access with expired/wrong-scope assignment fails closed",
        "publication request with unresolved field visibility/classification fails closed",
        "search/discovery visibility may never exceed source visibility"
    ]:
        need(failure in failures,f"privacy fail-closed rule missing: {failure}")

    invariants=priv.get("invariants",[])
    need(len(invariants)==18,"expected HZGCA-PRIV-001..018")
    for i,inv in enumerate(invariants,1):
        need(inv.startswith(f"HZGCA-PRIV-{i:03d} "),f"invariant numbering drift at {i}")

    for source in priv.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled privacy source: {source}")

    for token in [
        "Privacy class is separate from rights, identity, provenance, disclosure and canonical protocol status.",
        "Successful generation does not make these public.",
        "A hash is not automatically confidentiality.",
        "A Search result can never make a PRIVATE object public.",
        "Debug mode must not silently disable privacy/redaction behavior",
        "HZ-GCA-1.7 requires **bounded retention**",
        "HZ-GCA-1.8 — Define storage & retention rules"
    ]:
        need(token in doc,f"normative privacy token missing: {token}")

    need("HZ-GCA-1.7 — Define privacy model" in roadmap,"roadmap HZ-GCA-1.7 missing")
    need("machine-readable privacy manifest" in roadmap,"roadmap privacy deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
    "pass":not errors,
    "suite":"420Hz HZ-GCA-1.7 privacy model",
    "level":1,
    "dataRules":0 if errors else len(priv.get("dataRules",[])),
    "errors":errors,
},indent=2))
raise SystemExit(0 if not errors else 2)
