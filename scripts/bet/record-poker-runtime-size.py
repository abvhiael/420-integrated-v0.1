#!/usr/bin/env python3
"""Export actual compiler template sizes without granting deployment acceptance."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
if len(sys.argv) != 2:
    raise SystemExit('usage: record-poker-runtime-size.py output.json')
sha = subprocess.check_output(['git', '-c', 'safe.directory='+root.as_posix(),
                               'rev-parse', 'HEAD'], cwd=root, text=True).strip()
measurements = {}
for name in ('PokerNLHEBetting420', 'PokerActionDisputeClock420'):
    path = root / 'contracts/out' / (name+'.sol') / (name+'.json')
    data = json.loads(path.read_text(encoding='utf-8'))
    code = bytes.fromhex(data['deployedBytecode']['object'].removeprefix('0x'))
    if not code:
        raise SystemExit('missing actual compiler runtime: '+name)
    measurements[name] = dict(runtimeTemplateBytes=len(code), eip170Limit=24576,
        fitsEIP170=len(code)<=24576, compilerTemplateSHA256=hashlib.sha256(code).hexdigest())
report = dict(sourceCommit=sha, scope='compiler runtime size, not live deployment evidence',
              liveDeploymentReady=all(x['fitsEIP170'] for x in measurements.values()),
              contracts=measurements)
Path(sys.argv[1]).write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, indent=2))
