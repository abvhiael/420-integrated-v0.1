#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT/contracts"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required for the pinned Step 6.1 compile pipeline" >&2
  exit 2
fi

forge --version
forge build --force

mkdir -p artifacts
python3 "$ROOT/scripts/export-foundry-artifacts.py"

echo "SYSTEM_CONTRACT_COMPILE=PASS"
