#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fetch_one() {
  git clone --quiet --depth 1 --filter=blob:none "https://github.com/abvhiael/$1.git" "$TMP/$1"
  git -C "$TMP/$1" checkout --quiet --detach "$2"
  test "$(git -C "$TMP/$1" rev-parse HEAD)" = "$2"
}
fetch_one 420-budtender 9ab751e3cdf1fa2e8725dda0981749208ab038f5
fetch_one 420-green-road fb0c2e72730c4a562cb465fdc526036d79164766
fetch_one 420-smoke-and-chrome 861feb3561ed22dd6c8c8a8209c30321bab3e599
mkdir -p "$ROOT/clients/budtender-access-v1/src" "$ROOT/clients/greenroad-access-v1/src" "$ROOT/clients/smoke-chrome-access-v1/src"
cp "$TMP/420-budtender/clients/budtender-access-v1/src/access.js" "$ROOT/clients/budtender-access-v1/src/access.js"
sed 's|from "@420/gaming-sdk"|from "../../../packages/420-gaming-sdk/src/index.js"|' "$TMP/420-green-road/src/access.js" > "$ROOT/clients/greenroad-access-v1/src/access.js"
sed 's|from "@420/gaming-sdk"|from "../../../packages/420-gaming-sdk/src/index.js"|' "$TMP/420-smoke-and-chrome/src/access.js" > "$ROOT/clients/smoke-chrome-access-v1/src/access.js"
for game in budtender greenroad smoke-chrome; do
  echo '{"type":"module"}' > "$ROOT/clients/$game-access-v1/package.json"
done
node --check "$ROOT/clients/budtender-access-v1/src/access.js"
node --check "$ROOT/clients/greenroad-access-v1/src/access.js"
node --check "$ROOT/clients/smoke-chrome-access-v1/src/access.js"
echo "External source pins verified; isolated test adapters staged."
