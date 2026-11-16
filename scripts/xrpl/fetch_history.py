#!/usr/bin/env python3
"""Explicit public evidence acquisition; never used by offline qualification."""
import argparse
from collections import Counter
import json
from pathlib import Path
import time
import urllib.request
import websocket

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[2]/'contracts/test/fixtures/xrpl')
    args=parser.parse_args();p=args.output;p.mkdir(parents=True,exist_ok=True)
    names=['ripple-vl.json','foundation-vl.json','validations.json','ledger.json']
    if all((p/n).exists() for n in names):
        print('Preserved existing corpus; no network calls.');return
    if any((p/n).exists() for n in names):raise ValueError('Partial existing corpus: use a fresh output directory')
    for name,url in [('ripple-vl.json','https://vl.ripple.com'),('foundation-vl.json','https://vl.xrplf.org')]:
        with urllib.request.urlopen(url,timeout=30) as r:(p/name).write_bytes(r.read())
    messages=[];ws=websocket.create_connection('wss://s1.ripple.com',timeout=15)
    try:
        ws.send(json.dumps({'id':1,'command':'subscribe','streams':['validations'],'validation_full':True}))
        end=time.monotonic()+35
        while time.monotonic()<end:
            msg=json.loads(ws.recv())
            if msg.get('type')=='validationReceived' and msg.get('data') and msg.get('network_id')==0:messages.append(msg)
    finally:ws.close()
    counts=Counter(m['ledger_hash'] for m in messages)
    if not counts:raise ValueError('No native validation data received')
    target=counts.most_common(1)[0][0]
    body=json.dumps({'method':'ledger','params':[{'ledger_hash':target,'transactions':True,'expand':True,'binary':True}]}).encode()
    request=urllib.request.Request('https://xrplcluster.com',data=body,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=35) as r:raw=r.read()
    result=json.loads(raw).get('result',{})
    if result.get('ledger_hash','').lower()!=target.lower():raise ValueError('Ledger hash request mismatch')
    (p/'ledger.json').write_bytes(raw)
    (p/'validations.json').write_text(json.dumps([m for m in messages if m['ledger_hash']==target],separators=(',',':'))+'\n')
    print('Captured candidate',target,'; independently verify publisher, membership, quorum and SHAMap before trusting it.')

if __name__=='__main__':main()
