#!/usr/bin/env python3
"""Verify retained V2 deployment/compiler/source evidence against its qualified revision.
Does not re-execute passing historical suites or turn freeze drift into a pass.
"""
import importlib.util,json,subprocess,tarfile
from pathlib import Path
from eth_hash.auto import keccak
spec=importlib.util.spec_from_file_location('package12',Path(__file__).with_name('package.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
EVIDENCE=p.ROOT/'docs/audit/bridge-deployment-qualification'
V2_REVISION = '95f6a94b7c313a14a6689fe754806a88e9bdc95d'
V2_COMMITMENT = 'contracts/config/history/genesis-config-commitment-v2.json'

def qualified_bytes(path):
    return subprocess.check_output(['git', 'show', f'{V2_REVISION}:{path}'], cwd=p.ROOT)

def main():
    for line in (EVIDENCE/'SHA256SUMS').read_text().splitlines():
        digest,path=line.split('  ',1);data = (p.ROOT/path).read_bytes() if (p.ROOT/path).is_relative_to(EVIDENCE) else qualified_bytes(path)
        assert p.sha(data)==digest,'retained file drift: '+path
    with tarfile.open(EVIDENCE/'package.tar.gz','r:gz') as archive:
        def read(name):
            member=archive.getmember(name);assert member.isfile();return archive.extractfile(member).read()
        manifest=json.loads(read('manifest.json'));request=json.loads(read('compiler-input.json'))
        assert p.sha(read('compiler-input.json'))==manifest['compiler_input_sha256']
        assert p.sha(read('configuration.json'))==manifest['configuration_sha256']
        for path,expected in manifest['sources'].items():
            assert p.sha(qualified_bytes(path))==expected,'compiled source drift: '+path
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
    predeploy=json.loads(qualified_bytes('contracts/config/predeploy/storage-init.json'));assert predeploy['bridge_verifier']=='0x'+'00'*20
    assert predeploy['entries']['VerifiedGateway420']['constructor']==['governance_timelock','protocol_registry','genesis_config_hash','bridge_verifier']
    retained = (p.ROOT/V2_COMMITMENT).read_bytes()
    assert retained == qualified_bytes('contracts/config/genesis-config-commitment.json')
    frozen = json.loads(retained)
    config_hash = frozen['genesisConfigHash']
    payload = frozen['commitmentPayload']
    assert frozen['status'] == 'FROZEN_V2' and payload['domain'] == '420/GENESIS/CONFIG/V2'
    assert config_hash == '0x'+keccak(json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hex()
    for entry in payload['authorityInputs']:
        blob = subprocess.check_output(['git', 'rev-parse', f"{V2_REVISION}:{entry['path']}"], cwd=p.ROOT, text=True).strip()
        assert blob == entry['gitBlobSha1']
    assert state['current_authority_drift']==[]
    assert state['deployment_ready'] and state['constructor']['genesisConfigHash']==config_hash
    assert json.loads(qualified_bytes('contracts/artifacts/VerifiedGateway420.json'))==materialized
    assert json.loads(qualified_bytes('contracts/config/predeploy/VerifiedGateway420-predeploy-state.json'))==state
    assert plan['parameters']['genesis_config_hash']==config_hash
    residents=json.loads((EVIDENCE/'v2-residents/RESULTS.json').read_text())
    assert residents['pass'] and residents['count']==13 and residents['genesis_config_hash']==config_hash
    for path,expected in residents['source_sha256'].items():assert p.sha(qualified_bytes(path))==expected,'V2 source drift: '+path
    pay=json.loads(qualified_bytes('contracts/config/pay/pay-audit-6-deployment-package.json'))
    pay_records={x['contract']:x for x in pay['residents']}
    with tarfile.open(EVIDENCE/'v2-residents/compiler-artifacts.tar.gz','r:gz') as archive:
        for rec in residents['affected_retained_runtimes']:
            raw=json.loads(archive.extractfile(rec['name']+'.json').read())
            assert p.sha(p.dump(raw).encode())==rec['compiler_artifact_sha256'],'V2 compiler artifact drift'
            if rec['name'] in pay_records:expected=pay_records[rec['name']]['runtime_code_hash']
            else:
                swap=json.loads(qualified_bytes(f"contracts/config/predeploy/{rec['name']}-predeploy-state.json"))
                expected=swap['runtimeCodeHash'];assert swap['constructorMaterialization']['genesisConfigHash']==config_hash
                assert expected=='0x'+keccak(bytes.fromhex(swap['runtimeBytecode'][2:])).hex()
            assert expected==rec['runtime_code_hash'],'V2 retained runtime drift'
    for key in ['predeploys','contracts']:
        f='predeploy/predeploy-plan.json' if key=='predeploys' else 'deployment-manifest.json'
        entry=next(x for x in json.loads(qualified_bytes('contracts/config/'+f))[key] if x['name']=='VerifiedGateway420')
        assert entry['runtime_code_hash']==state['runtimeCodeHash'] and entry['artifact_status']=='BRIDGE_AUDIT_12_ARTIFACT_READY'
    test_sources=json.loads((EVIDENCE/'v2-residents/pay-test-source-sha256.json').read_text())
    for path,expected in test_sources.items():assert p.sha(qualified_bytes(path))==expected,'Pay qualification source drift: '+path
    print(json.dumps({'package_integrity_pass':True,'artifacts':len(manifest['contracts']),'compiled_sources':len(manifest['sources']),'rehearsal_checks':7,'core_deployments':11,'v2_affected_resident_comparisons':13,'frozen_gateway_runtime':state['runtimeCodeHash'],'v2_qualification_revision':V2_REVISION,'historical_pretestnet_deployment_package_ready':True,'live_deployment_qualified':False,'historical_suites_rerun':False},indent=2))
def read_manifest(path):
    with tarfile.open(path,'r:gz') as archive:return archive.extractfile('manifest.json').read()
if __name__=='__main__':main()
