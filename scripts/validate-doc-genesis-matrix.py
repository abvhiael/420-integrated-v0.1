#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs/audit/genesis-documentation-matrix.json"

def main() -> int:
    data = json.loads(MATRIX.read_text(encoding="utf-8"))
    rows = data.get("rows", [])
    errors = []
    catalogue = json.loads((ROOT / "config/genesis-applications.json").read_text())
    expected_names = {app["name"] for app in catalogue["apps"]}
    names = [row.get("surface_name") for row in rows]
    if len(names) != len(expected_names) or set(names) != expected_names:
        errors.append("documentation surfaces differ from the frozen Genesis catalogue")
    pay = next((row for row in rows if row.get("surface_name") == "420 Pay"), {})
    if (pay.get("surface_class") != "protocol-application" or
            pay.get("status") != "catalogue-approved-deployment-unverified"):
        errors.append("Pay documentation must distinguish catalogue approval from deployment qualification")
    seen = set()
    for row in rows:
        sid = row.get("surface_id")
        if sid in seen:
            errors.append(f"duplicate surface_id: {sid}")
        seen.add(sid)
        if row.get("genesis_role") != "protocol-only" and set(row.get("required_dimensions", [])) != set(data["dimensions"]):
            errors.append(f"{sid}: incomplete required documentation dimensions")
        for dim in row.get("required_dimensions", []):
            targets = row.get("evidence", {}).get(dim, [])
            if not targets:
                errors.append(f"{sid}: missing evidence for {dim}")
            for target in targets:
                if not (ROOT / target).is_file():
                    errors.append(f"{sid}: missing evidence target {target}")
    if errors:
        print(f"420Docs Genesis matrix FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"420Docs Genesis matrix PASS: {len(rows)} rows and all evidence targets exist")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
