#!/usr/bin/env python3
"""Checksum the genuine single-winner fixture without asserting execution success."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'clients/420bet-poker/zkshuffle/fixtures/ws8'
OUT = BASE.parent / 'ws8-winner'
def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

if sys.argv[1:] == ['--record']:
    source = ROOT / 'artifacts/contracts/ws8-winner/proofs'
    (OUT / 'proofs').mkdir(parents=True, exist_ok=True)
    (OUT / 'keys').mkdir(exist_ok=True)
    original = json.loads((BASE / 'manifest.json').read_text(encoding='utf-8'))
    for key in original['keys']:
        name = key['name'] + '.vk'
        assert digest(BASE/'keys'/name) == digest(ROOT/'artifacts/contracts/ws8-material'/name)
        shutil.copyfile(BASE/'keys'/name, OUT/'keys'/name)
    for p in source.iterdir():
        name = p.name.removeprefix('EXPERIMENTAL-')
        if name.endswith(('.abi', '.points', '.public', 'Proof.bin', 'SolidityFixture.json')) or name in ('roots.bin','deck-0.bin','deck-1.bin','deck-2.bin','reuse-report.json'):
            shutil.copyfile(p, OUT/'proofs'/name)
    for name in ('context.bin','context.json'):
        shutil.copyfile(BASE/name, OUT/name)
    reuse = json.loads((OUT/'proofs/reuse-report.json').read_text(encoding='utf-8'))
    assert len(reuse) == 41
    assert {r['material'] for r in reuse} == {'reused-identical-public-witness','generated-context-specific'}
    cached = [r['proof'] for r in reuse if r['material'] == 'reused-identical-public-witness']
    assert set(cached) == {'WS8Initial','WS8Shuffle1','WS8Recipient0','WS8Recipient1','WS8Aggregate'}
    for name in cached:
        for suffix in ('.abi','.public','Proof.bin'):
            assert digest(BASE/'proofs'/(name+suffix)) == digest(OUT/'proofs'/(name+suffix))
    for record in original['proofs']:
        name=record['name']
        if name not in cached:
            assert digest(BASE/'proofs'/(name+'.public')) != digest(OUT/'proofs'/(name+'.public'))
    manifest = dict(format=1, setup=original['setup'], keys=original['keys'], proofs=original['proofs'],
        reusedProofs=cached, generatedProofs=36, permutation='swap final positions 0 and 12; player 0 has ace-high flush',
        files={p.relative_to(ROOT).as_posix():digest(p) for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='manifest.json'})
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
elif sys.argv[1:] == ['--verify']:
    manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    assert len(manifest['proofs']) == 41 and len(manifest['keys']) == 7 and manifest['generatedProofs'] == 36
    for name, expected in manifest['files'].items():
        assert digest(ROOT/name) == expected, name
    for key in manifest['keys']:
        assert digest(OUT/'keys'/(key['name']+'.vk')) == digest(BASE/'keys'/(key['name']+'.vk'))
    assert len(manifest['reusedProofs'])==5
    for record in manifest['proofs']:
        name=record['name']
        if name not in manifest['reusedProofs']:
            assert digest(BASE/'proofs'/(name+'.public')) != digest(OUT/'proofs'/(name+'.public'))
    for name in manifest['reusedProofs']:
        for suffix in ('.abi','.public','Proof.bin'):
            assert digest(BASE/'proofs'/(name+suffix)) == digest(OUT/'proofs'/(name+suffix))
else:
    raise SystemExit('usage: package-poker-5a7-evidence.py --record|--verify')
assert len({digest(folder/'proofs'/(record['name']+'Proof.bin')) for folder in (BASE,OUT) for record in json.loads((folder/'manifest.json').read_text(encoding='utf-8'))['proofs']})==77
print('Single-winner fixture checksums: seven unchanged keys, five reused proofs, 36 context-specific proofs; actual verification must execute')
