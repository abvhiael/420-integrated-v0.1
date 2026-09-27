#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.9-current-main-requalification.json"
CI=ROOT/"docs/audit/EXP-0.4.1-ci-qualification-inventory.json"
CANON=ROOT/"docs/audit/EXP-0.4.7-canonical-qualification-ledger.json"
RET=ROOT/"docs/audit/EXP-0.4.8-evidence-retention-reproducibility.json"
EVIDENCE=ROOT/"exp-0-4-9-evidence"\nMERGED_EXP0="b03e247aa4df0a6a6d978ffad8eedfe2487a3a6b"
def load(p): return json.loads(p.read_text(encoding="utf-8"))
def git(*args):
 p=subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True)
 if p.returncode: raise RuntimeError((p.stderr or p.stdout).strip())
 return p.stdout.strip()
def ancestor(a,b="HEAD"):
 return subprocess.run(["git","merge-base","--is-ancestor",a,b],cwd=ROOT).returncode==0
def main():
 errors=[]
 for p in (M,CI,CANON,RET):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,ci,canon,ret=map(load,(M,CI,CANON,RET))
 if m.get("schema")!="420explorer-exp-0.4.9-current-main-requalification-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.9": errors.append("milestone drift")
 mainsha=m.get("current_main_snapshot",{}).get("sha")
 prev=m.get("baseline",{}).get("exp_0_4_8_final_qualified_head")
 if mainsha!="304cb61286c94f72d0b05e32e5f713b9d68bc450": errors.append("recorded current-main SHA drift")
 if m.get("baseline",{}).get("exp_0_4_start_main_sha")!=mainsha: errors.append("main changed since EXP-0.4 start")
 if not ancestor(mainsha): errors.append("recorded current main is not an ancestor of HEAD")
 if not ancestor(prev): errors.append("EXP-0.4.8 final qualified head is not an ancestor of HEAD")
 try:
  ahead=int(git("rev-list","--count",f"{reconciliation_base}..HEAD"))
 except Exception as e:
  errors.append(f"cannot calculate ahead count: {e}"); ahead=-1
 if not post_merge and ahead < m.get("current_main_snapshot",{}).get("observed_ahead_by_before_0_4_9_changes",0): errors.append("ahead count regressed below observed snapshot")
 try:
  changed=[x for x in git("diff","--name-only",f"{reconciliation_base}..HEAD").splitlines() if x]
 except Exception as e:
  errors.append(f"cannot inspect branch delta: {e}"); changed=[]
 allowed_exact=set(m.get("allowed_delta",{}).get("exact_files",[]))
 prefixes=tuple(m.get("allowed_delta",{}).get("path_prefixes",[]))
 unexpected=[p for p in changed if p not in allowed_exact and not p.startswith(prefixes)]
 if unexpected: errors.append("unexpected non-audit EXP-0.4 delta: "+", ".join(unexpected))
 wf=m.get("required_requalification_workflows",[])
 if [x.get("name") for x in wf]!=["420Indexer","420Docs Qualification","420 Integrated Qualification"]: errors.append("required workflow set/order drift")
 for x in wf:
  if not (ROOT/x.get("path","")).exists(): errors.append(f"missing workflow {x.get('path')}")
 integ=next((x for x in wf if x.get("name")=="420 Integrated Qualification"),{})
 if integ.get("required_jobs")!=["offline-core","production-dependencies","geth-engine","fault-matrix"]: errors.append("Integrated required job set drift")
 qm=next((x for x in ci.get("mechanisms",[]) if x.get("id")=="EXP-QM-009"),{})
 cmds=qm.get("command_group",[])
 required=[
  "scripts/verify-exp-0-4-1-ci-inventory.py",
  "scripts/verify-exp-0-4-2-historical-closeouts.py",
  "scripts/verify-exp-0-4-3-evidence-ledger.py",
  "scripts/verify-exp-0-4-4-requirement-ci-coverage.py",
  "scripts/verify-exp-0-4-5-acceptance-evidence.py",
  "scripts/verify-exp-0-4-6-historical-contradictions.py",
  "scripts/verify-exp-0-4-7-canonical-ledger.py",
  "scripts/verify-exp-0-4-8-evidence-retention.py",
  "scripts/verify-exp-0-4-9-current-main.py"
 ]
 norm=[x if x.startswith("scripts/") else "scripts/"+x for x in cmds]
 positions=[]
 for x in required:
  if x not in norm: errors.append(f"retained verifier missing: {x}")
  else: positions.append(norm.index(x))
 if positions and positions!=sorted(positions): errors.append("retained EXP-0.4 verifier order drift")
 state=canon.get("current_state",{})
 expected_state={"mandatory_requirements":60,"genesis_qualified_requirements":0,"active_genesis_blockers":10,"acceptance_criteria":10,"satisfied_acceptance_criteria":0,"unverified_acceptance_criteria":10,"runtime_qualified_events":0,"deployment_qualified_events":0,"live_network_qualified_events":0,"genesis_qualified_events":0,"genesis_ready":False}
 for k,v in expected_state.items():
  if state.get(k)!=v: errors.append(f"canonical state drift: {k}")
 if ret.get("baseline",{}).get("exp_0_4_7_final_qualified_head")!="c3b2d13d74ffed8be15edcecd144bc88959e5ab1": errors.append("retention baseline drift")
 s=m.get("summary",{})
 if s.get("current_main_reconciled") is not True or s.get("current_main_behind_commits")!=0: errors.append("main reconciliation summary drift")
 if s.get("product_runtime_files_changed_by_exp_0_4") is not False: errors.append("runtime/product delta incorrectly asserted")
 if s.get("genesis_ready") is not False: errors.append("premature Genesis readiness")
 EVIDENCE.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.9-evidence-v1","milestone":"EXP-0.4.9","head":git("rev-parse","HEAD"),"historical_current_main_sha":mainsha,"merged_exp_0_sha":MERGED_EXP0 if post_merge else None,"reconciliation_base":reconciliation_base,"current_main_is_ancestor":ancestor(mainsha),"exp_0_4_8_head_is_ancestor":ancestor(prev),"ahead_by":ahead,"changed_files":changed,"unexpected_files":unexpected,"genesis_blockers":state.get("active_genesis_blockers"),"unverified_acceptance_criteria":state.get("unverified_acceptance_criteria"),"errors":errors,"pass":not errors}
 (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
 (EVIDENCE/"current-main-delta.json").write_text(json.dumps({"base":mainsha,"head":git("rev-parse","HEAD"),"ahead_by":ahead,"files":changed},indent=2)+"\n",encoding="utf-8")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
