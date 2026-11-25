#!/usr/bin/env python3
"""Run every generated proof test against the original dependency closure.

Run from contracts/. A separate scoped invocation per root avoids ambiguity
when multiple generated Solidity files intentionally use the same contract name.
Verify every declared test function actually executed successfully.
"""
import glob
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

root = Path.cwd().resolve()
test = root / "test"
assert (root / "foundry.toml").is_file()
pattern = sys.argv[1]
assert pattern.startswith("test/") and ".." not in Path(pattern).parts
roots = sorted(Path(p).resolve() for p in glob.glob(pattern))
expected_count = int(sys.argv[2])
assert len(roots) == expected_count, (pattern, roots)
assert all(p.is_file() and p.is_relative_to(test) and p.name.endswith(".t.sol") for p in roots)
for src in roots:
    # These generated roots have only canonical source imports. Recursively
    # resolve any local test dependencies too, without modifying their bytes.
    with tempfile.TemporaryDirectory(prefix=".proof-acceptance.", dir=root) as tmp:
        scope = Path(tmp)
        seen = set()
        def copy(p):
            if p in seen:
                return
            assert p.is_file() and p.is_relative_to(test), p
            seen.add(p)
            target = scope / p.relative_to(test)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(p, target)
            assert target.read_bytes() == p.read_bytes()
            for statement in re.findall(r"\bimport\s+([^;]+);", p.read_text()):
                for dep in re.findall(r'["\x27]([^"\x27]+)["\x27]', statement):
                    if dep.startswith("."):
                        resolved = (p.parent / dep).resolve()
                        if resolved.is_relative_to(test):
                            copy(resolved)
        copy(src)
        expected = re.findall(r"\bfunction\s+(test[A-Za-z0-9_]*)\s*\(", src.read_text())
        assert expected and len(expected) == len(set(expected)), src
        for directory in ("empty-src", "empty-script"):
            (scope / directory).mkdir()
        env = dict(os.environ, FOUNDRY_SRC=str(scope / "empty-src"),
                   FOUNDRY_TEST=str(scope), FOUNDRY_SCRIPT=str(scope / "empty-script"))
        raw = subprocess.check_output(["forge", "test", "--match-path",
            str(scope / src.relative_to(test)), "--json"], env=env, text=True)
        data = json.loads(raw)
        actual = []
        for name, suite in data.items():
            assert name.split(":")[0].endswith("/" + src.name), name
            for signature, result in suite["test_results"].items():
                assert result["status"] == "Success", (name, signature, result["status"])
                actual.append(signature.split("(")[0])
        assert sorted(actual) == sorted(expected), (src, expected, actual)
        print(f"{src.relative_to(root)}: {len(actual)} tests passed: {', '.join(sorted(actual))}", flush=True)
