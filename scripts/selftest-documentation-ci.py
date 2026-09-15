#!/usr/bin/env python3
"""Self-test selected DOC-12 validators with deterministic pass/fail fixtures."""

from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"


def load(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_true(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def test_frontmatter() -> None:
    mod = load("validate-doc-frontmatter.py", "doc_frontmatter_selftest")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        docs = root / "docs"
        docs.mkdir()
        valid = docs / "valid.md"
        valid.write_text(
            "---\ntitle: Valid\ncategory: user-guide\nstatus: current\nversion: current\n---\n# Valid\n",
            encoding="utf-8",
        )
        malformed = docs / "malformed.md"
        malformed.write_text("---\ntitle: [broken\n---\n# Broken\n", encoding="utf-8")
        policy = {
            "required_fields": ["title", "category", "status", "version"],
            "allowed_category": ["user-guide"],
            "allowed_status": ["current"],
            "allowed_audience": ["user"],
        }
        mod.ROOT = root
        errors, legacy = mod.validate_page(valid, policy)
        assert_true(errors == [] and legacy is False, f"valid front matter failed: {errors}")
        errors, _ = mod.validate_page(malformed, policy)
        assert_true(bool(errors), "malformed YAML front matter did not fail closed")

        bad_policy = root / "bad-policy.json"
        bad_policy.write_text("{not-json", encoding="utf-8")
        mod.POLICY_PATH = bad_policy
        try:
            mod.load_policy()
        except SystemExit as exc:
            assert_true(exc.code == 1, "malformed policy did not exit 1")
        else:
            raise AssertionError("malformed front-matter policy was accepted")


def test_links() -> None:
    mod = load("validate-doc-links.py", "doc_links_selftest")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        docs = root / "docs"
        docs.mkdir()
        target = docs / "target.md"
        target.write_text("# Target heading\n", encoding="utf-8")
        good = docs / "good.md"
        good.write_text("[target](target.md#target-heading)\n", encoding="utf-8")
        bad = docs / "bad.md"
        bad.write_text("[missing](missing.md)\n", encoding="utf-8")
        mod.ROOT = root
        mod.DOCS = docs
        policy = {"external_schemes": ["http", "https"], "target_exceptions": [], "anchor_exceptions": []}
        checked, errors = mod.validate_page(good, policy, {})
        assert_true(checked == 1 and errors == [], f"valid internal link failed: {errors}")
        _, errors = mod.validate_page(bad, policy, {})
        assert_true(any("missing internal target" in item for item in errors), "missing link target did not fail closed")


def test_publication_safety() -> None:
    mod = load("validate-doc-publication-safety.py", "doc_publication_safety_selftest")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        trouble = root / "docs" / "troubleshooting"
        trouble.mkdir(parents=True)
        page = trouble / "case.md"
        policy = {
            "secret_safety_roots": ["docs/troubleshooting"],
            "sensitive_terms": ["private key"],
            "request_terms": ["paste"],
            "negation_terms": ["do not", "never"],
        }
        mod.ROOT = root
        page.write_text("Paste your private key into the ticket.\n", encoding="utf-8")
        errors, checked = mod.secret_safety_errors(policy)
        assert_true(checked == 1 and bool(errors), "affirmative secret request did not fail closed")
        page.write_text("Do not paste your private key into the ticket.\n", encoding="utf-8")
        errors, _ = mod.secret_safety_errors(policy)
        assert_true(errors == [], f"explicit secret-safety negation was rejected: {errors}")


def main() -> int:
    tests = [test_frontmatter, test_links, test_publication_safety]
    for test in tests:
        test()
        print(f"420Docs CI self-test PASS: {test.__name__}")
    print(f"420Docs CI self-tests PASS: {len(tests)} fixture group(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
