#!/usr/bin/env python3
"""Reconcile candidate changes against the immutable 10.1.D snapshot.
Never treat successful patch application as authorization to merge.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import subprocess
import tempfile
import zipfile

def git(*args, env=None, data=None, ok=(0,)):
    import os
    p = subprocess.run(["git", *args], env=env, input=data, capture_output=True)
    if p.returncode not in ok:
        raise RuntimeError(str(args) + ": " + p.stderr.decode(errors="replace"))
    return p

def text(*args):
    return git(*args).stdout.decode().strip()

def owner(path):
    p = path.lower()
    if "native" in p and ("settlement" in p or "funding" in p) and ("ai" in p):
        return "AI-AUDIT-5"
    if p.startswith("420-ai-provider/") or "420ai-provider" in p:
        return "AI-AUDIT-6"
    if p.startswith("ai/web/"):
        return "AI-AUDIT-8"
    if p.startswith("420-indexer/"):
        return "AI-AUDIT-7 / 420Indexer"
    if p.startswith(("contracts/src/compute/", "contracts/test/compute", "compute/", "docs/compute-market/")):
        return "AI-AUDIT-4 / ComputeMarket"
    if p.startswith("wallet/") or "420wallet" in p:
        return "AI-AUDIT-8 / 420Wallet"
    if "storage" in p or "resource" in p:
        return "AI-AUDIT-3/6 / Storage"
    if "reward" in p or "contribution" in p:
        return "AI-AUDIT-5/9 / Rewards"
    if "registry" in p or "identity" in p or "capability" in p:
        return "AI-AUDIT-9 / Registry and Identity"
    if "ai" in p and p.startswith(("contracts/src/ai/", "contracts/test/ai")):
        return "AI-AUDIT-2/3/4/5"
    if p.startswith(("config/", "contracts/config/", "genesis/")):
        return "AI-AUDIT-9 / configuration owner"
    return "Owning protocol / AI-AUDIT-10"

def review(args):
    raw = args.archive.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == "36a5869b0af2c7aae34e613d49ec90bbcb64537bda95a223b92b000973b800dc"
    with zipfile.ZipFile(args.archive) as z:
        snap = json.loads(z.read("420ai-branch-reconciliation.json"))
        refs = dict((ref.removeprefix("refs/heads/"), sha) for sha, ref in
                    (line.split() for line in z.read("remote-heads.txt").decode().splitlines()))
    assert refs == snap["branches"]
    main = snap["main"]
    assert main == "926210336ef4c1d30a0c6ade1693a47b4c38a05f"
    heads = [r for r in snap["heads"] if r["disposition"] == "requires_content_review"]
    assert len(heads) == 63 and sum(len(r["branches"]) for r in heads) == 65
    import os
    records = []
    cache = {}
    with tempfile.TemporaryDirectory() as tmp:
        index = pathlib.Path(tmp) / "index"
        env = dict(os.environ, GIT_INDEX_FILE=str(index))
        git("read-tree", main, env=env)
        for r in heads:
            sha, base = r["head"], r["mergeBase"]
            assert text("merge-base", main, sha) == base
            files = []
            for f in r["relevantFiles"]:
                if not f["status"].endswith("_candidate"):
                    continue
                path = f["path"]
                key = (path, f["baseEntry"], f["branchEntry"], f["mainEntry"])
                if key not in cache:
                    # Full binary-capable branch patch, and current main changes.
                    patch = git("diff", "--binary", "--full-index", "--no-renames", base, sha, "--", path).stdout
                    current = git("diff", "--binary", "--full-index", "--no-renames", base, main, "--", path).stdout
                    assert patch, (sha, path)
                    reverse = git("apply", "--cached", "--check", "--reverse", "--whitespace=nowarn", "-", env=env, data=patch, ok=(0,1,128))
                    forward = git("apply", "--cached", "--check", "--whitespace=nowarn", "-", env=env, data=patch, ok=(0,1,128))
                    # Compare full added/deleted lines with main, including moved code in this file.
                    added = collections.Counter(l[1:] for l in patch.splitlines() if l.startswith(b"+") and not l.startswith(b"+++"))
                    removed = collections.Counter(l[1:] for l in patch.splitlines() if l.startswith(b"-") and not l.startswith(b"---"))
                    present = git("show", f"{main}:{path}", ok=(0,128))
                    lines = collections.Counter(present.stdout.splitlines()) if present.returncode == 0 else collections.Counter()
                    missing = list((added - lines).elements())
                    retained_deleted = list((removed & lines).elements())
                    if reverse.returncode == 0:
                        disposition = "duplicate"
                        reason = "Exact historical patch reverse-applies to main index; changes already present."
                    elif forward.returncode == 0:
                        disposition = "outstanding implementation"
                        reason = "Historical patch applies cleanly to main; applicability and canonical owner acceptance required."
                    else:
                        disposition = "conflicting implementation"
                        reason = "Neither forward nor reverse patch applies to main; preserve current authority, reconcile missing behavior under owner."
                    if path.startswith("contracts/src/ai/AINative") or path.startswith("contracts/test/AINative"):
                        disposition = "superseded"
                        reason = "Historical standalone native AI custody replaced by canonical CMP/Vault custody (AI-AUDIT-5 qualification). Do not restore competing money authority."
                    cache[key] = dict(f, disposition=disposition, reason=reason, owner=owner(path),
                        historicalPatchSha256=hashlib.sha256(patch).hexdigest(),
                        mainPatchSha256=hashlib.sha256(current).hexdigest(),
                        forwardApplies=forward.returncode == 0, reverseApplies=reverse.returncode == 0,
                        addedLineCount=sum(added.values()), deletedLineCount=sum(removed.values()),
                        absentAddedLineCount=len(missing), retainedDeletedLineCount=len(retained_deleted),
                        absentAddedLines=[l.decode(errors="replace") for l in missing],
                        retainedDeletedLines=[l.decode(errors="replace") for l in retained_deleted],
                        patch=patch.decode(errors="replace"), mainPatch=current.decode(errors="replace"))
                files.append(cache[key])
            assert files
            counts = dict(collections.Counter(f["disposition"] for f in files))
            disposition = ("conflicting implementation" if "conflicting implementation" in counts else
                           "outstanding implementation" if "outstanding implementation" in counts else
                           "superseded" if "superseded" in counts else "duplicate")
            records.append({"head":sha,"branches":r["branches"],"mergeBase":base,
                            "disposition":disposition,"counts":counts,"files":files})
            print(sha[:10], ", ".join(r["branches"]), counts, flush=True)
    report = {"schema":"420ai-10.1.d-content-review-v1","main":main,
              "sourceArtifact":15056906404,"sourceArchiveSha256":hashlib.sha256(raw).hexdigest(),
              "branchCount":65,"uniqueHeadCount":63,"distinctFileVersions":len(cache),
              "counts":dict(collections.Counter(r["disposition"] for r in records)),
              "heads":records,
              "limitations":"Patch-level classifications are not proof of semantic equivalence or authorization to recover. Outstanding/conflicting candidates require owning-step semantic review."}
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True)+"\n")
    print(report["counts"], flush=True)
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--archive",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    review(p.parse_args())
