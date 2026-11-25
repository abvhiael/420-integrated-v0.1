#!/usr/bin/env python3
"""Run the existing Foundry selector with only its verbatim test import closure.

Invoke from contracts/. Preserve the caller's Foundry profile, compiler,
fuzz/invariant settings, selectors and verbosity; change discovery roots only.
"""
import glob
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

root = Path.cwd().resolve()
test = root / "test"
assert test.is_dir() and (root / "foundry.toml").is_file()
pattern, *args = sys.argv[1:]
assert pattern.startswith("test/") and ".." not in Path(pattern).parts
roots = sorted(Path(p).resolve() for p in glob.glob(pattern, recursive=True))
assert roots and all(p.is_file() and p.is_relative_to(test) and p.name.endswith(".t.sol") for p in roots), pattern
assert ("--match-path" in args) != ("--match-contract" in args)
with tempfile.TemporaryDirectory(prefix=".scoped-foundry.", dir=root) as tmp:
    scope = Path(tmp)
    seen = set()
    def copy(src):
        if src in seen:
            return
        assert src.is_file() and src.is_relative_to(test), src
        seen.add(src)
        target = scope / src.relative_to(test)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        assert src.read_bytes() == target.read_bytes()
        for statement in re.findall(r"\bimport\s+([^;]+);", src.read_text()):
            for dep in re.findall(r'["\x27]([^"\x27]+)["\x27]', statement):
                if dep.startswith("."):
                    resolved = (src.parent / dep).resolve()
                    if resolved.is_relative_to(test):
                        copy(resolved)
    for src in roots:
        copy(src)
    print("Mandatory test roots:", ", ".join(str(p.relative_to(root)) for p in roots), flush=True)
    print("Verbatim test closure:", ", ".join(str(p.relative_to(root)) for p in sorted(seen)), flush=True)
    if "--match-path" in args:
        i = args.index("--match-path") + 1
        assert args[i] == pattern
        args[i] = str(scope / pattern.removeprefix("test/"))
    env = dict(os.environ, FOUNDRY_SRC=str(scope / "empty-src"),
               FOUNDRY_TEST=str(scope), FOUNDRY_SCRIPT=str(scope / "empty-script"),
               NO_COLOR="1")
    (scope / "empty-src").mkdir()
    (scope / "empty-script").mkdir()
    result = subprocess.Popen(["forge", "test", *args], env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    passed = False
    for line in result.stdout:
        print(line, end="", flush=True)
        if re.search(r"\b[1-9]\d* tests? passed\b", line):
            passed = True
    code = result.wait()
    if code:
        sys.exit(code)
    if not passed:
        raise SystemExit("No successful tests reported by scoped Foundry execution")
