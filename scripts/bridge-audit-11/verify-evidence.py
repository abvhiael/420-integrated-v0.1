#!/usr/bin/env python3
"""Verify retained security coverage and current bridge source provenance.
Does not re-execute historical or already-passing Solidity tests.
"""
import argparse,hashlib,json,re,runpy
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args()
# This traverses source-transition manifests as well as the original native
# proof/consensus sources. A changed source cannot inherit an unrelated pass.
verified=runpy.run_path(str(ROOT/'scripts/verify-bridge-value-settlement.py'))['check']()
inventory=json.loads((ROOT/'contracts/config/bridge/verifier-qualification-inventory.json').read_text())
coverage=json.loads((ROOT/'docs/audit/adversarial-qualification/coverage-matrix.json').read_text())
families={};records=set()
for entry in coverage:
 assert entry['status'] in ['QUALIFIED_IMPLEMENTED_BOUNDARY','NOT_IMPLEMENTED_AT_THIS_LAYER'],entry
 if entry['status']=='NOT_IMPLEMENTED_AT_THIS_LAYER':assert entry.get('reason') and not entry.get('evidence'),entry
 for evidence in entry.get('evidence',[]):
  path=ROOT/evidence['log'];text=path.read_text();name=evidence['test']
  assert re.search(r'^\[PASS\]\s+'+re.escape(name)+r'\(',text,re.M),evidence
  records.add((evidence['source_commit'],evidence['log'],evidence['owner'],name))
 families.setdefault(entry['family'],Counter())[entry['status']]+=1
assert len(families)==14 and len(coverage)==196
report={'pass':True,'base_main':'671e72bef3a3c0e90e3db5581770049bfa9eb18d','candidate_dependency':'a467dfbd271be61ee6d022e950ea030c36cb747f','retained_settlement':verified,'retained_coverage_entries':len(coverage),'distinct_referenced_original_passes':len(records),'family_attack_statuses':{k:dict(v)for k,v in families.items()},'candidate_families':[{k:f[k]for k in ['asset','adapter','adapter_source_sha256','verifier','verifier_source_sha256','source_qualified_sha','trust_model','local_verifier_qualified_for_documented_model','production_route_qualified','external_dependencies']}for f in inventory['families']],'production_approvals':inventory['production_approvals'],'source_manifest_sha256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()for p in ['contracts/config/bridge/verifier-qualification-inventory.json','contracts/config/bridge/supported-token-routes-v1.json','contracts/config/bridge/adversarial-sources-v1.json','docs/audit/adversarial-qualification/coverage-matrix.json','docs/audit/settlement-qualification/RESULTS.json','docs/audit/final-verifier-qualification/RESULTS.json']},'historical_ci_evidence':[{'sha':'5f58baf6dc861939a21119a0fce645060a067518','run_ids':['43563876850','43563876854']}],'new_ci_runs':[]}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'pass':True,'families':len(families),'attack_entries':len(coverage),'distinct_referenced_original_passes':len(records),'retained_settlement':verified},indent=2))
