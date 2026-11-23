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
cp -a test/helpers "$workspace/test/helpers"
cp -a "${compute_tests[@]}" "$workspace/test/"

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
