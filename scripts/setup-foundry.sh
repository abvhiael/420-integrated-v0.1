#!/usr/bin/env bash
set -euo pipefail

# Official Foundry bootstrap. Run only on a networked developer/CI host.
curl -L https://getfoundry.sh/install | bash

export PATH="${HOME}/.foundry/bin:${PATH}"
foundryup

echo "=== Foundry toolchain ==="
forge --version
cast --version
anvil --version
chisel --version || true

echo "=== 420 contract configuration ==="
cd "$(dirname "$0")/../contracts"
forge config
