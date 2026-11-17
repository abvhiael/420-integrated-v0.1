"""Process scenarios called by the existing real-execution qualification owner.

Only this LOCAL producer holds known fixture keys. fourtwentyd receives public
keys/PoPs and real quorum signatures through its production certified ingress.
"""
import hashlib
import json
import os
from pathlib import Path
import queue
import shutil
import signal
import subprocess
import threading
import time


def qualify(root, out, evidence, rpc, snapshot, start_execution, stop_execution, genesis_hash, timestamp, auth_port):
    zero = '0x' + '00' * 32
    producer = root / 'bin/settlement-fixture'
    daemon = root / 'bin/fourtwentyd'
    fault_daemon = root / 'bin/fourtwentyd-recovery-fault'
    for label, binary in [('consensus', daemon), ('instrumented_consensus', fault_daemon), ('fixture_producer', producer)]:
        evidence[label + '_sha256'] = hashlib.sha256(binary.read_bytes()).hexdigest()
    trust = json.loads(subprocess.check_output([str(producer), '--genesis', genesis_hash, '--timestamp', timestamp], text=True))
    trust_path = out / 'trust.json'
    trust_path.write_text(json.dumps(trust))
    pin = hashlib.sha256(trust_path.read_bytes()).hexdigest()
    evidence['trust_sha256'] = pin
    evidence['consensus_build_tags'] = 'blst'
    evidence['fault_binary_build_tags'] = 'blst recoveryfault'
    state = out / 'consensus'
    process = None
    messages = queue.Queue()
    all_messages = []
    logs = []
    evidence['consensus_processes'] = []
    number = 0
    def spawn(fault_slot=None, repair=False, directory=None):
        nonlocal process, number, messages
        messages = queue.Queue()
        binary = fault_daemon if fault_slot else daemon
        env = os.environ.copy()
        if fault_slot:
            env['FOURTWENTYD_RECOVERY_STOP_SLOT'] = str(fault_slot)
        errlog = (out / f'consensus-{number}.log').open('w')
        logs.append(errlog)
        number += 1
        command = [str(binary), '--certified-settlement', '--engine', f'http://127.0.0.1:{auth_port}',
                   '--jwt-secret', str(out / 'jwt.hex'), '--settlement-dir', str(directory or state),
                   '--settlement-trust', str(trust_path), '--settlement-trust-sha256', pin]
        if repair:
            command += ['--recover-sequence']
        process = subprocess.Popen(command, cwd=root, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=errlog, text=True, bufsize=1, start_new_session=True)
        evidence['consensus_processes'].append({'pid': process.pid, 'fault_slot': fault_slot, 'repair': repair})
        events = messages
        def consume(stream):
            for line in stream:
                try:
                    event = json.loads(line)
                except ValueError:
                    events.put({'event': 'bad-output', 'error': line})
                else:
                    all_messages.append(event)
                    events.put(event)
        threading.Thread(target=consume, args=(process.stdout,), daemon=True).start()
    def kill_consensus(abrupt=True):
        nonlocal process
        if process and process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL if abrupt else signal.SIGTERM)
            process.wait(timeout=20)
        process = None
    def wait(event, number=None, timeout=35):
        deadline = time.monotonic() + timeout
        seen = []
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise AssertionError(f'consensus exited {process.returncode}; events={seen}')
            try:
                item = messages.get(timeout=.2)
            except queue.Empty:
                continue
            seen.append(item)
            if item['event'] == event:
                if number is None or item.get('status', {}).get('Settlement', {}).get('ExecutionBlock') == number or item.get('slot') == number:
                    return item
        raise AssertionError(f'waiting for {event}/{number}: {seen}')
    def send(record):
        process.stdin.write(json.dumps(record) + '\n')
        process.stdin.flush()
    def checkpoint():
        return json.loads((state / 'checkpoint.json').read_text())
    def cursor():
        return json.loads((state / 'sequence.json').read_text())
    def history():
        return json.loads((state / 'history.json').read_text())
    def produce(parent, previous, slot, calls=1):
        parent_hash = parent['Payload']['blockHash'] if parent else genesis_hash
        number = int(parent['Payload']['blockNumber'], 16) + 1 if parent else 1
        outcomes = {'Rotation': {'Rotation': slot, 'EligibleSnapshot': 15}}
        if calls == 2:
            outcomes['ExitNotices'] = [{'ValidatorID': [1] + [0] * 31, 'NoticeRotation': slot}]
        plan = {'Parent': parent, 'Previous': previous, 'Slot': slot, 'Outcomes': outcomes, 'Beacon': zero,
                'Payload': {'parentHash': parent_hash, 'blockNumber': hex(number)}}
        path = out / f'plan-{slot}-{calls}.json'
        path.write_text(json.dumps(plan))
        batch = json.loads(subprocess.check_output([str(producer), '--batch', '--record', str(path)], text=True))
        staged = rpc('engine420_submitSystemCallsV1', [batch])
        if staged['status'] != 'ACCEPTED':
            staged = rpc('engine420_replaceSystemCallsV1', [batch])
        assert staged['status'] == 'ACCEPTED', staged
        final = rpc('eth_getBlockByNumber', ['finalized', False])
        state_ = {'headBlockHash': parent_hash, 'safeBlockHash': parent_hash, 'finalizedBlockHash': final['hash'] if final else genesis_hash}
        attrs = {'timestamp': hex(int(timestamp,16) + slot * 12), 'prevRandao': batch['batchRoot'],
                 'suggestedFeeRecipient': '0x0000000000000000000000000000000000000423', 'withdrawals': [], 'parentBeaconBlockRoot': zero}
        built = rpc('engine_forkchoiceUpdatedV3', [state_, attrs])
        assert built['payloadStatus']['status'] == 'VALID', built
        assert built.get('payloadId'), built
        payload = rpc('engine_getPayloadV3', [built['payloadId']])['executionPayload']
        assert payload['extraData'] == batch['batchRoot']
        plan['Payload'] = payload
        path.write_text(json.dumps(plan))
        record = json.loads(subprocess.check_output([str(producer), '--record', str(path)], text=True))
        (out / f'certified-{slot}-{calls}.json').write_text(json.dumps(record))
        return record
    def record_scenario(name, before, after, **extra):
        evidence['scenarios'].append(dict(name=name, before=before, after=after, **extra))
    try:
        spawn()
        wait('settled', 0)
        # Prepare a valid competing child before finality advances, retaining it
        # for the later cross-finalized-boundary rejection check.
        cross_final = produce(None, 0, 1, 1)
        first = produce(None, 0, 1, 2)
        send(first)
        wait('settled', 1)
        before = snapshot()
        assert before['sequence'] == before['observed'] == 2
        first_checkpoint = checkpoint()
        kill_consensus()
        spawn()
        wait('settled', 1)
        assert snapshot() == before and checkpoint() == first_checkpoint
        second = produce(first, 2, 2)
        send(second)
        wait('settled', 2)
        after = snapshot()
        assert after['sequence'] == after['observed'] == 3
        record_scenario('production consensus-only SIGKILL/restart and next derivation', before, after)
        before = after
        kill_consensus()
        stop_execution(abrupt=True)
        start_execution()
        spawn()
        wait('settled', 2)
        assert snapshot() == before
        record_scenario('production simultaneous SIGKILL/restart with independent persistent stores', before, snapshot())
        third = produce(second, 3, 3)
        kill_consensus()
        spawn(fault_slot=3)
        wait('settled', 2)
        send(third)
        wait('canonical', 3)
        # The instrumented process SIGSTOPs before journal commit. The harness
        # terminates the actual PID, leaving execution alive on the accepted child.
        accepted = snapshot()
        assert accepted['sequence'] == accepted['observed'] == 4
        assert cursor()['lastSequence'] == 3
        assert checkpoint()['Settlement']['ExecutionBlock'] == 2
        assert history()['Pending'] is not None and len(history()['Entries']) == 2
        kill_consensus()
        spawn()
        wait('settled', 3)
        assert snapshot() == accepted and cursor()['lastSequence'] == 4
        assert history()['Pending'] is None and len(history()['Entries']) == 3
        record_scenario('production consensus killed after canonical acceptance before journal persistence', before, accepted,
                        stale_journal_sequence=3, recovered_journal_sequence=4)
        fourth = produce(third, 4, 4, 2)
        stable = checkpoint()
        stop_execution(abrupt=True)
        send(fourth)
        wait('queued')
        wait('halted')
        assert process.poll() is None and checkpoint() == stable and cursor()['lastSequence'] == 4
        start_execution()
        wait('settled', 4)
        after = snapshot()
        assert after['sequence'] == after['observed'] == 6
        record_scenario('execution-only crash while production consensus stays alive; unavailable execution cannot settle', accepted, after)
        old_cursor = (state / 'sequence.json').read_bytes()
        # The original finalized parent is retained; only its unfinalized child
        # is replaced, with a different batch and gateway sequence.
        os.kill(process.pid, signal.SIGSTOP)
        replacement = produce(third, 4, 4, 1)
        send(replacement)
        os.kill(process.pid, signal.SIGCONT)
        # Wait by root/hash because both candidates have execution number 4.
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            item = wait('settled', 4)
            if item['status']['Settlement']['LastSequence'] == 5:
                break
        else:
            raise AssertionError('replacement not settled')
        replaced = snapshot()
        assert replaced['sequence'] == replaced['observed'] == 5
        assert checkpoint()['Finalized']['Slot'] == 3
        record_scenario('certified bounded replacement restores canonical parent sequence', after, replaced)
        stable = checkpoint()
        send(cross_final)
        rejected = wait('rejected')
        assert 'finalized' in rejected['error']
        assert snapshot() == replaced and checkpoint() == stable and history()['Pending'] is None
        cross_plan = out / 'plan-1-1.json'
        old_batch = json.loads(subprocess.check_output([str(producer), '--batch', '--record', str(cross_plan)], text=True))
        assert rpc('engine420_replaceSystemCallsV1', [old_batch])['status'] == 'INVALID'
        try:
            rpc('eth_call', [{'to': '0x000000000000000000000000000000000000043c', 'data': '0x3bc684e9'}, {'blockHash': fourth['Payload']['blockHash'], 'requireCanonical': True}])
        except RuntimeError:
            pass
        else:
            raise AssertionError('orphan gateway checkpoint accepted as canonical')
        send(replacement)
        assert 'already recorded' in wait('rejected')['error']
        bad = json.loads(json.dumps(replacement))
        bad['Consensus']['header']['Slot'] = 5
        send(bad)
        wait('rejected')
        assert snapshot() == replaced and checkpoint() == stable
        record_scenario('finalized-boundary, duplicate settlement and forged certificate rejection', replaced, snapshot())
        # A stale but otherwise intact orphan cursor cannot silently authorize a
        # reset. Explicit repair is constrained by authenticated history/high-water.
        kill_consensus()
        (state / 'sequence.json').write_bytes(old_cursor)
        spawn()
        wait('halted')
        assert snapshot() == replaced and checkpoint() == stable
        kill_consensus()
        spawn(repair=True)
        wait('settled', 4)
        assert cursor()['lastSequence'] == 5 and snapshot() == replaced
        record_scenario('orphan/stale journal rejected; explicit verified canonical repair', replaced, snapshot())
        kill_consensus()
        (state / 'sequence.json').write_text('{corrupted')
        spawn()
        wait('halted')
        assert snapshot() == replaced
        kill_consensus()
        spawn(repair=True)
        wait('settled', 4)
        assert snapshot() == replaced and cursor()['lastSequence'] == 5
        # Even --recover-sequence cannot compensate for truncated verified history
        # beneath the durable finalized/high-water checkpoint.
        kill_consensus()
        broken = out / 'truncated-consensus'
        shutil.copytree(state, broken)
        h = json.loads((broken / 'history.json').read_text())
        h['Entries'] = h['Entries'][:2]
        h['Checksum'] = ''
        h['Checksum'] = hashlib.sha256(json.dumps(h, separators=(',', ':')).encode()).hexdigest()
        (broken / 'history.json').write_text(json.dumps(h))
        spawn(repair=True, directory=broken)
        assert process.wait(timeout=15) != 0
        logs[-1].flush()
        assert 'history missing durable settled checkpoint' in (out / f'consensus-{number-1}.log').read_text()
        assert snapshot() == replaced
        record_scenario('corrupted cursor and finalized history truncation fail closed', replaced, snapshot())
        spawn()
        wait('settled', 4)
        os.kill(process.pid, signal.SIGSTOP)
        fifth = produce(replacement, 5, 5)
        kill_consensus()
        invalid_state = out / 'invalid-import-consensus'
        shutil.copytree(state, invalid_state)
        settled_bytes = (invalid_state / 'checkpoint.json').read_bytes()
        journal_bytes = (invalid_state / 'sequence.json').read_bytes()
        invalid = json.loads(json.dumps(fifth))
        invalid['Payload']['stateRoot'] = zero
        spawn(directory=invalid_state)
        wait('settled', 4)
        send(invalid)
        wait('queued')
        failed = wait('halted')
        assert 'INVALID' in failed['error'], failed
        send(fifth)
        assert 'restart reconciliation required' in wait('rejected')['error']
        assert failed['status']['Settlement']['ExecutionBlock'] == 4
        assert (invalid_state / 'checkpoint.json').read_bytes() == settled_bytes
        assert (invalid_state / 'sequence.json').read_bytes() == journal_bytes
        assert snapshot() == replaced
        record_scenario('Engine-rejected certified payload cannot advance durable settlement', replaced, snapshot(), error=failed['error'])
        kill_consensus()
        # Import a correctly hashed header whose second native call fails after
        # the first changed its temporary StateDB. RLP is checked against a real
        # valid payload before using RPC Keccak to hash the rejected header.
        parent_header = rpc('eth_getBlockByHash', [replacement['Payload']['blockHash'], False])
        def rlp(value):
            if isinstance(value, list):
                data = b''.join(rlp(v) for v in value)
                if len(data) < 56:
                    return bytes([192 + len(data)]) + data
                n = len(data).to_bytes((len(data).bit_length()+7)//8, 'big')
                return bytes([247+len(n)]) + n + data
            if len(value) == 1 and value[0] < 128:
                return value
            if len(value) < 56:
                return bytes([128+len(value)]) + value
            n = len(value).to_bytes((len(value).bit_length()+7)//8, 'big')
            return bytes([183+len(n)]) + n + value
        def header_hash(payload):
            data = lambda s: bytes.fromhex(s[2:])
            def quantity(s):
                n = int(s, 16)
                return n.to_bytes((n.bit_length()+7)//8, 'big')
            assert payload['transactions'] == [] and payload['withdrawals'] == []
            fields = [data(payload['parentHash']), data(parent_header['sha3Uncles']), data(payload['feeRecipient']),
                      data(payload['stateRoot']), data(parent_header['transactionsRoot']), data(payload['receiptsRoot']),
                      data(payload['logsBloom']), quantity('0x0'), quantity(payload['blockNumber']),
                      quantity(payload['gasLimit']), quantity(payload['gasUsed']), quantity(payload['timestamp']),
                      data(payload['extraData']), data(payload['prevRandao']), data(parent_header['nonce']),
                      quantity(payload['baseFeePerGas']), data(parent_header['withdrawalsRoot']),
                      quantity(payload['blobGasUsed']), quantity(payload['excessBlobGas']), data(zero)]
            return rpc('web3_sha3', ['0x' + rlp(fields).hex()], auth=False)
        assert header_hash(fifth['Payload']) == fifth['Payload']['blockHash'], 'header encoder differs from real Engine'
        plan = json.loads((out / 'plan-5-1.json').read_text())
        plan['Outcomes']['ExitNotices'] = [{'ValidatorID': [1]+[0]*31, 'NoticeRotation': 999}]
        bad_plan = out / 'plan-invalid-native-import.json'
        bad_plan.write_text(json.dumps(plan))
        wire = json.loads(subprocess.check_output([str(producer), '--batch', '--record', str(bad_plan)], text=True))
        plan['Payload']['extraData'] = wire['batchRoot']
        plan['Payload']['blockHash'] = header_hash(plan['Payload'])
        bad_plan.write_text(json.dumps(plan))
        bad_record = json.loads(subprocess.check_output([str(producer), '--record', str(bad_plan)], text=True))
        native_state = out / 'native-failure-consensus'
        shutil.copytree(state, native_state)
        stable_native = (native_state / 'checkpoint.json').read_bytes()
        spawn(directory=native_state)
        wait('settled', 4)
        send(bad_record)
        wait('queued')
        native_rejection = wait('halted')
        assert '420 system call sequence 7: execution reverted' in native_rejection['error'], native_rejection
        assert snapshot() == replaced and (native_state / 'checkpoint.json').read_bytes() == stable_native
        kill_consensus()
        record_scenario('real block import rejects a failed later native call without partial settlement', replaced, snapshot(), error=native_rejection['error'])
        # Reuse an already applied sequence in the *next* execution block. The
        # actual gateway must reject it, independently of the consensus decoder.
        try:
            produce(replacement, 4, 5)
        except RuntimeError as error:
            assert 'execution reverted' in str(error), error
        else:
            raise AssertionError('native system call replay accepted')
        assert snapshot() == replaced
        record_scenario('real native gateway rejects replayed next-block sequence', replaced, snapshot())
        # A real wrong-chain database must not become recovery authority even
        # with the paired JWT and the same gateway bytecode.
        wrong_genesis = json.loads((out / 'genesis.json').read_text())
        wrong_genesis['config']['chainId'] = 421
        wrong_genesis_path = out / 'wrong-chain-genesis.json'
        wrong_genesis_path.write_text(json.dumps(wrong_genesis))
        wrong_directory = out / 'wrong-chain-execution'
        subprocess.run([str(root / 'bin/node420'), '--geth', str(root / 'bin/upstream/geth-v1.17.5-420'),
                        '--datadir', str(wrong_directory), '--init-genesis', str(wrong_genesis_path)],
                       cwd=root, stdout=logs[-1], stderr=subprocess.STDOUT, check=True)
        stable_bytes = (state / 'checkpoint.json').read_bytes()
        stop_execution(abrupt=True)
        start_execution(directory=wrong_directory)
        assert rpc('eth_chainId', []) == '0x1a5'
        spawn()
        wrong = wait('halted')
        assert 'execution chain mismatch' in wrong['error']
        assert (state / 'checkpoint.json').read_bytes() == stable_bytes
        kill_consensus()
        stop_execution(abrupt=True)
        start_execution()
        spawn()
        wait('settled', 4)
        assert snapshot() == replaced
        record_scenario('actual wrong execution chain rejected without advancing settlement', replaced, snapshot(), rejected_chain_id=421)


    finally:
        kill_consensus()
        for log in logs:
            log.close()
        (out / 'consensus-events.json').write_text(json.dumps(all_messages, indent=2))
