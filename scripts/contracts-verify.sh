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
  scripts/verify-step6-contracts.py \
  scripts/verify-420pay-parameters.py \
  scripts/verify-420pay-implementation.py \
  scripts/verify-420pay-hardening.py \
  scripts/verify-420bet-roulette-release.py
do
  if [[ -f "$s" ]]; then
    python3 "$s" | tee -a "$ART/static-verification.txt"
  fi
done

echo "== verifier regression tests =="
python3 -m unittest discover -s scripts/tests -p 'test_verify_*.py' -v |& tee "$ART/verifier-tests.txt"

echo "== forge clean/build =="
cd "$ROOT/contracts"
forge clean
if ! forge build --force --sizes 2>&1 | tee "$ART/forge-build.txt"; then
  echo "== forge build isolation ==" | tee "$ART/forge-build-isolation.txt"
  isolation_failed=0

  for target in src/* test/*; do
    [[ -e "$target" ]] || continue
    echo "-- target: $target" | tee -a "$ART/forge-build-isolation.txt"
    if forge build "$target" --force --sizes >>"$ART/forge-build-isolation.txt" 2>&1; then
      echo "PASS $target" | tee -a "$ART/forge-build-isolation.txt"
      continue
    fi

    echo "FAIL $target" | tee -a "$ART/forge-build-isolation.txt"
    isolation_failed=1
    if [[ -d "$target" ]]; then
      while IFS= read -r file; do
        echo "---- file: $file" | tee -a "$ART/forge-build-isolation.txt"
        if forge build "$file" --force --sizes >>"$ART/forge-build-isolation.txt" 2>&1; then
          echo "PASS $file" | tee -a "$ART/forge-build-isolation.txt"
        else
          echo "FAIL $file" | tee -a "$ART/forge-build-isolation.txt"
        fi
      done < <(find "$target" -type f -name '*.sol' | sort)
    fi
  done

  cat "$ART/forge-build-isolation.txt"
  exit "$(( isolation_failed == 0 ? 1 : isolation_failed ))"
fi

echo "== forge unit/fuzz/invariant tests =="
FOUNDRY_PROFILE="${FOUNDRY_PROFILE:-default}" forge test -vvv | tee "$ART/forge-test.txt"

echo "== coverage =="
FOUNDRY_PROFILE=coverage forge coverage --ir-minimum --report summary |& tee "$ART/forge-coverage.txt"

echo "== contract artifacts =="
find out -type f -name '*.json' -print0 | sort -z | \
  xargs -0 sha256sum > "$ART/foundry-artifact-sha256.txt"

echo "== runtime bytecode/codehash manifest =="
python3 "$ROOT/scripts/export-contract-manifest.py"

echo "ALL CONTRACT VERIFICATION STEPS PASSED"
