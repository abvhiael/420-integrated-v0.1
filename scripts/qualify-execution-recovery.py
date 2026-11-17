#!/usr/bin/env python3
"""Real patched-Geth and optional production certified-settlement recovery checks.

Reuses node420 and the pinned execution genesis. The real gateway is compiled in
an isolated import closure; a downstream counter is explicitly a test fixture.
Default mode qualifies execution only. --consensus adds the real BLS-verifying
settlement daemon; its separate local producer uses explicitly insecure fixture keys.
Production signing-boundary qualification is not claimed.
"""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import signal
import shlex
import struct
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
GATEWAY = '0x000000000000000000000000000000000000043c'
TARGET = '0x0000000000000000000000000000000000000423'
ZERO = '0x' + '00' * 32
ACTION = '420/SYSCALL/ROTATION_SNAPSHOT/V1'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--consensus', action='store_true', help='qualify the production certified-settlement daemon and signed history')
    p.add_argument('--geth', type=Path, default=ROOT / 'bin/upstream/geth-v1.17.5-420')
    p.add_argument('--solc', default='solc')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--auth-port', type=int, default=8551)
    p.add_argument('--rpc-port', type=int, default=8545)
    a = p.parse_args()
    out = a.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    if (out / 'execution/geth').exists():
        p.error('use a fresh output directory; evidence/data must not be overwritten')
    spec = importlib.util.spec_from_file_location('stake_scope', ROOT / 'scripts/qualify-stake-isolated.py')
    scope = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scope)
    sources = {str(x.relative_to(scope.CONTRACTS)): {'content': x.read_text()}
               for x in scope.closure([scope.CONTRACTS / 'src/system/ConsensusSystemCall420.sol'])}
    sources['RecoveryCounter.sol'] = {'content': '''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
contract RecoveryCounter {
 uint256 public observed;
 event Observed(uint256 value);
 function applyExitNotice(bytes32, uint64 notice) external {
  require(msg.sender == address(0x043c)); require(notice != 999, "injected downstream failure"); observed++; emit Observed(observed);
 }
 function applyRotationSnapshot(uint64 rotation, uint256) external {
  require(msg.sender == address(0x043c));
  require(rotation != 999, "injected downstream failure"); observed++; emit Observed(observed);
 }
}'''}
    settings = {'optimizer': {'enabled': True, 'runs': 200}, 'viaIR': True, 'evmVersion': 'cancun',
                'outputSelection': {'*': {'*': ['abi', 'evm.deployedBytecode', 'evm.methodIdentifiers']}}}
    compiled = subprocess.run([a.solc, '--standard-json'], input=json.dumps({
        'language': 'Solidity', 'sources': sources, 'settings': settings}),
        text=True, capture_output=True, check=True)
    result = json.loads(compiled.stdout)
    errors = [e for e in result.get('errors', []) if e['severity'] == 'error']
    if errors:
        raise RuntimeError(errors)
    gateway = result['contracts']['src/system/ConsensusSystemCall420.sol']['ConsensusSystemCall420']
    fixture = result['contracts']['RecoveryCounter.sol']['RecoveryCounter']
    assert gateway['evm']['methodIdentifiers']['lastSequence()'] == '3bc684e9'
    runtime = bytearray.fromhex(gateway['evm']['deployedBytecode']['object'])
    # Constructor's immutable governance address is materialized for this isolated
    # fixture only. No production genesis or frozen artifact is modified.
    for refs in gateway['evm']['deployedBytecode']['immutableReferences'].values():
        for ref in refs:
            runtime[ref['start']:ref['start'] + ref['length']] = (1).to_bytes(ref['length'], 'big')
    genesis = json.loads((ROOT / 'execution/genesis/execution-genesis.json').read_text())
    genesis['alloc'][GATEWAY[2:]] = {'balance': '0x0', 'code': '0x' + runtime.hex()}
    genesis['alloc'][TARGET[2:]] = {'balance': '0x0', 'code': '0x' + fixture['evm']['deployedBytecode']['object']}
    (out / 'genesis.json').write_text(json.dumps(genesis))
    secret = os.urandom(32)
    (out / 'jwt.hex').write_text(secret.hex())
    wrapper = ROOT / 'bin/node420'
    geth = a.geth.resolve()
    datadir = out / 'execution'
    launcher = out / 'geth-launcher.sh'
    launcher.write_text('#!/bin/sh\nif [ "$1" != version ]; then echo "$$" > '
                        + shlex.quote(str(out / 'geth.pid'))
                        + '; fi\nexec ' + shlex.quote(str(geth)) + ' "$@"\n')
    launcher.chmod(0o700)
    evidence = {'candidate_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                'scope': 'real execution only; no production consensus process or finality qualification',
                'source_sha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in
                    ['execution/patches/apply-420-systemcall.py', 'execution/patches/systemcall420.go.in',
                     'scripts/qualify-execution-recovery.py', 'scripts/settlement_process_scenarios.py',
                     'consensus/recovery/history.go', 'consensus/recovery/settlement.go',
                     'consensus/cmd/fourtwentyd/settlement.go', 'go.mod', 'go.sum']},
                'geth_upstream_commit': '9621c6ad10934a01b5514886fb6fbd87640b6c05',
                'geth_sha256': hashlib.sha256(geth.read_bytes()).hexdigest(),
                'wrapper_sha256': hashlib.sha256(wrapper.read_bytes()).hexdigest(),
                'gateway_selector_from_compiled_method_identifiers': gateway['evm']['methodIdentifiers']['lastSequence()'],
                'genesis_sha256': hashlib.sha256((out / 'genesis.json').read_bytes()).hexdigest(),
                'fixture': 'real ConsensusSystemCall420 with RecoveryCounter downstream test double',
                'processes': [], 'scenarios': [], 'pass': False, 'ordinary_rpc_url':f'http://127.0.0.1:{a.rpc_port}'}
    def rpc(method, params, auth=True):
        body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode()
        headers = {'Content-Type': 'application/json'}
        if auth:
            enc = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')
            token = enc(b'{"alg":"HS256","typ":"JWT"}') + b'.' + enc(json.dumps({'iat': int(time.time())}).encode())
            headers['Authorization'] = 'Bearer ' + (token + b'.' + enc(hmac.new(secret, token, hashlib.sha256).digest())).decode()
        port = a.auth_port if auth else a.rpc_port
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(urllib.request.Request('http://127.0.0.1:' + str(port), body, headers), timeout=15) as response:
            r = json.load(response)
        if r.get('error'):
            raise RuntimeError(r['error'])
        return r['result']
    proc = None
    handles = []
    evidence['scope'] = 'production certified consensus settlement with BLS/QC/PoP and real execution processes; downstream fixture' if a.consensus else evidence['scope']
    def start(directory=None):
        nonlocal proc
        log = (out / ('execution-' + str(len(evidence['processes'])) + '.log')).open('w')
        handles.append(log)
        (out / 'geth.pid').unlink(missing_ok=True)
        proc = subprocess.Popen([str(wrapper), '--geth', str(launcher), '--datadir', str(directory or datadir),
            '--jwt-secret', str(out / 'jwt.hex'), '--authrpc.port', str(a.auth_port),
            '--http.port', str(a.rpc_port), '--port', '0', '--', '--ipcdisable', '--nodiscover', '--maxpeers', '0'],
            cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        record = {'wrapper_pid': proc.pid}
        evidence['processes'].append(record)
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError('execution exited: ' + str(proc.returncode))
            try:
                assert rpc('eth_chainId', []) == ('0x1a5' if directory else '0x1a4')
                record['geth_pid'] = int((out / 'geth.pid').read_text().strip())
                assert record['geth_pid'] != proc.pid, 'wrapper/Geth are not separate processes'
                return
            except (OSError, RuntimeError) as error:
                last_error = error
                time.sleep(.1)
        raise RuntimeError('execution readiness timeout: ' + str(last_error))
    def stop(abrupt=False):
        nonlocal proc
        if proc and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL if abrupt else signal.SIGTERM)
            proc.wait(timeout=20)
        proc = None
    def block():
        return rpc('eth_getBlockByNumber', ['latest', False])
    def read(address, selector, b):
        # Both the number/hash match and the actual read's canonical EIP-1898 pin
        # are asserted, using real execution responses rather than RPC fixtures.
        assert rpc('eth_getBlockByNumber', [b['number'], False])['hash'] == b['hash']
        word = rpc('eth_call', [{'to': address, 'data': '0x' + selector},
                    {'blockHash': b['hash'], 'requireCanonical': True}])
        assert len(word) == 66 and word.startswith('0x')
        return int(word, 16)
    seq_selector = gateway['evm']['methodIdentifiers']['lastSequence()']
    counter_selector = fixture['evm']['methodIdentifiers']['observed()']
    def snapshot():
        b = block()
        return {'number': b['number'], 'hash': b['hash'], 'root': b['extraData'],
                'sequence': read(GATEWAY, seq_selector, b), 'observed': read(TARGET, counter_selector, b)}
    def batch(parent, previous, rotations):
        n = int(parent['number'], 16) + 1
        calls = []
        for i, rotation in enumerate(rotations):
            data = fixture['evm']['methodIdentifiers']['applyRotationSnapshot(uint64,uint256)'] + f'{rotation:064x}' + f'{15:064x}'
            calls.append({'sequence': hex(previous + i + 1), 'executionBlock': hex(n), 'parentHash': parent['hash'],
                'chainId': '0x1a4', 'action': ACTION, 'target': TARGET, 'payload': '0x' + data})
        u = lambda n: struct.pack('>Q', n)
        v = lambda b: u(len(b)) + b
        raw = v(b'420/CONSENSUS_SYSTEM_CALL_BATCH/V1') + u(420) + u(n) + bytes.fromhex(parent['hash'][2:]) + u(len(calls))
        for c in calls:
            raw += u(int(c['sequence'],16)) + u(n) + bytes.fromhex(parent['hash'][2:]) + u(420) + v(ACTION.encode()) + bytes.fromhex(TARGET[2:]) + v(bytes.fromhex(c['payload'][2:]))
        return {'executionBlock': hex(n), 'parentHash': parent['hash'], 'chainId': '0x1a4',
                'calls': calls, 'batchRoot': '0x' + hashlib.sha256(raw).hexdigest()}
    def stage(b):
        s = rpc('engine420_submitSystemCallsV1', [b])
        assert s['status'] == 'ACCEPTED' and s['batchRoot'] == b['batchRoot'], s
    def build(parent, b):
        stage(b)
        state = {'headBlockHash': parent['hash'], 'safeBlockHash': parent['hash'], 'finalizedBlockHash': genesis_hash}
        attrs = {'timestamp': hex(int(parent['timestamp'],16) + 12), 'prevRandao': ZERO,
                 'suggestedFeeRecipient': TARGET, 'withdrawals': [], 'parentBeaconBlockRoot': ZERO}
        fcu = rpc('engine_forkchoiceUpdatedV3', [state, attrs])
        assert fcu['payloadStatus']['status'] == 'VALID' and fcu['payloadStatus']['latestValidHash'] == parent['hash'], fcu
        payload = rpc('engine_getPayloadV3', [fcu['payloadId']])['executionPayload']
        assert payload['extraData'] == b['batchRoot'] and payload['parentHash'] == parent['hash']
        return payload
    def accept(payload):
        status = rpc('engine_newPayloadV3', [payload, [], ZERO])
        assert status['status'] == 'VALID' and status['latestValidHash'] == payload['blockHash'], status
        fcu = rpc('engine_forkchoiceUpdatedV3', [{'headBlockHash': payload['blockHash'],
              'safeBlockHash': payload['blockHash'], 'finalizedBlockHash': genesis_hash}, None])
        assert fcu['payloadStatus']['status'] == 'VALID', fcu
    try:
        with (out / 'init.log').open('w') as log:
            subprocess.run([str(wrapper), '--geth', str(geth), '--datadir', str(datadir),
                            '--init-genesis', str(out / 'genesis.json')], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
        start()
        genesis_hash = block()['hash']
        if a.consensus:
            subprocess.run(['go','build','-tags','blst','-o',str(ROOT/'bin/indexer420'),'./indexer/cmd/indexer420'],cwd=ROOT,check=True)
            scenario_spec = importlib.util.spec_from_file_location('settlement_scenarios', ROOT / 'scripts/settlement_process_scenarios.py')
            scenarios = importlib.util.module_from_spec(scenario_spec); scenario_spec.loader.exec_module(scenarios)
            scenarios.qualify(ROOT, out, evidence, rpc, snapshot, start, stop, genesis_hash, block()['timestamp'], a.auth_port)
            evidence['pass'] = True
            print(json.dumps(evidence, indent=2)); return
        initial = snapshot()
        assert initial['sequence'] == initial['observed'] == 0
        b = batch(block(), 0, [1, 2])
        accepted_payload = build(block(), b)
        accept(accepted_payload)
        (out / 'canonical-fixture-evidence.json').write_text(json.dumps({
            'batch': b, 'payload': accepted_payload,
            'authority': 'local integration fixture; NOT verified production consensus history'}, indent=2))
        before = snapshot()
        native_before = rpc('engine420_getSystemCallLogsV1', [before['hash']])
        assert native_before['batchRoot'] == b['batchRoot'] and len(native_before['logs']) == 4
        assert [int(x['data'],16) for x in native_before['logs'] if x['address'].lower() == TARGET] == [1,2]
        assert before['sequence'] == before['observed'] == 2 and before['root'] == b['batchRoot']
        evidence['scenarios'].append({'name': 'real native multi-call batch', 'before': initial, 'after': before})
        # Build, but do not import, the next batch. Staging/payload caches must
        # disappear on process death; deterministic canonical evidence rebuilds it.
        parent = block()
        staged = batch(parent, 2, [3])
        first_payload = build(parent, staged)
        assert snapshot() == before, 'building advanced canonical effects'
        stop(abrupt=True)
        start()
        restarted = snapshot()
        # Upstream path-state storage can rewind an unflushed head after SIGKILL.
        # Reconstruct from retained fixture evidence, never from an RPC-selected
        # replacement hash. A production caller needs verified consensus history.
        if restarted != before:
            assert restarted == initial, 'unexpected execution recovery checkpoint'
            stage(b)
            accept(accepted_payload)
        assert snapshot() == before, 'canonical reconstruction repeated or lost effects'
        assert rpc('engine420_getSystemCallLogsV1',[before['hash']]) == native_before, 'native evidence changed across restart'
        second_payload = build(parent, staged)
        assert first_payload['blockHash'] == second_payload['blockHash'], 'restaged payload changed'
        accept(second_payload)
        after = snapshot()
        assert after['sequence'] == after['observed'] == 3
        evidence['scenarios'].append({'name': 'SIGKILL execution restart and deterministic restaging',
            'before': before, 'immediate_restart': restarted,
            'required_canonical_replay': restarted != before, 'after': after})
        # First call succeeds, second reverts inside the real Solidity gateway.
        # Payload construction must fail and leave both canonical stores intact.
        failed_batch = batch(block(), 3, [4, 999])
        try:
            build(block(), failed_batch)
        except RuntimeError as error:
            rejection = str(error)
        else:
            raise AssertionError('failed later call produced an accepted payload')
        assert snapshot() == after, 'partial batch leaked into canonical state'
        stop(abrupt=True)
        start()
        if snapshot() != after:
            # The prior successfully settled block may also need reconstruction.
            stage(b)
            accept(accepted_payload)
            stage(staged)
            accept(second_payload)
        assert snapshot() == after, 'partial effects persisted across crash'
        # Same deterministic rejected evidence remains rejected after restaging.
        try:
            build(block(), failed_batch)
        except RuntimeError:
            pass
        else:
            raise AssertionError('rejected batch became valid after restart')
        assert snapshot() == after
        evidence['scenarios'].append({'name': 'later-call rejection and restart atomicity', 'rejection': rejection, 'before': after, 'after': snapshot()})
        evidence['native_log_archive'] = {'before':native_before,'after_restart':rpc('engine420_getSystemCallLogsV1',[before['hash']]),'authenticated':True}
        evidence['pass'] = True
    finally:
        stop()
        for h in handles:
            h.close()
        (out / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    main()
