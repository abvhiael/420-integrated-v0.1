#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
GETH="${NODE420_GETH:-$ROOT/bin/upstream/geth-v1.17.5-420}"
DATADIR="${NODE420_DATADIR:-$ROOT/devnet-data/live-engine/node420}"
JWT="${NODE420_JWT:-$ROOT/devnet-data/live-engine/jwt.hex}"
GENESIS="$ROOT/execution/genesis/execution-genesis.json"
mkdir -p "$(dirname "$JWT")" "$DATADIR"
"$ROOT/bin/node420" --geth "$GETH" --verify-geth
[ -f "$JWT" ] || bash "$ROOT/scripts/generate-jwt.sh" "$JWT"
"$ROOT/bin/node420" --geth "$GETH" --datadir "$DATADIR" --init-genesis "$GENESIS"
"$ROOT/bin/node420" --geth "$GETH" --datadir "$DATADIR" --jwt-secret "$JWT" \
  --authrpc.addr 127.0.0.1 --authrpc.port 8551 \
  --http.addr 127.0.0.1 --http.port 8545 >"$DATADIR/node420.log" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT INT TERM
i=0
until "$ROOT/bin/fourtwentyd" --engine-probe --engine http://127.0.0.1:8551 --jwt-secret "$JWT"; do
  i=$((i+1))
  [ "$i" -lt 30 ] || { echo "Engine API did not become ready" >&2; exit 1; }
  sleep 1
done
go build -o "$ROOT/bin/engine-live-smoke" ./integration/cmd/engine-live-smoke
"$ROOT/bin/engine-live-smoke" \
  --engine http://127.0.0.1:8551 \
  --rpc http://127.0.0.1:8545 \
  --jwt-secret "$JWT"
echo "LIVE_ENGINE_SMOKE=PASS"
