#!/usr/bin/env python3
"""Check evidence integrity and produce the V.18 attack-to-test qualification map."""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/audit/adversarial-qualification'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def git_file(commit, path):
    return subprocess.check_output(['git', '--no-replace-objects', '-C', str(ROOT), 'show', commit + ':' + path])


def cases(text):
    owner = None
    result = []
    for line in text.splitlines():
        match = re.search(r'Ran \d+ tests? for (\S+):(\w+)', line)
        if match:
            owner = match[1] + ':' + match[2]
        match = re.match(r'\[PASS\]\s+((?:test|invariant)\w+)\(([^\n]*?)\)(.*)', line)
        if match:
            result.append({'owner': owner, 'test': match[1], 'signature': match[1] + '(' + match[2] + ')', 'details': match[3].strip()})
    return result


def physical_test(path):
    return ROOT / 'qualification/bridge-adversarial/tests' / Path(path).name


def main():
    lock = json.loads((ROOT / 'contracts/config/bridge/adversarial-sources-v1.json').read_text())
    policy = json.loads((ROOT / 'qualification/bridge-adversarial/coverage-policy.json').read_text())
    retained = json.loads((OUT / 'retained-evidence.json').read_text())
    references = []
    for record in retained:
        raw = (ROOT / record['local_path']).read_bytes()
        assert digest(raw) == record['sha256'], 'retained bytes changed'
        assert raw == git_file(record['commit'], record['path']), 'retained source changed'
        for case in cases(raw.decode()):
            references.append(case | {'family': record['dataset'], 'log': record['local_path'], 'source_commit': record['commit'], 'status': 'RETAINED_PASS'})
    independent = json.loads((OUT / 'independent-reference-records.json').read_text())
    for reference in independent:
        raw = (ROOT / reference['local_path']).read_bytes()
        assert digest(raw) == reference['sha256'] and raw == git_file(reference['commit'], reference['path'])
    new = []
    input_files = {}
    for path in sorted(OUT.glob('*-inputs.json')):
        record = json.loads(path.read_text())
        for name, source in record['files'].items():
            if source['source'] == 'V18_TEST':
                raw = physical_test(name).read_bytes()
            elif source['source'] == 'V18_PATCH':
                raw = (ROOT / name).read_bytes()
            else:
                raw = git_file(source['source'], name)
            assert digest(raw) == source['sha256'], 'qualification input drift: ' + name
        input_files[path.name] = digest(path.read_bytes())
        if record['original']:
            continue
        logfile = Path(record['command'][record['command'].index('--root') + 1]).name
        # Each qualified execution has a separate log; source input filenames identify it.
        name = path.name.removesuffix('-inputs.json')
        log_path = OUT / (name + '-new.log' if name in lock['families'] else name + '.log')
        text = log_path.read_text()
        assert '[FAIL' not in text and re.search(r'0 failed', text), 'failed qualification: ' + str(log_path)
        passed = cases(text)
        assert passed, 'zero passing tests'
        for case in passed:
            new.append(case | {'family': record['family'], 'log': log_path.relative_to(ROOT).as_posix(), 'source_commit': record['source_commit'], 'status': 'V18_PASS'})
    # Published source pin, restored original and current main dependency all agree.
    restoration = lock['families']['solana']['restoration']
    raw = (ROOT / restoration['path']).read_bytes()
    pins = json.loads(git_file(restoration['published_pin_commit'], restoration['published_pin_path']))['files']
    assert digest(raw) == pins[restoration['path']] == restoration['sha256']
    assert raw == git_file(restoration['from_commit'], restoration['path'])
    cadc_inputs = json.loads((OUT / 'cadc-inputs.json').read_text())['files']
    cadc_production = {name: data['sha256'] for name, data in cadc_inputs.items() if name.startswith('contracts/src/')}
    assert all(digest((ROOT / name).read_bytes()) == expected for name, expected in cadc_production.items()), 'main CADC dependency drift'
    vectors = json.loads((OUT / 'solana-independent-integers.json').read_text())
    vector_test = physical_test('SolanaIntegerV18.t.sol').read_text()
    for vector in vectors['values']:
        value = vector['amount_and_nonce']
        encoded = b'420SOLV1' + struct.pack('<Q', value) + bytes(136) + struct.pack('<Q', value)
        assert len(encoded) == 160 and digest(encoded) == vector['instruction_sha256']
        assert vector['instruction_sha256'] in vector_test
    matrix = []
    pow_families = {'bitcoin', 'litecoin', 'dogecoin', 'potcoin', 'curecoin', 'dobbscoin', 'pirate'}
    issuer = {'cctp', 'cadc'}
    for family in lock['families']:
        for category, pattern in policy['categories'].items():
            applicable = not ((category == 'chain_work_and_difficulty' and family not in pow_families)
                              or (category == 'validator_sets_and_signers' and family in {'bitcoin', 'litecoin', 'dogecoin'})
                              or (category in {'forged_inclusion', 'reorganizations'} and family in issuer))
            if not applicable:
                matrix.append({'family': family, 'attack': category, 'status': 'NOT_IMPLEMENTED_AT_THIS_LAYER', 'reason': 'PoW has no validator quorum; stake/BFT has no cumulative-work target; native issuer protocols delegate source consensus/inclusion/fork handling. Their implemented attestation/DVN authorization, finality policy and replay checks are qualified separately.'})
                continue
            candidates = [r for r in references + new if r['family'] == family and re.search(pattern, r['test'])]
            if category == 'reorganizations':
                candidates = [r for r in candidates if re.search(r'(Reorg|ForkSelection|Conflict|CertifiedBank|CheckpointRotation|OldAuthority|StaleAuthority)', r['test'])]
                if family == 'ethereum':
                    candidates = [r for r in references if r['family'] == family and r['test'] in {'testConsensusRejectsForgedCommitteesOutputsReplayAndNoncanonicalJournal', 'invariantOnlyProvenMainnetCheckpointAndCommitteeCanBeStored'}]
                if family == 'bnb':
                    candidates = [r for r in new if r['family'] == family and 'ForkV18' in (r['owner'] or '')]
            if category == 'computational_and_memory_limits' and family == 'bnb':
                candidates += [r for r in references if r['family'] == family and r['test'] == 'testHistoricalFinalityAndRealValidatorTransition']
            # Prefer concrete verifier / cryptographic owners over adapter mocks.
            candidates.sort(key=lambda r: (r['status'] != 'V18_PASS', not bool(re.search(r'(FinalityProof|FinalityVerifier|ConsensusQualification|GatewayQualification|BnbAdversarial|BnbExecution|BitcoinHeaderPow|PirateEquihash|CCTPAdapter|CADCLayerZero)', r['owner'] or '')), r['test'], r['log']))
            selected = []
            seen = set()
            for reference in candidates:
                key = (reference['owner'], reference['test'])
                if key not in seen:
                    selected.append(reference); seen.add(key)
                if len(selected) == 4:
                    break
            if category in {'computational_and_memory_limits', 'malformed_serialization'}:
                selected += [r for r in new if r['family'] == family and re.search(r'(DynamicLength|LargeHostile|MalformedEnvelope|TrailingEnvelope|DirtyPadding|RelocatedDynamic)', r['test'])]
            if category == 'integer_and_precision':
                selected += [r for r in new if r['family'] == family and re.search(r'(IntegerVectors|DirtyAmount|NativeSupplyAmount|NotePosition)', r['test'])]
            assert selected, 'uncovered applicable attack: ' + family + '/' + category
            matrix.append({'family': family, 'attack': category, 'status': 'QUALIFIED_IMPLEMENTED_BOUNDARY', 'evidence': selected})
    for family in lock['families']:
        assert sum(r['family'] == family and r['test'].startswith('invariantV18') for r in new) == (2 if family == 'bnb' else 1)
    fuzz = sum(int(re.search(r'runs: (\d+)', r['details'])[1]) for r in new if r['test'].startswith('testFuzz'))
    invariant_calls = sum(int(re.search(r'calls: (\d+)', r['details'])[1]) for r in new if r['test'].startswith('invariant'))
    assert all('reverts: 0' in r['details'] for r in new if r['test'].startswith('invariant'))
    result = {'task': 'BRIDGE-AUDIT-3.V.18', 'status': 'LOCAL_ADVERSARIAL_QUALIFICATION_COMPLETE',
              'base_main_sha': lock['base_main_sha'], 'catalogue_sha': lock['catalogue_sha'],
              'implemented_verifier_families': len(lock['families']), 'new_and_affected_foundry_passes': len(new),
              'v18_new_passes': sum(r['test'].startswith(('testV18', 'testFuzzV18', 'invariantV18')) for r in new),
              'affected_cadc_regression_passes': sum(not r['test'].startswith(('testV18', 'testFuzzV18', 'invariantV18')) for r in new),
              'fuzz_executions': fuzz, 'invariant_calls': invariant_calls, 'invariant_handler_reverts': 0,
              'retained_log_files': len(retained), 'retained_passing_case_records': len(references),
              'attack_matrix_entries': len(matrix), 'uncovered_applicable_entries': 0,
              'cadc_main_production_imports_verified': cadc_production, 'independent_reference_records': independent, 'independent_new_instruction_vectors': len(vectors['values']), 'ci_run_ids': [],
              'old_consensus_test_reruns': 0, 'production_activation': False,
              'merge_requested': False, 'input_manifests': input_files, 'passing_cases': new,
              'limitations': ['Qualified against exact main / unmerged PR source pins, not a claim that all those PRs are merged.',
                              'Malformed-envelope invariants use unconfigured authority / no accepted deposits; they complement retained valid-context forgery and redemption tests.',
                              '500000 forwarded gas bounds new hostile-envelope rejection, excluding payload construction / transaction calldata gas. It is not a maximum valid-proof deployment cost claim.',
                              'BNB software BLS retains its previously measured multi-transaction, billions-of-gas cost; prior bounded-progress evidence is unchanged.',
                              'Existing Solana, PotCoin, Pirate, CCTP and CADC historical/native authority/deployment/issuer prerequisites remain as recorded by their audits. No new trust root or production readiness claim.']}
    (OUT / 'coverage-matrix.json').write_text(json.dumps(matrix, indent=2, sort_keys=True) + '\n')
    (OUT / 'RESULTS.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in {'input_manifests', 'passing_cases', 'limitations'}}, indent=2))


if __name__ == '__main__':
    main()
