#!/usr/bin/env python3
"""Fail closed on changed source or any unreviewed High/Medium analyzer finding.

The checked-in dispositions are local source review, never independent approval.
Raw severity/findings are retained and are not rewritten or excluded.
"""
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]


def signature(finding):
    description = re.sub(r"#\d+(?:-\d+)?", "", finding["description"].replace("\\", "/"))
    normalized = " ".join(description.split())
    return hashlib.sha256((finding["check"] + "\n" + normalized).encode()).hexdigest()


def review(raw_path, report_path):
    raw = json.loads(Path(raw_path).read_text())
    expected = json.loads((ROOT / "scripts/fantasy/static-review-v1.json").read_text())
    if not raw.get("success"):
        raise RuntimeError("actual analyzer/compilation failed")
    for path, digest in expected["normalizedSourceSHA256"].items():
        normalized = (ROOT / path).read_text(encoding="utf-8-sig").replace("\r\n", "\n").encode()
        if hashlib.sha256(normalized).hexdigest() != digest:
            raise RuntimeError("source changed since finding review: " + path)
    severe = [finding for finding in raw["results"].get("detectors", []) if finding["impact"] in ("High", "Medium")]
    # Slither's platform-dependent alias propagation can include the final
    # netPrize write in this exact reviewed finding. Preserve raw evidence,
    # accept only enumerated source-bound variants, and reject duplicates.
    variants = expected.get("reviewedSignatureVariants", {})
    actual = {}
    for finding in severe:
        fingerprint = signature(finding)
        key = variants.get(fingerprint, fingerprint)
        if key in actual:
            raise RuntimeError("duplicate reviewed finding: " + key)
        actual[key] = finding
    known = expected["dispositions"]
    if set(actual) != set(known):
        raise RuntimeError("new/missing High/Medium findings need source review: " + json.dumps({"new": sorted(set(actual)-set(known)), "missing": sorted(set(known)-set(actual))}))
    report = {"analyzerSucceeded": True, "reviewType": "local source review, not independent security approval",
              "rawHigh": sum(f["impact"] == "High" for f in severe),
              "rawMedium": sum(f["impact"] == "Medium" for f in severe), "unreviewedHighMedium": 0,
              "rawReportSHA256": hashlib.sha256(Path(raw_path).read_bytes()).hexdigest(),
              "reviewed": [{"signature": key, "severity": actual[key]["impact"], "check": actual[key]["check"], **known[key]} for key in sorted(actual)]}
    Path(report_path).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("analyzerSucceeded", "rawHigh", "rawMedium", "unreviewedHighMedium")}))


if __name__ == "__main__":
    review(sys.argv[1], sys.argv[2])
