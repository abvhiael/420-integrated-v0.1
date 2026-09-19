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
# Compile every assigned source, test and script, without applying EIP-170 limits
# to test harnesses and deployment scripts (which are not deployed on-chain).
# A compiler error still fails the shard.
forge build --force "${targets[@]}"
# Enforce the runtime/initcode size gate separately on the production sources.
# Never disable the size gate on actual deployable contracts just to make CI green.
if (( ${#sources[@]} )); then
  echo "=== DEPLOYABLE SOURCE SIZE CHECK: ${#sources[@]} sources ==="
  forge build --force --sizes "${sources[@]}"
fi
# Match one test source at a time to avoid Foundry compiling the entire test tree.
# Do not ignore failed test subprocesses; aggregate status is a strict AND.
for target in "${tests[@]}"; do
  echo "=== TEST $target ==="
  forge test --match-path "$target" -vv
  echo "=== PASSED $target ==="
done
echo "SHARD $shard COMPLETE: compilation, deployable size checks and assigned tests passed"
