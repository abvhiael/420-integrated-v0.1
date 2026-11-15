#!/usr/bin/env python3
"""Fetch exact upstream proving parameters; verify before native crypto reads."""
import argparse
import hashlib
from pathlib import Path
import urllib.request

PARAMS={
 'sapling-spend.params':(47958396,'8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13'),
 'sapling-output.params':(3592860,'2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4'),
 'sprout-groth16.params':(725523612,'b685d700c60328498fbde589c8c7c484c722b788b265b72af448a5bf0ee55b50')}
BASE='https://github.com/PirateNetwork/zcash_params/releases/download/release_bd4e9a3/'
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--native',action='store_true');a=p.parse_args();root=Path(a.directory);root.mkdir(parents=True,exist_ok=True)
 for name,(size,sha) in PARAMS.items():
  if name.startswith('sprout') and not a.native:continue
  path=root/name
  if path.is_file() and path.stat().st_size==size and digest(path)==sha:print(name,'verified existing');continue
  tmp=root/(name+'.part')
  try:
   count=0
   with urllib.request.urlopen(BASE+name,timeout=60) as response,tmp.open('xb') as out:
    while True:
     chunk=response.read(1024*1024)
     if not chunk:break
     count+=len(chunk)
     if count>size:raise RuntimeError('oversized upstream parameter')
     out.write(chunk)
   if count!=size or digest(tmp)!=sha:raise RuntimeError('upstream parameter checksum mismatch')
   tmp.replace(path);print(name,'verified downloaded')
  finally:
   if tmp.exists():tmp.unlink()
if __name__=='__main__':main()
