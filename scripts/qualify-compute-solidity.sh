#!/usr/bin/env bash
# Run the complete retained Compute*.t.sol suite without compiling unrelated
# Solidity test/fixture trees (notably vendored CADC upstream sources).
set -euo pipefail

contracts_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts" && pwd)"
cd "$contracts_root"

shopt -s nullglob
compute_tests=(test/Compute*.t.sol)
if (( ${#compute_tests[@]} == 0 )); then
  echo "ERROR: no Compute*.t.sol tests found" >&2
  exit 1
fi

workspace="$(mktemp -d)"
trap 'rm -rf "$workspace"' EXIT
mkdir -p "$workspace/test"
# Preserve original Foundry profiles, fuzz/invariant bounds, and import paths.
cp foundry.toml "$workspace/foundry.toml"
cp -a src "$workspace/src"
cp -a "${compute_tests[@]}" "$workspace/test/"

# Stage any local test helpers explicitly imported by the retained Compute
# tests (recursively). ComputeEscrowFunding420, for example, imports Vault420.
# Never discover or compile unrelated test trees merely for convenience.
COMPUTE_SOURCE_ROOT="$contracts_root" COMPUTE_WORKSPACE="$workspace" python3 - <<'PY'
import os
from pathlib import Path
import re
import shutil

root = Path(os.environ["COMPUTE_SOURCE_ROOT"])
staged = Path(os.environ["COMPUTE_WORKSPACE"])
pattern = re.compile(r"""\bimport\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']\s*;""", re.S)
queue = list((staged / "test").glob("Compute*.t.sol"))
seen = set()
while queue:
    file = queue.pop()
    if file in seen:
        continue
    seen.add(file)
    for imported in pattern.findall(file.read_text()):
        if not imported.startswith("."):
            continue
        dep = Path(os.path.normpath(str(file.parent / imported)))
        if not dep.is_relative_to(staged):
            raise SystemExit(f"Illegal import outside scoped workspace: {file}: {imported}")
        if dep.exists():
            if dep.is_relative_to(staged / "test") and dep.suffix == ".sol":
                queue.append(dep)
            continue
        source = root / dep.relative_to(staged)
        if not source.is_file():
            raise SystemExit(f"Missing required Compute test dependency: {source}")
        dep.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dep)
        if dep.suffix == ".sol":
            queue.append(dep)
print(f"Staged {len(seen)} Compute test and explicitly imported local dependency files")
PY

# Include non-Solidity fixture data without pulling in unrelated vendored
# Solidity test fixtures that triggered the 909-file compilation.
if [[ -d test/fixtures ]]; then
  mkdir -p "$workspace/test/fixtures"
  (cd test/fixtures && find . -type f ! -name '*.sol' -print0) |
    while IFS= read -r -d '' file; do
      mkdir -p "$workspace/test/fixtures/$(dirname "$file")"
      cp "test/fixtures/$file" "$workspace/test/fixtures/$file"
    done
fi

actual=( "$workspace"/test/Compute*.t.sol )
if (( ${#actual[@]} != ${#compute_tests[@]} )); then
  echo "ERROR: Compute test inventory changed in staging" >&2
  exit 1
fi
echo "Running all ${#compute_tests[@]} retained Compute Solidity test files in isolated workspace"
# Limit Foundry's source discovery to Compute; imports still resolve against
# the complete original src tree. Test discovery contains every Compute test,
# not the unrelated fixture/test trees. The default fuzz/invariant values
# remain identical to the repository's foundry.toml.
(
  cd "$workspace"
  FOUNDRY_SRC=src/compute FOUNDRY_TEST=test forge test --match-path 'test/Compute*.t.sol' -vvv
)
