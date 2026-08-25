#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

python3 scripts/verify-genesis-interface-v1-freeze.py
python3 scripts/verify-genesis-interface-v1-security.py
python3 scripts/verify-420pay-implementation.py
python3 scripts/verify-420pay-hardening.py
python3 scripts/verify-420swap-interface-v1.py
python3 scripts/verify-cadc-swap.py
python3 scripts/verify-bridge-hardening.py
python3 scripts/verify-genesis-dapps.py
sha256sum -c GENESIS-INTERFACE-V1-FREEZE-SHA256SUMS.txt

if ! command -v forge >/dev/null 2>&1; then
  echo "SOLIDITY_EXECUTION=BLOCKED: forge is not installed" >&2
  exit 127
fi

cd contracts
forge --version
forge build --force
forge test --match-contract '.*(Payment|Invoice|Refund|Settlement|GasSponsor).*'
forge test --match-contract '.*Swap.*'
forge test --match-contract '.*Bridge.*'
forge test --match-test '^testFuzz_'
forge test --match-test '^invariant_'
forge test --match-contract '.*GenesisIntegration420Test'
echo "PAY_SWAP_BRIDGE_INTERFACE_V1_VERIFICATION=PASS"
