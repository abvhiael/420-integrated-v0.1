import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("trigger_guard",Path(__file__).with_name("verify-trigger-isolation.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BASE = "name: expensive\non:\n  pull_request:\n    paths:\n      - 'src/**'\n  workflow_dispatch:\npermissions:\n  contents: read\njobs:\n  actual:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo preserved\n"
GOOD = BASE.replace("  pull_request:\n    paths:\n      - 'src/**'\n", "")

class WorkflowIsolationTests(unittest.TestCase):
    def test_authorized_dispatch_keeps_complete_jobs(self):
        self.assertTrue(module.check(BASE,GOOD,"synthetic"))
    def test_implicit_level3_fails(self):
        with self.assertRaisesRegex(ValueError,"implicit"):
            module.check(BASE,BASE,"synthetic")
    def test_loss_of_test_coverage_fails(self):
        with self.assertRaisesRegex(ValueError,"inventory"):
            module.check(BASE,GOOD.replace("echo preserved","echo omitted"),"synthetic")
    def test_loss_of_dispatch_fails(self):
        with self.assertRaisesRegex(ValueError,"dispatch"):
            module.check(BASE,GOOD.replace("  workflow_dispatch:\n",""),"synthetic")
    def test_header_change_fails(self):
        with self.assertRaisesRegex(ValueError,"header"):
            module.check(BASE,GOOD.replace("name: expensive","name: unrelated"),"synthetic")

if __name__ == "__main__":
    unittest.main()
