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
    if len(rows) != 21:
        errors.append(f"expected 21 rows, found {len(rows)}")
    seen = set()
    for row in rows:
        sid = row.get("surface_id")
        if sid in seen:
            errors.append(f"duplicate surface_id: {sid}")
        seen.add(sid)
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
