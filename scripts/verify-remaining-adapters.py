#!/usr/bin/env python3
"""Reconcile remaining catalogue routes, source identities and retained qualification."""
import hashlib,json,re,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
def read(path):return json.loads((ROOT/path).read_text())
def check():
    record=read('docs/audit/remaining-adapters-qualification/RECONCILIATION.json')
    assert {x['asset'] for x in record['chains']}=={'BNB','DOGE','LTC','XRP','TRX','POT','BOB','CURE','ARRR'}
    catalogue=read('contracts/config/bridge/launch-catalog-v12.5.1.json')['assets']
    for row in record['chains']:
        profile=read(row['profile']);source=(ROOT/row['adapter']).read_text()
        for path,key in [(row['profile'],'profile_sha256'),(row['adapter'],'adapter_source_sha256'),(row['native_verifier'],'native_verifier_sha256'),(row['retained_adapter_owner'],'retained_adapter_owner_sha256')]:assert digest(path)==row[key],path
        assert 'INACTIVE' in profile['status'] and not row['production_route_qualified']
        assert any(x['symbol']==row['asset'] and x['canonical_chain_key']==row['chain_key'] for x in catalogue)
        assert row['network_identity']==profile['network_identity']
        assert row['adapter_id_preimage'] in source and row['route_chain_id'].lower() in source.lower()
        assert len(row['source_qualified_sha'])==40
    by_asset={x['asset']:x for x in record['chains']}
    assert not by_asset['POT']['local_verifier_qualified_for_documented_model'] and not by_asset['ARRR']['local_verifier_qualified_for_documented_model']
    assert {x['asset']:x['decimals'] for x in record['chains']}=={'BNB':18,'DOGE':8,'LTC':8,'XRP':6,'TRX':6,'POT':8,'BOB':8,'CURE':6,'ARRR':8}
    routes=read('contracts/config/bridge/supported-token-routes-v1.json')
    assert record['token_routes']==routes['generic_routes'] and not routes['production_active']
    assert len(record['token_routes'])==9
    assert {x['symbol'] for x in record['token_routes']}=={'AUDIO','UNI','LINK','AAVE','USDT','QCAD','EURC','RAY'}
    for path,value in record['retained_artifact_sha256'].items():assert digest(path)==value,path
    inventory=runpy.run_path(str(ROOT/'scripts/verify-final-verifier-inventory.py'))['check']()
    assert inventory['production_approvals']==0 and inventory['source_identical_native_component_graphs']==12
    report=read('docs/audit/remaining-adapters-qualification/RESULTS.json')
    unique=set();observed=0
    for run in report['runs']:
        log=(ROOT/run['log']).read_text();names=set(re.findall(r'^\[PASS\] (\w+)\(',log,re.M));assert len(names)==run['cases_passed'];unique|=names;observed+=len(names)
    assert len(unique)==report['totals']['cases_passed']==26 and observed==37
    # Preserve the passing outbound-only evidence across the later inbound-domain correction.
    before=(ROOT/'docs/audit/remaining-adapters-qualification/BnbBridgeAdapter420-before-domain-fix.sol').read_text()
    current=(ROOT/'contracts/src/bridge/adapters/BnbBridgeAdapter420.sol').read_text()
    def outbound(text):return text.split('    function initiateOutbound(',1)[1].split('    function _setVerifier(',1)[0]
    assert outbound(before)==outbound(current)
    return {'pass':True,'remaining_native_chains':9,'generic_token_routes':9,'qualified_distinct_cases':26,
            'native_consensus_graphs_unchanged':12,'production_approvals':0,
            'POT_full_native_qualification':False,'ARRR_full_native_qualification':False,
            'CURE_decimals':6,'source_profiles_unchanged':True}
if __name__=='__main__':print(json.dumps(check(),indent=2))
