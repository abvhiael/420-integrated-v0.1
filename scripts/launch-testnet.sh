#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

echo "Running public-testnet preflight..."
python3 scripts/testnet-preflight.py

echo "Preflight passed."
echo "This script intentionally does not provision cloud infrastructure."
echo "Use the approved deployment environment to start bootnodes, RPC nodes, validators, explorer and faucet."
echo "PUBLIC_TESTNET_LAUNCH_AUTHORIZED=PASS"
