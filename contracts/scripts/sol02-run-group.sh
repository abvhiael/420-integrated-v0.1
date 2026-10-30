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
mkdir -p ../artifacts/sol02/runtime-"$group"
for target in "${tests[@]}"; do
  id="$(printf '%s' "$target" | sha256sum | cut -c1-16)"
  python3 scripts/sol02-execution.py --target "$target" --output "../artifacts/sol02/runtime-$group/$id.json"
done
python3 - "$plan" "$group" <<'PY'
import hashlib,json,sys
from pathlib import Path
p=json.loads(Path(sys.argv[1]).read_text())
group=sys.argv[2]
records=[json.loads(f.read_text()) for f in sorted(Path('../artifacts/sol02/runtime-'+group).glob('*.json'))]
expected=set(t for t in p['groups'][group] if t.startswith('test/') and t.endswith('.sol'))
assert {r['target'] for r in records}==expected, 'Missing test-target runtime record'
executed=[(e['contract'],e['test']) for r in records for e in r.get('executed',[])]
assert len(executed)==len(set(executed)), 'Duplicate runtime test result'
assert executed, 'Empty runtime test inventory'
result={key:p[key] for key in ('schema','sha','profile','inventory_sha256')}
result.update(group=group,targets=p['groups'][group],passed=True,
              runtime=records,runtimeTestCount=len(executed))
Path('../artifacts/sol02/sol02-'+group+'.json').write_text(json.dumps(result,sort_keys=True,indent=2)+'\n')
PY
