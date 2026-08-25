#!/usr/bin/env bash
set -euo pipefail
export FOUNDRY_PROFILE=ci
exec bash "$(dirname "$0")/contracts-verify.sh"
