"""BNB-2.1 live acceptance gate. Missing authority is a BLOCK, not a PASS.

This script is repository evidence classification, never a replacement for
signed live transaction receipts, verifier logs or issuer governance approval.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = (
    "developer-hub/manifests/testnet.json",
    "docs/audit/BNB-2.1-APPROVED-PROPERTY-ISSUER.json",
    "docs/bnb/qualification/BNB-2.1-LIVE-ACCEPTANCE.json",
)

def readiness(root=ROOT):
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    if missing:
        return {"status": "BLOCKED_EXTERNAL_AUTHORITY", "missing": missing,
                "liveAccepted": False}
    # Evidence that happens to exist on disk is never self-authenticating.
    return {"status": "REVIEW_REQUIRED", "missing": [],
            "liveAccepted": False}

if __name__ == "__main__":
    result = readiness()
    print(json.dumps(result, sort_keys=True))
    # CI classification remains successful when deployment is honestly blocked;
    # an actual live acceptance verifier must explicitly validate evidence.
    if result["liveAccepted"]:
        sys.exit(1)
