#!/usr/bin/env python3
"""Preserve historical green owner evidence without rerunning unrelated suites."""
import hashlib
import io
import json
import re
import zipfile
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
    'contracts/src/bet/PokerConfidentialDeal420.sol',
    'contracts/src/bet/PokerSeatLedger420.sol',
    'contracts/src/bet/PokerHandRank420.sol',
    'contracts/src/bet/PokerCanonicalRake420.sol',
    'clients/420bet-poker/crypto/nlhe-economics.mjs',
    'clients/420bet-poker/crypto/nlhe-pot-reference.mjs',
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
# Retain the original run and job provenance even though its artifacts aged out.
def verify_run(run, source, expected_jobs):
    record = get(f"actions/runs/{run}")
    assert record["head_sha"] == source and record["conclusion"] == "success"
    assert record["path"] == ".github/workflows/420bet-poker-ws7-consolidated-adversarial.yml"
    jobs = {j["id"]: j for j in get(f"actions/runs/{run}/jobs?per_page=100")["jobs"]}
    for ident, name in expected_jobs.items():
        assert jobs[ident]["name"] == name and jobs[ident]["conclusion"] == "success"

verify_run(40054572031, SOURCE, {
    120754573959: "cryptographic-attacks", 120754573705: "replay-and-economics",
    120757802960: "consolidated-gate",
})
REPLACEMENT = "c27c4bdae9c1cf764d4e2e904e30c411003a87fc"
RUN = 45319608400
verify_run(RUN, REPLACEMENT, {
    138195632367: "cryptographic-attacks", 138195632744: "replay-and-economics",
    138201145341: "consolidated-gate",
})
subprocess.run(["git", "fetch", "--no-tags", "origin", REPLACEMENT], check=True)
# Stronger than the artifact's partial manifests: verify the entire source/test
# and compiler input trees, replay/crypto trees and exact WS7 workflow identity.
subprocess.run(["git", "diff", "--exit-code", REPLACEMENT, "HEAD", "--",
    "contracts/src", "contracts/test", "contracts/foundry.toml",
    "contracts/remappings.txt", "contracts/lib", "clients/420bet-poker",
    ".github/workflows/420bet-poker-ws7-consolidated-adversarial.yml"], check=True)
artifacts = {a["id"]: a for a in get(f"actions/runs/{RUN}/artifacts?per_page=100")["artifacts"]}
expected = {
    14886608650: ("ws7-crypto-exact-sha",
        "7886f3635d5c3246881d5ef69d3027b6b7ffc19e4573056e9706f78cd22c86f3",
        ["clients/420bet-poker/zkshuffle/" + p for p in (
            "partial_decryption_circuit.go", "card_unmask_circuit.go", "ws4_joint_revelation_test.go")]),
    14888261191: ("ws7-native-exact-sha",
        "06c5021cab34b9ce90285606e03588f73daf46ef6b666a78cfe6912d1cc643ad",
        ["contracts/src/bet/" + p + ".sol" for p in (
            "PokerNLHEBetting420", "PokerNativeOutcome420", "PokerLiveCardReveals420",
            "PokerSeatLedger420", "PokerCanonicalSettlement420")]),
}
for ident, (name, digest, files) in expected.items():
    a = artifacts[ident]
    assert a["name"] == name and not a["expired"]
    assert a["workflow_run"]["id"] == RUN and a["workflow_run"]["head_sha"] == REPLACEMENT
    assert a["digest"] == "sha256:" + digest
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/artifacts/{ident}/zip",
        headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                 "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        raw = response.read()
    assert hashlib.sha256(raw).hexdigest() == digest
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert sorted(archive.namelist()) == ["qualified-sha.txt", "source-sha256.txt"]
        assert archive.read("qualified-sha.txt").decode().strip() == REPLACEMENT
        checksums = {}
        for line in archive.read("source-sha256.txt").decode().splitlines():
            checksum, path = line.split("  ", 1)
            assert re.fullmatch(r"[0-9a-f]{64}", checksum) and path not in checksums
            checksums[path] = checksum
        assert set(checksums) == set(files)
        for path, checksum in checksums.items():
            original = subprocess.check_output(["git", "show", REPLACEMENT + ":" + path])
            current = subprocess.check_output(["git", "show", "HEAD:" + path])
            assert hashlib.sha256(original).hexdigest() == checksum
            assert hashlib.sha256(current).hexdigest() == checksum
    print(f"Verified replacement artifact {ident}: {name}, archive and all source checksums")
print("Historical run/job/source identities retained; replacement WS7 exact-SHA crypto and native evidence verified; changed 5A.5 owners REQUIRE fresh execution")
