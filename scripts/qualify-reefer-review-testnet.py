#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys
import urllib.parse
import urllib.request

DEPENDENCIES = {
    "420 Identity": "420/service/identity/v1",
    "420 Rights": "420/service/rights/v1",
    "420 Storage": "420/service/resource-protocol/v1",
    "420 Search": "420/service/search/v1",
    "420 Notifications": "420/service/notifications/v1",
    "420Mail": "420/service/mail/v1",
}
REQUIRED_JOURNEYS = {
    "identity_authorization",
    "rights_assertion",
    "storage_roundtrip",
    "public_search_projection",
    "notification_delivery",
    "mail_delivery",
    "private_visibility_negative",
    "dependency_failure_recovery",
    "restart_idempotency",
}

def fail(msg):
    raise SystemExit("ERROR: " + msg)

def load(path):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except Exception as exc:
        fail(f"cannot read {path}: {exc}")

def clean_https(value, label):
    if not isinstance(value, str) or not value:
        fail(f"{label} missing")
    low = value.lower()
    if any(x in value for x in ("REPLACE_", "PLACEHOLDER")):
        fail(f"{label} is placeholder")
    p = urllib.parse.urlparse(value)
    if p.scheme != "https" or not p.netloc or p.username or p.password:
        fail(f"{label} must be credential-free HTTPS")
    if p.hostname in ("localhost", "127.0.0.1", "::1"):
        fail(f"{label} must not be local")
    return value

def probe(url, timeout):
    req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": "reefer-audit-7-qualifier"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status < 200 or response.status >= 300:
            fail(f"health probe failed {url}: HTTP {response.status}")
        response.read(4096)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--evidenceDraft", required=True)
    ap.add_argument("--repositorySha", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--timeoutSeconds", type=int, default=15)
    args = ap.parse_args()

    if len(args.repositorySha) != 40 or any(c not in "0123456789abcdef" for c in args.repositorySha.lower()):
        fail("repository SHA must be exact 40-character hex")

    manifest = load(args.manifest)
    evidence = load(args.evidenceDraft)
    if manifest.get("network", {}).get("environment") != "testnet":
        fail("manifest environment is not testnet")
    if evidence.get("phase") != "REEFER-AUDIT-7":
        fail("evidence phase mismatch")
    if evidence.get("status") != "DRAFT_REQUIRES_REAL_TESTNET_EVIDENCE":
        fail("input must be a reviewed live evidence draft, not retained PASS evidence")
    if evidence.get("repositorySha") != args.repositorySha:
        fail("evidence repository SHA mismatch")

    reefer = evidence.get("reeferReview", {})
    clean_https(reefer.get("serviceUrl"), "Reefer Review service URL")
    ready = clean_https(reefer.get("readyUrl"), "Reefer Review ready URL")
    probe(ready, args.timeoutSeconds)

    seen = {}
    for dep in evidence.get("dependencies", []):
        name = dep.get("name")
        if name not in DEPENDENCIES:
            fail(f"unexpected dependency {name!r}")
        if dep.get("serviceId") != DEPENDENCIES[name]:
            fail(f"{name} service ID mismatch")
        clean_https(dep.get("endpoint"), f"{name} endpoint")
        health = clean_https(dep.get("healthUrl"), f"{name} health URL")
        if dep.get("status") != "PASS" or not dep.get("evidence"):
            fail(f"{name} lacks reviewed PASS evidence")
        probe(health, args.timeoutSeconds)
        seen[name] = True
    if set(seen) != set(DEPENDENCIES):
        fail("dependency evidence is incomplete")

    journeys = evidence.get("journeys", [])
    names = {j.get("name") for j in journeys if j.get("status") == "PASS" and j.get("evidence")}
    missing = sorted(REQUIRED_JOURNEYS - names)
    if missing:
        fail("missing PASS journey evidence: " + ", ".join(missing))

    for key in ("networkIdentity", "deploymentIdentity", "restartRecovery", "privacyBoundary"):
        block = evidence.get(key, {})
        if block.get("status") != "PASS" or not block.get("evidence"):
            fail(f"{key} evidence incomplete")

    out = {
        "schema": "reefer-audit-7-live-testnet-evidence-v1",
        "phase": "REEFER-AUDIT-7",
        "status": "PASS",
        "repositorySha": args.repositorySha,
        "manifestPath": args.manifest,
        "reeferReview": reefer,
        "dependencies": evidence["dependencies"],
        "journeys": journeys,
        "networkIdentity": evidence["networkIdentity"],
        "deploymentIdentity": evidence["deploymentIdentity"],
        "restartRecovery": evidence["restartRecovery"],
        "privacyBoundary": evidence["privacyBoundary"],
        "authoritative": False,
        "launchAuthority": False,
    }
    path = pathlib.Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
    print("REEFER_AUDIT_7_LIVE_QUALIFICATION=PASS")
    print(f"repositorySha={args.repositorySha}")
    print(f"output={path}")

if __name__ == "__main__":
    main()
