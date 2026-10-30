#!/usr/bin/env python3
"""Negative tests for the CI-SOL-02 runtime and evidence gates; no Foundry invocation."""
import importlib.util,json,tempfile,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/name)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
execution=load('sol02-execution.py')
aggregate=load('sol02-aggregate.py')

class RuntimeEvidenceTests(unittest.TestCase):
    def test_discovery_execution_exact_set(self):
        names={'test/Foo.t.sol':{'FooTest':['testA()','testB(uint256)']}}
        rows={'test/Foo.t.sol:FooTest':{'test_results':{
            'testA()':{'status':'Success'},'testB(uint256)':{'status':'Success'}}}}
        self.assertEqual(execution.flatten_list(names),set(execution.flatten_results(rows)))
    def test_reject_failed_runtime(self):
        with self.assertRaisesRegex(ValueError,'Unsuccessful'):
            execution.flatten_results({'test/Foo.t.sol:FooTest':{'test_results':{'testA()':{'status':'Failure'}}}})
    def test_reject_duplicate_discovery(self):
        with self.assertRaisesRegex(ValueError,'Duplicate'):
            execution.flatten_list({'test/Foo.t.sol':{'Foo':['testA()','testA()']}})
    def test_reject_no_runtime_for_suite(self):
        with self.assertRaisesRegex(ValueError,'Missing runtime'):
            execution.flatten_results({'Foo':{'different':{}}})
    def test_aggregator_rejects_forged_runtime(self):
        target='test/Foo.t.sol'
        expected={'contract':'test/Foo.t.sol:FooTest','test':'testA()'}
        plan={'required':['a'],'groups':{'a':[target]},'schema':'420.ci.sol02.v1',
              'sha':'abc','profile':'pr','inventory_sha256':'hash','level3':False}
        artifact={'group':'a','schema':plan['schema'],'sha':plan['sha'],
                  'profile':plan['profile'],'inventory_sha256':plan['inventory_sha256'],
                  'targets':[target],'passed':True,'runtimeTestCount':1,
                  'runtime':[{'target':target,'discovered':[expected],'executed':[],'supportOnly':False}]}
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'sol02-a.json'
            path.write_text(json.dumps(artifact))
            with self.assertRaisesRegex(ValueError,'runtime mismatch'):
                aggregate.verify(plan,Path(d))
            artifact['runtime'][0]['executed']=[expected]
            path.write_text(json.dumps(artifact))
            self.assertEqual(aggregate.verify(plan,Path(d)),['a'])

if __name__=='__main__':unittest.main()
