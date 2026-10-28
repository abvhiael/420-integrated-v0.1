#!/usr/bin/env bash
# Exact SHA Level 2: run retained cross-protocol integration/security tests.
set -euo pipefail
expected="${1:?exact candidate SHA required}"
test "$(git rev-parse HEAD)" = "$expected"
export FOUNDRY_PROFILE=pr
export FOUNDRY_OUT=out-sol02-level2
export FOUNDRY_CACHE_PATH=cache-sol02-level2
tests=(
  test/PaySwapBridgeGenesisIntegration420.t.sol
  test/TokenVaultIntegration420.t.sol
  test/AIComputeIntegration420.t.sol
  test/PaymentGenesisIntegration420.t.sol
)
for t in "${tests[@]}"; do
  test -s "$t" || { echo "Missing mandatory L2 test $t" >&2; exit 1; }
done
forge build "${tests[@]}"
for t in "${tests[@]}"; do
  echo "=== LEVEL 2 INTEGRATION: $t ==="
  forge test --match-path "$t" -vv
done
mkdir -p ../artifacts/sol02
python3 - "$expected" "${tests[@]}" <<'PY'
import json,sys
from pathlib import Path
Path("../artifacts/sol02/sol02-level2.json").write_text(json.dumps({
    "schema":"420.ci.sol02.level2.v1",
    "sha":sys.argv[1],
    "profile":"pr",
    "tests":sys.argv[2:],
    "passed":True
},sort_keys=True,indent=2)+"\n")
PY
