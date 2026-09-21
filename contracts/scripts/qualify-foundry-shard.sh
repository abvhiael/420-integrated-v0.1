#!/usr/bin/env bash
# Run from contracts/. Every primary Solidity source, test, and script is assigned
# deterministically to exactly one shard. Imported dependencies are also compiled.
set -euo pipefail
shard="${1:?shard index required}"
count="${2:?shard count required}"
if ! [[ "$shard" =~ ^[0-9]+$ && "$count" =~ ^[0-9]+$ ]] || (( count < 1 || shard >= count )); then
  echo "Invalid shard $shard / $count" >&2
  exit 2
fi
mapfile -t all < <(find src test script -type f -name '*.sol' | LC_ALL=C sort)
if (( ${#all[@]} == 0 )); then echo 'No Solidity primary sources found' >&2; exit 1; fi
targets=()
sources=()
tests=()
for i in "${!all[@]}"; do
  if (( i % count == shard )); then
    target="${all[$i]}"
    targets+=("$target")
    [[ "$target" == src/* ]] && sources+=("$target")
    [[ "$target" == test/* ]] && tests+=("$target")
  fi
done
if (( ${#targets[@]} == 0 )); then echo "EMPTY SHARD $shard" >&2; exit 1; fi
printf 'Shard %s/%s: %s primary units, %s deployable sources and %s test sources, from %s total primary units\n' \
  "$shard" "$count" "${#targets[@]}" "${#sources[@]}" "${#tests[@]}" "${#all[@]}"
printf '%s\n' "${targets[@]}" > "../artifacts/contracts/shard-${shard}-targets.txt"
# Compile all assigned sources, tests and scripts; compiler errors fail immediately.
forge build --force "${targets[@]}"
# Enforce deployable runtime/initcode limits on production sources only.
if (( ${#sources[@]} )); then
  echo "=== DEPLOYABLE SOURCE SIZE CHECK: ${#sources[@]} sources ==="
  forge build --force --sizes "${sources[@]}"
fi
# Run EVERY assigned test file, even if an earlier file fails, to expose the
# complete list of failing test files in one CI pass. Never hide the failure:
# an unsuccessful test subprocess makes the aggregate shard exit nonzero.
failed_tests=()
for target in "${tests[@]}"; do
  echo "=== TEST $target ==="
  if forge test --match-path "$target" -vv; then
    echo "=== PASSED $target ==="
  else
    failed_tests+=("$target")
    echo "=== FAILED $target ===" >&2
  fi
done
if (( ${#failed_tests[@]} )); then
  printf 'SHARD %s FAILED: %s/%s assigned test files failed:\n' "$shard" "${#failed_tests[@]}" "${#tests[@]}" >&2
  printf '  %s\n' "${failed_tests[@]}" >&2
  exit 1
fi
echo "SHARD $shard COMPLETE: compilation, deployable size checks and all assigned tests passed"
