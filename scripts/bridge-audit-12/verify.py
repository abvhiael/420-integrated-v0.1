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
    frozen=json.loads((p.ROOT/'contracts/config/genesis-config-commitment.json').read_text());assert frozen['genesisConfigHash']=='0x'+keccak(json.dumps(frozen['commitmentPayload'],sort_keys=True,separators=(',',':')).encode()).hex()
    import subprocess
    drift=[x['path'] for x in frozen['commitmentPayload']['authorityInputs'] if subprocess.check_output(['git','hash-object',x['path']],cwd=p.ROOT,text=True).strip()!=x['gitBlobSha1']]
    assert drift==[x['path'] for x in state['current_authority_drift']],'authority conflict evidence drift'
    assert not state['deployment_ready'] and len(drift)==2
    print(json.dumps({'package_integrity_pass':True,'artifacts':len(manifest['contracts']),'compiled_sources':len(manifest['sources']),'rehearsal_checks':7,'core_deployments':11,'frozen_gateway_runtime':state['runtimeCodeHash'],'production_deployment_ready':False,'pretestnet_blockers':drift,'historical_suites_rerun':False},indent=2))
def read_manifest(path):
    with tarfile.open(path,'r:gz') as archive:return archive.extractfile('manifest.json').read()
if __name__=='__main__':main()
