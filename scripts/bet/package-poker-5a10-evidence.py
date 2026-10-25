"""Package actual nine-player context proofs; checksums never substitute for execution."""
from pathlib import Path
import hashlib,json,shutil,sys,zipfile
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'clients/420bet-poker/zkshuffle/fixtures/ws8';OUT=BASE/'multiplayer'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def key(n):
 for prefix,k in [('WS8Initial','InitialDeck52'),('WS8Shuffle','Reencrypt52'),('WS8Recipient','RecipientPoP'),('WS8Aggregate','Aggregate'),('WS8Delivery','Delivery'),('WS8Partial','Partial'),('WS8Unmask','Unmask')]:
  if n.startswith(prefix):return k
 raise ValueError(n)
expected=['WS8Initial','WS8Shuffle1','WS8Shuffle2','WS8Aggregate']+['WS8Recipient'+str(i) for i in range(9)]+['WS8Delivery'+str(p)+str(h) for p in range(18) for h in range(2)]
slots=[(1,19),(1,20),(1,21),(2,23),(3,25)]+[(4,p) for p in range(18)]
expected+=['WS8Partial'+str(s)+str(p)+str(h) for s,p in slots for h in range(2)]+['WS8Unmask'+str(s)+str(p) for s,p in slots]
assert len(expected)==len(set(expected))==118
if sys.argv[1:]==['--record']:
 src=ROOT/'artifacts/contracts/ws8-multiplayer/proofs';(OUT/'proofs').mkdir(exist_ok=True);(OUT/'keys').mkdir(exist_ok=True)
 original=json.loads((BASE/'manifest.json').read_text())
 for k in original['keys']:shutil.copyfile(BASE/'keys'/(k['name']+'.vk'),OUT/'keys'/(k['name']+'.vk'))
 for p in src.iterdir():
  name=p.name.removeprefix('EXPERIMENTAL-')
  if name.endswith(('.abi','.points','.public','Proof.bin')) or name in ['roots.bin','deck-0.bin','deck-1.bin','deck-2.bin','reuse-report.json']:shutil.copyfile(p,OUT/'proofs'/name)
 reuse=json.loads((OUT/'proofs/reuse-report.json').read_text());assert {r['proof'] for r in reuse}==set(expected)
 cached=[r['proof'] for r in reuse if r['material']=='reused-identical-public-witness'];sourceArchiveSHA256=digest(OUT/'evidence.zip')
 with zipfile.ZipFile(OUT/'evidence.zip') as previous:
  for n in cached:
   for suffix in ['.abi','.public','Proof.bin']:assert hashlib.sha256(previous.read('proofs/'+n+suffix)).hexdigest()==digest(OUT/'proofs'/(n+suffix)),n
 manifest={'format':1,'setup':original['setup'],'keys':original['keys'],'proofs':[{'name':n,'key':key(n)} for n in expected],'reuseSourceArchiveSHA256':sourceArchiveSHA256,'reusedProofSHA256':{n:digest(OUT/'proofs'/(n+'Proof.bin')) for n in cached},'players':9,'playerEscrow':5400,'perProviderCollateral':5400,'generatedProofs':sum(r['material']=='generated-context-specific' for r in reuse),'reusedProofs':[r['proof'] for r in reuse if r['material']=='reused-identical-public-witness'],'files':{p.relative_to(ROOT).as_posix():digest(p) for p in sorted(OUT.rglob('*')) if p.is_file() and (p.parent.name in ['keys','proofs'] or p.name in ['context.bin','context.json']) and not p.name.endswith('SolidityFixture.json')}}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
 with zipfile.ZipFile(OUT/'evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
  for filename in sorted(list(manifest['files'])+[(OUT/'manifest.json').relative_to(ROOT).as_posix()]):
   f=ROOT/filename;info=zipfile.ZipInfo(f.relative_to(OUT).as_posix(),date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,f.read_bytes())
 (OUT/'bundle.json').write_text(json.dumps({'sha256':digest(OUT/'evidence.zip'),'players':9,'proofs':118,'generatedProofs':manifest['generatedProofs'],'reusedProofs':manifest['reusedProofs'],'keys':7},indent=2)+'\n',encoding='utf-8')
elif sys.argv[1:]!=['--verify']:raise SystemExit('usage: package-poker-5a10-evidence.py --record|--verify')
index=json.loads((OUT/'bundle.json').read_text());assert digest(OUT/'evidence.zip')==index['sha256']
with zipfile.ZipFile(OUT/'evidence.zip') as z:
 for entry in z.infolist():
  target=(OUT/entry.filename).resolve();assert target.is_relative_to(OUT.resolve()) and entry.filename not in ['evidence.zip','bundle.json'],entry.filename
 z.extractall(OUT)
m=json.loads((OUT/'manifest.json').read_text());assert {r['name'] for r in m['proofs']}==set(expected) and len(m['proofs'])==118 and len(m['keys'])==7
assert len((OUT/'context.bin').read_bytes())==48*32
for p,h in m['files'].items():assert digest(ROOT/p)==h,p
for k in m['keys']:assert digest(OUT/'keys'/(k['name']+'.vk'))==digest(BASE/'keys'/(k['name']+'.vk'))
for n in m['reusedProofs']:assert digest(OUT/'proofs'/(n+'Proof.bin'))==m['reusedProofSHA256'][n]
for n in ['WS8Recipient0','WS8Recipient1','WS8Aggregate']:
 for suffix in ['.abi','.public','Proof.bin']:assert digest(OUT/'proofs'/(n+suffix))==digest(BASE/'proofs'/(n+suffix))
assert m['generatedProofs']+len(m['reusedProofs'])==118
print(f"Nine-player evidence checksums verified: {m['generatedProofs']} context-specific genuine proofs, {len(m['reusedProofs'])} reused proofs, seven unchanged keys; execution required separately")
