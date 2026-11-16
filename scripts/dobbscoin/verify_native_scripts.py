#!/usr/bin/env python3
"""Verify exactly the historical scripts skipped by native checkpoint fast-sync.
Uses the unmodified pinned native consensus ABI and the independently authenticated
raw corpus. Does NOT repeat the scrypt/difficulty/chainwork qualification.
"""
import argparse,collections,ctypes,hashlib,json,sqlite3,time as clock
from pathlib import Path
from consensus import *
CHECKPOINT=1848000

def validate_build_identity(acquisition,build,library_sha):
    require(acquisition.get('source_commit')==SOURCE and acquisition.get('source_modified') is False,'acquisition source identity')
    if build is None:require(acquisition.get('consensus_library_sha256')==library_sha,'library/build provenance mismatch')
    else:require(build.get('source')==SOURCE and build.get('modified_native_sources') is False and build.get('consensus_library_sha256')==library_sha,'unqualified native build receipt')

def main():
    p=argparse.ArgumentParser();p.add_argument('--headers',type=Path,required=True);p.add_argument('--index',type=Path,required=True);p.add_argument('--acquisition',type=Path,required=True);p.add_argument('--library',type=Path,required=True);p.add_argument('--library-sha256',required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--build-receipt',type=Path);a=p.parse_args()
    require(hashlib.file_digest(a.library.open('rb'),'sha256').hexdigest()==a.library_sha256,'native library identity');headers=a.headers.read_bytes();header_sha=sha256(headers).hexdigest();require(header_sha=='805b01aef94d298dc4aa42142e7dac7e53bb05b672ea0f1560bfa9c772591594','qualified canonical header corpus');source=json.loads(a.acquisition.read_text());require(source['source_commit']==SOURCE and source['source_modified'] is False,'native source identity');validate_build_identity(source,json.loads(a.build_receipt.read_text()) if a.build_receipt else None,a.library_sha256);db=sqlite3.connect(a.index)
    files=[row[0] for row in db.execute('SELECT DISTINCT file FROM blocks')]
    for name in files:
        path=Path(name);expected=source['selected_raw_files_sha256'].get('blocks/'+path.name)
        with path.open('rb') as stream:actual=hashlib.file_digest(stream,'sha256').hexdigest()
        require(actual==expected,'raw corpus changed: '+path.name)
    lib=ctypes.CDLL(str(a.library.resolve()));lib.dobbscoinconsensus_version.restype=ctypes.c_uint;require(lib.dobbscoinconsensus_version()==0,'native ABI version')
    verify=lib.dobbscoinconsensus_verify_script;verify.argtypes=[ctypes.c_char_p,ctypes.c_uint,ctypes.c_char_p,ctypes.c_uint,ctypes.c_uint,ctypes.c_uint,ctypes.POINTER(ctypes.c_int)];verify.restype=ctypes.c_int
    utxo={};versions=collections.deque();version3=0;streams={};inputs=0;transactions=0;der_inputs=0;negative_done=False;started=clock.monotonic()
    try:
        for height in range(CHECKPOINT):
            h=headers[height*80:(height+1)*80];row=db.execute('SELECT file,offset,size FROM blocks WHERE hash=?',(dsha(h),)).fetchone();require(row is not None,'missing raw ancestor')
            name,offset,size=row
            if name not in streams:streams[name]=open(name,'rb')
            stream=streams[name];stream.seek(offset);block=stream.read(size);require(block[:80]==h,'raw/header mismatch');aux=None;at=80
            if int.from_bytes(h[:4],'little')&256:aux,at=read_aux(block)
            count,at=cs(block,at);version=int.from_bytes(h[:4],'little',signed=True);base=version-trunc(version,256)*256
            flags=(1 if time(h)>=1333238400 else 0)|(4 if base>=3 and version3>=2750 else 0)|(512 if height>=2000000 else 0)
            for tx_index in range(count):
                t,at=tx(block,at);transactions+=1;raw=t['raw'];coinbase=len(t['inputs'])==1 and t['inputs'][0][0]==bytes(32)+bytes.fromhex('ffffffff')
                require(coinbase==(tx_index==0),'coinbase position')
                if not coinbase:
                    for index,(prev,script_sig) in enumerate(t['inputs']):
                        require(prev in utxo,'missing/spent historical output');script=utxo.pop(prev);error=ctypes.c_int();ok=verify(script,len(script),raw,len(raw),index,flags,ctypes.byref(error));require(ok==1 and error.value==0,'native script failure at '+str(height)+' input '+str(index));inputs+=1;der_inputs+=bool(flags&4)
                        if not negative_done and script and script[-1]==0xac and len(script_sig)>8:
                            mutated=bytearray(raw);n,pos=cs(raw,4)
                            for i in range(index+1):
                                pos+=36;length,pos=cs(raw,pos)
                                if i==index:break
                                pos+=length+4
                            mutated[pos+5]^=1;error=ctypes.c_int();require(verify(script,len(script),bytes(mutated),len(mutated),index,flags,ctypes.byref(error))==0,'tampered historical signature accepted');negative_done=True
                if height>0:
                    for index,(amount,script) in enumerate(t['outputs']):
                        key=t['id']+index.to_bytes(4,'little');require(key not in utxo,'unspent output overwritten');utxo[key]=script
            require(at==len(block),'block boundary')
            versions.append(base);version3+=base>=3
            if len(versions)>9000:version3-=versions.popleft()>=3
            if height%100000==0:print('native historical scripts',height,'inputs',inputs,'elapsed',round(clock.monotonic()-started),flush=True)
        require(inputs>0 and negative_done,'no native signature evidence')
        result={'source':SOURCE,'native_library_sha256':a.library_sha256,'headers_sha256':header_sha,'scope':'scripts skipped by native built-in-checkpoint optimization; no scrypt/difficulty replay','first_height':1,'last_height':CHECKPOINT-1,'native_checkpoint_height':CHECKPOINT,'blocks_read':CHECKPOINT,'transactions_read':transactions,'verified_inputs':inputs,'dersig_inputs':der_inputs,'tampered_historical_signature_rejected':negative_done,'last_hash':dsha(headers[(CHECKPOINT-1)*80:CHECKPOINT*80])[::-1].hex()}
        a.output.write_text(json.dumps(result,indent=2)+'\n');print('PASS',json.dumps(result),flush=True)
    finally:
        db.close()
        for stream in streams.values():stream.close()
if __name__=='__main__':main()
