#!/usr/bin/env bash
# Mandatory Level 2: exact-SHA funded cross-module tests with actual runtime evidence.
set -euo pipefail
expected="${1:?exact SHA required}"
test "$(git rev-parse HEAD)" = "$expected"
export FOUNDRY_PROFILE=pr
export FOUNDRY_OUT=out-sol02-level2
export FOUNDRY_CACHE_PATH=cache-sol02-level2
tests=(
  test/PaySwapBridgeGenesisIntegration420.t.sol
  test/TokenVaultIntegration420.t.sol
  test/AIComputeIntegration420.t.sol
  test/PaymentGenesisIntegration420.t.sol
)
mkdir -p ../artifacts/sol02/level2-runtime
forge build "${tests[@]}"
for t in "${tests[@]}"; do
  test -s "$t" || { echo "Missing Level 2 test: $t" >&2; exit 1; }
  id="$(printf '%s' "$t" | sha256sum | cut -c1-16)"
  python3 scripts/sol02-execution.py --target "$t" --output "../artifacts/sol02/level2-runtime/$id.json"
done
python3 - "$expected" "${tests[@]}" <<'PY'
import hashlib,importlib.util,json,sys
from pathlib import Path
expected=sys.argv[2:]
records=[json.loads(p.read_text()) for p in sorted(Path('../artifacts/sol02/level2-runtime').glob('*.json'))]
assert {r['target'] for r in records}==set(expected), 'Missing Level 2 runtime target'
assert all(r['executed'] and r['executed']==r['discovered'] for r in records), 'Incomplete Level 2 tests'
spec=importlib.util.spec_from_file_location('plan','scripts/sol02-plan.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
closures={}
for target in expected:
    owners=sorted({m.assign(path) for path in m.dependency_closure(target) if path.startswith('src/')})
    if len(owners)<2: raise ValueError('Not an actual cross-module integration: '+target)
    closures[target]=owners
data={'schema':'420.ci.sol02.level2.v2','sha':sys.argv[1],'profile':'pr',
      'tests':expected,'runtime':records,'sourceFamilies':closures,
      'executedTests':sum(len(r['executed']) for r in records),'passed':True}
Path('../artifacts/sol02/sol02-level2.json').write_text(json.dumps(data,sort_keys=True,indent=2)+'\n')
PY
