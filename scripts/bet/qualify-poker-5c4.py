"""Exact-SHA funded seating qualification. Native movement snapshots are not genuine poker outcomes."""
import argparse,hashlib,json,os,re,subprocess,sys,importlib.util
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version
ROOT=Path(__file__).resolve().parents[2]
BASE='e7f449d808ffedf23a12ad5348a7cbf29726bd8b'
SCOPE=['contracts/src/bet/tournament/PokerTournamentAssignments420.sol','contracts/src/bet/tournament/PokerTournamentSeatingEntropy420.sol','contracts/src/bet/tournament/PokerTournamentTableBalance420.sol','contracts/test/tournament-5c4','scripts/bet/qualify-poker-5c4.py','scripts/bet/poker-5c4-static-review.json','docs/bet/BET-AUDIT-5C.4-ASSIGNMENTS-BALANCING.md','.github/workflows/420bet-poker-5c4-level2.yml']
spec=importlib.util.spec_from_file_location('prior_helpers',ROOT/'scripts/bet/qualify-poker-5c2.py');helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
execute,native,git=helpers.execute,helpers.native,helpers.git
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(out,name,value):(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def allowed(f):return any(f==s or f.startswith(s+'/') for s in SCOPE)
def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()):raise RuntimeError('Fresh evidence directory required')
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('Clean committed scope required')
    head=git('rev-parse','HEAD');subprocess.check_call(['git','merge-base','--is-ancestor',BASE,head],cwd=ROOT)
    if any(not allowed(f) for f in git('diff','--name-only',BASE,head).splitlines()):raise RuntimeError('Unrelated source changes')
    sources={f:sha(ROOT/f) for f in git('ls-files','--',*SCOPE).splitlines()}
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c4',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0')
    tool=execute([a.forge,'--version'],ROOT,env,out,'foundry-version').stdout.decode()
    if '1.8.6' not in tool or version('slither-analyzer')!='0.11.6' or sys.version_info[:2]!=(3,12):raise RuntimeError('Unqualified toolchain')
    cmd=[a.forge,'test','--no-dynamic-test-linking','--use',a.solc];tests=[];counts={}
    for suite,file,count in [('TournamentAssignmentsFunded420Test','PokerTournamentAssignments420.t.sol',30),('TournamentTableBalance420Test','PokerTournamentBalance420.t.sol',28)]:
        r=execute(cmd+['--match-contract','^'+suite+'$','--json'],ROOT/'contracts',env,out,suite)
        tests+=native(r,ROOT/'contracts/test/tournament-5c4'/file,count);counts[suite]=count
    old=[]
    for folder,file,count in [('tournament-5c1','PokerTournamentPolicy420.t.sol',36),('tournament-5c2','PokerTournamentEntryEscrow420.t.sol',60),('tournament-5c3','PokerTournamentStructure420.t.sol',91)]:
        r=execute(cmd+['--json'],ROOT/'contracts',dict(env,FOUNDRY_TEST='test/'+folder),out,'inherited-'+folder);old+=native(r,ROOT/'contracts/test'/folder/file,count)
    fuzz={s+':'+n:t['kind']['Fuzz']['runs'] for s,n,t in tests+old if 'Fuzz' in t['kind']}
    if len(fuzz)!=10 or any(n<2500 for n in fuzz.values()):raise RuntimeError('Incomplete fuzz execution')
    r=execute([sys.executable,'clients/420bet-poker/tournament/check_lifecycle.py'],ROOT,env,out,'inherited-reference');log=r.stderr.decode('utf-8').replace('\r\n','\n')
    if not re.search(r'Ran 43 tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('Incomplete reference regression')
    execute(cmd+['--match-contract','^TournamentAssignmentsFunded420Test$','--match-test','testLegitimateFundedRosterGenuineProofAndAssignments','-vvvv'],ROOT/'contracts',env,out,'genuine-funded-trace')
    trace=(out/'genuine-funded-trace.stdout.log').read_text(encoding='utf-8-sig');line=next((x for x in trace.splitlines() if 'emit SeatingEvidence(' in x),'')
    fields=dict(re.findall(r'(router|routerHash|verifier|verifierHash|requestId|rosterRoot|word|proof|root|proofHash|assignments): (?:[A-Za-z0-9_]+: \[)?(0x[0-9a-fA-F]+)',line))
    if len(fields)!=11 or len(fields['proof'])!=130:raise RuntimeError('Missing genuine executed proof statement')
    from Crypto.Hash import keccak
    def k256(data):h=keccak.new(digest_bits=256);h.update(data);return h.hexdigest()
    if k256(bytes.fromhex(fields['proof'][2:]))!=fields['proofHash'][2:]:raise RuntimeError('Proof checksum mismatch')
    write(out,'executed-identities-and-proof.json',dict(fields,genuineHandAdmission=False,trace='genuine-funded-trace.stdout.log'))
    execute(cmd+['--match-contract','^TournamentAssignmentsFunded420Test$','--match-test','testFullFunded576Player64TableChunkedQualification','-vvvv'],ROOT/'contracts',env,out,'funded-capacity-trace')
    trace=(out/'funded-capacity-trace.stdout.log').read_text(encoding='utf-8-sig');chunks=re.findall(r'emit ChunkGas\(phase: (0x[0-9a-fA-F]+), chunk: (\d+), gasUsed: (\d+)',trace)
    if len(chunks)!=54 or any(int(n)!=32 or int(g)>=15000000 for phase,n,g in chunks):raise RuntimeError('Incomplete bounded gas evidence')
    write(out,'capacity-gas.json',{'tables':64,'fundedPlayers':576,'chunkSize':32,'chunks':len(chunks),'maximumChunkGas':max(int(g) for phase,n,g in chunks),'allChunksBelow':15000000,'trace':'funded-capacity-trace.stdout.log'})
    closure={};artifacts={};seen=False
    for file in (out/'build').glob('*/*.json'):
        d=json.loads(file.read_text(encoding='utf-8'));code=d.get('deployedBytecode',{}).get('object','').removeprefix('0x')
        if not code or file.stem.endswith('Test'):continue
        runtime=len(bytes.fromhex(code));creation=len(bytes.fromhex(d['bytecode']['object'].removeprefix('0x')))
        if runtime>24576 or creation>49152 or not d['metadata']['compiler']['version'].startswith('0.8.30+'):raise RuntimeError('EVM/compiler mismatch: '+file.stem)
        for rel,v in d['metadata']['sources'].items():
            source=ROOT/'contracts'/rel
            if k256(source.read_bytes().replace(b'\r\n',b'\n'))!=v['keccak256'].removeprefix('0x'):raise RuntimeError('Compiled source mismatch: '+rel)
            closure['contracts/'+rel]=sha(source)
        if file.stem=='PokerTournamentAssignments420':
            functions={x['name'] for x in d['abi'] if x['type']=='function'}
            approved={'DOMAIN','BIND','MAX_CHUNK','book','escrow','router','entropy','routerCodeHash','verifierCodeHash','scope','configuration','policyDigest','bind','eventOf','rosterCount','rosterAt','player','tableOf','occupant','tableCount','liveHandIntegrationEnabled','assignmentLive','loadRoster','fulfill','resolve','shuffle','assign','expire'}
            if functions!=approved or any(x.get('stateMutability')=='payable' for x in d['abi']):raise RuntimeError('Unqualified live-hand/custody ABI escape')
            seen=True
        artifacts[file.relative_to(out).as_posix()]={'sha256':sha(file),'runtimeBytes':runtime,'creationBytes':creation}
    if not seen:raise RuntimeError('Missing assignment artifact')
    for f in closure:
        if not allowed(f) and git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited compiled source changed: '+f)
    write(out,'compiled-identities.json',{'sourceClosureSHA256':closure,'artifacts':artifacts})
    review=json.loads((ROOT/'scripts/bet/poker-5c4-static-review.json').read_text(encoding='utf-8'));staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    execute([sys.executable,'-m','slither',SCOPE[0],'--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',out/'static-raw.json'],ROOT,staticenv,out,'static-analysis',True)
    raw=json.loads((out/'static-raw.json').read_text(encoding='utf-8'))
    if not raw.get('success') or not isinstance(raw.get('results'),dict):raise RuntimeError('Analyzer did not succeed')
    severe=[f for f in raw['results'].get('detectors',[]) if f['impact'] in ['High','Medium']];actual={}
    for f in severe:
        desc=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());key=hashlib.sha256((f['check']+'\n'+desc).encode()).hexdigest()
        if key in actual:raise RuntimeError('Duplicate severe finding')
        actual[key]=f
    if set(actual)!=set(review['dispositions']) or any(actual[h]['impact']!=v['severity'] or actual[h]['check']!=v['check'] for h,v in review['dispositions'].items()):raise RuntimeError('Unreviewed severe static finding')
    for f,h in review['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/f).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('Reviewed source drift: '+f)
    write(out,'static-review.json',{'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0,'review':review,'independentAudit':False})
    if git('rev-parse','HEAD')!=head or git('status','--porcelain','--',*SCOPE) or any(sha(ROOT/f)!=h for f,h in {**sources,**closure}.items()):raise RuntimeError('Source drift')
    evidence={f.relative_to(out).as_posix():sha(f) for f in out.rglob('*') if f.is_file() and not any(x in f.relative_to(out).parts for x in ['build','cache'])}
    report={'schema':'420-poker-5c4-funded-seating-v1','qualifiedSHA':head,'reconciledMain':BASE,'tree':git('rev-parse','HEAD^{tree}'),'nativeMechanicsLevel1Accepted':True,'fundedInitialSeatingLevel2Accepted':True,'testsPassed':{**counts,'inheritedNative':187,'inheritedReference':43,'total':288},'fuzzRuns':fuzz,'retainedRandomizedReferenceCases':1000,'maximumTables':64,'maximumPlayers':576,'genuineRandomnessVerifierExecuted':True,'genuineTournamentHandIntegrationAccepted':False,'liveBalancingAccepted':False,'gameplayPurchasesEnabled':False,'prizeExecutionAccepted':False,'externalProviderIndependenceAccepted':False,'officialTestnetAccepted':False,'productionApproved':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    write(out,'qualification.json',report);print(json.dumps({k:report[k] for k in ['qualifiedSHA','nativeMechanicsLevel1Accepted','fundedInitialSeatingLevel2Accepted','testsPassed']}),flush=True)
if __name__=='__main__':main()
