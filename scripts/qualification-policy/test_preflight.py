import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("preflight", Path(__file__).with_name("preflight.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class PolicyGuardTests(unittest.TestCase):
    def setUp(self):
        self.original = mod.ROOT
        self.tmp = tempfile.TemporaryDirectory()
        mod.ROOT = Path(self.tmp.name)
        (mod.ROOT / "docs").mkdir()
        (mod.ROOT / ".github/workflows").mkdir(parents=True)
        (mod.ROOT / "docs/roadmap.md").write_text("canonical")
        (mod.ROOT / ".github/workflows/focused.yml").write_text("name: focused")
        self.sha = "a" * 40
        self.base = "b" * 40
        self.changed = ["services/product/src/a.py"]
        self.data = dict(step="APP-01", roadmap="docs/roadmap.md", level="L1",
                         base_sha=self.base, candidate_sha="HEAD",
                         classification="implementation", scope=self.changed,
                         tests=[{"command": "python -m unittest", "owner": "services/product"}],
                         required_workflows=[".github/workflows/focused.yml"],
                         exit_criteria=["tested, secure, exact SHA"],
                         frozen_inputs={}, external_gates=[])

    def tearDown(self):
        mod.ROOT = self.original
        self.tmp.cleanup()

    def check(self):
        return mod.check_manifest(self.data, self.changed, self.sha, self.base)

    def test_valid_runtime_sha(self):
        self.assertEqual(self.check()["status"], "PASS")

    def test_stale_base(self):
        self.data["base_sha"] = "c"*40
        with self.assertRaisesRegex(ValueError, "base SHA"):
            self.check()

    def test_unaudited_change(self):
        with self.assertRaisesRegex(ValueError, "unclassified"):
            mod.check_manifest(self.data, self.changed + ["services/product/src/b.py"], self.sha, self.base)

    def test_forbid_global_level1(self):
        self.data["required_workflows"] = [".github/workflows/global-level3.yml"]
        with self.assertRaisesRegex(ValueError, "global"):
            self.check()

    def test_forged_evidence(self):
        self.data["classification"] = "evidence-only"
        with self.assertRaisesRegex(ValueError, "evidence-only"):
            self.check()

    def test_frozen_input_mismatch(self):
        (mod.ROOT / "lock.txt").write_text("actual")
        self.data["frozen_inputs"] = {"lock.txt": "0"*64}
        with self.assertRaisesRegex(ValueError, "stale SHA256"):
            self.check()

    def test_level3_without_digest_fails(self):
        self.data["level"] = "L3"
        with self.assertRaisesRegex(ValueError, "Level 3"):
            self.check()

    def test_unsafe_path(self):
        self.data["scope"] = ["../secret"]
        with self.assertRaisesRegex(ValueError, "unsafe"):
            mod.check_manifest(self.data, ["../secret"], self.sha, self.base)

    def test_unapproved_level3_trigger_is_detected(self):
        heavy = mod.ROOT / '.github/workflows/app-level3.yml'
        heavy.write_text(chr(10).join([
            'name: expensive', 'on:', '  pull_request:',
            '    paths:', "      - 'services/product/**'",
            '  workflow_dispatch:', ''
        ]))
        with self.assertRaisesRegex(ValueError, 'unauthorized automatic Level 3'):
            mod.audit_unwanted_level3(self.changed)
        heavy.write_text(chr(10).join(['name: expensive', 'on:', '  workflow_dispatch:', '']))
        mod.audit_unwanted_level3(self.changed)

    def test_unique_manifest_per_pr(self):
        path = '.qualification/candidates/APP-01.json'
        self.assertEqual(mod.choose_manifest('auto', self.changed + [path]), path)
        with self.assertRaisesRegex(ValueError, 'unique'):
            mod.choose_manifest('auto', self.changed)
        with self.assertRaisesRegex(ValueError, 'unique'):
            mod.choose_manifest('auto', self.changed + [path, '.qualification/candidates/APP-02.json'])

    def test_changed_governed_docs_require_frontmatter(self):
        directory = mod.ROOT / 'docs/ci'
        directory.mkdir(parents=True)
        (directory / 'frontmatter-policy.json').write_text(
            '{"governed_roots":["docs/ci"],"required_fields":["title","category","status","version"]}')
        document = directory / 'example.md'
        document.write_text('# Invalid')
        with self.assertRaisesRegex(ValueError, 'frontmatter'):
            mod.audit_governed_docs(['docs/ci/example.md'])
        document.write_text('---\ntitle: Example\ncategory: contributing\nstatus: current\nversion: current\n---\n')
        mod.audit_governed_docs(['docs/ci/example.md'])

    def test_unregistered_workflow(self):
        self.data["required_workflows"] = [".github/workflows/missing.yml"]
        with self.assertRaisesRegex(ValueError, "registered"):
            self.check()


if __name__ == "__main__":
    unittest.main()
