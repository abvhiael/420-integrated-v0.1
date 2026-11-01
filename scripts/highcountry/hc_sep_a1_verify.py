#!/usr/bin/env python3
"""Hash actual HighCountry Git blob bytes at frozen main and archived PR heads."""
import argparse, collections, hashlib, json, pathlib, re, subprocess, sys
EXT={'.png','.jpg','.jpeg','.webp','.gif','.svg','.avif','.bmp','.tif','.tiff','.ico','.ase','.aseprite','.psd','.kra','.xcf','.tsx','.tmx','.tmj','.tsj','.glb','.gltf','.fbx','.obj','.mtl','.wav','.ogg','.mp3','.flac','.mp4','.webm','.woff','.woff2','.ttf','.otf'}
PREFIX=('apps/highcountry-web/public/','assets/highcountry/','deployments/highcountry/','tools/tiled/','services/highcountry-archive/')
def cmd(*args):
 p=subprocess.run(['git',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode: raise RuntimeError('git '+repr(args)+': '+p.stderr.decode(errors='replace')[:300])
 return p.stdout
def entries(ref):
 for row in cmd('ls-tree','-rz','--full-tree',ref).split(b'\0'):
  if not row: continue
  meta,path=row.split(b'\t',1);mode,kind,sha=meta.decode().split(' ')
  path=path.decode('utf8','surrogateescape')
  if kind=='blob':yield path,sha
def asset(path):return path.lower().startswith(PREFIX) and pathlib.PurePosixPath(path.lower()).suffix in EXT
def registry(root):
 values=collections.defaultdict(list)
 for path,sha in entries(root):
  if not (path.startswith(('deployments/highcountry/','docs/highcountry/','apps/highcountry-web/')) and path.endswith('.json')):continue
  if not any(t in path.lower() for t in ('asset','manifest','catalog','registry','inventory')):continue
  try: obj=json.loads(cmd('cat-file','blob',sha))
  except (ValueError,UnicodeDecodeError):continue
  def visit(node):
   if isinstance(node,dict):
    key=next((node[k] for k in ('repoPath','path','assetPath','filePath','sourcePath') if isinstance(node.get(k),str)),None)
    value=next((node[k] for k in ('sha256','sha256Hex','checksumSha256','sha256_hex') if isinstance(node.get(k),str) and re.fullmatch('[a-fA-F0-9]{64}',node[k])),None)
    if key and value:values[key.lstrip('/')].append({'manifest':path,'sha256':value.lower()})
    for x in node.values():visit(x)
   elif isinstance(node,list):
    for x in node:visit(x)
  visit(obj)
 return values
def main(a):
 prs=json.loads(pathlib.Path(a.pr_heads).read_text())
 prs=prs.get('highCountryPRs',prs.get('PRs',[]))
 if len(prs)!=63:raise RuntimeError('expected 63 preserved PR heads, found '+str(len(prs)))
 refs={'frozen-main':a.frozen_main}
 for p in prs:
  n=p.get('number',p.get('pr')); sha=p.get('headSHA',p.get('head'))
  ref='refs/heads/hc-separation/archive/pr-'+str(n)+'-20261031'
  observed=cmd('rev-parse',ref).decode().strip()
  if observed!=sha:raise RuntimeError('head mismatch PR '+str(n))
  refs['PR-'+str(n)]=sha
 known=registry(a.frozen_main); files=collections.defaultdict(set); bytes_by_sha={}
 mainpaths={p for p,_ in entries(a.frozen_main) if asset(p)}
 for label,ref in refs.items():
  for path,sha in entries(ref):
   if asset(path):files[(path,sha)].add(label)
 records=[]
 for (path,sha),sources in sorted(files.items()):
  if sha not in bytes_by_sha:
   raw=cmd('cat-file','blob',sha);bytes_by_sha[sha]=(hashlib.sha256(raw).hexdigest(),len(raw))
  digest,size=bytes_by_sha[sha]; previous=known.get(path,[])
  result='unregistered' if not previous else 'match' if any(x['sha256']==digest for x in previous) else 'mismatch'
  records.append({'path':path,'gitBlobSHA1':sha,'sha256':digest,'bytes':size,'sources':sorted(sources),
   'uniqueToArchivedPR':path not in mainpaths,'recorded':previous,'status':result})
 represented={x['path'] for x in records}
 missing=[p for p in known if asset(p) and p not in represented]
 by_path=collections.defaultdict(set);same=collections.defaultdict(set)
 for x in records:by_path[x['path']].add(x['sha256']);same[x['sha256']].add(x['path'])
 duplicates={h:sorted(paths) for h,paths in same.items() if len(paths)>1}
 conflicts={p:sorted(h) for p,h in by_path.items() if len(h)>1}
 summary={'frozenMain':a.frozen_main,'PRs':len(prs),'assetVersions':len(records),
  'uniquePaths':len(by_path),'uniqueArchivedPaths':len(set(by_path)-mainpaths),
  'byteVerifiedBlobs':len(bytes_by_sha),'mismatches':sum(x['status']=='mismatch' for x in records),
  'missingRegisteredPaths':len(missing),'unregisteredVersions':sum(x['status']=='unregistered' for x in records),
  'duplicateGroups':len(duplicates),'conflictingVersionPaths':len(conflicts)}
 report={'schema':'HC_SEP_A1_ACTUAL_GIT_BYTES_V1','summary':summary,'files':records,
  'missingRecordedPaths':missing,'duplicates':duplicates,'conflictingVersions':conflicts}
 pathlib.Path(a.output).write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(summary,indent=2))
 return 1 if missing or summary['mismatches'] else 0
if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--frozen-main',default='78a4befa01bd08693aabfd576a6fe8fba2e2677b')
 p.add_argument('--pr-heads',required=True);p.add_argument('--output',required=True)
 sys.exit(main(p.parse_args()))
