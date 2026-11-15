#!/usr/bin/env python3
"""Explicit online fixture acquisition. Offline qualification never calls this script."""
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT/'contracts/test/fixtures/tron'
FIX.mkdir(parents=True,exist_ok=True)
sources = [('genesis.json','getblockbynum?num=0')]
sources += [('blocks-1-100.json','getblockbylimitnext?startNum=1&endNum=101')]
sources += [(f'blocks-{n}-{n+100}.json',f'getblockbylimitnext?startNum={n}&endNum={n+100}') for n in range(100,1100,100)]
for name,query in sources:
    destination = FIX/name
    if destination.exists():
        print('preserved',name)
        continue
    url = 'https://api.trongrid.io/wallet/'+query
    with urllib.request.urlopen(url,timeout=60) as response:
        data = response.read()
    parsed = json.loads(data)
    if not isinstance(parsed,dict) or not ('block' in parsed or 'blockID' in parsed):
        raise ValueError(f'Invalid source response: {url}')
    destination.write_bytes(data)
    print('captured',url,name)
