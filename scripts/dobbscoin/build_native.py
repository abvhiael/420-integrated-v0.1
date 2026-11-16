#!/usr/bin/env python3
"""Build the unmodified pinned native verifier; no system package installation."""
import argparse,json,os,subprocess
from pathlib import Path
from hashlib import sha256
from consensus import SOURCE,require
def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--build',type=Path,required=True);p.add_argument('--prefix',action='append',default=[]);p.add_argument('--jobs',type=int,default=2);a=p.parse_args()
    require(subprocess.check_output(['git','-C',str(a.source),'rev-parse','HEAD'],text=True).strip()==SOURCE,'native source revision')
    subprocess.run(['git','-C',str(a.source),'diff','--exit-code','HEAD'],check=True,stdout=subprocess.DEVNULL)
    cmd=['cmake','-S',str(a.source),'-B',str(a.build),'-DCMAKE_BUILD_TYPE=Release','-DBUILD_GUI=OFF','-DBUILD_TESTS=ON','-DWITH_MINIUPNPC=OFF','-DWITH_NATPMP=OFF']
    if a.prefix:cmd+=['-DCMAKE_PREFIX_PATH='+';'.join(a.prefix)]
    subprocess.run(cmd,check=True);subprocess.run(['cmake','--build',str(a.build),'-j',str(a.jobs)],check=True)
    report={'source':SOURCE,'daemon_sha256':sha256((a.build/'src/dobbscoind').read_bytes()).hexdigest(),'tests_sha256':sha256((a.build/'src/test/test_dobbscoin').read_bytes()).hexdigest(),'consensus_library_sha256':sha256((a.build/'src/libdobbscoinconsensus.so.0.0.0').read_bytes()).hexdigest(),'modified_native_sources':False}
    (a.build/'native-build.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
