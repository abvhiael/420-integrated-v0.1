#!/usr/bin/env bash
# Run inside contracts/; exact commit, isolated compilation cache, no hidden skip.
set -euo pipefail
plan="${1:?plan JSON required}"
group="${2:?group required}"
test "$(git rev-parse HEAD)" = "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["sha"])' "$plan")"
mkdir -p ../artifacts/sol02
export FOUNDRY_PROFILE="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["profile"])' "$plan")"
mapfile -t targets < <(python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); print("\n".join(p["groups"][sys.argv[2]]))' "$plan" "$group")
(( ${#targets[@]} > 0 )) || { echo "Empty group $group" >&2; exit 1; }
# Each group has its own compilation cache/output; never share mutable build state
# between separate Foundry profiles or qualification groups.
export FOUNDRY_OUT="out-sol02-$group"
export FOUNDRY_CACHE_PATH="cache-sol02-$group"
echo "CI-SOL-02 group=$group profile=$FOUNDRY_PROFILE targets=${#targets[@]}"
# Multiplayer proofs are retained as a checksum-pinned archive, not loose Git files.
# Restore and verify authentic artifacts only for the group that executes 6.10.
if [[ "$group" == "420bet--01" ]]; then
  python3 ../scripts/bet/package-poker-5a10-evidence.py --verify
  # Restore only checksum-manifested canonical tournament proofs for inherited 5C.5 tests.
  python3 ../scripts/bet/unpack-poker-5c5-evidence.py
  # Tournament 5C.5 context commitments were generated under canonical solc 0.8.30.
  # Keep the proof and address commitments exact; do not rewrite fixture witnesses.
  export FOUNDRY_SOLC_VERSION="0.8.30"
fi
forge build "${targets[@]}"
mapfile -t tests < <(printf '%s\n' "${targets[@]}" | grep '^test/.*\.sol$' || true)
for target in "${tests[@]}"; do
  forge test --match-path "$target" -vv
done
python3 - "$plan" "$group" <<'PY'
import json,sys
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text())
group=sys.argv[2]
result={key:p[key] for key in ("schema","sha","profile","inventory_sha256")}
result.update(group=group,targets=p["groups"][group],passed=True,tests=sum(t.startswith("test/") for t in p["groups"][group]))
Path("../artifacts/sol02/sol02-"+group+".json").write_text(json.dumps(result,sort_keys=True,indent=2)+"\n")
PY
