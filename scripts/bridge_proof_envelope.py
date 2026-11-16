#!/usr/bin/env python3
"""Encode public canonical transport claims, NOT source evidence or a signing authority."""
import argparse,json
from pathlib import Path
FIELDS=['version','routeId','adapterId','assetId','sourceChainId','destinationChainId','sourceNetworkId','destinationNetworkId','sourceGateway','sourceAsset','verifierConfigHash','destinationChainIdEvm','destinationRouter','recipient','amount','sourceTxId','sourceMessageId','observedAt','expiresAt']
BYTES={'routeId','adapterId','assetId','sourceNetworkId','destinationNetworkId','sourceGateway','sourceAsset','verifierConfigHash','sourceTxId','sourceMessageId'}
ADDRESSES={'destinationRouter','recipient'}
def encode(claims,inner):
 if set(claims)!=set(FIELDS):raise ValueError('exact public claim schema required; no credentials accepted')
 if not isinstance(inner,bytes) or not inner:raise ValueError('native proof bytes required')
 words=[]
 for field in FIELDS:
  value=claims[field]
  if field in BYTES or field in ADDRESSES:
   size=20 if field in ADDRESSES else 32
   if not isinstance(value,str) or not value.startswith('0x') or len(value)!=2+size*2:raise ValueError(field+' width')
   data=bytes.fromhex(value[2:]);number=int.from_bytes(data,'big')
  else:
   bits=64 if field in ['sourceChainId','destinationChainId','observedAt','expiresAt'] else 256
   if not isinstance(value,int) or isinstance(value,bool) or not 0<value<2**bits:raise ValueError(field+' uint')
   number=value
  if number==0:raise ValueError(field+' zero')
  words.append(number.to_bytes(32,'big'))
 if claims['version']!=1 or claims['sourceChainId']==claims['destinationChainId']:raise ValueError('version or chain pair')
 if not 0<claims['expiresAt']-claims['observedAt']<=86400:raise ValueError('transport window')
 result=(32).to_bytes(32,'big')+b''.join(words)+(640).to_bytes(32,'big')+len(inner).to_bytes(32,'big')+inner+b'\0'*((-len(inner))%32)
 if len(result)>4200000:raise ValueError('envelope size')
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--claims',type=Path,required=True);p.add_argument('--inner-proof',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();native=bytes.fromhex(a.inner_proof.removeprefix('0x'));a.output.write_text('0x'+encode(json.loads(a.claims.read_text()),native).hex()+'\n')
