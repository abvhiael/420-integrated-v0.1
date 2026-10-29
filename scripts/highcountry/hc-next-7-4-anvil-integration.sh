#!/usr/bin/env bash
set -euo pipefail
: "${HIGHCOUNTRY_CUP_POSTGRES_TEST_URL:?isolated PostgreSQL URL required}"
export HIGHCOUNTRY_CUP_ANVIL_RPC="http://127.0.0.1:8545"
# Public Anvil deterministic development account ONLY; never use for real networks.
export HIGHCOUNTRY_CUP_ANVIL_SENDER="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
ANVIL_DEV_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
anvil --chain-id 420 --port 8545 --silent > /tmp/highcountry-cup-anvil.log 2>&1 &
anvil_pid=$!
trap 'kill "$anvil_pid" 2>/dev/null || true' EXIT
for i in $(seq 1 40); do
  if cast block-number --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" >/dev/null 2>&1;then break;fi
  sleep 0.5
done
deployment=$(cd contracts && forge create test/highcountry/integration/cup/CupHttpAnvilFixture.sol:CupHttpAnvilFixture --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" --private-key "$ANVIL_DEV_KEY" --broadcast --json)
export HIGHCOUNTRY_CUP_ANVIL_FIXTURE=$(printf '%s' "$deployment" | python3 -c 'import json,sys; x=json.load(sys.stdin); print(x.get("deployedTo") or x.get("deployed_to") or x.get("contractAddress") or "")')
test -n "$HIGHCOUNTRY_CUP_ANVIL_FIXTURE"
fixture="$HIGHCOUNTRY_CUP_ANVIL_FIXTURE"
readFixture(){
  cast call "$fixture" "$1" --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC"
}
warp(){
  # cast may show a decimal number with a human-readable annotation, e.g. 123 [1.23e2].
  # Normalize without trusting arbitrary text or passing decimals directly to Anvil.
  local raw="$1" timestamp quantity
  if [[ "$raw" =~ ^[[:space:]]*(0x[0-9a-fA-F]+|[0-9]+)([[:space:]]*\[[[:space:]]*([0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?|uint(8|16|32|64|128|256))[[:space:]]*\])?[[:space:]]*$ ]]; then
    timestamp="${BASH_REMATCH[1]}"
  else
    echo "invalid Anvil timestamp: $raw" >&2; return 1
  fi
  if [[ "$timestamp" == 0x* ]]; then
    quantity="$timestamp"
  else
    printf -v quantity '0x%x' "$timestamp"
  fi
  cast rpc --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" evm_setNextBlockTimestamp "$quantity" > /dev/null
}
sendFixture(){
  cast send "$fixture" "$1" --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" --private-key "$ANVIL_DEV_KEY" > /dev/null
}
warp "$(readFixture 'openA()(uint64)')"
sendFixture 'scoreSemis()'
warp "$(($(readFixture 'closeA()(uint64)') + 100))"
sendFixture 'finalizeSemis()'
warp "$(readFixture 'openF()(uint64)')"
sendFixture 'scoreFinal()'
warp "$(($(readFixture 'closeF()(uint64)') + 100))"
sendFixture 'finalizeCup()'
export HIGHCOUNTRY_CUP_ANVIL_CUP=$(readFixture 'cup()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ENGINE=$(readFixture 'engine()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ID=$(readFixture 'CUP()(bytes32)')
cd services/420-gaming-player-profile
node --test test/highcountry-cup-anvil.integration.mjs
\\r'/}"
  raw="${raw//
  cast rpc --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" evm_setNextBlockTimestamp "$quantity" > /dev/null
}
sendFixture(){
  cast send "$fixture" "$1" --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" --private-key "$ANVIL_DEV_KEY" > /dev/null
}
warp "$(readFixture 'openA()(uint64)')"
sendFixture 'scoreSemis()'
warp "$(($(readFixture 'closeA()(uint64)') + 100))"
sendFixture 'finalizeSemis()'
warp "$(readFixture 'openF()(uint64)')"
sendFixture 'scoreFinal()'
warp "$(($(readFixture 'closeF()(uint64)') + 100))"
sendFixture 'finalizeCup()'
export HIGHCOUNTRY_CUP_ANVIL_CUP=$(readFixture 'cup()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ENGINE=$(readFixture 'engine()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ID=$(readFixture 'CUP()(bytes32)')
cd services/420-gaming-player-profile
node --test test/highcountry-cup-anvil.integration.mjs
\\n'/}"
  if [[ "$raw" =~ ^[[:space:]]*(0x[0-9a-fA-F]+|[0-9]+)([[:space:]]*\\[[[:space:]]*uint(8|16|32|64|128|256)[[:space:]]*\\])?[[:space:]]*$ ]]; then
    timestamp="${BASH_REMATCH[1]}"
  else
    echo "invalid Anvil timestamp" >&2; return 1
  fi
  if [[ "$timestamp" == 0x* ]]; then
    quantity="$timestamp"
  else
    printf -v quantity '0x%x' "$timestamp"
  fi
  cast rpc --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" evm_setNextBlockTimestamp "$quantity" > /dev/null
}
sendFixture(){
  cast send "$fixture" "$1" --rpc-url "$HIGHCOUNTRY_CUP_ANVIL_RPC" --private-key "$ANVIL_DEV_KEY" > /dev/null
}
warp "$(readFixture 'openA()(uint64)')"
sendFixture 'scoreSemis()'
warp "$(($(readFixture 'closeA()(uint64)') + 100))"
sendFixture 'finalizeSemis()'
warp "$(readFixture 'openF()(uint64)')"
sendFixture 'scoreFinal()'
warp "$(($(readFixture 'closeF()(uint64)') + 100))"
sendFixture 'finalizeCup()'
export HIGHCOUNTRY_CUP_ANVIL_CUP=$(readFixture 'cup()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ENGINE=$(readFixture 'engine()(address)')
export HIGHCOUNTRY_CUP_ANVIL_ID=$(readFixture 'CUP()(bytes32)')
cd services/420-gaming-player-profile
node --test test/highcountry-cup-anvil.integration.mjs
