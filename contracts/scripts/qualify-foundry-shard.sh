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
# Shared CADC dependency remappings are validated by the focused import-closure CI.
source scripts/cadc-foundry-env.sh
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
printf '%s\n' "${all[@]}" > "../artifacts/contracts/primary-inventory-shard-${shard}.txt"
# Compile the complete assigned primary inventory in bounded deterministic
# batches. A single large via-IR compiler invocation expands to ~1000 sources
# and repeatedly loses hosted runners. No targets or assertions are omitted.
contexts=16
for (( segment=0; segment<contexts; segment++ )); do
  batch=()
  for (( i=segment; i<${#targets[@]}; i+=contexts )); do
    batch+=("${targets[i]}")
  done
  if (( ${#batch[@]} == 0 )); then echo "Empty batch $segment" >&2; exit 1; fi
  echo "=== COMPILE BATCH $segment/$contexts: ${#batch[@]} primaries ==="
  forge build "${batch[@]}"
  python3 scripts/coverage-foundry-shard.py --capture-compiled-batch "$shard" "$count" "$segment" "$contexts"
done
# The canonical dependency graph is the exact-SHA union of real compiler caches.
python3 scripts/coverage-foundry-shard.py --snapshot-canonical-graph "$shard" "$count"
# Preserve full deployable bytecode size checks, in bounded source-only batches.
if (( ${#sources[@]} )); then
  for (( segment=0; segment<contexts; segment++ )); do
    source_batch=()
    for (( i=segment; i<${#sources[@]}; i+=contexts )); do
      source_batch+=("${sources[i]}")
    done
    if (( ${#source_batch[@]} )); then
      echo "=== DEPLOYABLE SIZE BATCH $segment/$contexts: ${#source_batch[@]} primaries ==="
      forge build --sizes "${source_batch[@]}"
    fi
  done
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
