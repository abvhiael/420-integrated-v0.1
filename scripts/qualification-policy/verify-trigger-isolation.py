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
 "highcountry-r06-level3.yml", "liftd-l02-13-level3.yml",
 "mig-5-level3.yml", "qualification.yml",
)

def fail(msg):
    raise ValueError("ci-guard-02: " + msg)

def check(before, after, name):
    def split(source):
        marker = "\njobs:"
        idx = source.find(marker)
        if idx < 0:
            fail(name + ": missing jobs")
        return source[:idx], source[idx:]
    old_top, old_jobs = split(before)
    new_top, new_jobs = split(after)
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

def main():
    if len(sys.argv) != 2:
        fail("usage: verify-trigger-isolation.py BASE_SHA")
    base = sys.argv[1]
    for name in WORKFLOWS:
        path = ".github/workflows/" + name
        before = subprocess.run(["git", "show", base + ":" + path],
                                cwd=ROOT, text=True, capture_output=True, check=True).stdout
        after = (ROOT / path).read_text()
        check(before, after, name)
        print("PASS", name, "manual-only; identical job inventory")
    print("PASS: all eleven heavy workflows are explicitly dispatched without implicit triggers")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as err:
        print(err, file=sys.stderr)
        sys.exit(1)
