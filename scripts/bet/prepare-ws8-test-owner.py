#!/usr/bin/env python3
"""Copy only the transitive WS8 test owners into an isolated Foundry directory."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]/'contracts/test'
out=root/'ws8-focused';out.mkdir(exist_ok=True)
seen=set()
def copy(name):
 if name in seen:return
 source=root/name
 if not source.is_file():raise SystemExit('missing WS8 test dependency '+name)
 seen.add(name);body=source.read_text(encoding='utf-8')
 for dep in re.findall(r'import\s+["\x27](\./[^"\x27]+)["\x27]\s*;',body):copy(Path(dep).name)
 (out/name).write_text(body.replace('../src/','../../src/'),encoding='utf-8')
for name in ('BetPokerWS8FrozenHandContext54.t.sol','BetPokerIntegratedAdversarial54.t.sol'):copy(name)
print('Prepared isolated actual WS8 owners:',', '.join(sorted(seen)))
