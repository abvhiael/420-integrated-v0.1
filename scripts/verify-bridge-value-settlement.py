#!/usr/bin/env python3
"""Verify retained exact-source settlement qualification without rerunning consensus suites."""
import hashlib,json,re,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def check():
    report=read('docs/audit/settlement-qualification/RESULTS.json');assert report['pass']
    inventory=runpy.run_path(str(ROOT/'scripts/verify-final-verifier-inventory.py'))['check']()
    lineage=runpy.run_path(str(ROOT/'scripts/verify-final-verifier-inventory.py'))['qualified_source_matches']
    cases=set();fuzz=0;invariant_runs=0;invariant_calls=0;current=set();sizes={}
    for run in report['runs']:
        log=(ROOT/run['log']).read_text();inputs=read(run['source_inputs'])['source_sha256']
        # Retain independent passes; every actual failure must be corrected in a recorded run.
        failures=set(re.findall(r'^\[FAIL[\s\S]*?\]\s+(\w+)\(',log,re.M))
        assert failures==set(run.get('expected_failed_tests',[])),run['log']
        assert re.search(r'\b[1-9][0-9]* tests? passed',log),run['log']
        owner=None;found=[]
        for line in log.splitlines():
            match=re.match(r'Ran \d+ tests? for (\S+)',line)
            if match:owner=match.group(1)
            match=re.match(r'\[PASS\] (\w+)\((.*?)\)',line)
            if match:
                key=owner+'::'+match.group(1);found.append(key)
                if key in run.get('superseded_cases',[]):continue
                assert key not in cases,key;cases.add(key)
                count=re.search(r'\(runs: (\d+),',line)
                if count and 'calls:' not in line:fuzz+=int(count.group(1))
                count=re.search(r'\(runs: (\d+), calls: (\d+), reverts: (\d+)\)',line)
                if count:
                    assert count.group(3)=='0',line
                    invariant_runs+=int(count.group(1));invariant_calls+=int(count.group(2))
        assert len(found)==run['cases_passed'],run['log']
        for path,digest in inputs.items():
            lineage(path,digest)
            if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest:current.add(path)
        size_path=Path(run['log']).with_suffix('.bytecode.json')
        if (ROOT/size_path).exists():sizes.update(read(str(size_path)))
    assert len(cases)==report['totals']['distinct_cases_passed']
    assert (fuzz,invariant_runs,invariant_calls)==(report['totals']['fuzz_inputs'],report['totals']['invariant_runs'],report['totals']['invariant_calls'])
    assert sizes and max(sizes.values())<=24576
    for path in report['changed_production_sources']:assert path in current,path
    for path,digest in report['input_sha256'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
    assert inventory['production_approvals']==0 and report['production_approvals']==[] and not report['live_settlement_qualified']
    router=(ROOT/'contracts/src/bridge/GatewayRouter420.sol').read_text()
    assert router.count('return _fundedOutbound(')==2 and 'function _initiateOutbound(' in router
    assert 'custody.reserve(' in router and 'custody.bindOutbound(' in router
    token=(ROOT/'contracts/src/bridge/BridgeRepresentation420.sol').read_text()
    assert 'issuerNative=false' in token and 'qualification.requireCurrent(controller)' in token
    return {'pass':True,'distinct_cases_passed':len(cases),'fuzz_inputs':fuzz,'invariant_runs':invariant_runs,'invariant_calls':invariant_calls,'compiled_bridge_artifacts':len(sizes),'maximum_runtime_bytes':max(sizes.values()),'production_approvals':0,'live_settlement_qualified':False,'new_ci_runs':len(report['ci_run_ids'])}
if __name__=='__main__':print(json.dumps(check(),indent=2))
