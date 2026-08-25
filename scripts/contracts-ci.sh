#!/usr/bin/env bash
set -euo pipefail
export FOUNDRY_PROFILE=ci
exec "$(dirname "$0")/contracts-verify.sh"
