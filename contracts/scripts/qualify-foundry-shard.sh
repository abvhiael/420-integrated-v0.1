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
# CADC provider fixtures include the audited upstream libraries at a retained,
# content-hashed path rather than NPM/vendor installations. Resolve their canonical
# import names without downloading dependencies or dropping primary test files.
# This fixes unrelated LayerZero/OpenZeppelin import failures in clean Level 3 shards.
for dependency in \
  test/fixtures/cadc/upstream/@openzeppelin/contracts/utils/introspection/IERC165.sol \
  test/fixtures/cadc/upstream/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol \
  test/fixtures/cadc/upstream/solidity-bytes-utils/contracts/BytesLib.sol; do
  if [[ ! -f "$dependency" ]]; then
    echo "Missing retained upstream CADC dependency: $dependency" >&2
    exit 1
  fi
done
pinned_remappings="$(printf '%s\n' \
  '@openzeppelin/=test/fixtures/cadc/upstream/@openzeppelin/' \
  '@layerzerolabs/=test/fixtures/cadc/upstream/@layerzerolabs/' \
  'solidity-bytes-utils/=test/fixtures/cadc/upstream/solidity-bytes-utils/')"
FOUNDRY_REMAPPINGS="${FOUNDRY_REMAPPINGS:-}"
if [[ -n "$FOUNDRY_REMAPPINGS" ]]; then FOUNDRY_REMAPPINGS+=
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
# Compile all assigned sources, tests and scripts; compiler errors fail immediately.
forge build "${targets[@]}"
# Retain the complete graph before sparse test commands prune the live cache.
python3 scripts/coverage-foundry-shard.py --snapshot-canonical-graph "$shard" "$count"
# Enforce deployable runtime/initcode limits on production sources only. Reuse the\n# first build cache rather than forcing a second cold compilation.
if (( ${#sources[@]} )); then
  echo "=== DEPLOYABLE SOURCE SIZE CHECK: ${#sources[@]} sources ==="
  forge build --sizes "${sources[@]}"
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
\n'; fi
FOUNDRY_REMAPPINGS+="$pinned_remappings"
export FOUNDRY_REMAPPINGS
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
# Compile all assigned sources, tests and scripts; compiler errors fail immediately.
forge build "${targets[@]}"
# Retain the complete graph before sparse test commands prune the live cache.
python3 scripts/coverage-foundry-shard.py --snapshot-canonical-graph "$shard" "$count"
# Enforce deployable runtime/initcode limits on production sources only. Reuse the\n# first build cache rather than forcing a second cold compilation.
if (( ${#sources[@]} )); then
  echo "=== DEPLOYABLE SOURCE SIZE CHECK: ${#sources[@]} sources ==="
  forge build --sizes "${sources[@]}"
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
