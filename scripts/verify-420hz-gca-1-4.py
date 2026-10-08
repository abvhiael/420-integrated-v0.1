#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
DISC = ROOT / "hz" / "config" / "gca-ai-disclosure-v1.json"
LIFE = ROOT / "hz" / "config" / "gca-generate-lifecycle-v1.json"
OBJECTS = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.4-AI-DISCLOSURE.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [DISC, LIFE, OBJECTS, BOUNDARY, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    disc = json.loads(DISC.read_text())
    life = json.loads(LIFE.read_text())
    objects = json.loads(OBJECTS.read_text())
    boundary = json.loads(BOUNDARY.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(disc.get("schema") == "420hz-gca-ai-disclosure-v1", "disclosure schema drift")
    need(disc.get("version") == 1, "disclosure version drift")
    need(disc.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(disc.get("workPackage") == "HZ-GCA-1.4", "work package drift")
    need(disc.get("level") == 1, "HZ-GCA-1.4 must remain Level 1")
    need(disc.get("milestoneRequired") is False, "HZ-GCA-1.4 must not become Level-2 milestone")
    need(life.get("workPackage") == "HZ-GCA-1.3", "HZ-GCA-1.3 prerequisite drift")
    need(objects.get("workPackage") == "HZ-GCA-1.2", "HZ-GCA-1.2 prerequisite drift")
    need(boundary.get("workPackage") == "HZ-GCA-1.1", "HZ-GCA-1.1 prerequisite drift")

    classes = disc.get("classes", [])
    names = [x.get("class") for x in classes]
    expected = ["HUMAN", "AI_ASSISTED", "AI_GENERATED", "AI_DERIVATIVE"]
    need(names == expected, f"disclosure vocabulary/order drift: {names}")
    need(len(names) == len(set(names)), "duplicate disclosure classes")
    for item in classes:
        need(isinstance(item.get("meaning"), str) and item["meaning"].strip(), f"{item.get('class')} meaning missing")
        need(isinstance(item.get("allowedWhen"), list) and item["allowedWhen"], f"{item.get('class')} allowedWhen missing")
        need(isinstance(item.get("forbiddenWhen"), list) and item["forbiddenWhen"], f"{item.get('class')} forbiddenWhen missing")

    precedence = disc.get("precedence", [])
    need(len(precedence) == 4, "expected four disclosure precedence rules")
    need(precedence[0].startswith("AI_DERIVATIVE overrides AI_GENERATED"), "AI_DERIVATIVE precedence drift")
    need(precedence[1].startswith("AI_GENERATED overrides AI_ASSISTED"), "AI_GENERATED precedence drift")
    need(precedence[2].startswith("AI_ASSISTED overrides HUMAN"), "AI_ASSISTED precedence drift")
    need(precedence[3].startswith("HUMAN is valid only"), "HUMAN fallback rule drift")

    substantial = disc.get("substantialityRule", {})
    need("No fixed percentage threshold is invented" in substantial.get("policy", ""), "no-invented-threshold rule missing")
    need("fail closed" in substantial.get("failClosed", ""), "ambiguous classification fail-closed rule missing")
    need("rather than default to HUMAN" in substantial.get("failClosed", ""), "ambiguous HUMAN default prohibition missing")

    binding = disc.get("publicationBinding", {})
    need(binding.get("requiredForGenerateOrigin") is True, "Generate-origin disclosure must be mandatory")
    need(binding.get("exactlyOneClass") is True, "exactly-one disclosure rule missing")
    need("publication may not complete" in binding.get("bindAt", ""), "publication binding gate missing")
    need("cannot be silently overwritten" in binding.get("immutableHistory", ""), "historical immutability missing")
    need("explicit new disclosure revision/version" in binding.get("correction", ""), "versioned correction rule missing")

    required_record = set(disc.get("requiredDisclosureRecord", []))
    for field in ["schemaVersion","disclosureClass","policyVersion","declarationCommitment","provenanceDraftRef or provenanceCommitment"]:
        need(field in required_record, f"required disclosure record field missing: {field}")

    evidence_rules = " ".join(disc.get("sourceEvidenceRules", []))
    need("not inferred from provider marketing" in evidence_rules, "provider marketing non-authority missing")
    need("Model420 aiDisclosureHash" in evidence_rules, "Model420 disclosure separation missing")
    need("does not determine a Recording" in evidence_rules, "Recording/model disclosure separation missing")

    rights = " ".join(disc.get("rightsBoundaries", []))
    need("not proof of copyright ownership" in rights, "non-rights-grant boundary missing")
    need("AI_DERIVATIVE requires" in rights, "AI derivative authorization boundary missing")
    need("AI transformation permission remains distinct from AI training permission" in rights, "transform/training separation missing")

    creative = disc.get("creativeMapping", {})
    need(creative.get("recordingClassAI_DERIVATIVE") == "must disclose AI_DERIVATIVE",
         "Creative AI_DERIVATIVE mapping drift")
    need("does not substitute" in creative.get("provenanceClass", ""), "ProvenanceClass separation missing")
    need("does not substitute" in creative.get("rightsStatus", ""), "RightsStatus separation missing")

    lifecycle = disc.get("lifecycleIntegration", {})
    need("creator explicitly confirms" in lifecycle.get("REVIEWED", ""), "REVIEWED disclosure confirmation missing")
    need("exactly one valid disclosure class" in lifecycle.get("PUBLISHED", ""), "PUBLISHED disclosure gate missing")

    privacy = " ".join(disc.get("privacyRules", []))
    for token in ["plaintext prompts", "private lyrics drafts", "raw reference audio", "provider credentials"]:
        need(token in privacy, f"privacy exclusion missing: {token}")

    failures = set(disc.get("validationFailures", []))
    for failure in [
        "missing disclosure at Generate publication",
        "unknown disclosure class",
        "multiple simultaneous disclosure classes",
        "attempt to overwrite historical disclosure in place",
        "attempt to use disclosure as rights/license/training permission",
    ]:
        need(failure in failures, f"validation failure missing: {failure}")

    invariants = disc.get("invariants", [])
    need(len(invariants) == 16, "expected HZGCA-DISC-001..016")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-DISC-{index:03d} "), f"invariant numbering drift at {index}")

    for source in disc.get("sourceDocs", []):
        need((ROOT / source).is_file(), f"missing reconciled disclosure source: {source}")

    for token in [
        "Every published Recording created through Generate must expose **exactly one**",
        "AI_DERIVATIVE",
        "The disclosure is descriptive metadata",
        "publication **fails closed** until corrected",
        "Model420 `aiDisclosureHash`",
        "AI transformation permission remains distinct from AI training permission",
        "A disclosure correction is append-only/versioned",
    ]:
        need(token in doc, f"normative disclosure token missing: {token}")

    need("HZ-GCA-1.4 — Define AI disclosure rules" in roadmap, "roadmap HZ-GCA-1.4 missing")
    need("machine-readable disclosure-policy manifest" in roadmap, "roadmap disclosure deliverable missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 classification missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.4 AI disclosure",
    "level": 1,
    "classes": 0 if errors else len(disc.get("classes", [])),
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
