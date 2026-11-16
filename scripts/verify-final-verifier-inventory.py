#!/usr/bin/env python3
"""Validate the V.22 snapshot against exact source identities and retained evidence."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def qualified_source_matches(path,digest):
 """Retain original SHA evidence while requiring every later source transition to be qualified."""
 inventory=json.loads((ROOT/'contracts/config/bridge/verifier-qualification-inventory.json').read_text())
 for extension in inventory.get('qualification_extensions',[]):
  record=extension.get('superseded_inputs',{}).get(path)
  if record and digest in (record['previous_sha256'],record.get('intermediate_sha256')):digest=record['current_sha256']
 assert digest==hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),path
 return True

def check():
 inventory=json.loads((ROOT/'contracts/config/bridge/verifier-qualification-inventory.json').read_text());assert inventory['audit_status']=='QUALIFIED_LOCAL_INTEGRATION'
 extensions=inventory.get('qualification_extensions',[]);transitions={};extension_manifests=0;extension_sizes={}
 for extension in extensions:
  for path,record in extension['superseded_inputs'].items():
   chain=transitions.setdefault(path,[])
   if chain:assert chain[-1]['current_sha256']==record['previous_sha256'],path
   assert record['previous_sha256']!=record['current_sha256']
   if record.get('intermediate_source'):
    assert hashlib.sha256((ROOT/record['intermediate_source']).read_bytes()).hexdigest()==record['intermediate_sha256'],path
   chain.append(record)
 def matches_qualified_lineage(path,digest):
  current=hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
  for record in transitions.get(path,[]):
   if digest in (record['previous_sha256'],record.get('intermediate_sha256')):digest=record['current_sha256']
  assert digest==current,path
 for extension in extensions:
  report=json.loads((ROOT/extension['results']).read_text());assert report['pass'];tested=set()
  for run in report['runs']:
   inp=json.loads((ROOT/run['source_inputs']).read_text());log=(ROOT/run['log']).read_text()
   failures=set(re.findall(r'^\[FAIL[\s\S]*?\]\s+(\w+)\(',log,re.M))
   assert failures==set(run.get('expected_failed_tests',[])),run['log']
   assert len(re.findall(r'^\[PASS\] ',log,re.M))==run['cases_passed'] and run['cases_passed']>0
   for name in failures:
    corrected=report['corrected_failures'][run['log']][name]
    corrected_log=corrected['log'] if isinstance(corrected,dict) else corrected
    corrected_name=corrected.get('test',name) if isinstance(corrected,dict) else name
    assert any(x['log']==corrected_log and corrected_name not in x.get('expected_failed_tests',[]) for x in report['runs'])
    assert re.search(r'^\[PASS\] '+re.escape(corrected_name)+r'\(', (ROOT/corrected_log).read_text(),re.M)
   for path,digest in inp['source_sha256'].items():
    matches_qualified_lineage(path,digest);tested.add((path,digest))
   size_path=(ROOT/run['log']).with_suffix('.bytecode.json')
   if size_path.exists():extension_sizes.update(json.loads(size_path.read_text()))
   extension_manifests+=1
  for path,record in extension['superseded_inputs'].items():assert (path,record['current_sha256']) in tested,path
  if report.get('sdk_inputs'):
   sdk=json.loads((ROOT/report['sdk_inputs']).read_text())
   for path,digest in sdk['source_sha256'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
   assert hashlib.sha256(bytes.fromhex((ROOT/sdk['golden_hex']).read_text().strip()[2:])).hexdigest()==sdk['normative_golden_bytes_sha256']
   for log_path in sdk['logs'].values():
    text=(ROOT/log_path).read_text();assert 'Ran '+str(sdk['cases'])+' tests' in text and text.strip().endswith('OK')

 families=inventory['families'];assert len(families)==14 and len({f['asset'] for f in families})==14
 assert inventory['production_approvals']==[] and inventory['no_production_activation_authorized']
 for f in families:
  assert hashlib.sha256((ROOT/f['adapter']).read_bytes()).hexdigest()==f['adapter_source_sha256'],f['adapter']
  if f['verifier']:assert hashlib.sha256((ROOT/f['verifier']).read_bytes()).hexdigest()==f['verifier_source_sha256'],f['verifier']
  assert not f['production_route_qualified'] and not f['approved_instances'] and len(f['source_qualified_sha'])==40
  for p,record in f['v18_component_graph_comparison'].items():
   assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==record['current_sha256'],p
   if f['asset'] not in ['USDC','CADC']:assert record['current_sha256']==record['original_sha256'] and record['identical'],p
 token=json.loads((ROOT/'contracts/config/bridge/supported-token-routes-v1.json').read_text());assert not token['production_active'] and len(token['generic_routes'])==9
 for profile in token['generic_routes']:
  path=ROOT/'contracts/config/bridge'/profile['config'];assert hashlib.sha256(path.read_bytes()).hexdigest()==profile['config_sha256'],path
 q=json.loads((ROOT/'contracts/config/bridge/verifier-identity-policy.json').read_text());assert q['production_approvals']==[]
 source=(ROOT/'contracts/src/bridge/adapters/CADCLayerZeroAdapter.sol').read_text();assert 'i.requireActive();' in source
 assert 'BridgeProofEnvelope420.decode(proof)' in (ROOT/'contracts/src/bridge/GatewayRouter420.sol').read_text()
 assert 'legacy source proof domain unqualified' in (ROOT/'contracts/src/bridge/VerifiedGateway420.sol').read_text()
 for name in ['ETHProofAdapter','BTCLightClientAdapter']:
  text=(ROOT/f'contracts/src/bridge/adapters/{name}.sol').read_text();assert 'production verifier not wired' in text and 'production outbound path not wired' in text
 evidence=ROOT/'docs/audit/final-verifier-qualification';retained=json.loads((evidence/'PRESERVED-SOURCE-EVIDENCE.json').read_text())
 for family in ['bitcoin','ethereum','litecoin','dogecoin','bnb','solana','tron','xrpl','potcoin','curecoin','dobbscoin','pirate']:assert not retained[family+'-inputs.json']['changed_production_sources'],family
 for name in ['envelope-core-domain','envelope-core-admission','envelope-core-invariant','envelope-core-settlement','envelope-core-downstream','envelope-full','envelope-utxo','envelope-ethereum','envelope-tokens','envelope-token-router','envelope-cadc','envelope-cadc-router','envelope-admission','envelope-legacy']:
  inp=json.loads((evidence/(name+'.inputs.json')).read_text())
  for p,h in inp['source_sha256'].items():matches_qualified_lineage(p,h)
 sizes=json.loads((evidence/'envelope-legacy.bytecode.json').read_text());assert sizes and max(sizes.values())<=24576
 sizes.update(extension_sizes);assert max(sizes.values())<=24576
 catalogue=json.loads((evidence/'catalogue-integrity.log').read_text());assert catalogue['pass']
 results=json.loads((evidence/'RESULTS.json').read_text());assert results['pass']
 for run in results['runs']:
  log=(ROOT/run['log']).read_text();assert '[FAIL' not in log and re.search(r'\b[1-9][0-9]* tests? passed, 0 failed',log),run['log']
  assert len(re.findall(r'^\[PASS\] ',log,re.M))==run['cases_passed']
 assert sum(run['cases_passed'] for run in results['runs'])==inventory['current_affected_qualification']['required_cases_passed']
 return {'pass':True,'verifier_families':14,'local_verifier_models':sum(x['local_verifier_qualified_for_documented_model'] for x in families),'generic_token_routes':9,'production_approvals':0,'source_identical_native_component_graphs':12,'compiled_bridge_artifacts':len(sizes),'maximum_runtime_bytes':max(sizes.values()),'retained_bitcoin_ci':inventory['retained_bitcoin_ci'],'retained_framework_input_manifests':14,'current_extension_input_manifests_verified':extension_manifests,'explicitly_requalified_input_changes':len(transitions)}
if __name__=='__main__':print(json.dumps(check(),indent=2))
