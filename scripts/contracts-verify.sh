#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ART="$ROOT/artifacts/contracts"
mkdir -p "$ART"

echo "== versions =="
{
  date -u +"timestamp_utc=%Y-%m-%dT%H:%M:%SZ"
  forge --version
  cast --version
  anvil --version
  go version
} | tee "$ART/tool-versions.txt"

echo "== go tests =="
cd "$ROOT"
go test ./... | tee "$ART/go-test.txt"

echo "== static verification =="
for s in \
  scripts/verify-420pay-parameters.py \
  scripts/verify-420pay-implementation.py \
  scripts/verify-420pay-hardening.py
do
  if [[ -f "$s" ]]; then
    python3 "$s" | tee -a "$ART/static-verification.txt"
  fi
done

echo "== forge clean/build =="
cd "$ROOT/contracts"
forge clean
forge build --force --sizes | tee "$ART/forge-build.txt"

echo "== forge unit/fuzz/invariant tests =="
FOUNDRY_PROFILE="${FOUNDRY_PROFILE:-default}" forge test -vvv | tee "$ART/forge-test.txt"

echo "== coverage =="
forge coverage --report summary | tee "$ART/forge-coverage.txt"

echo "== contract artifacts =="
find out -type f -name '*.json' -print0 | sort -z | \
  xargs -0 sha256sum > "$ART/foundry-artifact-sha256.txt"

echo "== runtime bytecode/codehash manifest =="
python3 "$ROOT/scripts/export-contract-manifest.py"

echo "ALL CONTRACT VERIFICATION STEPS PASSED"
