#!/usr/bin/env python3
"""Verify immutable fixture and tested source fingerprints, without network access."""
import hashlib,json
from pathlib import Path
here=Path(__file__).resolve().parent
root=here.parents[3]
for manifest,base in [(here/'SHA256SUMS.json',here),(here/'qualification/source-sha256.json',root)]:
 entries=json.loads(manifest.read_text())
 for name,digest in entries.items():
  p=base/name
  assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,'fingerprint mismatch: '+name
 print('PASS',len(entries),'fingerprints in',manifest.name)
