#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

GETH="${NODE420_GETH:-$ROOT/bin/upstream/geth-v1.17.5}"
GENESIS="$ROOT/execution/genesis/execution-genesis.json"

"$ROOT/bin/node420" --geth "$GETH" --verify-geth

i=0
while [ "$i" -lt 15 ]; do
  DIR="$ROOT/devnet-data/real15/node-$i"
  mkdir -p "$DIR/execution" "$DIR/consensus"
  if [ ! -f "$DIR/jwt.hex" ]; then
    "$ROOT/scripts/generate-jwt.sh" "$DIR/jwt.hex"
  fi
  if [ ! -d "$DIR/execution/geth" ]; then
    "$ROOT/bin/node420" --geth "$GETH" \
      --datadir "$DIR/execution" \
      --init-genesis "$GENESIS"
  fi
  i=$((i+1))
done

echo "REAL_DEVNET15_PREPARED=PASS"
