#!/usr/bin/env python3
"""Exact-ref branch reconciliation; no checkout or historical merge."""
import argparse
import collections
import concurrent.futures
import json
import os
import pathlib
import re
import subprocess

def git(*args, data=None, allowed=(0,)):
    p = subprocess.run(["git", *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode not in allowed:
        raise RuntimeError(f"git {args!r}: {p.stderr.decode(errors='replace')}")
    return p

def out(*args):
    return git(*args).stdout.decode().strip()

def paths(*args):
    return [p.decode("utf-8", errors="surrogateescape") for p in git(*args).stdout.split(b"\0") if p]

def scope(p):
    q = p.lower()
    if q.startswith(("contracts/src/ai/", "contracts/config/ai/", "ai/", "services/420ai-provider/")) or re.search(r"(^|[/_-])(?:420ai|ai420|ai-audit|ai-descriptors|ai-read-model)(?:[./_-]|$)", q) or re.search(r"contracts/test/ai[^/]*\.sol$", q) or q.startswith("docs/apps/ai/"):
        return "ai"
    if q.startswith(("contracts/src/compute/", "contracts/src/vault/", "contracts/src/trust/", "contracts/src/rewards/", "contracts/src/rights/", "contracts/src/storage/", "contracts/src/identity/", "contracts/src/system/", "contracts/src/interfaces/", "contracts/src/apps/", "contracts/config/", "compute/", "420-indexer/", "420-rpc/", "wallet/", "packages/420-sdk/", "sdk/", "indexer/", "genesis/", "deployments/", "config/", "contracts/script/", "docs/compute-market/")) or re.search(r"contracts/test/(compute|vault|trust|reward|rights|storage|identity|registry|capability)", q):
        return "canonical_dependency"
    return None

def tree_entry(ref, path):
    return git("ls-tree", "-z", ref, "--", path).stdout

def patch_ids(commits):
    if not commits:
        return {}
    p = git("log", "--no-walk=unsorted", "--no-merges", "--format=medium", "-p", "--no-ext-diff", "--binary", "--stdin", data=("\n".join(commits)+"\n").encode())
    rows = git("patch-id", "--stable", data=p.stdout).stdout.decode().splitlines()
    return {commit: patch for patch, commit in (row.split() for row in rows)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--main", required=True)
    ap.add_argument("--output", type=pathlib.Path, required=True)
    args = ap.parse_args()
    base = out("rev-parse", args.main)
    refs = {}
    for row in out("for-each-ref", "--format=%(refname)%09%(objectname)", "refs/remotes/origin").splitlines():
        name, sha = row.split("\t")
        name = name.removeprefix("refs/remotes/origin/")
        if name != "HEAD":
            refs[name] = sha
    if not refs or refs.get("main") != base:
        raise RuntimeError("Full remote branch snapshot required; origin/main must match pinned main")
    groups = collections.defaultdict(list)
    for name, sha in sorted(refs.items()):
        groups[sha].append(name)
    ancestors = set(out("rev-list", base).splitlines())
    print(f"Snapshot: {len(refs)} branches, {len(groups)} distinct HEADs", flush=True)
    def analyze(item):
        sha, names = item
        rec = {"head": sha, "branches": names, "ancestorOfMain": sha in ancestors}
        if rec["ancestorOfMain"]:
            return dict(rec, disposition="merged", mergeBase=sha, commits=[], changedFiles=[], relevantFiles=[])
        mb = out("merge-base", base, sha)
        commits = out("rev-list", "--reverse", f"{mb}..{sha}").splitlines()
        changed = sorted(set(paths("diff", "--name-only", "-z", "--no-renames", mb, sha)))
        # Include files touched and later reverted, and merge commit first-parent changes.
        touched = set(changed)
        for p in paths("log", "--format=", "--name-only", "-z", "--no-renames", "-m", f"{mb}..{sha}"):
            if p.strip():
                touched.add(p.lstrip("\n"))
        relevant = []
        for p in sorted(touched):
            kind = scope(p)
            if kind is None:
                # Detect AI-specific cross-app consumers even on unrelated paths.
                # Limit to changed text blobs, not binary assets.
                for ref in (sha, mb):
                    t = git("show", f"{ref}:{p}", allowed=(0,128))
                    if t.returncode == 0 and b"\0" not in t.stdout[:8192] and re.search(rb"420AI|AIJobManager|AIComputeAdapter420|AIModelRegistry|AIContributionVerifier420|AIRewardsAdapter420|AIAuthorization420|AIModelDeploymentRegistry420|AIReputationRegistry|AIJobEscrow|AIRouter420|AIRequestRegistry420|AIResultRegistry420", t.stdout, re.I):
                        kind = "cross_consumer"
                        break
            if kind is None:
                continue
            old, branch, current = (tree_entry(ref, p) for ref in (mb, sha, base))
            # Compare mode and object identity, ignoring path itself only by using identical path.
            if branch == current:
                status = "identical_to_main"
            elif branch == old:
                status = "no_net_branch_change"
            elif old == current:
                status = "outstanding_candidate"
            else:
                status = "divergent_candidate"
            relevant.append({"path": p, "scope": kind, "status": status,
                             "baseEntry": old.decode(errors="replace").rstrip("\0"),
                             "branchEntry": branch.decode(errors="replace").rstrip("\0"),
                             "mainEntry": current.decode(errors="replace").rstrip("\0")})
        unresolved = [x for x in relevant if x["status"].endswith("_candidate")]
        disposition = "requires_content_review" if unresolved else ("duplicate" if relevant else "outside_ai_scope")
        return dict(rec, mergeBase=mb, commits=commits, changedFiles=changed,
                    touchedFileCount=len(touched), relevantFiles=relevant, disposition=disposition)
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 2)) as pool:
        records = []
        for rec in pool.map(analyze, sorted(groups.items())):
            records.append(rec)
            if len(records)%100 == 0:
                print(f"Analyzed {len(records)}/{len(groups)} HEADs", flush=True)
    # Patch equivalence is secondary evidence, never a substitute for current tree comparison.
    nonancestor = {c for rec in records for c in rec["commits"]}
    branch_patches = patch_ids(sorted(nonancestor))
    # Match historical cherry-picks/squashes where a single commit patch is equivalent.
    main_patches = patch_ids(sorted(ancestors))
    by_patch = collections.defaultdict(list)
    for commit, patch in main_patches.items():
        by_patch[patch].append(commit)
    for rec in records:
        rec["patchEquivalentCommits"] = {c: sorted(by_patch[branch_patches[c]]) for c in rec["commits"]
            if c in branch_patches and branch_patches[c] in by_patch}
    report = {"schema":"420ai-10.1.d-branch-reconciliation-v1", "main":base,
              "branchCount":len(refs), "uniqueHeadCount":len(groups), "branches":refs,
              "counts":dict(collections.Counter(r["disposition"] for r in records)),
              "heads":records}
    assert sum(len(r["branches"]) for r in records) == len(refs)
    assert set(r["head"] for r in records) == set(groups)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True)+"\n")
    print(json.dumps(report["counts"], sort_keys=True))
if __name__ == "__main__":
    main()
