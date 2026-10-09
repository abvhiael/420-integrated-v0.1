#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
LIFE = ROOT / "hz" / "config" / "gca-generate-lifecycle-v1.json"
OBJECTS = ROOT / "hz" / "config" / "gca-object-model-v1.json"
BOUNDARY = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.3-GENERATE-LIFECYCLE.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [LIFE, OBJECTS, BOUNDARY, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    life = json.loads(LIFE.read_text())
    objects = json.loads(OBJECTS.read_text())
    boundary = json.loads(BOUNDARY.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(life.get("schema") == "420hz-gca-generate-lifecycle-v1", "lifecycle schema drift")
    need(life.get("version") == 1, "lifecycle version drift")
    need(life.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(life.get("workPackage") == "HZ-GCA-1.3", "work package drift")
    need(life.get("level") == 1, "HZ-GCA-1.3 must remain Level 1")
    need(life.get("milestoneRequired") is False, "HZ-GCA-1.3 must not become Level-2 milestone")
    need(objects.get("workPackage") == "HZ-GCA-1.2", "HZ-GCA-1.2 prerequisite drift")
    need(boundary.get("workPackage") == "HZ-GCA-1.1", "HZ-GCA-1.1 prerequisite drift")

    expected_states = [
        "DRAFT","QUOTED","SUBMITTED","RUNNING","SUCCEEDED",
        "FAILED","CANCELLED","REVIEWED","REGISTERED","PUBLISHED",
    ]
    states = life.get("states", [])
    state_names = [x.get("state") for x in states]
    need(state_names == expected_states, f"lifecycle state vocabulary/order drift: {state_names}")
    need(len(state_names) == len(set(state_names)), "duplicate lifecycle states")

    expected_normal = ["DRAFT","QUOTED","SUBMITTED","RUNNING","SUCCEEDED","REVIEWED","REGISTERED","PUBLISHED"]
    need(life.get("normalPath") == expected_normal, "normal path drift")
    need(set(life.get("exceptionalPath", [])) == {"FAILED","CANCELLED"}, "exception path drift")

    transitions = life.get("allowedTransitions", [])
    pairs = [(t.get("from"), t.get("to")) for t in transitions]
    need(len(pairs) == len(set(pairs)), "duplicate legal transition")
    for t in transitions:
        need(t.get("from") in expected_states, f"unknown transition source {t.get('from')}")
        need(t.get("to") in expected_states, f"unknown transition target {t.get('to')}")
        need(isinstance(t.get("guard"), str) and t["guard"].strip(), f"missing guard for {t.get('from')}->{t.get('to')}")

    required_pairs = {
        ("DRAFT","QUOTED"),("DRAFT","CANCELLED"),
        ("QUOTED","DRAFT"),("QUOTED","SUBMITTED"),("QUOTED","CANCELLED"),
        ("SUBMITTED","RUNNING"),("SUBMITTED","FAILED"),("SUBMITTED","CANCELLED"),
        ("RUNNING","SUCCEEDED"),("RUNNING","FAILED"),("RUNNING","CANCELLED"),
        ("SUCCEEDED","REVIEWED"),("REVIEWED","REGISTERED"),("REGISTERED","PUBLISHED"),
    }
    need(set(pairs) == required_pairs, f"legal transition set drift: {sorted(set(pairs) ^ required_pairs)}")

    forbidden = set(life.get("forbiddenTransitions", []))
    for shortcut in [
        "DRAFT->SUBMITTED","SUBMITTED->SUCCEEDED","SUCCEEDED->REGISTERED",
        "SUCCEEDED->PUBLISHED","REVIEWED->PUBLISHED","FAILED->RUNNING",
        "CANCELLED->SUBMITTED",
    ]:
        need(shortcut in forbidden, f"required forbidden shortcut missing: {shortcut}")

    mapping = life.get("aiStatusMapping", {})
    expected_mapping = {
        "CREATED":"SUBMITTED",
        "FUNDED":"SUBMITTED",
        "MATCHED":"SUBMITTED",
        "ACCEPTED":"SUBMITTED",
        "RUNNING":"RUNNING",
        "RESULT_COMMITTED":"RUNNING",
        "VERIFIED":"SUCCEEDED",
        "SETTLED":"SUCCEEDED",
        "CANCELLED":"CANCELLED",
        "EXPIRED":"FAILED",
        "FAILED":"FAILED",
        "DISPUTED":"SUBMITTED_OR_RUNNING_HOLD",
        "REFUNDED":"FAILED_OR_CANCELLED_PRESERVE_CAUSE",
    }
    for k, v in expected_mapping.items():
        need(mapping.get(k) == v, f"AI mapping drift for {k}: {mapping.get(k)}")
    need(mapping.get("NONE") == "invalid/unbound; cannot support SUBMITTED or later", "AI NONE mapping drift")

    bindings = {x.get("object"): x for x in life.get("objectStateBindings", [])}
    for obj in ["GenerationIntent","GenerationRunBinding","GenerationOutput","PublishIntent"]:
        need(obj in bindings, f"missing object lifecycle binding: {obj}")
    need(bindings["GenerationIntent"].get("field") == "status", "GenerationIntent lifecycle field drift")
    need("non-authoritative cache" in bindings["GenerationRunBinding"].get("owns",""), "AI observed status boundary drift")
    need("cannot fabricate REGISTERED/PUBLISHED" in bindings["PublishIntent"].get("rule",""), "PublishIntent authority boundary drift")

    retry = life.get("retryPolicy", {})
    need("never rewrite FAILED history" in retry.get("failed",""), "FAILED retry history rule missing")
    need("CANCELLED history remains terminal" in retry.get("cancelled",""), "CANCELLED retry history rule missing")
    need("same canonical AI job or fail closed" in retry.get("duplicateSubmission",""), "idempotent duplicate submission rule missing")

    partial = life.get("partialOutputPolicy", {})
    need("does not automatically mean SUCCEEDED" in partial.get("lifecycle",""), "partial-output success guard missing")
    need("cannot bypass REVIEWED" in partial.get("publication",""), "partial-output publication guard missing")

    cancellation = life.get("cancellationPolicy", {})
    need("owning AI/Compute cancellation confirmation" in cancellation.get("postSubmission",""), "post-submission cancellation authority missing")
    need("never directly refunds/transfers funds" in cancellation.get("economics",""), "cancellation economic boundary missing")

    gates = life.get("publicationGates", {})
    need(set(gates) == {"reviewed","registered","published"}, "publication gate set drift")
    need("canonical Creative WorkId exists" in gates.get("registered", []), "registered WorkId gate missing")
    need("canonical Creative RecordingId exists" in gates.get("registered", []), "registered RecordingId gate missing")
    need("canonical Recording status is ACTIVE" in gates.get("published", []), "published ACTIVE gate missing")

    invariants = life.get("invariants", [])
    need(len(invariants) == 18, "expected HZGCA-LIFE-001..018")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-LIFE-{index:03d} "), f"invariant numbering drift at {index}")

    for source in life.get("sourceDocs", []):
        need((ROOT / source).is_file(), f"missing reconciled lifecycle source: {source}")

    for token in [
        "DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED → REVIEWED → REGISTERED → PUBLISHED",
        "RESULT_COMMITTED",
        "VERIFIED",
        "A UI click alone cannot manufacture canonical cancellation",
        "Product success does not imply Creative rights",
        "Duplicate submission with the same idempotency/client key",
    ]:
        need(token in doc, f"normative lifecycle token missing: {token}")

    need("HZ-GCA-1.3 — Define Generate lifecycle" in roadmap, "roadmap HZ-GCA-1.3 missing")
    need("machine-readable transition manifest" in roadmap, "roadmap lifecycle deliverable missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 classification missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.3 Generate lifecycle",
    "level": 1,
    "states": 0 if errors else len(life.get("states", [])),
    "transitions": 0 if errors else len(life.get("allowedTransitions", [])),
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
