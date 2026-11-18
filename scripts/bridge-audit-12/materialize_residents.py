#!/usr/bin/env python3
"""Generate or verify the permanent artifacts for the active Genesis commitment."""
import argparse
import gzip
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile

from eth_hash.auto import keccak

import qualify_v2 as qualification

v = qualification.v
p = v.p
prepare = v.module('prepare_residents', v.HERE / 'prepare.py')
ARCHIVE_NAME = 'native-rehearsal-14464554916.zip'
ARCHIVE_SHA = '3ab285049bc52c20458d503ddef39a6059e9942c097c1b6657eef69065c4f604'
ARCHIVE_HEAD = '032f1bfa59e97436d6083b1f638a68eb00c7cc21'
ARCHIVE_RUN = 44385260069


def git(*args):
    return subprocess.check_output(['git', *args], cwd=p.ROOT)


def load(path):
    return json.loads(path.read_bytes())


def code_hash(code):
    return '0x' + keccak(bytes.fromhex(code.removeprefix('0x'))).hex()


def constructor_inventory(frozen_addresses, materialized):
    """Account for direct global-commitment constructors and their address policy."""
    paths = git('ls-files', '-z', 'contracts/src').decode().split('\0')
    consumers = {}
    for path in filter(lambda name: name.endswith('.sol'), paths):
        source = (p.ROOT / path).read_text()
        if re.search(r'\bGenesisResidentAccess420\s*\(', source):
            consumers[Path(path).stem] = path
    fixed = {name for name in consumers if name in frozen_addresses}
    assert fixed == set(v.s.FROZEN) | {'VerifiedGateway420'}, 'fixed resident inventory drift'
    assert set(materialized) <= set(consumers), 'unclassified materialized resident'
    reserved = {entry['name']: entry['address'] for entry in load(
        p.ROOT / 'contracts/config/genesis-address-namespace.json'
    )['activeNonPredeployReservations']}
    return {
        name: {
            'source': path,
            'source_sha256': p.sha((p.ROOT / path).read_bytes()),
            'fixed_address': frozen_addresses.get(name),
            'candidate_reservation': reserved.get(name),
            'materialized': name in materialized,
        }
        for name, path in sorted(consumers.items())
    }


def verify_retained_archive(archive_path, commitment, payloads, records):
    assert p.sha(archive_path.read_bytes()) == ARCHIVE_SHA, 'historical native archive digest'
    subprocess.run(['git', 'merge-base', '--is-ancestor', ARCHIVE_HEAD, 'HEAD'], cwd=p.ROOT, check=True)
    frozen_path = 'contracts/config/genesis-config-commitment.json'
    assert json.loads(git('show', f'{ARCHIVE_HEAD}:{frozen_path}')) == commitment
    with ZipFile(archive_path) as archive:
        def member(name):
            return json.loads(archive.read(name))

        assert archive.read('genesis-config-commitment-v3.json') == git('show', f'{ARCHIVE_HEAD}:{frozen_path}')
        derived = member('pay-derived.json')
        assert derived == v.pay.derive(), 'retained Pay compiler or runtime identity drift'
        prior = member('resident-rehearsal/RESULTS.json')
        assert prior['pass'] and prior['chain_id'] == 31337 and prior['count'] == 13
        assert prior['genesis_config_hash'] == commitment['genesisConfigHash']
        for path, digest in prior['source_sha256'].items():
            assert p.sha(git('show', f'{ARCHIVE_HEAD}:{path}')) == digest, f'archive source identity: {path}'
        current = {record['name']: record for record in records}
        previous = {record['name']: record for record in prior['affected_retained_runtimes']}
        assert set(previous) == set(current), 'retained resident inventory'
        for name, record in previous.items():
            for key in ('runtime_code_hash', 'runtime_bytes', 'frozen_address', 'compiler_artifact_sha256'):
                assert record[key] == current[name][key], f'retained {name} {key}'
        for name in v.s.FROZEN:
            assert member(f'{name}-predeploy-state.json') == load(v.s.PREDEPLOY_DIR / f'{name}-predeploy-state.json')
        assert member('bridge-canonical/VerifiedGateway420.json') == payloads['VerifiedGateway420']['compiler_artifact']
        bridge = member('bridge-rehearsal/RESULTS.json')
        assert bridge['pass'] and len(bridge['deployments']) == 11 and len(bridge['checks']) == 7
        assert bridge['production_approvals'] == []


def materialize(bridge_package, anvil, output, write):
    subprocess.run(['python3', 'scripts/verify-genesis-config-commitment.py'], cwd=p.ROOT, check=True)
    commitment, drift = p.commitment()
    assert not drift, 'frozen authority drift'
    version = commitment['commitmentPayload']['domain'].rsplit('/', 1)[-1].lower()
    destination = p.ROOT / 'contracts/artifacts/genesis-residents' / version
    for path, expected in v.derive().items():
        assert load(path) == expected, f'committed deployment input drift: {path}'
    payloads = {}
    compiler_input = bridge_package / 'compiler-input.json'
    inputs = load(compiler_input)
    registry = load(bridge_package / 'artifacts/ProtocolRegistry.json')
    bridge_manifest = load(bridge_package / 'manifest.json')
    assert p.sha(compiler_input.read_bytes()) == bridge_manifest['compiler_input_sha256']
    assert inputs['settings'] == bridge_manifest['settings']
    assert inputs['settings']['evmVersion'] == 'cancun'
    assert inputs['settings']['viaIR'] is True
    assert inputs['settings']['optimizer'] == {'enabled': True, 'runs': 200}
    for path, source in inputs['sources'].items():
        digest = p.sha(source['content'].encode())
        assert digest == bridge_manifest['sources'][path] == p.sha((p.ROOT / path).read_bytes())
    registry_record, = (entry for entry in bridge_manifest['contracts'] if entry['name'] == 'ProtocolRegistry')
    assert p.sha(p.dump(registry).encode()) == registry_record['artifact_sha256'], 'Registry compiler artifact drift'
    result = qualification.run(anvil, output / 'resident-rehearsal', payloads, registry)
    gateway_dir = output / 'bridge-canonical'
    prepare.prepare(bridge_package, anvil, gateway_dir)
    prepare.check_committed(gateway_dir)
    gateway = load(gateway_dir / 'VerifiedGateway420.json')
    state = load(gateway_dir / 'VerifiedGateway420-predeploy-state.json')
    payloads['VerifiedGateway420'] = {
        'compiler_artifact': gateway,
        'constructor_arguments': list(state['constructor'][key] for key in
                                      ('governanceTimelock', 'registry', 'genesisConfigHash', 'verifier')),
        'constructor_storage': state['storage'],
        'runtime_bytecode': gateway['deployedBytecode']['object'],
    }
    expected_solc = '0.8.24+commit.e11b9ed9'
    compiler = v.pay.compiler_record()
    assert expected_solc in bridge_manifest['compiler']
    for name, payload in payloads.items():
        raw = payload['compiler_artifact']
        if name == 'VerifiedGateway420':
            assert raw['compiler'] == expected_solc
            continue
        metadata = raw.pop('metadata')
        assert metadata['compiler']['version'] == expected_solc
        settings = metadata['settings']
        assert settings['evmVersion'] == compiler['evmVersion']
        assert settings['viaIR'] is compiler['viaIR']
        assert settings['optimizer'] == {'enabled': compiler['optimizer'], 'runs': compiler['optimizerRuns']}
        payload['compiler_artifact'] = {key: raw[key] for key in ('abi', 'bytecode', 'deployedBytecode', 'storageLayout')}
    if version == 'v3':
        verify_retained_archive(destination / ARCHIVE_NAME, commitment, payloads, result['affected_retained_runtimes'])
    inventory = constructor_inventory(p.namespace(), payloads)
    assert len(payloads) == 14
    bundle = (json.dumps(payloads, separators=(',', ':'), sort_keys=True) + '\n').encode()
    manifest = {
        'schema': '420-genesis-resident-materialization-v1',
        'genesis_config_hash': commitment['genesisConfigHash'],
        'configuration_version': version,
        'compiler': compiler,
        'bundle': 'contracts.json.gz',
        'bundle_content_sha256': p.sha(bundle),
        'authority_inputs': commitment['commitmentPayload']['authorityInputs'],
        'deployment_input_records': [
            'contracts/config/pay/pay-audit-6-deployment-package.json',
            'contracts/config/predeploy/predeploy-plan.json',
            'contracts/config/deployment-manifest.json',
            'contracts/config/swap/swap-audit-7-deployment-binding.json',
        ],
        'pay_swap_source_sha256': result['source_sha256'],
        'qualification': {
            'chain_id': result['chain_id'],
            'constructor_comparisons': len(payloads),
            'registry_registration': 'empty at construction',
            'governance_checks': ['unauthorized caller rejected', 'timelock without Registry authority rejected'],
            'gateway_verifier': state['constructor']['verifier'],
        },
        'constructor_inventory': inventory,
        'residents': {
            name: {
                'address': inventory[name]['fixed_address'],
                'constructor_arguments': payload['constructor_arguments'],
                'runtime_code_hash': code_hash(payload['runtime_bytecode']),
                'runtime_bytes': (len(payload['runtime_bytecode']) - 2) // 2,
            } for name, payload in sorted(payloads.items())
        },
        'production_approvals': [],
    }
    if version == 'v3':
        manifest['retained_rehearsal'] = {
            'file': ARCHIVE_NAME, 'sha256': ARCHIVE_SHA, 'head': ARCHIVE_HEAD,
            'workflow_run': ARCHIVE_RUN, 'artifact_id': 14464554916,
        }
    if write:
        destination.mkdir(parents=True, exist_ok=True)
        with (destination / 'contracts.json.gz').open('wb') as stream:
            with gzip.GzipFile(fileobj=stream, mode='wb', filename='', mtime=0) as zipped:
                zipped.write(bundle)
        p.write(destination / 'manifest.json', manifest)
    assert load(destination / 'manifest.json') == manifest, 'resident materialization manifest drift'
    assert gzip.decompress((destination / 'contracts.json.gz').read_bytes()) == bundle, 'resident bundle drift'
    print(json.dumps({'pass': True, 'materialized': len(payloads), 'constructor_consumers': len(inventory)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bridge-package', type=Path, required=True)
    parser.add_argument('--anvil', required=True)
    parser.add_argument('--output', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    materialize(args.bridge_package, args.anvil, args.output, args.write)
