#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"docs/audit/EXP-0.4.10-final-exp-0-closeout.json"
CANON=ROOT/"docs/audit/EXP-0.4.7-canonical-qualification-ledger.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
AC=ROOT/"docs/audit/EXP-0.4.5-acceptance-criterion-evidence.json"
PROV=ROOT/"docs/audit/EXP-0.4.3-qualification-evidence-ledger.json"
SCOPE=ROOT/"docs/audit/EXP-0.3.8-governance-scope-decision.json"
MAIN=ROOT/"docs/audit/EXP-0.4.9-current-main-requalification.json"
CI=ROOT/"docs/audit/EXP-0.4.1-ci-qualification-inventory.json"
E=ROOT/"exp-0-4-10-evidence"
def load(p): return json.loads(p.read_text())
def anc(a): return subprocess.run(["git","merge-base","--is-ancestor",a,"HEAD"],cwd=ROOT).returncode==0
def main():
 errors=[]
 for p in (M,CANON,GAPS,AC,PROV,SCOPE,MAIN,CI):
  if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
 if errors:
  print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
 m,canon,gaps,ac,prov,scope,mainrec,ci=map(load,(M,CANON,GAPS,AC,PROV,SCOPE,MAIN,CI))
 if m.get("schema")!="420explorer-exp-0.4.10-final-exp-0-closeout-v1": errors.append("schema drift")
 if m.get("milestone")!="EXP-0.4.10": errors.append("milestone drift")
 prev=m["baseline"]["exp_0_4_9_final_qualified_head"]
 if prev!="4d477e57ba178a90a8724217c919051a26222d53" or not anc(prev): errors.append("EXP-0.4.9 final head ancestry failure")
 if m["baseline"]["current_main_sha"]!="304cb61286c94f72d0b05e32e5f713b9d68bc450": errors.append("main baseline drift")
 state=canon.get("current_state",{})
 exp={"mandatory_requirements":60,"active_genesis_blockers":10,"acceptance_criteria":10,"unverified_acceptance_criteria":10,"satisfied_acceptance_criteria":0,"unresolved_scope_conflicts":0,"genesis_qualified_requirements":0,"runtime_qualified_events":0,"deployment_qualified_events":0,"live_network_qualified_events":0,"genesis_qualified_events":0,"genesis_ready":False}
 for k,v in exp.items():
  if state.get(k)!=v: errors.append(f"canonical state drift: {k}")
 active=[f for f in gaps.get("findings",[]) if f.get("genesis_blocking")]
 if len(active)!=10: errors.append("active Genesis blocker count drift")
 if ac.get("summary",{}).get("unverified")!=10 or ac.get("summary",{}).get("satisfied")!=0: errors.append("AC evidence drift")
 ps=prov.get("summary",{})
 for k in ("runtime_qualified_events","deployment_qualified_events","live_network_qualified_events","genesis_qualified_events"):
  if ps.get(k)!=0: errors.append(f"provenance overpromotion: {k}")
 if scope.get("decision")!="EXP-SCOPE-RESOLUTION-B" or scope.get("outcome")!="not_required_as_dedicated_view": errors.append("governance scope decision drift")
 if mainrec.get("summary",{}).get("current_main_behind_commits")!=0: errors.append("current-main reconciliation no longer exact")
 for p in m.get("retained_authorities",[]):
  if not (ROOT/p).exists(): errors.append(f"missing retained authority {p}")
 qm=next((x for x in ci.get("mechanisms",[]) if x.get("id")=="EXP-QM-009"),{})
 cmds=qm.get("command_group",[])
 norm=[str(x) if str(x).startswith("scripts/") else "scripts/"+str(x) for x in cmds]
 required=[f"scripts/verify-exp-0-4-{i}-" for i in range(1,11)]
 for prefix in required:
  if not any(x.startswith(prefix) for x in norm): errors.append(f"retained verifier missing for {prefix}")
 s=m.get("summary",{})
 if s.get("exp_0_ready_for_closeout") is not True or s.get("exp_0_complete") is not False: errors.append("pre-closeout summary drift")
 if s.get("genesis_ready") is not False or s.get("next_stage")!="EXP-1": errors.append("handoff/readiness drift")
 E.mkdir(exist_ok=True)
 out={"schema":"exp-0.4.10-evidence-v1","milestone":"EXP-0.4.10","head":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),"mandatory_requirements":60,"active_genesis_blockers":10,"unverified_acceptance_criteria":10,"unresolved_scope_conflicts":0,"genesis_ready":False,"errors":errors,"pass":not errors}
 (E/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
 print(json.dumps(out,indent=2))
 if errors: raise SystemExit(1)
if __name__=="__main__": main()
