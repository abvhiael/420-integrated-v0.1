#!/usr/bin/env python3
"""Extract the production-funded contract ABI context from an executed trace."""
import json,re,sys
from pathlib import Path
if len(sys.argv)!=3:raise SystemExit('usage: export-ws8-context.py forge.log output-directory')
s=Path(sys.argv[1]).read_text(encoding='utf-8')
if '[PASS] testFreezeCanonicalFundedHandContext()' not in s and '[PASS] testExportFundedContextForProver()' not in s:raise SystemExit('executed passing context test required')
m=re.findall(r'emit WS8StatementContext\(encoded: (0x[0-9a-fA-F]+)\)',s)
if len(m)!=1:raise SystemExit('one actual contract context emission required')
b=bytes.fromhex(m[0][2:])
if len(b)!=34*32:raise SystemExit('wrong ABI length')
out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
(out/'context.bin').write_bytes(b)
words=[str(int.from_bytes(b[i:i+32],'big')) for i in range(0,len(b),32)]
(out/'context.json').write_text(json.dumps(words,indent=2)+'\n',encoding='utf-8')
print('Exported 34 actual production contract words; this is not proof acceptance')
