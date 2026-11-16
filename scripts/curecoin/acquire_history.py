#!/usr/bin/env python3
"""Acquire/check the official raw corpus without extracting archive databases."""
import argparse,hashlib,json,urllib.request,zipfile
from pathlib import Path

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser();p.add_argument('--work-dir',type=Path,required=True);a=p.parse_args();a.work_dir.mkdir(parents=True,exist_ok=True)
    source=Path(__file__).resolve().parents[2]/'docs/audit/curecoin-qualification/source.json';manifest=json.loads(source.read_text())['official_archive'];archive=a.work_dir/'CCBlockchain.zip';raw=a.work_dir/'blk0001.dat'
    if not archive.exists():
        tmp=archive.with_suffix('.download')
        with urllib.request.urlopen(manifest['url'],timeout=60) as r,tmp.open('wb') as f:
            for chunk in iter(lambda:r.read(4*1024*1024),b''):f.write(chunk)
        if digest(tmp)!=manifest['sha256']:raise ValueError('official archive checksum mismatch')
        tmp.rename(archive)
    if digest(archive)!=manifest['sha256']:raise ValueError('existing archive checksum mismatch')
    if not raw.exists():
        tmp=raw.with_suffix('.extracting')
        with zipfile.ZipFile(archive) as z,z.open(manifest['raw_entry']) as src,tmp.open('wb') as dst:
            for chunk in iter(lambda:src.read(4*1024*1024),b''):dst.write(chunk)
        if digest(tmp)!=manifest['raw_sha256']:raise ValueError('raw blockchain checksum mismatch')
        tmp.rename(raw)
    if digest(raw)!=manifest['raw_sha256']:raise ValueError('existing raw blockchain checksum mismatch')
    print('PASS official archive and raw corpus checksums; archive databases not imported')
if __name__=='__main__':main()
