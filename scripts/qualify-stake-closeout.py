#!/usr/bin/env python3
"""Qualify only closeout deltas; prove inherited evidence by exact Git blob IDs."""
import argparse, hashlib, importlib.util, json, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
LEDGER=ROOT/'docs/STAKE-AUDIT-9.8-OPERATIONAL-QUALIFICATION.json'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def require(value,message):
 if not value:raise RuntimeError(message)
def tree(ref,paths):
 out={}
 for line in git('ls-tree','-r',ref,'--',*paths).splitlines():
  meta,path=line.split('\t');mode,kind,sha=meta.split();require(kind=='blob','non-blob evidence');out[path]={'mode':mode,'blob':sha}
 return out

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--comparison-base');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 record={'schema':'420-stake-operational-closeout-result-v1','candidate_sha':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'pass':False,'liveAcceptance':False,'preserved':[]}
 try:
  ledger=json.loads(LEDGER.read_text());require(ledger['schema']=='420-stake-operational-closeout-v1','wrong ledger')
  base=ledger['baseMain']
  # The original audit's base and evidence ledger remain immutable. A later
  # integration may have been squash-merged; prove current PR ancestry separately.
  comparison=a.comparison_base or base
  require(git('merge-base',comparison,'HEAD')==comparison,'candidate not based on comparison main')
  require(tree('HEAD',[str(LEDGER.relative_to(ROOT))])==tree(comparison,[str(LEDGER.relative_to(ROOT))]) or comparison==base,'historical ledger changed')
  ancestry=subprocess.run(['git','merge-base','--is-ancestor',base,comparison],cwd=ROOT)
  require(ancestry.returncode in (0,1),'historical ancestry query failed')
  record['provenance']={'historicalBase':base,'comparisonBase':comparison,'historicalBaseIsAncestor':ancestry.returncode==0,'historicalLedgerUnchanged':True}
  if ancestry.returncode!=0:
   require(a.comparison_base is not None,'historical ancestry not proven')
   # A squash/import boundary must preserve every recorded historical blob;
   # this check is performed below against the actual historical Git objects.
   require(tree(comparison,[str(LEDGER.relative_to(ROOT))])==tree('HEAD',[str(LEDGER.relative_to(ROOT))]),'ledger provenance drift')
  # Only the closeout tooling/records and its existing scoped workflow changed.
  exact={'docs/ROADMAP.md','docs/STAKE-AUDIT-9.8-OPERATIONAL-QUALIFICATION.json','docs/STAKE-AUDIT-9.8-OPERATIONAL-CLOSEOUT.md','docs/STAKE-TESTNET-OPERATIONAL-ACCEPTANCE.md','.github/workflows/stake-operator-runbook.yml','scripts/qualify-stake-closeout.py','scripts/stake-live-operations.py','scripts/test-stake-live-operations.py','deployments/stake-operations/live.example.json'}
  changed=set(git('diff','--name-only',comparison,'HEAD').splitlines())
  if comparison==base:require(changed<=exact,'unqualified runtime change')
  record['comparisonChangedFiles']=sorted(changed)
  for row in ledger['evidence']:
   require(row['requirements'] and row['runs'] and row['files'],'incomplete requirement/evidence row')
   historical=tree(row['qualifiedSource'],row['paths']);current=tree('HEAD',row['paths'])
   require(historical==row['files'],'historical evidence invalidated: '+row['step'])
   # Runtime paths must remain byte-for-byte identical. Only the specific
   # revised runbook can differ, with freshly qualified exact-head evidence.
   revised=[]
   doc='docs/STAKE-AUDIT-9.7-VALIDATOR-OPERATOR-RUNBOOK.md'
   if row['step']=='9.7' and historical.get(doc)!=current.get(doc):
    require(doc in historical and doc in current,'runbook missing')
    evidence=a.output/'operator-runbook-result.json'
    require(evidence.is_file(),'revised runbook requires fresh qualification')
    fresh=json.loads(evidence.read_text())
    require(fresh['pass'] is True and fresh['candidate_sha']==record['candidate_sha'],'runbook qualification head mismatch')
    require(fresh['runbook_sha256']==hashlib.sha256((ROOT/doc).read_bytes()).hexdigest(),'runbook qualification content mismatch')
    revised.append({'path':doc,'historical':historical.pop(doc),'current':current.pop(doc),'qualification':fresh['candidate_sha']})
   require(historical==current,'inherited runtime/source evidence invalidated: '+row['step'])
   record['preserved'].append({'step':row['step'],'qualifiedSource':row['qualifiedSource'],'runs':row['runs'],'unchangedFiles':len(current),'requalifiedDocuments':revised})
  required={'9.1','9.2','9.2-runtime','9.3-sql','9.3-go','9.4','9.5','9.6','9.7','shared-runtime'}
  require({r['step'] for r in record['preserved']}==required,'requirement coverage gap')
  for path in ['docs/STAKE-AUDIT-9.8-OPERATIONAL-CLOSEOUT.md','docs/STAKE-TESTNET-OPERATIONAL-ACCEPTANCE.md']:
   text=(ROOT/path).read_text();require('STAKE-AUDIT-10' in text,'scope/next owner missing')
   # Relative links must resolve without publishing credentials or private files.
   import re
   for target in re.findall(r'\]\(([^)#]+)(?:#[^)]*)?\)',text):
    if '://' not in target:require((ROOT/path).parent.joinpath(target).is_file(),'broken closeout link')
  spec=importlib.util.spec_from_file_location('live',ROOT/'scripts/stake-live-operations.py');live=importlib.util.module_from_spec(spec);spec.loader.exec_module(live)
  raw=(ROOT/'deployments/stake-operations/live.example.json').read_bytes()
  try:live.config(raw,hashlib.sha256(raw).hexdigest())
  except live.Invalid:pass
  else:raise RuntimeError('template incorrectly passes live configuration')
  # Baseline public monitoring policy and executable operational examples remain
  # exactly at their qualified sources; no protocol/hardware/exit API is invented.
  require(tree('HEAD',['testnet/public/monitoring/policy.json'])==tree('4561e95809e672a3b69177fbcd069a5f35c1551b',['testnet/public/monitoring/policy.json']),'policy drift')
  checked=subprocess.run(['python3',str(ROOT/'scripts/test-stake-live-operations.py')],cwd=ROOT,capture_output=True,text=True)
  (a.output/'live-harness-tests.log').write_text(checked.stdout+checked.stderr);require(checked.returncode==0,'live harness test failure')
  record['source_sha256']={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(exact) if (ROOT/p).is_file()}
  import re
  count=re.search(r'Ran (\d+) tests',checked.stderr);require(count and int(count[1])==15,'missing adversarial cases')
  record['newQualification']={'liveHarnessAdversarialTests':int(count[1]),'inheritedCodeReexecuted':False,'templateFailsClosed':True,'existingPolicyUnchanged':True,'runbookRequalified':any(r['requalifiedDocuments'] for r in record['preserved'])}
  record['pass']=True
 finally:(a.output/'evidence.json').write_text(json.dumps(record,indent=2)+'\n')
 require(record['pass'],'closeout failed');print(json.dumps(record,indent=2))
if __name__=='__main__':main()
