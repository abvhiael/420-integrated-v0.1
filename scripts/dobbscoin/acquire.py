#!/usr/bin/env python3
"""Acquire checksum-pinned official BOB raw history; never import snapshot databases."""
import argparse,hashlib,json,re,urllib.request,zipfile
from pathlib import Path
from consensus import require
NAME='dobbscoin-chain-1914745-20260928.zip'
URL='https://www.dobbscoin.info/bootstrap/'+NAME
SHA='30874468c97d7911d1486828a2e8410f11f5af7921786f9073d295bf57ed278a'
def digest(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def raw_member(name):return bool(re.fullmatch(r'blocks/blk[0-9]{5}\.dat',name))
def validate_cached(path,size,checksum):
    require(path.stat().st_size==size and digest(path)==checksum,'cached raw file does not match pinned archive')
def main():
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);archive=a.output/NAME
    if not archive.exists():
        partial=archive.with_suffix('.part')
        with urllib.request.urlopen(URL,timeout=120) as response,partial.open('wb') as out:
            while data:=response.read(4*1024*1024):out.write(data)
        require(digest(partial)==SHA,'official snapshot checksum');partial.rename(archive)
    require(digest(archive)==SHA,'official snapshot checksum')
    target=a.output/'raw';target.mkdir(exist_ok=True);files={}
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if not raw_member(item.filename):continue
            require(item.file_size<=134217728,'raw file bound');path=target/Path(item.filename).name
            if not path.exists():
                with z.open(item) as source,path.open('wb') as out:
                    while data:=source.read(4*1024*1024):out.write(data)
            expected=hashlib.sha256()
            with z.open(item) as source:
                while data:=source.read(4*1024*1024):expected.update(data)
            validate_cached(path,item.file_size,expected.hexdigest());files[path.name]=expected.hexdigest()
    require(len(files)==6,'snapshot raw file inventory')
    report={'url':URL,'manifest':'https://www.dobbscoin.info/bootstrap/SHA256SUMS','sha256':SHA,'height':1914745,'tip':'c6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8','imported':'raw blk files only','files':files}
    (a.output/'acquisition.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
