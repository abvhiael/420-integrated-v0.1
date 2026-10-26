"""Exact-SHA C8 security and funded recovery qualification with verified C7 inheritance."""
import argparse,hashlib,importlib.util,json,os,re,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
from importlib.metadata import version
ROOT=Path(__file__).resolve().parents[2]
BASE='a86534c944ee9700110854213eee58d2bf5a0328'
SCOPE=['.github/workflows/identity-id-audit-4.yml','.github/workflows/identity-id-audit-5.yml','clients/420bet-poker/zkshuffle/fixtures/tournament-5c8/inherited-level2.zip','contracts/foundry.toml','contracts/src/bet/tournament/recovery','contracts/test/tournament-5c8','scripts/bet/qualify-poker-5c8.py','scripts/bet/inherit-poker-5c8.py','scripts/bet/monitor-poker-5c8.py','scripts/bet/check-poker-5c8-monitor.py','scripts/bet/poker-5c8-static-review.json','docs/bet/BET-AUDIT-5C.8-RECOVERY-SECURITY-QUALIFICATION.md','docs/420BET-TESTNET-WORK-ROADMAP.md','.github/workflows/420bet-poker-5c8-level2.yml']
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
helpers=module('helpers','scripts/bet/qualify-poker-5c2.py');execute,git=helpers.execute,helpers.git

def sha(p):
 data=p.read_bytes()
 if p.suffix!='.zip':data=data.replace(b'\r\n',b'\n')
 return hashlib.sha256(data).hexdigest()
def write(out,name,value):(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def allowed(f):return any(f==s or f.startswith(s+'/')for s in SCOPE)
def main():
 p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--inherited-evidence',default=str(ROOT/'clients/420bet-poker/zkshuffle/fixtures/tournament-5c8/inherited-level2.zip'));p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
 if any(out.iterdir()):raise RuntimeError('Fresh evidence directory required')
 if git('status','--porcelain','--',*SCOPE):raise RuntimeError('Clean committed scope required')
 head=git('rev-parse','HEAD');subprocess.check_call(['git','merge-base','--is-ancestor',BASE,head],cwd=ROOT)
 if any(not allowed(f)for f in git('diff','--name-only',BASE,head).splitlines()):raise RuntimeError('Unrelated source changes')
 current=(ROOT/'contracts/foundry.toml').read_text(encoding='utf-8').replace('\r\n','\n').split('\n# C8 recovery/security qualification')[0]
 if current.strip()!=git('show',BASE+':contracts/foundry.toml').replace('\r\n','\n').strip():raise RuntimeError('Inherited profile drift')
 retained=module('inherit','scripts/bet/inherit-poker-5c8.py').validate(ROOT,a.inherited_evidence,out/'inherited-qualification.json')
 sources={f:sha(ROOT/f)for f in git('ls-files','--',*SCOPE).splitlines()}
 env=dict(os.environ,FOUNDRY_PROFILE='tournament5c8',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c8',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0')
 tool=execute([a.forge,'--version'],ROOT,env,out,'foundry-version').stdout.decode()
 if '1.8.6'not in tool or version('slither-analyzer')!='0.11.6' or sys.version_info[:2]!=(3,12):raise RuntimeError('Unqualified toolchain')
 for step in ['5c5','5c7']:execute([sys.executable,'scripts/bet/unpack-poker-'+step+'-evidence.py'],ROOT,env,out,'unpack-'+step)
 cmd=[a.forge,'test','--no-dynamic-test-linking','--use',a.solc]
 r=execute(cmd+['--match-contract','^TournamentRecovery(Security|Rebuy)420Test$','--json'],ROOT/'contracts',env,out,'recovery-tests')
 tests=[(s,n,t)for s,v in json.loads(r.stdout.decode('utf-8-sig')).items()for n,t in v['test_results'].items()]
 source=(ROOT/'contracts/test/tournament-5c8/PokerTournamentRecovery420.t.sol').read_text(encoding='utf-8');base=(ROOT/'contracts/test/tournament-5c7/PokerTournamentPrizes420.t.sol').read_text(encoding='utf-8').split('contract TournamentPrizeReentryFunded420Test')[0]
 inherited=set(re.findall(r'function\s+(test\w+)\s*\(',base));security=set(re.findall(r'function\s+(test\w+)\s*\(',source.split('contract TournamentRecoverySecurity420Test')[1].split('contract TournamentRecoveryRebuy420Test')[0]));rebuy=set(re.findall(r'function\s+(test\w+)\s*\(',source.split('contract TournamentRecoveryRebuy420Test')[1]))
 expected={'TournamentRecoverySecurity420Test':inherited|security,'TournamentRecoveryRebuy420Test':inherited|rebuy}
 for suite,names in expected.items():
  rows=[(n,t)for s,n,t in tests if s.endswith(':'+suite)]
  if len(rows)!=len(names)or {n.split('(')[0]for n,t in rows}!=names or any(t['status']!='Success'for n,t in rows):raise RuntimeError('Incomplete/failed security owner: '+suite)
 if len(tests)!=sum(map(len,expected.values())):raise RuntimeError('Unexpected test inventory')
 fuzz={s+':'+n:t['kind']['Fuzz']['runs']for s,n,t in tests if 'Fuzz'in t['kind']}
 if len(fuzz)!=1 or min(fuzz.values())<2500:raise RuntimeError('Incomplete fuzz execution')
 r=execute([sys.executable,'scripts/bet/check-poker-5c8-monitor.py'],ROOT,env,out,'monitor-tests');log=r.stderr.decode('utf-8').replace('\r\n','\n')
 if not re.search(r'Ran 20 tests\b',log)or '\nOK\n'not in log:raise RuntimeError('Incomplete monitor execution')
 replayer=module('refunds','scripts/bet/replay-poker-5c7-refunds.py')
 owners=[('Security','testCoordinatorRefundsRealPlayedHandAndWithheldDeal','withheld'),('Security','testRestartBetweenEveryRefundChunkRetainsOriginalPayers','restarted'),('Security','testQueuedPurchasesBlockRefundUntilBoundedDrain','queued'),('Security','testActiveAuthenticatedHandBlocksRefundAndTimesOutCanonically','active'),('Security','testMissingPublicEvidenceUsesOriginalReviewDeadline','missing'),('Security','testPauseDeadlineDoesNotMoveWhenObservedLateOrRestarted','pause'),('Security','testGenuineShuffleWithoutDeliveryCannotStartAndRefunds','delivery'),('Rebuy','testPendingRebuyExpiresBeforeRecoveryCanReleaseMoney','rebuy')]
 for owner,test,label in owners:
  execute(cmd+['--match-contract','^TournamentRecovery'+owner+'420Test$','--match-test','^'+test+r'\(\)$','-vvvv'],ROOT/'contracts',env,out,label+'-trace')
  trace=(out/(label+'-trace.stdout.log')).read_text(encoding='utf-8-sig');write(out,label+'-independent-replay.json',replayer.replay(trace))
 execute(cmd+['--match-contract','^TournamentRecoverySecurity420Test$','--match-test',r'^testCanonicalPrizesResumeThroughIndependentCoordinators\(\)$','-vvvv'],ROOT/'contracts',env,out,'prize-restart-trace')
 from Crypto.Hash import keccak
 def k256(b):h=keccak.new(digest_bits=256);h.update(b);return h.hexdigest()
 closure={};artifacts={}
 for f in (out/'build').glob('*/*.json'):
  d=json.loads(f.read_text(encoding='utf-8'));code=d.get('deployedBytecode',{}).get('object','').removeprefix('0x')
  for rel,entry in d.get('metadata',{}).get('sources',{}).items():
   path='contracts/'+rel;data=(ROOT/path).read_bytes().replace(b'\r\n',b'\n')
   if k256(data)!=entry['keccak256'].removeprefix('0x'):raise RuntimeError('Compiled source drift: '+path)
   closure[path]=sha(ROOT/path)
  if not code or f.stem.endswith('Test')or f.stem.endswith('Fixture420'):continue
  # Contract-test fixtures are excluded from deployment-size claims by source path.
  target=d.get('metadata',{}).get('settings',{}).get('compilationTarget',{})
  if any(rel.startswith('test/')for rel in target):continue
  runtime=len(code)//2;creation=len(d['bytecode']['object'].removeprefix('0x'))//2
  if runtime>24576 or creation>49152:raise RuntimeError('EVM deployment bound: '+f.stem)
  artifacts[f.relative_to(out).as_posix()]={'runtimeBytes':runtime,'creationBytes':creation,'runtimeKeccak256':k256(bytes.fromhex(code))}
 if not any('PokerTournamentRecovery420.json'in f for f in artifacts):raise RuntimeError('Missing recovery compilation')
 write(out,'compiled-identities.json',{'sourceClosureSHA256':closure,'artifacts':artifacts})
 execute([sys.executable,'-m','slither','contracts/src/bet/tournament/recovery/PokerTournamentRecovery420.sol','--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',out/'static-raw.json'],ROOT,env,out,'static-analysis',True)
 raw=json.loads((out/'static-raw.json').read_text(encoding='utf-8'));review=json.loads((ROOT/'scripts/bet/poker-5c8-static-review.json').read_text(encoding='utf-8'));actual={}
 if not raw.get('success'):raise RuntimeError('Static analysis failed')
 for f in raw['results'].get('detectors',[]):
  if f['impact']not in ['High','Medium']:continue
  desc=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());key=hashlib.sha256((f['check']+'\n'+desc).encode()).hexdigest();actual[key]=f
 if set(actual)!=set(review['dispositions'])or any(actual[h]['impact']!=v['severity']or actual[h]['check']!=v['check']for h,v in review['dispositions'].items()):raise RuntimeError('Unreviewed severe finding')
 for f,h in review['normalizedSourceSHA256'].items():
  if sha(ROOT/f)!=h:raise RuntimeError('Static reviewed source drift: '+f)
 write(out,'static-review.json',{'rawHigh':sum(f['impact']=='High'for f in actual.values()),'rawMedium':sum(f['impact']=='Medium'for f in actual.values()),'unreviewedHighMedium':0,'independentAudit':False,'review':review})
 if git('rev-parse','HEAD')!=head or git('status','--porcelain','--',*SCOPE)or any(sha(ROOT/f)!=h for f,h in {**sources,**closure}.items()):raise RuntimeError('Source drift')
 evidence={f.relative_to(out).as_posix():hashlib.sha256(f.read_bytes()).hexdigest()for f in out.rglob('*')if f.is_file()and not any(x in f.relative_to(out).parts for x in ['build','cache'])}
 report={'schema':'420-poker-5c8-security-recovery-v1','qualifiedSHA':head,'tree':git('rev-parse','HEAD^{tree}'),'reconciledMain':BASE,'level1Accepted':True,'fundedRecoveryLevel2Accepted':True,'newNativeTestsPassed':len(tests),'newMonitorTestsPassed':20,'newFuzzRuns':fuzz,'independentRefundReplays':len(owners),'independentRestartedPrizeReplay':True,'retainedQualification':retained,'newProofMaterialRequired':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'officialTestnetAccepted':False,'externalProviderIndependenceAccepted':False,'independentAuditAccepted':False,'productionApproved':False,'completedAt':datetime.now(timezone.utc).isoformat()}
 write(out,'qualification.json',report);print(json.dumps({k:report[k]for k in ['qualifiedSHA','level1Accepted','fundedRecoveryLevel2Accepted','newNativeTestsPassed','newMonitorTestsPassed']}),flush=True)
if __name__=='__main__':main()
