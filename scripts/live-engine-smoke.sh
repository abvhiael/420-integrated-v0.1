#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
GETH="${NODE420_GETH:-$ROOT/bin/upstream/geth-v1.17.5-420}"
DATADIR="${NODE420_DATADIR:-$ROOT/devnet-data/live-engine/node420}"
JWT="${NODE420_JWT:-$ROOT/devnet-data/live-engine/jwt.hex}"
GENESIS="$ROOT/execution/genesis/execution-genesis.json"
AUTH_PORT="${NODE420_AUTH_PORT:-8551}"
RPC_PORT="${NODE420_RPC_PORT:-8545}"
mkdir -p "$(dirname "$JWT")" "$DATADIR"
"$ROOT/bin/node420" --geth "$GETH" --verify-geth
[ -f "$JWT" ] || bash "$ROOT/scripts/generate-jwt.sh" "$JWT"
"$ROOT/bin/node420" --geth "$GETH" --datadir "$DATADIR" --init-genesis "$GENESIS"
"$ROOT/bin/node420" --geth "$GETH" --datadir "$DATADIR" --jwt-secret "$JWT" \
  --authrpc.addr 127.0.0.1 --authrpc.port "$AUTH_PORT" \
  --http.addr 127.0.0.1 --http.port "$RPC_PORT" --port 0 \
  -- --ipcdisable --nodiscover --maxpeers 0 >"$DATADIR/node420.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT INT TERM
i=0
until "$ROOT/bin/fourtwentyd" --engine-probe --engine "http://127.0.0.1:$AUTH_PORT" --jwt-secret "$JWT"; do
  kill -0 "$PID" 2>/dev/null || { cat "$DATADIR/node420.log" >&2; exit 1; }
  i=$((i+1))
  [ "$i" -lt 30 ] || { echo "Engine API did not become ready" >&2; exit 1; }
  sleep 1
done
go build -o "$ROOT/bin/engine-live-smoke" ./integration/cmd/engine-live-smoke
"$ROOT/bin/engine-live-smoke" \
  --engine "http://127.0.0.1:$AUTH_PORT" \
  --rpc "http://127.0.0.1:$RPC_PORT" \
  --jwt-secret "$JWT"
echo "LIVE_ENGINE_SMOKE=PASS"
