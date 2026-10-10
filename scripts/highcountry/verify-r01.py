#!/usr/bin/env python3
"""R01 source/specification consistency checks; does not qualify missing gameplay."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
def read(path):
    return (root / path).read_text()
def require(condition, message):
    if not condition:
        raise SystemExit('FAIL: ' + message)
docs = ['RELEASE-SCOPE.md', 'ARCHITECTURE-AND-AUTHORITY.md', 'TYPES-AND-UNITS.md',
        'MIGRATION-BOUNDARIES.md', 'DEPLOYMENT-AND-TRUST.md', 'GAMEPLAY-SPECIFICATION.md']
types = read('docs/highcountry/TYPES-AND-UNITS.md')
enum_sources = ['contracts/src/highcountry/types/HighCountryEnums.sol',
                'contracts/src/highcountry/cultivation/PlantRegistry.sol',
                'contracts/src/gaming/access/ProgressiveGamingTypes.sol']
enum_count = 0
for path in enum_sources:
    source = re.sub(r'//[^\n]*|/\*.*?\*/', '', read(path), flags=re.S)
    for name, body in re.findall(r'enum\s+(\w+)\s*\{([^}]+)\}', source):
        members = [x.strip() for x in body.split(',') if x.strip()]
        expected = '- ' + name + ': ' + ', '.join(f'{i}={m}' for i, m in enumerate(members)) + '.'
        require(expected in types, 'enum mismatch: ' + path + ':' + name)
        enum_count += 1
udvts = re.findall(r'type\s+(\w+)\s+is\s+(\w+)\s*;', read('contracts/src/highcountry/types/HighCountryTypes.sol'))
for name, abi in udvts:
    require(f'| {name} | {abi} |' in types, 'type mismatch: ' + name)
actions = re.findall(r'bytes32\s+(?:public\s+)?(?:internal\s+)?constant\s+(\w+)\s*=\s*keccak256\("([^"]+)"\)', read('contracts/src/highcountry/constants/ActionIds.sol'))
# R02.8 extends the frozen R01 action catalogue with four separately authorized
# one-time emergency-controller bindings. Reject unexpected names, domains, or
# duplicated selectors rather than accepting an arbitrary catalogue growth.
emergency_bindings = {
    'PLANT_BIND_EMERGENCY': 'HC.ACTION.PLANT_REGISTRY.BIND_EMERGENCY',
    'CULTIVATION_BIND_EMERGENCY': 'HC.ACTION.CULTIVATION_ENGINE.BIND_EMERGENCY',
    'BREEDING_BIND_EMERGENCY': 'HC.ACTION.BREEDING_ENGINE.BIND_EMERGENCY',
    'RANDOMNESS_BIND_EMERGENCY': 'HC.ACTION.RANDOMNESS_COORDINATOR.BIND_EMERGENCY',
}
require(len(actions) == 60, 'unexpected action catalogue size')
require(actions.count(('MODULE_APPROVE_ARTIFACT', 'HC.ACTION.MODULE_REGISTRY.APPROVE_ARTIFACT')) == 1, 'missing artifact approval authority')
require(actions.count(('MODULE_EXECUTE', 'HC.ACTION.MODULE_REGISTRY.EXECUTE')) == 1, 'missing permission-scoped module execution')
require(actions.count(('MODULE_BIND_RULESETS', 'HC.ACTION.MODULE_REGISTRY.BIND_RULESETS')) == 1, 'missing canonical ruleset binding action')
require(actions.count(('MODULE_BIND_EMERGENCY', 'HC.ACTION.MODULE_REGISTRY.BIND_EMERGENCY')) == 1, 'missing or modified module emergency binding')
require(actions.count(('RANDOMNESS_BIND_BREEDING', 'HC.ACTION.RANDOMNESS_COORDINATOR.BIND_BREEDING')) == 1, 'missing or modified canonical randomness binding')
require(actions.count(('BREEDING_CANCEL', 'HC.ACTION.BREEDING_ENGINE.CANCEL')) == 1, 'missing or modified breeding cancellation action')
action_names = [name for name, _ in actions]
action_domains = [domain for _, domain in actions]
require(len(set(action_names)) == len(actions), 'duplicate action names')
require(len(set(action_domains)) == len(actions), 'duplicate action domains')
for name, domain in emergency_bindings.items():
    require(actions.count((name, domain)) == 1, 'missing or modified emergency binding action: ' + name)
require(all(domain.startswith('HC.ACTION.') for domain in action_domains), 'unexpected action namespace')
trust = read('docs/highcountry/DEPLOYMENT-AND-TRUST.md')
for name, domain in actions:
    require(trust.count(f'- {name}: `{domain}`') == 1, 'action mismatch: ' + name)
pattern = r'^\| (HC-AUD-\d{3})\b([^\n]*)'
audit_rows = dict(re.findall(pattern, read('docs/highcountry/REPOSITORY-AUDIT-20261009.md'), re.M))
scope_rows = re.findall(pattern, read('docs/highcountry/RELEASE-SCOPE.md'), re.M)
expected = {f'HC-AUD-{i:03}' for i in range(1, 66)}
require(set(audit_rows) == expected, 'audit requirement inventory')
require(len(scope_rows) == 65 and {x[0] for x in scope_rows} == expected, 'requirement assignment missing/duplicate')
for name, row in scope_rows:
    require('Launch required' in row or 'Launch security review required' in row, 'unassigned requirement: ' + name)
    require('R0' in row or 'R10' in row, 'missing buildout owner: ' + name)
links = 0
for name in docs:
    path = root / 'docs/highcountry' / name
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text()):
        if not target.startswith(('https:', 'http:', '#')):
            require((path.parent / target.split('#')[0]).is_file(), 'missing link: ' + target)
            links += 1
spec = read('docs/highcountry/GAMEPLAY-SPECIFICATION.md')
require('adopt that baseline' in spec and 'Status: COMPLETE' in spec, 'missing adopted baseline')
require('R01.7' in read('docs/highcountry/RECONCILIATION-AND-BUILDOUT-ROADMAP.md'), 'missing milestone')
counts = dict.fromkeys('DCBAS', 0)
for q in range(10001):
    mass = 100000 * q // 10000
    require(mass == q * 10 and 0 <= mass <= 100000, 'harvest arithmetic')
    grade = next(g for threshold, g in [(9000, 'S'), (7500, 'A'), (5000, 'B'), (2500, 'C'), (0, 'D')] if q >= threshold)
    counts[grade] += 1
require(counts == dict(D=2500, C=2500, B=2500, A=1500, S=1001), 'grade partition')
for lo, hi, grade in [(0,2499,'D'),(2500,4999,'C'),(5000,7499,'B'),(7500,8999,'A'),(9000,10000,'S')]:
    require(f'| {lo}..{hi} | {grade} |' in spec, 'document grade drift')
require('100000 mg' in spec and 'zero decimal places' in spec and '0 bps' in spec, 'baseline unit/fee drift')
for centi in range(1000,4001):
    require((centi * 10) // 10 == centi, 'temperature conversion')
for milli in [25001,-1000,9990,40010]:
    require(milli % 10 != 0 or not 1000 <= milli // 10 <= 4000, 'invalid temperature admitted')
inputs = {p: hashlib.sha256((root/p).read_bytes()).hexdigest() for p in
          enum_sources + ['contracts/src/highcountry/types/HighCountryTypes.sol', 'contracts/src/highcountry/constants/ActionIds.sol'] + ['docs/highcountry/'+p for p in docs]}
print(json.dumps({'status':'PASS', 'sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
                  'enums':enum_count,'types':len(udvts),'actions':len(actions),'requirements':len(scope_rows),
                  'links':links,'harvestInputs':10001,'temperatureInputs':3001,'inputHashes':inputs,
                  'scope':'Source/specification consistency only; not runtime or full-game qualification.'},indent=2))
