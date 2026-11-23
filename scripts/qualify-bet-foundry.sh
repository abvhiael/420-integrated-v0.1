#!/usr/bin/env bash
# Qualify an explicit Bet Solidity test inventory without discovering unrelated
# vendored CADC/LayerZero tests. Never omit a caller-requested test file.
# Usage: bash ../scripts/qualify-bet-foundry.sh test/BetFoo.t.sol [test/BetBar.t.sol ...] -- [forge test flags]
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts" && pwd)"
cd "$root"
files=()
while (( $# > 0 )) && [[ "$1" != "--" ]]; do files+=("$1"); shift; done
if (( $# > 0 )); then shift; fi
if (( ${#files[@]} == 0 )); then echo "BET qualification needs an explicit test inventory" >&2; exit 2; fi
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/test"
cp foundry.toml "$stage/foundry.toml"
[[ ! -f remappings.txt ]] || cp remappings.txt "$stage/remappings.txt"
cp -a src "$stage/src"
[[ ! -d config ]] || cp -a config "$stage/config"
for f in "${files[@]}"; do
 [[ "$f" == test/*.t.sol && -f "$f" ]] || { echo "Refusing absent/non-Test Solidity file: $f" >&2; exit 2; }
 cp "$f" "$stage/test/${f##*/}"
done
BET_CONTRACTS_ROOT="$root" BET_WORKSPACE="$stage" python3 - <<'PY'
import os, re, shutil
from pathlib import Path
root, stage = Path(os.environ['BET_CONTRACTS_ROOT']),Path(os.environ['BET_WORKSPACE'])
pattern=re.compile(r"""\bimport\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']\s*;""",re.S)
queue=list((stage/'test').glob('*.t.sol'))
seen=set()
while queue:
    f=queue.pop()
    if f in seen: continue
    seen.add(f)
    for source in pattern.findall(f.read_text()):
        if not source.startswith('.'): continue
        target=(f.parent/source).resolve()
        if not target.is_relative_to(stage.resolve()): raise SystemExit('Refused nonlocal test import '+source)
        if target.exists():
            if target.is_relative_to(stage/'test') and target.suffix=='.sol':queue.append(target)
            continue
        original=root/target.relative_to(stage)
        if not original.is_file(): raise SystemExit('Missing required Bet test import '+str(original))
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(original,target)
        if target.suffix=='.sol':queue.append(target)
print('Bet Solidity isolated test/dependency inventory:',len(seen))
PY
# Retain non-Solidity fixture data; never compile vendored fixture contracts.
if [[ -d test/fixtures ]]; then
 while IFS= read -r -d '' f; do
   mkdir -p "$stage/$(dirname "$f")"
   cp "$f" "$stage/$f"
 done < <(find test/fixtures -type f ! -name '*.sol' -print0)
fi
for f in "${files[@]}"; do test -f "$stage/$f"; done
echo "Running all ${#files[@]} caller-required Bet tests in a scoped Foundry workspace"
(cd "$stage" && FOUNDRY_SRC=src/bet FOUNDRY_TEST=test forge test "$@")
