"""Validate retained exact-source C7 execution evidence before extending qualification."""
import hashlib,json,re,subprocess,zipfile
from pathlib import Path
SHA='98a2d504d7e218c301d3309fd680660b193043c7'
ARTIFACT_SHA256='8ff45c10cd8a7c9605b5a34a9d4063befac201d7506ffaf7f314e72c04530de8'

def validate(root,evidence,report_out):
 from Crypto.Hash import keccak
 evidence=Path(evidence)
 if evidence.is_file():
  assert hashlib.sha256(evidence.read_bytes()).hexdigest()==ARTIFACT_SHA256,'Retained archive checksum'
  z=zipfile.ZipFile(evidence);names=z.namelist();read=z.read
 else:
  names=[p.relative_to(evidence).as_posix()for p in evidence.rglob('*')if p.is_file()];read=lambda n:(evidence/n).read_bytes()
 files=[n for n in names if n.endswith('qualification.json')];assert len(files)==1
 prefix=files[0][:-len('qualification.json')];r=json.loads(read(files[0]));assert r['qualifiedSHA']==SHA and r['fundedTournamentLevel2Accepted']and r['level1Accepted']
 assert r['testsPassed']=={'c7':78,'inheritedNative':354,'inheritedReference':43,'total':475}
 assert r['genuineProofsVerified']+r['inheritedGenuineProofsVerified']==1438 and r['independentReplayTamperCases']==21
 assert not r['officialTestnetAccepted']and not r['productionApproved']
 def git(*args):return subprocess.check_output(['git',*args],cwd=root)
 def digest(data):return hashlib.sha256(data).hexdigest()
 cache={}
 def old(f):
  if f not in cache:cache[f]=git('show',SHA+':'+f)
  return cache[f]
 for f,h in {**r['sourceSHA256'],**r['compiledSourceClosureSHA256']}.items():
  assert digest(old(f))==h,f
  current=(Path(root)/f).read_bytes()
  if Path(f).name=='.gitignore' or Path(f).suffix in ['.sol','.py','.md','.json','.toml','.yml','.go']:current=current.replace(b'\r\n',b'\n')
  if f=='contracts/foundry.toml':current=current.split(b'\n# C8 recovery/security qualification')[0].rstrip()+b'\n'
  if f in ['.github/workflows/identity-id-audit-4.yml','.github/workflows/identity-id-audit-5.yml']:current=current.replace(b" && github.head_ref != 'bet/5c8-recovery-security-qualification'",b'')
  assert digest(current)==h,('Inherited source changed',f)
 for f,h in r['evidenceSHA256'].items():assert digest(read(prefix+f))==h,f
 compiled=set()
 for n in names:
  if not n.startswith(prefix+'build/')or not n.endswith('.json'):continue
  d=json.loads(read(n))
  for rel,entry in d.get('metadata',{}).get('sources',{}).items():
   f='contracts/'+rel;k=keccak.new(digest_bits=256);k.update(old(f));assert k.hexdigest()==entry['keccak256'].removeprefix('0x'),f;compiled.add(f)
 for label,count in [('genuine-groth16-verification',574),('inherited-c6-proofs',410),('inherited-c5-proofs',454)]:
  log=read(prefix+label+'.stdout.log').decode('utf-8-sig');assert log.count('verified committed genuine proof ')==count and '--- SKIP'not in log and '\nPASS\n'in log
 tamper=json.loads(read(prefix+'replay-tamper-checks.json'));assert tamper['alteredEvidenceRejected']==21
 fuzz=sum(r['fuzzRuns'].values());assert fuzz==32500
 result={'retainedQualifiedSHA':SHA,'retainedRunURL':'https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40388415667','retainedArtifactID':12684890532,'retainedArchiveSHA256':ARTIFACT_SHA256,'retainedActualTests':475,'retainedGenuineProofVerifications':1438,'retainedFuzzCases':fuzz,'retainedTamperCases':21,'compiledSourcesIncludingTests':len(compiled),'sourceIdentitiesMatched':True,'allEvidenceChecksumsMatched':True,'rerunClaimed':False}
 Path(report_out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');return result
