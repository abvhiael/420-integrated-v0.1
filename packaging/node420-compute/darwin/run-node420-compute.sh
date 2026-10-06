#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${1:-/Library/Application Support/420Integrated/node420-compute/worker.args}"
BINARY="${NODE420_COMPUTE_BINARY:-$SCRIPT_DIR/node420-compute}"

if [[ ! -x "$BINARY" ]]; then
  echo "node420-compute launcher: binary not executable: $BINARY" >&2
  exit 2
fi
if [[ ! -f "$CONFIG" ]]; then
  echo "node420-compute launcher: config not found: $CONFIG" >&2
  exit 2
fi

args=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  args+=("$line")
done < "$CONFIG"

exec "$BINARY" "${args[@]}"
