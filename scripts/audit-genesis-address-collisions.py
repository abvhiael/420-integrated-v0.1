#!/usr/bin/env python3
"""Audit the active Genesis namespace for collisions and authority drift.

REG-AUDIT-4 converted this former expected-failure preflight into a real-data
release check. Historical proposals remain auditable but are non-authoritative.
"""
import importlib.util
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
VERIFY = HERE / "verify-reg-audit-4-genesis-address-namespace.py"
spec = importlib.util.spec_from_file_location("reg_audit_4_namespace", VERIFY)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

def main():
    try:
        errors = validator.validate(validator.load())
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        errors = [f"Genesis address collision audit blocked: {exc}"]
    print(json.dumps({
        "pass": not errors,
        "mode": "ACTIVE_NAMESPACE_REAL_DATA",
        "canonicalRegistry": validator.REGISTRY,
        "collisionsAndDrifts": len(errors),
        "problems": errors,
    }, indent=2))
    return int(bool(errors))

if __name__ == "__main__":
    sys.exit(main())
