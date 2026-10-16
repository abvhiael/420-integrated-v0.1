#!/usr/bin/env python3
import json,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((root/"docs/compliance/C01.8-ARCHITECTURE-BASELINE.json").read_text())
assert d["step"]=="C01.8" and d["qualification_level"]==2
assert "| C01.8 | Architecture Level 2 milestone: source-to-requirement-to-test matrix, authority review, implementation sequence and baseline lock. |" in (root/"docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
ids={t["id"] for t in d["traceability"]}
assert all("C01."+str(i) in ids for i in range(1,8))
assert {"C01.7-RUNTIME","C08.3-HANDOFF"}.issubset(ids)
for row in d["traceability"]:
 assert (root/row["source"]).is_file() and (root/row["test"]).is_file(),row
assert not d["baseline_lock"]["runtime_permission"]
assert d["authority_review"]["travel_transaction_gateway"]=="DISABLED"
assert d["authority_review"]["managed_prod_keys"]=="NOT_PROVISIONED"
assert d["authority_review"]["genesis_changes"]=="NONE"
assert len(d["implementation_sequence"])>=7
if len(sys.argv)>1:
 assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()==sys.argv[1]
print("C01.8 architecture authority traceability baseline lock: PASS")
