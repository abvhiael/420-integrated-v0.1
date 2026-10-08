#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
RC = ROOT / "hz" / "config" / "gca-rights-consent-v1.json"
PROV = ROOT / "hz" / "config" / "gca-provenance-v1.json"
DISC = ROOT / "hz" / "config" / "gca-ai-disclosure-v1.json"
LIFE = ROOT / "hz" / "config" / "gca-generate-lifecycle-v1.json"
OBJECTS = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.6-RIGHTS-CONSENT-BOUNDARIES.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [RC, PROV, DISC, LIFE, OBJECTS, BOUNDARY, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    rc = json.loads(RC.read_text())
    prov = json.loads(PROV.read_text())
    disc = json.loads(DISC.read_text())
    life = json.loads(LIFE.read_text())
    objects = json.loads(OBJECTS.read_text())
    boundary = json.loads(BOUNDARY.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(rc.get("schema") == "420hz-gca-rights-consent-v1", "rights/consent schema drift")
    need(rc.get("version") == 1, "rights/consent version drift")
    need(rc.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(rc.get("workPackage") == "HZ-GCA-1.6", "work package drift")
    need(rc.get("level") == 1, "HZ-GCA-1.6 must remain Level 1")
    need(rc.get("milestoneRequired") is False, "HZ-GCA-1.6 must not become Level-2 milestone")
    need(prov.get("workPackage") == "HZ-GCA-1.5", "HZ-GCA-1.5 prerequisite drift")
    need(disc.get("workPackage") == "HZ-GCA-1.4", "HZ-GCA-1.4 prerequisite drift")
    need(life.get("workPackage") == "HZ-GCA-1.3", "HZ-GCA-1.3 prerequisite drift")
    need(objects.get("workPackage") == "HZ-GCA-1.2", "HZ-GCA-1.2 prerequisite drift")
    need(boundary.get("workPackage") == "HZ-GCA-1.1", "HZ-GCA-1.1 prerequisite drift")

    authorities = rc.get("authorities", {})
    for key in ["creativeRights","contributorCredits","aiTrainingRights","walletAuthorization","voicePersonaConsent","hzRole"]:
        need(isinstance(authorities.get(key), str) and authorities[key].strip(), f"authority boundary missing: {key}")
    need("no canonical production registry is claimed" in authorities.get("voicePersonaConsent",""),
         "synthetic voice registry non-claim missing")

    perms = {x.get("case"): x for x in rc.get("creativePermissionRules", [])}
    expected_cases = {"COVER","REMIX","STEM_REMIX","SAMPLE_DERIVATIVE","AI_DERIVATIVE"}
    need(set(perms) == expected_cases, f"Creative derivative permission case drift: {sorted(set(perms)^expected_cases)}")
    need(perms["COVER"]["requiredWorkPermissions"] == ["CREATE_COVER","COMMERCIALIZE"], "COVER work mask drift")
    need(perms["COVER"]["requiredSourceRecordingPermissions"] == [], "COVER source mask drift")
    need(perms["REMIX"]["requiredSourceRecordingPermissions"] == ["CREATE_REMIX","USE_MASTER","COMMERCIALIZE"], "REMIX source mask drift")
    need(perms["STEM_REMIX"]["requiredSourceRecordingPermissions"] == ["CREATE_REMIX","USE_STEMS","COMMERCIALIZE"], "STEM_REMIX source mask drift")
    need(perms["SAMPLE_DERIVATIVE"]["requiredSourceRecordingPermissions"] == ["USE_SAMPLE","COMMERCIALIZE"], "SAMPLE source mask drift")
    need(perms["AI_DERIVATIVE"]["requiredWorkPermissions"] == ["COMMERCIALIZE"], "AI_DERIVATIVE work mask drift")
    need(perms["AI_DERIVATIVE"]["requiredSourceRecordingPermissions"] == ["AI_TRANSFORM","USE_MASTER","COMMERCIALIZE"], "AI_DERIVATIVE source mask drift")

    license_rules = " ".join(rc.get("licenseRules", []))
    for token in ["exact active licenseeProfileId","source RecordingId","permission mask","validity window","revalidated by the Creative Protocol"]:
        need(token in license_rules, f"license rule missing: {token}")

    contributor = " ".join(rc.get("contributorRules", []))
    need("proposed Creative contributor credit is not accepted" in contributor and "ContributorRegistry credit state ACCEPTED" in contributor, "contributor proposed/accepted distinction missing")
    need("distinct from economic rights ownership" in contributor, "credit/economic-rights separation missing")
    need("synthetic voice/persona consent" in contributor, "credit/voice-consent separation missing")

    training = rc.get("trainingVsTransformation", {})
    need(training.get("transformationAuthority") == "Creative AuthorizationRegistry420 / LicenseRegistry420",
         "transformation authority drift")
    need(training.get("trainingAuthority") == "420AI AIModelRegistry Model420Metadata + TrainingGrant policy",
         "training authority drift")
    joined_training = " ".join(training.get("rules", []))
    need("AI_TRANSFORM permission authorizes" in joined_training, "AI_TRANSFORM boundary missing")
    need("does not authorize model training" in joined_training, "transform/training non-substitution missing")
    need("420AI training grant does not authorize transformation" in joined_training, "training/Creative non-substitution missing")

    voice = rc.get("voicePersonaConsent", {})
    need("synthetic or cloned voice/persona" in voice.get("scope",""), "voice/persona scope missing")
    required_evidence = set(voice.get("requiredEvidence", []))
    for token in [
        "consent subject identity/reference",
        "consenting authority/controller reference",
        "scope commitment covering the intended synthetic use",
        "revocation/status evidence source",
        "evidence commitment/reference that can be independently checked by the qualified consent source",
    ]:
        need(token in required_evidence, f"voice consent evidence missing: {token}")
    joined_voice = " ".join(voice.get("rules", []))
    need("is not consent" in joined_voice, "non-consent examples missing")
    need("must fail closed" in joined_voice, "voice-consent fail-closed rule missing")
    need("does not currently establish a canonical production voice/persona consent registry" in joined_voice,
         "consent registry non-invention rule missing")

    source_rules = " ".join(rc.get("sourceMaterialRules", []))
    for token in ["Reference audio", "USE_MASTER", "USE_STEMS", "USE_SAMPLE", "AI_TRANSFORM", "upload possession alone is not permission"]:
        need(token in source_rules, f"source material rule missing: {token}")

    gates = rc.get("reviewAndLifecycleGates", {})
    need(set(gates) == {"beforeSUBMITTED","beforeREVIEWED","beforeREGISTERED","beforePUBLISHED"},
         "lifecycle rights/consent gate set drift")
    need(any("source authorization references" in x for x in gates["beforeREVIEWED"]), "REVIEWED source auth gate missing")
    need(any("qualified consent references" in x for x in gates["beforeREVIEWED"]), "REVIEWED voice consent gate missing")
    need(any("revalidated" in x for x in gates["beforeREGISTERED"]), "REGISTERED revalidation gate missing")
    need(any("derivative authorization is valid" in x for x in gates["beforePUBLISHED"]), "PUBLISHED derivative auth gate missing")

    expiry = " ".join(rc.get("expiryRevocationRevalidation", []))
    need("must be checked at the action that relies on them" in expiry, "point-of-use revalidation missing")
    need("cannot retroactively erase immutable historical provenance" in expiry, "historical provenance preservation missing")
    need("fails closed" in expiry, "unavailable/conflicting authority fail-closed rule missing")

    failures = set(rc.get("failureRules", []))
    for failure in [
        "AI_DERIVATIVE without required Creative authorization fails closed.",
        "Wrong/expired/inactive/insufficient Creative license fails closed.",
        "Required synthetic voice/persona consent without qualified explicit evidence fails closed.",
        "Contributor PROPOSED is not treated as ACCEPTED.",
        "Creative AI_TRANSFORM is never treated as AI training permission.",
        "420AI TrainingGrant is never treated as Creative transformation/commercialization permission.",
        "Missing/unavailable/conflicting required authority state blocks the action rather than defaulting to allowed.",
    ]:
        need(failure in failures, f"required fail-closed rule missing: {failure}")

    invariants = rc.get("invariants", [])
    need(len(invariants) == 18, "expected HZGCA-RC-001..018")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-RC-{index:03d} "), f"invariant numbering drift at {index}")

    for source in rc.get("sourceDocs", []):
        need((ROOT / source).is_file(), f"missing reconciled rights/consent source: {source}")

    for token in [
        "420Hz is not the authority for:",
        "`AI_TRANSFORM` does not authorize model training",
        "A `PROPOSED` credit is not accepted attribution or consent",
        "The repository does not currently establish a canonical production synthetic voice/persona consent registry",
        "must **fail closed**",
        "Possession or upload of reference audio is not authorization",
        "Derivative authorization is revalidated by the Creative Protocol at activation",
    ]:
        need(token in doc, f"normative rights/consent token missing: {token}")

    need("HZ-GCA-1.6 — Define rights & consent boundaries" in roadmap, "roadmap HZ-GCA-1.6 missing")
    need("machine-readable rights/consent manifest" in roadmap, "roadmap rights/consent deliverable missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 classification missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.6 rights and consent boundaries",
    "level": 1,
    "permissionCases": 0 if errors else len(rc.get("creativePermissionRules", [])),
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
