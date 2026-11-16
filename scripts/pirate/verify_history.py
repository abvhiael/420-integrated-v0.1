#!/usr/bin/env python3
"""Reproduce genuine public historical crypto checks; no ownership assertion."""
from pathlib import Path
import hashlib
import json
from evidence import equihash, transaction_inclusion, require

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT/'contracts/test/fixtures/pirate'

def main():
    data = json.loads((FIX/'historical-headers.json').read_text())
    hashes = set()
    ancestry = 0
    for row in data['records']:
        header = bytes.fromhex(row['header'])
        h = equihash(header)
        require(h == row['hash'], 'historical block hash')
        if header[4:36][::-1].hex() in hashes:
            ancestry += 1
        hashes.add(h)
    item = json.loads((FIX/'historical-inclusion.json').read_text())
    header = bytes.fromhex((FIX/'historical-header.hex').read_text())
    raw = bytes.fromhex((FIX/'historical-sapling.hex').read_text())
    require(hashlib.sha256(header).hexdigest() == item['header_sha256'], 'header checksum')
    require(hashlib.sha256(raw).hexdigest() == item['transaction_sha256'], 'transaction checksum')
    require(transaction_inclusion(raw, item['transaction_index'], [bytes.fromhex(x) for x in item['merkle_branch']], header) == item['transaction_id'], 'transaction ID')
    require(equihash(header) == item['block_hash'], 'block ID')
    print(json.dumps({'equihash_headers':len(hashes),'linked_parent_edges':ancestry,'historical_sapling_inclusion':True,'canonical_tip_or_dpow_qualified':False}))

if __name__ == '__main__':
    main()
