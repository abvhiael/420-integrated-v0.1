#!/usr/bin/env python3
"""Audit exact approved PNG bytes; never edit art or infer ownership from it."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
def audit(root=ROOT):
 manifest=json.loads((root/'deployments/highcountry/seed-assets.v1.json').read_text());records=[];seen=set();heritage=[]
 if manifest['schema']!='HC.SEED.ASSETS.V1' or len(manifest['entries'])!=146:raise ValueError('asset coverage')
 for e in manifest['entries']:
  p=(root/e['repositoryPath']).resolve();p.relative_to(root.resolve())
  if p in seen:raise ValueError('duplicate asset path')
  seen.add(p);raw=p.read_bytes();blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest();digest=hashlib.sha256(raw).hexdigest()
  if len(raw)!=e['bytes'] or blob!=e['gitBlobSha1'] or (e['sha256'] is not None and digest!=e['sha256']):raise ValueError('asset byte identity: '+e['id'])
  with Image.open(p) as im:
   im.load()
   if im.format!='PNG' or im.mode!='RGBA':raise ValueError('RGBA PNG required: '+e['id'])
   if e['width'] is not None and im.size!=(e['width'],e['height']):raise ValueError('asset dimensions: '+e['id'])
   alpha=im.getchannel('A');bounds=alpha.getbbox()
   if alpha.getextrema()[0]!=0 or bounds is None:raise ValueError('genuine exterior transparency required: '+e['id'])
   if e['sha256'] is None:
    if e['role']!='illustration' or not e['cultivarId'].startswith('HC-F'):raise ValueError('unresolved nonheritage digest')
    heritage.append(im.size)
   records.append({'id':e['id'],'path':e['repositoryPath'],'gitBlobSha1':blob,'sha256':digest,'bytes':len(raw),'width':im.width,'height':im.height,'mode':im.mode,'alphaBounds':bounds})
 if len(heritage)!=16 or len(set(heritage))!=1:raise ValueError('consistent sixteen heritage plate geometry')
 return {'schema':'HC.SEED.ASSET_AUDIT.V1','count':len(records),'authority':'cosmetic-only; no registration or harvest entitlement','records':records}
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',default='artifacts/highcountry/hc-seed-10-assets.json');args=p.parse_args();result=audit();out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'assetCount':result['count'],'report':str(out.relative_to(ROOT)),'status':'PASS'}))
if __name__=='__main__':main()
