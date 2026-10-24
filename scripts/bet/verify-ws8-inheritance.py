#!/usr/bin/env python3
"""Preserve historical green owner evidence without rerunning unrelated suites."""
import json
import os
import subprocess
import urllib.request

SOURCE = "0bf8aede5ed1675493017d5e054f972abcede24c"
subprocess.run(["git", "fetch", "--no-tags", "origin", SOURCE], check=True)
paths = subprocess.check_output([
    "git", "ls-tree", "-r", "--name-only", SOURCE, "--",
    "contracts/src/bet", "clients/420bet-poker/crypto", "clients/420bet-poker/zkshuffle",
], text=True).splitlines()
# Only the module declaration is normalized to its already-resolved historical
# dependencies. It receives fresh qualification in the WS8 compiled-relation /
# all-proof verification job; it is not asserted byte-identical to old go.mod.
paths = [p for p in paths if not p.endswith(("/go.mod", "/go.sum"))]
# 5A.5 changes these native/replay owners. Their old green result is explicitly
# NOT inherited: the Level 2 workflow requires fresh execution and an exact-SHA
# report from all affected native owners plus both independent replay models.
fresh = {
    'contracts/src/bet/PokerNLHEBetting420.sol',
    'contracts/src/bet/PokerActionDisputeClock420.sol',
    'contracts/src/bet/PokerNativeOutcome420.sol',
    'clients/420bet-poker/zkshuffle/triage_slither_poker.py',
    'clients/420bet-poker/crypto/nlhe-betting.mjs',
    'clients/420bet-poker/crypto/nlhe-betting.test.mjs',
    'clients/420bet-poker/crypto/nlhe-independent-verifier.mjs',
    'clients/420bet-poker/crypto/nlhe-independent-verifier.test.mjs',
}
paths = [p for p in paths if p not in fresh]
subprocess.run(["git", "diff", "--exit-code", SOURCE, "HEAD", "--", *paths], check=True)
repo = os.environ["GITHUB_REPOSITORY"]
def get(path):
    req = urllib.request.Request("https://api.github.com/repos/" + repo + "/" + path,
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)
run = 40054572031
record = get(f"actions/runs/{run}")
assert record["head_sha"] == SOURCE and record["conclusion"] == "success"
assert record["path"] == ".github/workflows/420bet-poker-ws7-consolidated-adversarial.yml"
jobs = {j["id"]: j for j in get(f"actions/runs/{run}/jobs?per_page=100")["jobs"]}
for ident, name in {120754573959: "cryptographic-attacks", 120754573705: "replay-and-economics", 120757802960: "consolidated-gate"}.items():
    assert jobs[ident]["name"] == name and jobs[ident]["conclusion"] == "success"
artifacts = {a["id"]: a for a in get(f"actions/runs/{run}/artifacts?per_page=100")["artifacts"]}
for ident, name in {12545081467: "ws7-crypto-exact-sha", 12545048458: "ws7-native-exact-sha"}.items():
    assert artifacts[ident]["name"] == name and not artifacts[ident]["expired"]
    assert artifacts[ident]["workflow_run"]["head_sha"] == SOURCE
print("Unchanged historical sources and cryptographic run/job/artifact identities preserved; changed 5A.5 native/replay owners REQUIRE fresh exact-SHA execution")
