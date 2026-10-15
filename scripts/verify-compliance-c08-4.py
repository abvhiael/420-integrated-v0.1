#!/usr/bin/env python3
"""C08.4 branch freeze verifier, not an assertion of merge-candidate approval."""
import json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/"docs/compliance/qualification/C08.4-branch-freeze.json"
j=json.loads(p.read_text())
assert j["status"]=="BRANCH_SNAPSHOT_ONLY_NOT_MAIN_RECONCILED"
assert j["release_enabled"] is False and j["main_integration"]=="UNQUALIFIED"
assert j["candidate_source_sha"] and re.fullmatch("[0-9a-f]{40}",j["candidate_source_sha"])
for group,entries in j["scope"].items():
 assert entries,group
 for x in entries:
  assert re.fullmatch("[0-9a-f]{40}",x["git_blob_sha"]),(group,x)
  assert not x["path"].startswith("/") and ".." not in x["path"]
  current=subprocess.check_output(["git","hash-object",x["path"]],cwd=root,text=True).strip()
  assert current==x["git_blob_sha"],("freeze mismatch",x["path"])
print("C08.4 source-blob inventory PASS; main merge candidate remains UNQUALIFIED")
