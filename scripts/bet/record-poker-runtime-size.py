#!/usr/bin/env python3
"""Export actual compiler template sizes without granting deployment acceptance."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
if len(sys.argv) not in (2,3):
    raise SystemExit('usage: record-poker-runtime-size.py output.json [executed-constructor.log]')
sha = subprocess.check_output(['git', '-c', 'safe.directory='+root.as_posix(),
                               'rev-parse', 'HEAD'], cwd=root, text=True).strip()
dirty=subprocess.run(['git','-c','safe.directory='+root.as_posix(),'diff','--quiet','HEAD'],cwd=root).returncode!=0
measurements = {}
targets = [('PokerNLHEBetting420', 'PokerNLHEBetting420.sol',128),
           ('PokerActionDisputeClock420', 'PokerActionDisputeClock420.sol',32),
           ('PokerSeatLedger420','PokerSeatLedger420.sol',32),
           ('PokerPlayerRecovery420','PokerPlayerRecovery420.sol',32)]
for group in ('Admission','Play','Custody','Settlement'):
    targets += [('PokerNLHE'+group+'Module420','PokerNLHEModules420.sol',160),
                ('PokerNLHE'+group+'Factory420','PokerNLHEModuleFactories420.sol',0)]
for name, source, arguments in targets:
    path = root / 'contracts/out' / source / (name+'.json')
    data = json.loads(path.read_text(encoding='utf-8'))
    code = bytes.fromhex(data['deployedBytecode']['object'].removeprefix('0x'))
    # Solc artifacts retain 20-byte library placeholders in initcode. Linking
    # replaces exactly those bytes and cannot change the EIP-3860 size. Actual
    # linked factory addresses/code hashes are exported by the funded context.
    creationHex=data['bytecode']['object'].removeprefix('0x')
    creation = bytes.fromhex(re.sub(r'__\$[0-9a-fA-F]{34}\$__','0'*40,creationHex))
    if not code:
        raise SystemExit('missing actual compiler runtime: '+name)
    measurements[name] = dict(runtimeTemplateBytes=len(code), eip170Limit=24576,
        fitsEIP170=len(code)<=24576, creationTemplateBytes=len(creation),
        constructorArgumentBytes=arguments,eip3860Limit=49152,
        linkReferences=data['bytecode'].get('linkReferences',{}),
        fitsEIP3860=len(creation)+arguments<=49152,
        compilerTemplateSHA256=hashlib.sha256(code).hexdigest())
compatible=all(x['fitsEIP170'] and x['fitsEIP3860'] for x in measurements.values())
report = dict(sourceCommit=sha, scope='compiler runtime size, not live deployment evidence',
              qualifiedSHA=None if dirty else sha,trackedWorkingTreeDirty=dirty,
              runtimeDeploymentCompatible=compatible, liveDeploymentReady=False,
              contracts=measurements)
if len(sys.argv)==3:
    trace=Path(sys.argv[2]).read_text(encoding='utf-8-sig')
    if '[PASS] test55ProductionConstructorFitsSixteenMillionGasBudget()' not in trace:
        raise SystemExit('actual passing constructor execution required')
    events=re.findall(r'emit NativeConstructorGas\(gasUsed: (\d+)',trace)
    if len(events)!=1 or not 0<int(events[0])<=16_000_000:
        raise SystemExit('one actual constructor measurement within budget required')
    report.update(constructorGasUsed=int(events[0]),constructorGasBudget=16_000_000,
                  constructorTraceSHA256=hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest())
Path(sys.argv[1]).write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, indent=2))
if not compatible:
    raise SystemExit('an actual engine/module/factory exceeds EIP-170 or EIP-3860')
