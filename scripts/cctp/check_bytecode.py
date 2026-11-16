#!/usr/bin/env python3
"""Check production adapter bytecode under repository compiler/optimizer rules."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('--solc',required=True);a=p.parse_args();solc=str(Path(a.solc).resolve())
 cmd=[solc,'--via-ir','--optimize','--optimize-runs','200','--evm-version','cancun','--base-path','.','--allow-paths',str(ROOT/'contracts'),'--combined-json','bin,bin-runtime','src/bridge/adapters/USDCCCTPAdapter.sol']
 r=subprocess.run(cmd,cwd=ROOT/'contracts',check=True,capture_output=True,text=True);contracts=json.loads(r.stdout)['contracts'];artifact=contracts['src/bridge/adapters/USDCCCTPAdapter.sol:USDCCCTPAdapter'];size=len(artifact['bin-runtime'])//2
 if not 0<size<=24576:raise RuntimeError('production runtime exceeds EIP-170')
 print(json.dumps({'contract':'USDCCCTPAdapter','solc':'0.8.24','evm':'cancun','via_ir':True,'optimizer_runs':200,'runtime_size':size,'creation_sha256':hashlib.sha256(bytes.fromhex(artifact['bin'])).hexdigest(),'deployed_code_hash':'NOT_ASSIGNED; constructor immutables and approved deployment required'}))
if __name__=='__main__':main()
