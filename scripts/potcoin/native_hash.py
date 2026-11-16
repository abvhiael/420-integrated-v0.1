#!/usr/bin/env python3
"""Build the actual pinned upstream X13 (Hash9) function; do not substitute SHA-256d."""
import argparse
import ctypes
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from consensus import SOURCE, GENESIS, H

PARTS='blake bmw groestl skein jh keccak luffa cubehash shavite simd echo hamsi fugue'.split()

def build(source,out):
    source=Path(source).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
    if commit!=SOURCE:raise ValueError('Wrong native source commit')
    if subprocess.check_output(['git','status','--porcelain','--','src'],cwd=source,text=True).strip():raise ValueError('Modified native source')
    wrapper=out/'x13.cpp';wrapper.write_text('#include "hashblock.h"\nextern "C" void pot_x13(const unsigned char* p,unsigned int n,unsigned char* out){uint256 h=Hash9(p,p+n);memcpy(out,&h,32);}\n')
    for part in PARTS:subprocess.run(['gcc','-O2','-fPIC','-I'+str(source/'src'),'-c',str(source/'src'/f'{part}.c'),'-o',str(out/f'{part}.o')],check=True)
    library=out/'libpot-x13.so'
    subprocess.run(['g++','-O2','-std=c++11','-fPIC','-I'+str(source/'src'),'-shared',str(wrapper),*[str(out/f'{p}.o') for p in PARTS],'-o',str(library)],check=True)
    return library

def hasher(path):
    lib=ctypes.CDLL(str(Path(path).resolve()));f=lib.pot_x13;f.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_void_p]
    def hash_(raw):
        output=ctypes.create_string_buffer(32);f(raw,len(raw),output);return output.raw
    return hash_

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);args=parser.parse_args()
    root=Path(__file__).resolve().parents[2];fix=root/'contracts/test/fixtures/potcoin'
    with tempfile.TemporaryDirectory(prefix='potcoin-x13-') as folder:
        library=build(args.source,folder);x13=hasher(library)
        raw=(fix/'genesis-header.bin').read_bytes();actual=x13(raw)
        if actual[::-1].hex()!=GENESIS:raise ValueError('Native genesis X13 mismatch')
        print('PASS pinned upstream X13 genesis:',actual[::-1].hex())
        manifest={'source':SOURCE,'genesis':GENESIS,'header_sha256':hashlib.sha256(raw).hexdigest(),'x13_raw':actual.hex(),'compiled_library_sha256':hashlib.sha256(library.read_bytes()).hexdigest()}
        (root/'docs/audit/potcoin-qualification/native-x13.json').write_text(json.dumps(manifest,indent=2)+'\n')

if __name__=='__main__':main()
