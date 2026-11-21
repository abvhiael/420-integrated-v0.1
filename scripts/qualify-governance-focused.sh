#!/usr/bin/env bash
# Qualify the exact retained Governance tests without compiling unrelated vendored test fixtures.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts"
WORKDIR="$(mktemp -d "$PWD/test-governance-focused.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT
shopt -s nullglob
tests=(test/Civic*.t.sol test/Governance*.t.sol)
if (( ${#tests[@]} == 0 )); then
  echo "Governance regression test inventory is empty" >&2
  exit 1
fi
cp "${tests[@]}" "$WORKDIR/"
echo "Governance focused Foundry inventory: ${#tests[@]} original test files"
# All original Civic/Governance tests are run with their assertions unchanged.
# Restricting Foundry's discovery root excludes unrelated vendored CADC/LayerZero fixtures.
FOUNDRY_SRC=src/governance FOUNDRY_TEST="${WORKDIR#"$PWD/"}" forge test -vv
