#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
PROV = ROOT / "hz" / "config" / "gca-provenance-v1.json"
DISC = ROOT / "hz" / "config" / "gca-ai-disclosure-v1.json"
LIFE = ROOT / "hz" / "config" / "gca-generate-lifecycle-v1.json"
OBJECTS = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.5-PROVENANCE-MODEL.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [PROV, DISC, LIFE, OBJECTS, BOUNDARY, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    prov = json.loads(PROV.read_text())
    disc = json.loads(DISC.read_text())
    life = json.loads(LIFE.read_text())
    objects = json.loads(OBJECTS.read_text())
    boundary = json.loads(BOUNDARY.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(prov.get("schema") == "420hz-gca-provenance-v1", "provenance schema drift")
    need(prov.get("version") == 1, "provenance version drift")
    need(prov.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(prov.get("workPackage") == "HZ-GCA-1.5", "work package drift")
    need(prov.get("level") == 1, "HZ-GCA-1.5 must remain Level 1")
    need(prov.get("milestoneRequired") is False, "HZ-GCA-1.5 must not become Level-2 milestone")
    need(disc.get("workPackage") == "HZ-GCA-1.4", "HZ-GCA-1.4 prerequisite drift")
    need(life.get("workPackage") == "HZ-GCA-1.3", "HZ-GCA-1.3 prerequisite drift")
    need(objects.get("workPackage") == "HZ-GCA-1.2", "HZ-GCA-1.2 prerequisite drift")
    need(boundary.get("workPackage") == "HZ-GCA-1.1", "HZ-GCA-1.1 prerequisite drift")

    record = prov.get("record", {})
    need(record.get("name") == "GenerationProvenanceRecord", "record name drift")
    need(record.get("idField") == "provenanceRecordId", "provenance id field drift")
    need(record.get("revisionField") == "revision", "revision field drift")

    fields = prov.get("fields", [])
    by_name = {f.get("name"): f for f in fields}
    need(len(by_name) == len(fields), "duplicate provenance field names")

    required_fields = {
        "provenanceRecordId","schemaVersion","policyVersion","revision","projectId","intentId","runId","outputId",
        "creatorAccountRef","creatorProfileId","aiJobId","modelVersionId","providerId","computeRequestId","computeJobId",
        "requestCommitment","resultCommitment","resultManifestHash","verificationOutcomeRef","aiDisclosureClass",
        "declarationCommitment","sourceWorkIds","sourceRecordingIds","sourceLicenseIds","sourceAuthorizationRefs",
        "voiceConsentRefs","artifactCommitments","storageManifestRefs","creativeProvenanceCommitment",
        "authorizationManifestCommitment","workId","recordingId","publishedProvenanceCommitment","createdAt",
        "supersedesProvenanceRecordId",
    }
    need(set(by_name) == required_fields, f"provenance field set drift: {sorted(set(by_name) ^ required_fields)}")

    for name, field in by_name.items():
        for key in ["kind","required","visibility","authority","rule"]:
            need(isinstance(field.get(key), str) and field[key].strip(), f"{name} missing {key}")

    before_reviewed = set(record.get("requiredBeforeReviewed", []))
    for name in [
        "schemaVersion","policyVersion","projectId","intentId","runId","outputId","creatorAccountRef",
        "aiJobId","modelVersionId","requestCommitment","resultCommitment","resultManifestHash",
        "aiDisclosureClass","declarationCommitment","createdAt","revision",
    ]:
        need(name in before_reviewed, f"REVIEWED provenance requirement missing: {name}")

    need(by_name["creatorProfileId"]["authority"] == "420 Creative Protocol", "CreatorProfile authority drift")
    need(by_name["aiJobId"]["authority"] == "420AI", "AI job authority drift")
    need(by_name["modelVersionId"]["authority"] == "420AI ModelRegistry", "model-version authority drift")
    need(by_name["computeJobId"]["authority"] == "ComputeMarket", "compute job authority drift")
    need(by_name["workId"]["authority"] == "420 Creative Protocol", "WorkId authority drift")
    need(by_name["recordingId"]["authority"] == "420 Creative Protocol", "RecordingId authority drift")

    need("native WorkId" in by_name["sourceWorkIds"]["rule"], "source WorkId native-id rule missing")
    need("native RecordingId" in by_name["sourceRecordingIds"]["rule"], "source RecordingId native-id rule missing")
    need("native LicenseId" in by_name["sourceLicenseIds"]["rule"], "source LicenseId native-id rule missing")

    privacy = prov.get("privacy", {})
    never_public = set(privacy.get("neverPublicPlaintext", []))
    for token in [
        "prompts","private lyric drafts","raw reference audio","private stems",
        "provider API credentials","wallet secrets/private keys","decryption keys",
    ]:
        need(token in never_public, f"protected provenance plaintext missing: {token}")
    allowed_public = set(privacy.get("allowedPublic", []))
    for token in ["hashes/commitments","native canonical IDs","policy/schema versions","disclosure class"]:
        need(token in allowed_public, f"allowed public provenance class missing: {token}")

    lineage = prov.get("lineage", [])
    need(len(lineage) >= 10, "provenance lineage unexpectedly incomplete")
    joined_lineage = " ".join(lineage)
    for token in ["GenerationProject.projectId","420AI aiJobId","verified resultCommitment","Creative WorkId + RecordingId"]:
        need(token in joined_lineage, f"lineage stage missing: {token}")

    derivative = " ".join(prov.get("derivativeRules", []))
    need("AI_DERIVATIVE provenance must include" in derivative, "AI derivative source requirement missing")
    need("native LicenseId" in derivative, "Creative LicenseId preservation missing")
    need("AI transformation permission and AI training permission remain distinct" in derivative,
         "transform/training separation missing")

    voice = " ".join(prov.get("voiceRules", []))
    need("requires explicit voiceConsentRefs" in voice, "voice consent reference gate missing")
    need("model name or provider claim is insufficient" in voice, "provider/model non-consent rule missing")
    need("HZ-GCA-1.6" in voice, "consent-policy deferral missing")

    corrections = " ".join(prov.get("correctionRules", []))
    need("append-only/versioned" in corrections, "append-only provenance correction rule missing")
    need("never overwritten in place" in corrections, "historical provenance immutability missing")

    handoff = prov.get("creativeHandoff", {})
    need("provenanceHash" in handoff.get("Work", {}), "Work provenance handoff missing")
    need("provenanceHash" in handoff.get("Recording", {}), "Recording provenance handoff missing")
    need("authorizationManifestHash" in handoff.get("Recording", {}), "Recording authorization handoff missing")
    need("mediaManifestHash" in handoff.get("Recording", {}), "Recording media/provenance separation missing")

    failures = set(prov.get("failureRules", []))
    for failure in [
        "missing required provenance before REVIEWED blocks REVIEWED",
        "AI_DERIVATIVE without source provenance/authorization blocks REVIEWED and publication",
        "synthetic identity claim without required voiceConsentRefs blocks REVIEWED/publication",
        "plaintext protected payloads in public provenance are invalid",
        "in-place mutation of published provenance is invalid",
    ]:
        need(failure in failures, f"fail-closed provenance rule missing: {failure}")

    invariants = prov.get("invariants", [])
    need(len(invariants) == 18, "expected HZGCA-PROV-001..018")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-PROV-{index:03d} "), f"invariant numbering drift at {index}")

    for source in prov.get("sourceDocs", []):
        need((ROOT / source).is_file(), f"missing reconciled provenance source: {source}")

    for token in [
        "GenerationProvenanceRecord",
        "420AI job/model",
        "Public provenance must not expose plaintext",
        "AI transformation permission remains distinct from AI training permission",
        "A synthetic voice or persona identity claim requires explicit `voiceConsentRefs`",
        "Published provenance is append-only/versioned",
        "The provenance model does not activate the Work/Recording",
    ]:
        need(token in doc, f"normative provenance token missing: {token}")

    need("HZ-GCA-1.5 — Define provenance model" in roadmap, "roadmap HZ-GCA-1.5 missing")
    need("machine-readable provenance manifest" in roadmap, "roadmap provenance deliverable missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 classification missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.5 provenance model",
    "level": 1,
    "fields": 0 if errors else len(prov.get("fields", [])),
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
