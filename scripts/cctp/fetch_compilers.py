#!/usr/bin/env python3
"""Acquire the exact official Solidity compilers used for local qualification."""
import argparse
import hashlib
from pathlib import Path
import urllib.request

COMPILERS={
 '0.7.6':('solc-linux-amd64-v0.7.6+commit.7338295f','bd69ea85427bf2f4da74cb426ad951dd78db9dfdd01d791208eccc2d4958a6bb'),
 '0.8.24':('solc-linux-amd64-v0.8.24+commit.e11b9ed9','fb03a29a517452b9f12bcf459ef37d0a543765bb3bbc911e70a87d6a37c30d5f')}
def main():
 p=argparse.ArgumentParser();p.add_argument('directory');a=p.parse_args();root=Path(a.directory);root.mkdir(parents=True,exist_ok=True)
 for version,(name,sha) in COMPILERS.items():
  path=root/('solc-'+version)
  if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==sha:print(version,'verified existing');continue
  url='https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/linux-amd64/'+name
  with urllib.request.urlopen(url,timeout=60) as response:data=response.read(20_000_001)
  if len(data)>20_000_000 or hashlib.sha256(data).hexdigest()!=sha:raise RuntimeError('compiler checksum mismatch')
  path.write_bytes(data);path.chmod(0o755);print(version,'verified downloaded')
if __name__=='__main__':main()
