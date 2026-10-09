#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.2-CANONICAL-OBJECT-MODEL.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [MODEL, BOUNDARY, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    model = json.loads(MODEL.read_text())
    boundary = json.loads(BOUNDARY.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(model.get("schema") == "420hz-gca-object-model-v1", "object-model schema drift")
    need(model.get("version") == 1, "object-model version drift")
    need(model.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(model.get("workPackage") == "HZ-GCA-1.2", "work package drift")
    need(model.get("level") == 1, "HZ-GCA-1.2 must remain Level 1")
    need(model.get("milestoneRequired") is False, "HZ-GCA-1.2 must not become a Level-2 milestone")
    need(boundary.get("workPackage") == "HZ-GCA-1.1", "HZ-GCA-1.1 boundary prerequisite drift")

    classes = set(model.get("objectClasses", []))
    expected_classes = {
        "HZ_PRIVATE_APPLICATION",
        "HZ_PUBLIC_APPLICATION",
        "HZ_AWARD_CANONICAL_PRODUCT_DOMAIN",
        "EXTERNAL_CANONICAL_REFERENCE",
        "DERIVED_PROJECTION",
    }
    need(classes == expected_classes, f"object class drift: {sorted(classes ^ expected_classes)}")

    objects = model.get("objects", [])
    types = [obj.get("type") for obj in objects]
    need(len(types) == len(set(types)), "duplicate object type definitions")
    required = set(model.get("requiredTypes", []))
    need(set(types) == required, f"required object set mismatch: {sorted(set(types) ^ required)}")

    ids = []
    for obj in objects:
        t = obj.get("type", "<unknown>")
        for key in ["class", "id", "owner", "visibility", "purpose", "immutable", "mutable", "references", "mustNotDuplicate"]:
            need(key in obj, f"{t} missing {key}")
        need(obj.get("class") in expected_classes, f"{t} has unknown class")
        need(isinstance(obj.get("id"), str) and obj["id"].strip(), f"{t} missing stable logical id field")
        ids.append((t, obj.get("id")))
        need(isinstance(obj.get("immutable"), list), f"{t} immutable must be a list")
        need(isinstance(obj.get("mutable"), list), f"{t} mutable must be a list")
        need(not set(obj.get("immutable", [])) & set(obj.get("mutable", [])),
             f"{t} field listed as both immutable and mutable")
        need(isinstance(obj.get("mustNotDuplicate"), list) and obj["mustNotDuplicate"],
             f"{t} missing no-duplication boundary")

    private_required = {
        "GenerationProject","GenerationIntent","GenerationRunBinding","GenerationOutput",
        "GenerationArtifact","ProvenanceDraft","PublishIntent",
    }
    by_type = {obj["type"]: obj for obj in objects}
    for t in private_required:
        need(by_type[t]["class"] == "HZ_PRIVATE_APPLICATION", f"{t} must remain private application state")
        need("PRIVATE" in by_type[t]["visibility"], f"{t} must remain private by default")

    derived = {"CommunityActivity", "ChartSnapshot"}
    for t in derived:
        need(by_type[t]["class"] == "DERIVED_PROJECTION", f"{t} must remain derived")
        need(by_type[t]["mutable"] == [], f"{t} snapshot/projection definition must not expose canonical mutation fields")

    awards = {
        "AwardProgram","AwardSeason","AwardCategory","EligibilityPolicy","AwardNomination",
        "AwardBallot","AwardVote","AwardResult","AwardBadge",
    }
    for t in awards:
        need(by_type[t]["class"] == "HZ_AWARD_CANONICAL_PRODUCT_DOMAIN",
             f"{t} must remain in Awards product domain")

    ext_refs = {
        "CreatorAccountRef","CreatorProfileRef","WorkRef","RecordingRef","LicenseRef",
        "AIJobRef","AIModelVersionRef","AIProviderRef","ComputeRequestRef","ComputeJobRef",
        "StorageObjectRef","PaymentRef",
    }
    for t in ext_refs:
        need(by_type[t]["class"] == "EXTERNAL_CANONICAL_REFERENCE", f"{t} must be reference-only")
        need(by_type[t]["mutable"] == [], f"{t} may not expose independently mutable canonical fields")

    need(by_type["CreatorProfileRef"]["id"] == "creatorId", "Creative CreatorId native reference drift")
    need(by_type["WorkRef"]["id"] == "workId", "Creative WorkId native reference drift")
    need(by_type["RecordingRef"]["id"] == "recordingId", "Creative RecordingId native reference drift")
    need(by_type["LicenseRef"]["id"] == "licenseId", "Creative LicenseId native reference drift")
    need(by_type["AIJobRef"]["id"] == "aiJobId", "420AI job reference drift")
    need(by_type["ComputeJobRef"]["id"] == "computeJobId", "Compute job reference drift")

    invariants = model.get("invariants", [])
    need(len(invariants) == 16, "expected HZGCA-OBJ-001..016")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-OBJ-{index:03d} "), f"invariant numbering drift at {index}")

    identity = model.get("identityRules", {})
    need("preserve the owning protocol's native canonical ID exactly" in identity.get("externalIds", ""),
         "native external ID preservation rule missing")
    need("must not encode plaintext prompts" in identity.get("privateObjects", ""),
         "private identifier secrecy rule missing")
    need("never silently recycled" in identity.get("uniqueness", ""),
         "ID non-reuse rule missing")

    for source in model.get("sourceDocs", []):
        need((ROOT / source).is_file(), f"missing reconciled source: {source}")

    for token in [
        "External canonical protocol objects are referenced by their native IDs",
        "Awards-domain voting is product voting, not Civic governance voting",
        "A follow is not 420Commons membership",
        "PublishIntent cannot fabricate Creative registration",
        "This HZ object model preserves those boundaries",
    ]:
        need(token in doc, f"normative object-model token missing: {token}")

    need("HZ-GCA-1.2 — Define canonical object model" in roadmap, "roadmap HZ-GCA-1.2 missing")
    need("machine-readable object manifest" in roadmap, "roadmap object-model deliverable missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 classification missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.2 canonical object model",
    "level": 1,
    "objectCount": 0 if errors else len(model.get("objects", [])),
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
