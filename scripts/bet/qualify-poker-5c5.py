"""Execute exact-SHA native and genuine funded tournament Level 2 qualification."""
import argparse,hashlib,importlib.util,json,os,re,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
from importlib.metadata import version
ROOT=Path(__file__).resolve().parents[2]
BASE='91a24aafbe1aa1e6136115fd8ed382e812e25bcf'
SCOPE=['contracts/foundry.toml','contracts/test/tournament-5c5','clients/420bet-poker/zkshuffle/fixtures/tournament-5c5','clients/420bet-poker/zkshuffle/tournament5c5_funded_proofs_test.go','clients/420bet-poker/zkshuffle/tournament5c5_verify_evidence_test.go','scripts/bet/qualify-poker-5c5.py','scripts/bet/export-poker-5c5-context.py','scripts/bet/replay-poker-5c5.py','scripts/bet/unpack-poker-5c5-evidence.py','scripts/bet/poker-5c5-static-review.json','docs/bet/BET-AUDIT-5C.5-ELIMINATIONS-STANDINGS.md','.github/workflows/420bet-poker-5c5-level2.yml']
SCOPE += ['contracts/src/bet/tournament/'+n+'.sol' for n in ['PokerTournamentAdmission420','PokerTournamentNLHE420','PokerTournamentRuntimeEscrow420','PokerTournamentStandings420','PokerTournamentRoundEntropy420','PokerTournamentHost420','PokerTournamentHostState420','PokerTournamentHostFactories420','PokerTournamentHostConfiguration420','PokerTournamentHostAdmission420','PokerTournamentHostLedger420','PokerTournamentHostRounds420','PokerTournamentHostBalance420']]
SCOPE += ['contracts/src/bet/tournament/generated','.github/workflows/identity-id-audit-4.yml','.github/workflows/identity-id-audit-5.yml']
def module(name,file):
    s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
helpers=module('previous_helpers','scripts/bet/qualify-poker-5c2.py')
execute,native,git=helpers.execute,helpers.native,helpers.git
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(out,name,value):(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def allowed(f):return any(f==s or f.startswith(s+'/') for s in SCOPE)
def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--go',default='go');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()):raise RuntimeError('Fresh evidence directory required')
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('Clean committed scope required')
    head=git('rev-parse','HEAD');subprocess.check_call(['git','merge-base','--is-ancestor',BASE,head],cwd=ROOT)
    if any(not allowed(f) for f in git('diff','--name-only',BASE,head).splitlines()):raise RuntimeError('Unrelated changes')
    current=(ROOT/'contracts/foundry.toml').read_text(encoding='utf-8').replace('\r\n','\n')
    stripped=re.sub(r'# Isolated tournament integration owner\.[\s\S]*?(?=\[profile.hardening.invariant\])','',current)
    baseline=git('show',BASE+':contracts/foundry.toml').replace('\r\n','\n').strip()
    if stripped.strip()!=baseline:raise RuntimeError('Inherited Foundry profile drift')
    sources={f:sha(ROOT/f) for f in git('ls-files','--',*SCOPE).splitlines()}
    env=dict(os.environ,FOUNDRY_PROFILE='tournament5c5',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c5',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0',GOMAXPROCS='4')
    tool=execute([a.forge,'--version'],ROOT,env,out,'foundry-version').stdout.decode()
    gotool=execute([a.go,'version'],ROOT,env,out,'go-version').stdout.decode()
    if '1.8.6' not in tool or 'go1.27.3' not in gotool or version('slither-analyzer')!='0.11.6' or sys.version_info[:2]!=(3,12):raise RuntimeError('Unqualified toolchain')
    execute([sys.executable,'scripts/bet/unpack-poker-5c5-evidence.py'],ROOT,env,out,'unpack-evidence')
    r=execute([a.go,'test','-mod=readonly','-count=1','-timeout','10m','-run','^TestTournament5C5CommittedCryptographicEvidence$','-v','.'],ROOT/'clients/420bet-poker/zkshuffle',env,out,'genuine-groth16-verification')
    log=r.stdout.decode('utf-8')
    if '--- PASS: TestTournament5C5CommittedCryptographicEvidence' not in log or '--- SKIP' in log or len(re.findall('verified committed genuine proof ',log))!=454:raise RuntimeError('Incomplete genuine proof verification')
    cmd=[a.forge,'test','--no-dynamic-test-linking','--use',a.solc]
    selection='^Tournament(StandingsNative|EliminationFunded|RebuyFunded|ReentryFunded|TieFunded|BalanceFunded|RuntimeAssetAttack)420Test$'
    r=execute(cmd+['--match-contract',selection,'--json'],ROOT/'contracts',env,out,'tournament-tests')
    suites=json.loads(r.stdout.decode('utf-8-sig'));tests=[(s,n,t) for s,v in suites.items() for n,t in v['test_results'].items()]
    expected=set()
    for file in (ROOT/'contracts/test/tournament-5c5').glob('*.sol'):expected.update(re.findall(r'function\s+(test\w+)\s*\(',file.read_text(encoding='utf-8')))
    if len(tests)!=58 or {n.split('(')[0] for s,n,t in tests}!=expected or any(t['status']!='Success' for s,n,t in tests):raise RuntimeError('Incomplete funded/native C5 inventory')
    old=[]
    for folder,file,count,select in [('tournament-5c1','PokerTournamentPolicy420.t.sol',36,[]),('tournament-5c2','PokerTournamentEntryEscrow420.t.sol',60,[]),('tournament-5c3','PokerTournamentStructure420.t.sol',91,['--match-contract','^TournamentStructure.*Test$'])]:
        r=execute(cmd+select+['--json'],ROOT/'contracts',dict(env,FOUNDRY_PROFILE='pr',FOUNDRY_TEST='test/'+folder),out,'inherited-'+folder);old+=native(r,ROOT/'contracts/test'/folder/file,count)
    for suite,file,count in [('TournamentAssignmentsFunded420Test','PokerTournamentAssignments420.t.sol',31),('TournamentTableBalance420Test','PokerTournamentBalance420.t.sol',28)]:
        r=execute(cmd+['--match-contract','^'+suite+'$','--json'],ROOT/'contracts',dict(env,FOUNDRY_PROFILE='pr',FOUNDRY_TEST='test/tournament-5c4'),out,'inherited-'+suite);old+=native(r,ROOT/'contracts/test/tournament-5c4'/file,count)
    fuzz={s+':'+n:t['kind']['Fuzz']['runs'] for s,n,t in tests+old if 'Fuzz' in t['kind']}
    if len(fuzz)!=11 or any(n<2500 for n in fuzz.values()):raise RuntimeError('Incomplete fuzz execution')
    r=execute([sys.executable,'clients/420bet-poker/tournament/check_lifecycle.py'],ROOT,env,out,'inherited-reference');log=r.stderr.decode('utf-8').replace('\r\n','\n')
    if not re.search(r'Ran 43 tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('Incomplete reference regression')
    replay=module('independent_replay','scripts/bet/replay-poker-5c5.py');traces={}
    for suite,test,label,certificate in [('TournamentEliminationFunded420Test','testLegitimateFundedTournamentEliminationsAndChampion','legitimate',True),('TournamentTieFunded420Test','testGenuineSameHandEliminationTie','tie',True),('TournamentBalanceFunded420Test','testGenuineHandResultsAuthorizeNextBigBlindBalancing','balance',False)]:
        execute(cmd+['--match-contract','^'+suite+'$','--match-test','^'+test+r'\(\)$','-vvvv'],ROOT/'contracts',env,out,label+'-trace')
        trace=(out/(label+'-trace.stdout.log')).read_text(encoding='utf-8-sig');traces[label]=trace
        write(out,label+'-independent-replay.json',replay.replay(trace,certificate))
    identities=re.findall(r'emit C5VerifierIdentity\(index: (\d+), backend: .*?\[(0x[0-9a-fA-F]{40})\], verifyingKey: (0x[0-9a-fA-F]{64}), runtimeHash: (0x[0-9a-fA-F]{64}), circuit: (0x[0-9a-fA-F]{64}), schema: (0x[0-9a-fA-F]{64})\)',traces['legitimate'])
    if len(identities)!=7 or not re.search(r'emit C5RuntimeIdentity\(',traces['legitimate']):raise RuntimeError('Missing executed verifier/runtime identities')
    write(out,'executed-verifier-identities.json',identities)
    execute(cmd+['--match-contract','^TournamentStandingsNative420Test$','--match-test','testFull576PlayerStandingsAndBoundedFinalization','-vvvv'],ROOT/'contracts',env,out,'capacity-trace')
    trace=(out/'capacity-trace.stdout.log').read_text(encoding='utf-8-sig');chunks=re.findall(r'emit FinalizationChunkGas\(players: 576, chunk: 8, gasUsed: (\d+)',trace)
    if len(chunks)!=72 or any(int(g)>=15000000 for g in chunks):raise RuntimeError('Incomplete bounded finalization evidence')
    write(out,'capacity-gas.json',{'nativePlayers':576,'chunk':8,'chunks':72,'maximumGas':max(map(int,chunks)),'genuine576PlayerHandsClaimed':False})
    from Crypto.Hash import keccak
    def k256(data):h=keccak.new(digest_bits=256);h.update(data);return h.hexdigest()
    closure={};artifacts={}
    for file in (out/'build').glob('*/*.json'):
        d=json.loads(file.read_text(encoding='utf-8'));code=d.get('deployedBytecode',{}).get('object','').removeprefix('0x')
        if not code or file.stem.endswith('Test'):continue
        runtime=len(code)//2;creation=len(d['bytecode']['object'].removeprefix('0x'))//2
        if runtime>24576 or creation>49152 or not d['metadata']['compiler']['version'].startswith('0.8.30+'):raise RuntimeError('EVM/compiler bound: '+file.stem)
        for rel,v in d['metadata']['sources'].items():
            f=ROOT/'contracts'/rel
            if k256(f.read_bytes().replace(b'\r\n',b'\n'))!=v['keccak256'].removeprefix('0x'):raise RuntimeError('Compiled source drift: '+rel)
            closure['contracts/'+rel]=sha(f)
        artifacts[file.relative_to(out).as_posix()]={'sha256':sha(file),'runtimeBytes':runtime,'creationBytes':creation}
    for f in closure:
        if not allowed(f) and git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited compiled source changed: '+f)
    write(out,'compiled-identities.json',{'sourceClosureSHA256':closure,'artifacts':artifacts})
    manifest=json.loads((ROOT/'clients/420bet-poker/zkshuffle/fixtures/tournament-5c5/manifest.json').read_text(encoding='utf-8'))
    if [int(v[0]) for v in identities]!=list(range(7)):raise RuntimeError('Verifier identity inventory mismatch')
    for index,backend,key,runtime,circuit,schema in identities:
        record=manifest['keys'][int(index)];name=record['name'];artifact=out/'build'/('C5'+name+'Verifier.sol')/('C5'+name+'Verifier.json')
        d=json.loads(artifact.read_text(encoding='utf-8'));code=bytes.fromhex(d['deployedBytecode']['object'].removeprefix('0x'))
        vk=ROOT/'clients/420bet-poker/zkshuffle/fixtures/tournament-5c5/keys'/(name+'.vk')
        if runtime!='0x'+k256(code) or key!='0x'+k256(vk.read_bytes()) or circuit!='0x'+record['relationSHA256'] or schema!='0x'+record['schemaSHA256']:raise RuntimeError('Deployed verifier/key/relation/schema mismatch: '+name)
    review=json.loads((ROOT/'scripts/bet/poker-5c5-static-review.json').read_text(encoding='utf-8'));staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    execute([sys.executable,'-m','slither','contracts/src/bet/tournament/PokerTournamentHost420.sol','--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',out/'static-raw.json'],ROOT,staticenv,out,'static-analysis',True)
    raw=json.loads((out/'static-raw.json').read_text(encoding='utf-8'))
    if not raw.get('success'):raise RuntimeError('Analyzer did not succeed')
    severe=[f for f in raw['results'].get('detectors',[]) if f['impact'] in ['High','Medium']];actual={}
    for f in severe:
        desc=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());key=hashlib.sha256((f['check']+'\n'+desc).encode()).hexdigest();actual[key]=f
    if set(actual)!=set(review['dispositions']) or any(actual[h]['impact']!=v['severity'] or actual[h]['check']!=v['check'] for h,v in review['dispositions'].items()):raise RuntimeError('Unreviewed severe finding')
    for f,h in review['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/f).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('Reviewed source drift: '+f)
    write(out,'static-review.json',{'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0,'review':review,'independentAudit':False})
    if git('rev-parse','HEAD')!=head or git('status','--porcelain','--',*SCOPE) or any(sha(ROOT/f)!=h for f,h in {**sources,**closure}.items()):raise RuntimeError('Source drift')
    evidence={f.relative_to(out).as_posix():sha(f) for f in out.rglob('*') if f.is_file() and not any(x in f.relative_to(out).parts for x in ['build','cache'])}
    report={'schema':'420-poker-5c5-genuine-tournament-v1','qualifiedSHA':head,'reconciledMain':BASE,'tree':git('rev-parse','HEAD^{tree}'),'level1Accepted':True,'fundedTournamentLevel2Accepted':True,'testsPassed':{'c5Native':24,'c5Funded':27,'c5HostileAsset':7,'inheritedNative':246,'inheritedReference':43,'total':347},'genuineProofsVerified':454,'fuzzRuns':fuzz,'retainedRandomizedReferenceCases':1000,'genuineTournamentHandIntegrationAccepted':True,'liveConsolidationAccepted':True,'liveOrdinaryBalancingAccepted':True,'receiptFundedExtraPurchasesAccepted':True,'prizeExecutionAccepted':False,'externalProviderIndependenceAccepted':False,'productionTrustedCeremonyAccepted':False,'officialTestnetAccepted':False,'productionApproved':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    write(out,'qualification.json',report);print(json.dumps({k:report[k] for k in ['qualifiedSHA','level1Accepted','fundedTournamentLevel2Accepted','testsPassed']}),flush=True)
if __name__=='__main__':main()
