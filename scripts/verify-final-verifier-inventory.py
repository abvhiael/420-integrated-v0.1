#!/usr/bin/env python3
"""Validate the V.22 snapshot against exact source identities and retained evidence."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def check():
 inventory=json.loads((ROOT/'contracts/config/bridge/verifier-qualification-inventory.json').read_text());assert inventory['audit_status']=='QUALIFIED_LOCAL_INTEGRATION'
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
  for p,h in inp['source_sha256'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p
 sizes=json.loads((evidence/'envelope-legacy.bytecode.json').read_text());assert sizes and max(sizes.values())<=24576
 catalogue=json.loads((evidence/'catalogue-integrity.log').read_text());assert catalogue['pass']
 results=json.loads((evidence/'RESULTS.json').read_text());assert results['pass']
 for run in results['runs']:
  log=(ROOT/run['log']).read_text();assert '[FAIL' not in log and re.search(r'\b[1-9][0-9]* tests? passed, 0 failed',log),run['log']
  assert len(re.findall(r'^\[PASS\] ',log,re.M))==run['cases_passed']
 assert sum(run['cases_passed'] for run in results['runs'])==inventory['current_affected_qualification']['required_cases_passed']
 return {'pass':True,'verifier_families':14,'local_verifier_models':sum(x['local_verifier_qualified_for_documented_model'] for x in families),'generic_token_routes':9,'production_approvals':0,'source_identical_native_component_graphs':12,'compiled_bridge_artifacts':len(sizes),'maximum_runtime_bytes':max(sizes.values()),'retained_bitcoin_ci':inventory['retained_bitcoin_ci'],'exact_head_input_manifests_verified':14}
if __name__=='__main__':print(json.dumps(check(),indent=2))
