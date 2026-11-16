#!/usr/bin/env python3
"""Public 420SREQ1 request codec, never a finality verifier or release/signing authority."""
import argparse,json,struct
from pathlib import Path
FIELDS=['sourceChainId','sourceRouter','sourceAdapter','messageId','routeId','assetId','sender','recipient','localAmount','solanaAmount','solanaAsset','nonce','extra']
WIDTHS={'sourceRouter':20,'sourceAdapter':20,'messageId':32,'routeId':32,'assetId':32,'sender':20,'recipient':32,'solanaAsset':32}
def raw(value,width):
 if not isinstance(value,str) or not value.startswith('0x') or len(value)!=2+width*2 or any(c not in '0123456789abcdefABCDEF' for c in value[2:]):raise ValueError('hex width')
 try:return bytes.fromhex(value[2:])
 except ValueError:raise ValueError('hex encoding') from None
def uint(value,bits):
 if not isinstance(value,int) or isinstance(value,bool) or not 0<value<2**bits:raise ValueError('unsigned integer width/nonzero')
 return value
def encode(m):
 if not isinstance(m,dict) or set(m)!=set(FIELDS):raise ValueError('exact public request schema required; credentials are not accepted')
 d={k:raw(m[k],v) for k,v in WIDTHS.items()}
 if any(not int.from_bytes(v,'big') for k,v in d.items() if k!='recipient'):raise ValueError('zero identity')
 try:extra=bytes.fromhex(m['extra'][2:]) if isinstance(m['extra'],str) and m['extra'].startswith('0x') and len(m['extra'])%2==0 and all(c in '0123456789abcdefABCDEF' for c in m['extra'][2:]) else None
 except ValueError:raise ValueError('extra hex') from None
 if extra is None or len(extra)>=2**32:raise ValueError('extra width')
 out=b'420SREQ1'+uint(m['sourceChainId'],256).to_bytes(32,'big')+d['sourceRouter']+d['sourceAdapter']+d['messageId']+d['routeId']+d['assetId']+d['sender']+d['recipient']+uint(m['localAmount'],256).to_bytes(32,'big')+struct.pack('<Q',uint(m['solanaAmount'],64))+d['solanaAsset']+uint(m['nonce'],256).to_bytes(32,'big')+struct.pack('<I',len(extra))+extra
 return out
def decode(data):
 if not isinstance(data,bytes) or len(data)<336 or data[:8]!=b'420SREQ1':raise ValueError('request framing')
 m={};at=8
 for key,width,kind in [('sourceChainId',32,'big'),('sourceRouter',20,'hex'),('sourceAdapter',20,'hex'),('messageId',32,'hex'),('routeId',32,'hex'),('assetId',32,'hex'),('sender',20,'hex'),('recipient',32,'hex'),('localAmount',32,'big'),('solanaAmount',8,'little'),('solanaAsset',32,'hex'),('nonce',32,'big')]:
  value=data[at:at+width];at+=width;m[key]='0x'+value.hex() if kind=='hex' else int.from_bytes(value,kind)
 size=struct.unpack('<I',data[at:at+4])[0];at+=4
 if len(data)!=at+size:raise ValueError('request length')
 m['extra']='0x'+data[at:].hex()
 if encode(m)!=data:raise ValueError('noncanonical request')
 return m
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--request',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.write_text('0x'+encode(json.loads(a.request.read_text())).hex()+'\n')
