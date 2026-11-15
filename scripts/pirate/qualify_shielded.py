#!/usr/bin/env python3
"""Qualify pinned proofs and isolated worker rejection paths using public fixtures.
No viewing key is stored in the repository. Owned-note tests use the separate
native harness and a private, disposable wallet, never production credentials.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
FIX=ROOT/'contracts/test/fixtures/pirate'

def main():
    a=argparse.ArgumentParser();a.add_argument('--binary',required=True);a.add_argument('--params',required=True);a.add_argument('--only');args=a.parse_args()
    binary=str(Path(args.binary).resolve());params=str(Path(args.params).resolve());checks=[]
    with tempfile.TemporaryDirectory(prefix='pirate-public-crypto-') as work:
        work=Path(work)
        def run(req,expected=0,key=None):
            (work/'request.json').write_text(json.dumps(req))
            result=subprocess.run([binary,str(work/'request.json'),str(key or work/'missing.private'),params],capture_output=True,text=True)
            if result.returncode!=expected:raise RuntimeError('unexpected worker result: '+result.stderr)
            if expected:
                if result.stdout or result.stderr!='shielded evidence rejected\n':raise RuntimeError('uncontrolled error output')
                return None
            return json.loads(result.stdout)
        for name,branch in [('historical-sapling',0x76b809bb),('controlled-sapling-v6',0x37a5165b),('controlled-ironwood-v6',0x37a5165b),('controlled-ironwood-spend-v6',0x37a5165b)]:
            if args.only and args.only!=name:continue
            raw=bytes.fromhex((FIX/(name+'.hex')).read_text());path=work/(name+'.bin');path.write_bytes(raw);req=dict(mode='verify',raw_file=str(path),branch_id=branch)
            result=run(req)
            if not result['shielded_authorization_validated']:raise RuntimeError('unverified proof')
            checks.append(name+': native proofs and signatures')
            corrupt=bytearray(raw);corrupt[-1]^=1;path.write_bytes(corrupt);run(req,2);checks.append(name+': altered authorization rejected');path.write_bytes(raw)
            run(dict(req,branch_id=0),2);checks.append(name+': wrong consensus branch rejected')
            run(dict(req,claimed_finalized=True),2);checks.append(name+': caller RPC assertion rejected')
        if not args.only:
            # A valid public transaction does not prove owned-gateway funds.
            raw=bytes.fromhex((FIX/'controlled-sapling-v6.hex').read_text());path=work/'owned.bin';path.write_bytes(raw)
            req=dict(mode='decrypt',raw_file=str(path),branch_id=0x37a5165b,pool=0,output_index=1,position=0,root='00'*32,siblings=['00'*32]*32)
            secret=work/'credential.private';secret.write_bytes(bytes(96));secret.chmod(0o644)
            run(req,2,secret);checks.append('world-readable credential rejected')
            secret.chmod(0o600);link=work/'symlink.private';link.symlink_to(secret);run(req,2,link);checks.append('symlink credential rejected')
            secret.write_bytes(bytes(32));run(req,2,secret);checks.append('incoming-only/wrong-width credential rejected')
            secret.write_bytes(bytes(96));run(req,2,secret);checks.append('unowned key rejected')
    print(json.dumps({'checks':checks,'passed':len(checks),'historical_owned_deposit_qualified':False},indent=2))
if __name__=='__main__':main()
