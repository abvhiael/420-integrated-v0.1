#!/usr/bin/env python3
"""CI-GUARD-02: verify heavy workflows are opt-in without changing their jobs."""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKFLOWS = (
 "420compliance-c08-5-level3.yml", "420hz-gca-17-level3.yml",
 "explorer-exp-1-9.yml", "explorer-exp-1-10.yml",
 "contracts-foundry.yml", "contracts-genesis.yml", "genesis-address-authority.yml",
 "liftd-l02-13-level3.yml",
 "mig-5-level3.yml", "qualification.yml",
)

def fail(msg):
    raise ValueError("ci-guard-02: " + msg)

# EXP-1.9 is a scoped post-merge regression, not a Level 3 dispatch.
EXP19_PUSH = """  push:
    branches:
      - main
    paths:
      - 'indexer/**'
      - '420-indexer/**'
      - 'explorer/**'
      - 'deployments/indexer/**'
      - 'docker/Dockerfile.420indexer'
      - 'config/420indexer-v1.json'
      - 'testnet/public-services/indexer/**'
      - 'testnet/public-services/explorer/**'
      - 'docs/audit/EXP-1.*'
      - 'scripts/verify-exp-1-*.py'
      - 'scripts/verify-420indexer.py'
      - '.github/workflows/420indexer.yml'
      - '.github/workflows/docs-qualify.yml'
      - '.github/workflows/qualification.yml'
      - '.github/workflows/explorer-exp-1-9.yml'
"""
EXP19_ENV = """          INDEXER_ENGINE_URL: https://engine.invalid.example
          INDEXER_JWT_SECRET: /tmp/420-indexer-exp19-engine.jwt
"""
EXP19_FIXTURE = """          # Validate only the Compose manifest; no external engine connection.
          (umask 077; openssl rand -hex 32 > "$INDEXER_JWT_SECRET")
          trap 'rm -f "$INDEXER_JWT_SECRET"' EXIT
"""

def check(before, after, name):
    def split(source):
        marker = "\njobs:"
        idx = source.find(marker)
        if idx < 0:
            fail(name + ": missing jobs")
        return source[:idx], source[idx:]
    old_top, old_jobs = split(before)
    new_top, new_jobs = split(after)
    if name == 'explorer-exp-1-9.yml':
        if EXP19_PUSH not in new_top:
            fail(name + ': missing exact scoped main trigger')
        new_top = new_top.replace(EXP19_PUSH, '', 1)
        if EXP19_ENV not in old_jobs:
            old_jobs = old_jobs.replace('          INDEXER_RPC_URL: https://rpc.invalid.example\n', '          INDEXER_RPC_URL: https://rpc.invalid.example\n' + EXP19_ENV, 1)
            old_jobs = old_jobs.replace('          mkdir -p /tmp/420consensus\n', EXP19_FIXTURE + '          mkdir -p /tmp/420consensus\n', 1)
    if old_jobs != new_jobs:
        fail(name + ": test inventory or job definitions changed")
    if "\n  workflow_dispatch:" not in new_top:
        fail(name + ": missing explicit dispatch")
    for event in ("push:", "pull_request:", "pull_request_target:", "schedule:"):
        if "\n  " + event in new_top:
            fail(name + ": implicit heavy trigger " + event)
    if not old_top:
        fail(name + ": missing baseline")
    if new_top.split("\non:\n",1)[0] != old_top.split("\non:\n",1)[0]:
        fail(name + ": workflow name or header changed")
    return True

# Preserve the retired owner separately from the active integrated inventory.
# The original baseline and retirement commit are immutable Git evidence.
RETIRED_HIGHCOUNTRY = {
    "path": ".github/workflows/highcountry-r06-level3.yml",
    "historical_base": "70e8d6968033d8889bd77ef09c634627afda7c0f",
    "historical_blob": "da1e2f5c2f4177b43bf062b60f309b5803caa962",
    "retirement": "9d132667d5cc7b40a5ed549cc1d0375202785077",
    "destination": "abvhiael/HighCountry",
    "destination_observed_head": "3c4e521eca344058216a21a196e8afb018ce5fe9",
}


def verify_retired(git):
    r = RETIRED_HIGHCOUNTRY
    path = r["path"]
    historical = git("rev-parse", r["historical_base"] + ":" + path)
    if historical != r["historical_blob"]:
        fail("retired HighCountry historical identity drift")
    if git("merge-base", r["retirement"], "HEAD") != r["retirement"]:
        fail("HighCountry retirement is not in candidate ancestry")
    for ref in (r["retirement"], "HEAD"):
        if git("ls-tree", "-r", ref, "--", path):
            fail("retired HighCountry workflow reintroduced: " + ref)
    if (ROOT / path).exists():
        fail("retired HighCountry workflow present in working tree")
    print("PASS historical HighCountry inventory; retirement ancestry and absence verified")


def main():
    if len(sys.argv) != 2:
        fail("usage: verify-trigger-isolation.py BASE_SHA")
    base = sys.argv[1]
    def git(*args):
        return subprocess.run(['git', *args], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    verify_retired(git)
    for name in WORKFLOWS:
        path = ".github/workflows/" + name
        before = subprocess.run(["git", "show", base + ":" + path],
                                cwd=ROOT, text=True, capture_output=True, check=True).stdout
        after = (ROOT / path).read_text()
        check(before, after, name)
        print("PASS", name, "scoped main regression; retained jobs" if name == "explorer-exp-1-9.yml" else "manual-only; identical job inventory")
    print("PASS: nine manual-only workflows, one scoped EXP-1.9 main regression, one retired historical inventory")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as err:
        print(err, file=sys.stderr)
        sys.exit(1)
