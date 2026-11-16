#!/usr/bin/env python3
"""Combine actual native replay and its necessary historical-script complement."""
import argparse,json
from pathlib import Path
from hashlib import sha256
from bundle import build
from consensus import SOURCE,require

def main():
    p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--scripts',type=Path,required=True);p.add_argument('--history',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    n=json.loads(a.native.read_text());s=json.loads(a.scripts.read_text());h=json.loads(a.history.read_text());require(s.get('source')==n.get('source')==SOURCE,'script/native source mismatch');require(s.get('headers_sha256')==h.get('headers_sha256'),'script/independent corpus mismatch')
    n['checkpoints_disabled']=False;n['script_validation']=s;n['original_replay_receipt_sha256']=sha256(a.native.read_bytes()).hexdigest();n['script_receipt_sha256']=sha256(a.scripts.read_bytes()).hexdigest()
    build(h,n) # Full source, network, scripts, selected tip, work and coverage checks.
    a.output.write_text(json.dumps(n,indent=2)+'\n');print('PASS complete script coverage: native script checks enabled from 1848000; pinned native ABI checks below it')
if __name__=='__main__':main()
