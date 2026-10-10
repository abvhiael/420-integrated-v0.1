#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "hz" / "config" / "gca-product-boundaries-v1.json"
DOC = ROOT / "docs" / "architecture" / "420hz" / "HZ-GCA-1.1-PRODUCT-BOUNDARIES.md"
ROADMAP = ROOT / "docs" / "420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"

errors = []

def need(cond, message):
    if not cond:
        errors.append(message)

for path in [MANIFEST, DOC, ROADMAP]:
    need(path.is_file(), f"missing {path.relative_to(ROOT)}")

if not errors:
    data = json.loads(MANIFEST.read_text())
    doc = DOC.read_text()
    roadmap = ROADMAP.read_text()

    need(data.get("schema") == "420hz-gca-product-boundaries-v1", "manifest schema drift")
    need(data.get("version") == 1, "manifest version drift")
    need(data.get("canonicalStep") == "HZ-GCA-1", "canonical parent step drift")
    need(data.get("workPackage") == "HZ-GCA-1.1", "work package drift")
    need(data.get("level") == 1, "HZ-GCA-1.1 must remain Level 1")
    need(data.get("milestoneRequired") is False, "HZ-GCA-1.1 must not become a Level-2 milestone")

    required_ids = {
        "wallet", "identity", "ai", "compute", "creative", "pay", "resource",
        "indexer", "search", "notifications", "commons", "governance",
        "arbitration", "registry",
    }
    systems = data.get("systems", [])
    ids = [item.get("id") for item in systems]
    need(len(ids) == len(set(ids)), "duplicate system boundary ids")
    need(set(ids) == required_ids, f"system boundary set drift: {sorted(set(ids) ^ required_ids)}")

    for item in systems:
        for key in ["name", "authority", "hzRole", "forbidden"]:
            need(isinstance(item.get(key), str) and item[key].strip(), f"{item.get('id')} missing {key}")

    invariants = data.get("crossSystemInvariants", [])
    need(len(invariants) == 14, "expected HZGCA-BND-001..014")
    for index, invariant in enumerate(invariants, start=1):
        need(invariant.startswith(f"HZGCA-BND-{index:03d} "), f"invariant numbering drift at {index}")

    authoritative = data.get("authoritativeVsDerived", {}).get("authoritative", [])
    derived = data.get("authoritativeVsDerived", {}).get("derived", [])
    need(authoritative and derived, "authoritative/derived classification missing")
    need(not set(authoritative) & set(derived), "authoritative and derived lists overlap")

    for forbidden_phrase in [
        "wallet signing",
        "compute provider/resource/match/job/receipt/settlement authority",
        "Work/Recording/contributor/rights/license/royalty authority",
        "payment finality/refund authority",
        "governance execution authority",
        "arbitration resolver/remedy-execution authority",
    ]:
        need(any(forbidden_phrase in value for value in data["application"]["mustNotOwn"]),
             f"application non-authority missing: {forbidden_phrase}")

    required_sources = data.get("sourceDocs", [])
    need(len(required_sources) >= 14, "source reconciliation set unexpectedly small")
    for source in required_sources:
        need((ROOT / source).is_file(), f"missing retained source authority: {source}")

    for token in [
        "420Hz is the music product/application layer",
        "420Hz Awards voting is product-domain voting",
        "420Commons retains community-space/channel membership authority",
        "ProtocolRegistry discovery never confers runtime mutation authority",
        "This does **not** close parent HZ-GCA-1",
    ]:
        need(token in doc, f"normative product-boundary token missing: {token}")

    need("HZ-GCA-1.1 — Define product boundaries" in roadmap, "roadmap work package missing")
    need("Level 1 only" in roadmap, "roadmap Level-1 qualification rule missing")
    need("do not replace, renumber or independently close" in roadmap,
         "roadmap parent-step preservation statement missing")

print(json.dumps({
    "pass": not errors,
    "suite": "420Hz HZ-GCA-1.1 product boundaries",
    "level": 1,
    "errors": errors,
}, indent=2))
raise SystemExit(0 if not errors else 2)
