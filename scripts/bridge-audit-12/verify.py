#!/usr/bin/env python3
"""Verify retained deployment/compiler/source evidence at the checked-out head.
Does not re-execute passing historical suites or turn freeze drift into a pass.
"""
import gzip,hashlib,importlib.util,json,tarfile
from pathlib import Path
from eth_hash.auto import keccak
spec=importlib.util.spec_from_file_location('package12',Path(__file__).with_name('package.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
EVIDENCE=p.ROOT/'docs/audit/bridge-deployment-qualification'
def main():
    for line in (EVIDENCE/'SHA256SUMS').read_text().splitlines():
        digest,path=line.split('  ',1);assert p.sha((p.ROOT/path).read_bytes())==digest,'retained file drift: '+path
    with tarfile.open(EVIDENCE/'package.tar.gz','r:gz') as archive:
        def read(name):
            member=archive.getmember(name);assert member.isfile();return archive.extractfile(member).read()
        manifest=json.loads(read('manifest.json'));request=json.loads(read('compiler-input.json'))
        assert p.sha(read('compiler-input.json'))==manifest['compiler_input_sha256']
        assert p.sha(read('configuration.json'))==manifest['configuration_sha256']
        for path,expected in manifest['sources'].items():
            assert p.sha((p.ROOT/path).read_bytes())==expected,'compiled source drift: '+path
            assert p.sha(request['sources'][path]['content'].encode())==expected
        for rec in manifest['contracts']:
            a=json.loads(read('artifacts/'+rec['name']+'.json'));assert p.sha(p.dump(a).encode())==rec['artifact_sha256']
            assert len(a['evm']['deployedBytecode']['object'])//2==rec['runtime_bytes']<=24576
            assert not a['evm']['bytecode']['linkReferences'] and not a['evm']['deployedBytecode']['linkReferences']
        assert {x['name'] for x in manifest['contracts'] if x['classification']=='core'}==set(p.CORE)
        assert {x['name'] for x in manifest['contracts'] if x['classification']=='legacy_disabled'}==p.LEGACY
        template=json.loads(read('artifacts/VerifiedGateway420.json'))
    p.namespace();state=json.loads((EVIDENCE/'canonical/VerifiedGateway420-predeploy-state.json').read_text());materialized=json.loads((EVIDENCE/'canonical/VerifiedGateway420.json').read_text())
    expected=bytearray.fromhex(template['evm']['deployedBytecode']['object'])
    assert set(state['immutable_values'])==set(template['evm']['deployedBytecode']['immutableReferences'])
    for identity,locations in template['evm']['deployedBytecode']['immutableReferences'].items():
        word=bytes.fromhex(state['immutable_values'][identity][2:]);assert len(word)==32
        for location in locations:
            assert location['length']==32;expected[location['start']:location['start']+32]=word
    assert materialized['deployedBytecode']['object']=='0x'+expected.hex()
    assert state['runtimeCodeHash']=='0x'+keccak(expected).hex()
    assert state['storage']=={} and all(int(value,16)==0 for value in state['checked_zero_slots'].values())
    assert state['constructor']['verifier']=='0x'+'00'*20 and state['constructor']['registry']==p.REGISTRY
    report=json.loads((EVIDENCE/'rehearsal/RESULTS.json').read_text());assert report['pass'] and len(report['deployments'])==11 and len(report['checks'])==7 and report['production_approvals']==[]
    assert report['package_manifest_sha256']==p.sha(read_manifest(EVIDENCE/'package.tar.gz'))
    plan=json.loads((EVIDENCE/'rehearsal/unsigned-plan.json').read_text());assert not plan['routes_active'] and plan['production_approvals']==[]
    for step in plan['steps']:assert step['name'] not in p.LEGACY
    predeploy=json.loads((p.ROOT/'contracts/config/predeploy/storage-init.json').read_text());assert predeploy['bridge_verifier']=='0x'+'00'*20
    assert predeploy['entries']['VerifiedGateway420']['constructor']==['governance_timelock','protocol_registry','genesis_config_hash','bridge_verifier']
    frozen,drift=p.commitment();assert not drift and state['current_authority_drift']==[]
    assert state['deployment_ready'] and state['constructor']['genesisConfigHash']==p.CONFIG_HASH
    assert json.loads((p.ROOT/'contracts/artifacts/VerifiedGateway420.json').read_text())==materialized
    assert json.loads((p.ROOT/'contracts/config/predeploy/VerifiedGateway420-predeploy-state.json').read_text())==state
    assert plan['parameters']['genesis_config_hash']==p.CONFIG_HASH
    residents=json.loads((EVIDENCE/'v2-residents/RESULTS.json').read_text())
    assert residents['pass'] and residents['count']==13 and residents['genesis_config_hash']==p.CONFIG_HASH
    for path,expected in residents['source_sha256'].items():assert p.sha((p.ROOT/path).read_bytes())==expected,'V2 source drift: '+path
    pay=json.loads((p.ROOT/'contracts/config/pay/pay-audit-6-deployment-package.json').read_text())
    pay_records={x['contract']:x for x in pay['residents']}
    with tarfile.open(EVIDENCE/'v2-residents/compiler-artifacts.tar.gz','r:gz') as archive:
        for rec in residents['affected_retained_runtimes']:
            raw=json.loads(archive.extractfile(rec['name']+'.json').read())
            assert p.sha(p.dump(raw).encode())==rec['compiler_artifact_sha256'],'V2 compiler artifact drift'
            if rec['name'] in pay_records:expected=pay_records[rec['name']]['runtime_code_hash']
            else:
                swap=json.loads((p.ROOT/'contracts/config/predeploy'/f"{rec['name']}-predeploy-state.json").read_text())
                expected=swap['runtimeCodeHash'];assert swap['constructorMaterialization']['genesisConfigHash']==p.CONFIG_HASH
                assert expected=='0x'+keccak(bytes.fromhex(swap['runtimeBytecode'][2:])).hex()
            assert expected==rec['runtime_code_hash'],'V2 retained runtime drift'
    for key in ['predeploys','contracts']:
        f='predeploy/predeploy-plan.json' if key=='predeploys' else 'deployment-manifest.json'
        entry=next(x for x in json.loads((p.ROOT/'contracts/config'/f).read_text())[key] if x['name']=='VerifiedGateway420')
        assert entry['runtime_code_hash']==state['runtimeCodeHash'] and entry['artifact_status']=='BRIDGE_AUDIT_12_ARTIFACT_READY'
    test_sources=json.loads((EVIDENCE/'v2-residents/pay-test-source-sha256.json').read_text())
    for path,expected in test_sources.items():assert p.sha((p.ROOT/path).read_bytes())==expected,'Pay qualification source drift: '+path
    print(json.dumps({'package_integrity_pass':True,'artifacts':len(manifest['contracts']),'compiled_sources':len(manifest['sources']),'rehearsal_checks':7,'core_deployments':11,'v2_affected_resident_comparisons':13,'frozen_gateway_runtime':state['runtimeCodeHash'],'pretestnet_deployment_package_ready':True,'live_deployment_qualified':False,'pretestnet_blockers':drift,'historical_suites_rerun':False},indent=2))
def read_manifest(path):
    with tarfile.open(path,'r:gz') as archive:return archive.extractfile('manifest.json').read()
if __name__=='__main__':main()
