#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== 420 Contract Dev Environment =="
command -v forge >/dev/null || { echo "forge missing"; exit 2; }
command -v cast >/dev/null || { echo "cast missing"; exit 2; }
command -v anvil >/dev/null || { echo "anvil missing"; exit 2; }

echo "forge: $(forge --version | head -n1)"
echo "cast:  $(cast --version | head -n1)"
echo "anvil: $(anvil --version | head -n1)"
echo "go:    $(go version)"

cd contracts
forge config >/tmp/420-forge-config.txt
grep -E 'solc|evm_version|optimizer|optimizer_runs' /tmp/420-forge-config.txt || true
echo "bootstrap OK"
