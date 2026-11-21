#!/usr/bin/env bash
# Source only from contracts/. Reuse audited CADC dependencies across the full
# Solidity shard inventory and the focused import-closure compilation.
# Reuse the pinned CADC upstream sources rather than downloading new vendor dependencies.
for dependency in \
  test/fixtures/cadc/upstream/@openzeppelin/contracts/utils/introspection/IERC165.sol \
  test/fixtures/cadc/upstream/@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol \
  test/fixtures/cadc/upstream/solidity-bytes-utils/contracts/BytesLib.sol; do
  if [[ ! -f "$dependency" ]]; then
    echo "Missing pinned CADC source: $dependency" >&2
    exit 1
  fi
done
pinned_remappings="$(printf '%s\n' \
  '@openzeppelin/=test/fixtures/cadc/upstream/@openzeppelin/' \
  '@layerzerolabs/=test/fixtures/cadc/upstream/@layerzerolabs/' \
  'solidity-bytes-utils/=test/fixtures/cadc/upstream/solidity-bytes-utils/')"
if [[ -n "${FOUNDRY_REMAPPINGS:-}" ]]; then
  FOUNDRY_REMAPPINGS="$(printf '%s\n%s' "$FOUNDRY_REMAPPINGS" "$pinned_remappings")"
else
  FOUNDRY_REMAPPINGS="$pinned_remappings"
fi
export FOUNDRY_REMAPPINGS
