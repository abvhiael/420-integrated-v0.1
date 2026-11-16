#!/usr/bin/env python3
"""Check exact-source provider qualification and explicit inactive deployment state.

Public support observations are dated provenance, never offline issuer authorization.
"""
import hashlib
import json
import re
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def check():
    lineage=runpy.run_path(str(ROOT/'scripts/verify-final-verifier-inventory.py'))['qualified_source_matches']
    record=read('docs/audit/provider-completion-qualification/RECONCILIATION.json')
    for path,digest in {**record['source_sha256'],**record['retained_artifact_sha256']}.items():
        assert lineage(path,digest),path
    usdc=read('contracts/config/bridge/usdc-cctp-v2-v1.json')
    assert usdc['status']=='APPROVED_INACTIVE_PENDING_CIRCLE_420_SUPPORT'
    assert all(usdc['local'][name] is None for name in ['circle_domain','native_usdc','message_transmitter','token_messenger','token_minter','issuer_support_evidence'])
    assert all(not p['active'] for p in usdc['source_peers'].values())
    cadc=read('contracts/config/bridge/cadc.json')
    assert cadc['status']=='CANONICAL_CAD_PENDING_ISSUER_INTEGRATION'
    assert not cadc['destination_420']['mint_authority_420_protocol']
    assert all(not p['active_420_route'] for p in cadc['known_source_deployments'])
    assert record['production_approvals']==[]
    report=read('docs/audit/provider-completion-qualification/RESULTS.json')
    assert report['pass'] and report['production_approvals']==[] and report['totals']['cases_passed']==6
    for run in report['runs']:
        log=(ROOT/run['log']).read_text()
        assert '[FAIL' not in log and len(re.findall(r'^\[PASS\] ',log,re.M))==run['cases_passed']
        inputs=read(run['source_inputs'])
        for path,digest in inputs['source_sha256'].items():
            assert lineage(path,digest),path
    inventory=runpy.run_path(str(ROOT/'scripts/verify-final-verifier-inventory.py'))['check']()
    assert inventory['production_approvals']==0
    return {'pass':True,'new_provider_integration_cases':6,'retained_production_sources_qualified_lineage':True,
            'production_approvals':0,'CADC_active':False,'USDC_active':False,
            'historical_replays_rerun':0,'observations_are_issuer_authorization':False}
if __name__=='__main__':print(json.dumps(check(),indent=2))
