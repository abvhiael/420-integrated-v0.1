"""Actual native 5C.3 qualification and funded receipt/stack binding; no live-hand acceptance."""
import argparse,hashlib,json,os,re,subprocess,sys,importlib.util
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version
ROOT=Path(__file__).resolve().parents[2]
BASE='6a06b54b1c182411ab2ea46586989ab1cadde76e'
SCOPE=['contracts/src/bet/tournament/PokerTournamentStructure420.sol','contracts/src/bet/tournament/PokerTournamentStructureBook420.sol','contracts/test/tournament-5c3','scripts/bet/qualify-poker-5c3.py','scripts/bet/poker-5c3-static-review.json','docs/bet/BET-AUDIT-5C.3-STACKS-BLINDS-LEVELS.md','.github/workflows/420bet-poker-5c3-level2.yml']
INHERITED=['contracts/src/bet/tournament/PokerTournamentPolicy420.sol','contracts/src/bet/tournament/PokerTournamentPolicyRegistry420.sol','contracts/src/bet/tournament/PokerTournamentEntryEscrow420.sol','contracts/src/bet/tournament/PokerTournamentPurchaseAccounting420.sol','contracts/test/tournament-5c1/PokerTournamentPolicy420.t.sol','contracts/test/tournament-5c2/PokerTournamentEntryEscrow420.t.sol','clients/420bet-poker/tournament/lifecycle.py','clients/420bet-poker/tournament/check_lifecycle.py','scripts/bet/qualify-poker-5c2.py','scripts/bet/poker-5c2-static-review.json']
spec=importlib.util.spec_from_file_location('inherited_qualification_helpers',ROOT/INHERITED[-2]);helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
execute,native,git=helpers.execute,helpers.native,helpers.git
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(out,name,value):(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()):raise RuntimeError('Fresh evidence directory required')
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('Tracked clean scope required')
    head=git('rev-parse','HEAD');subprocess.check_call(['git','merge-base','--is-ancestor',BASE,head],cwd=ROOT)
    changed=git('diff','--name-only',BASE,head).splitlines()
    allowed=lambda f:any(f==s or f.startswith(s+'/') for s in SCOPE)
    if any(not allowed(f) for f in changed):raise RuntimeError('Unrelated changes beyond reconciled main')
    for f in INHERITED:
        if git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited source identity changed: '+f)
    sources={f:sha(ROOT/f) for f in git('ls-files','--',*SCOPE,*INHERITED).splitlines()}
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c3',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0')
    tool=execute([a.forge,'--version'],ROOT,env,out,'foundry-version').stdout.decode()
    if '1.8.6' not in tool or version('slither-analyzer')!='0.11.6' or sys.version_info[:2]!=(3,12):raise RuntimeError('Unqualified toolchain version')
    basecmd=[a.forge,'test','--no-dynamic-test-linking','--use',a.solc]
    r=execute(basecmd+['--match-contract','^TournamentStructure.*Test$','--json'],ROOT/'contracts',env,out,'structure-tests')
    tests=native(r,ROOT/'contracts/test/tournament-5c3/PokerTournamentStructure420.t.sol',91)
    counts={name:sum(s.endswith(':'+name) for s,n,t in tests) for name in ['TournamentStructureBook420Test','TournamentStructureClock420Test','TournamentStructureBlinds420Test']}
    if counts!={'TournamentStructureBook420Test':46,'TournamentStructureClock420Test':36,'TournamentStructureBlinds420Test':9}:raise RuntimeError('Incorrect actual 5C.3 inventory')
    old=[]
    for folder,file,expected in [('tournament-5c2',INHERITED[5],60),('tournament-5c1',INHERITED[4],36)]:
        e=dict(env,FOUNDRY_TEST='test/'+folder)
        r=execute(basecmd+['--json'],ROOT/'contracts',e,out,'inherited-'+folder);old+=native(r,ROOT/file,expected)
    fuzz={n:t['kind']['Fuzz']['runs'] for s,n,t in tests+old if 'Fuzz' in t['kind']}
    if len(fuzz)!=8 or any(n<2500 for n in fuzz.values()):raise RuntimeError('Incomplete native fuzz execution')
    r=execute([sys.executable,INHERITED[7]],ROOT,env,out,'inherited-reference');log=r.stderr.decode('utf-8').replace('\r\n','\n')
    if not re.search(r'Ran 43 tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('Incomplete reference regression')
    execute(basecmd+['--match-contract','^TournamentStructureBook420Test$','--match-test','testLegitimateFundedReceiptReservesExactStartingStack','-vvvv'],ROOT/'contracts',env,out,'funded-structure-trace')
    trace=(out/'funded-structure-trace.stdout.log').read_text(encoding='utf-8-sig');line=next((s for s in trace.splitlines() if 'emit StructureIdentity(' in s),'')
    addresses=re.findall(r'0x[0-9a-fA-F]{40}\b',line);hashes=re.findall(r'0x[0-9a-fA-F]{64}\b',line)
    if len(addresses)!=2 or len(hashes)!=3 or any(f'{k}: {v}' not in line for k,v in [('reservedChips',1000),('assetLiability',103),('prizeBalance',100),('heldFees',3)]):raise RuntimeError('Missing genuine funded binding trace identity')
    write(out,'executed-identities.json',{'book':addresses[0],'runtimeKeccak256':hashes[0],'structureDigest':hashes[1],'eventManifest':hashes[2],'escrow':addresses[1],'reservedChips':1000,'assetLiability':103,'prizeBalance':100,'heldFees':3,'trace':'funded-structure-trace.stdout.log','genuineHandAdmission':False})
    from Crypto.Hash import keccak
    def k256(value):
        h=keccak.new(digest_bits=256);h.update(value);return h.hexdigest()
    artifacts={};closure={};abi_seen=False
    for file in (out/'build').glob('*/*.json'):
        d=json.loads(file.read_text(encoding='utf-8'));code=d.get('deployedBytecode',{}).get('object','').removeprefix('0x')
        if not code or file.stem.endswith('Test'):continue
        size=len(bytes.fromhex(code));creation=len(bytes.fromhex(d['bytecode']['object'].removeprefix('0x')))
        if size>24576 or creation>49152 or not d['metadata']['compiler']['version'].startswith('0.8.30+'):raise RuntimeError('EVM/compiler mismatch: '+file.stem)
        for rel,v in d['metadata']['sources'].items():
            path=ROOT/'contracts'/rel
            if k256(path.read_bytes().replace(b'\r\n',b'\n'))!=v['keccak256'].removeprefix('0x'):raise RuntimeError('Compiled source mismatch: '+rel)
            closure['contracts/'+rel]=sha(path)
        if file.stem=='PokerTournamentStructureBook420':
            functions={x['name'] for x in d['abi'] if x['type']=='function'}
            allowed={'DOMAIN','CREATE','APPROVE','PUBLISH','RETIRE','BIND_POLICY','BIND_EVENT','RESERVE','policies','escrow','authorization','policyStructure','eventStructure','boundManifest','reservedForPerson','reservedChips','reservedPlayers','scope','digest','register','approve','publish','retire','structureOf','levelsOf','levelAt','bindPolicy','bindEvent','reserve','reserveAfterCleanup','syncReservation','reservationOf','reservationLive','acceptsFunds','liveHandIntegrationEnabled','ante','freezesBlindClockOnPause'}
            if functions!=allowed or any(x.get('stateMutability')=='payable' for x in d['abi']):raise RuntimeError('Unqualified ABI or gameplay/custody escape')
            abi_seen=True
        artifacts[file.relative_to(out).as_posix()]={'sha256':sha(file),'runtimeBytes':size,'creationBytes':creation}
    if not abi_seen:raise RuntimeError('Book artifact missing')
    for f in closure:
        if not allowed_path(f) and git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited compiled source changed')
    write(out,'compiled-identities.json',{'artifacts':artifacts,'sourceClosureSHA256':closure})
    review=json.loads((ROOT/'scripts/bet/poker-5c3-static-review.json').read_text(encoding='utf-8'));staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    summaries={}
    for name,target in [('book',SCOPE[1]),('clock',SCOPE[0])]:
        execute([sys.executable,'-m','slither',target,'--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',out/(name+'-static-raw.json')],ROOT,staticenv,out,name+'-static',True)
        raw=json.loads((out/(name+'-static-raw.json')).read_text(encoding='utf-8'))
        if not raw.get('success') or not isinstance(raw.get('results'),dict):raise RuntimeError('Analyzer did not succeed: '+name)
        actual={};severe=[f for f in raw['results'].get('detectors',[]) if f['impact'] in ['High','Medium']]
        for f in severe:
            desc=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());h=hashlib.sha256((f['check']+'\n'+desc).encode()).hexdigest()
            if h in actual:raise RuntimeError('Duplicate severe finding')
            actual[h]=f
        expected=review['dispositions'][name]
        if set(actual)!=set(expected) or any(actual[h]['impact']!=v['severity'] or actual[h]['check']!=v['check'] for h,v in expected.items()):raise RuntimeError('Unreviewed severe static finding: '+name)
        summaries[name]={'analyzerSucceeded':True,'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0}
    for f,h in review['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/f).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('Reviewed source drift')
    write(out,'static-review.json',{'targets':summaries,'review':review,'independentSecurityApproval':False})
    if git('rev-parse','HEAD')!=head or git('status','--porcelain','--',*SCOPE) or any(sha(ROOT/f)!=h for f,h in {**sources,**closure}.items()):raise RuntimeError('Source drift during qualification')
    evidence={f.relative_to(out).as_posix():sha(f) for f in out.rglob('*') if f.is_file() and not any(x in f.relative_to(out).parts for x in ['build','cache'])}
    report={'schema':'420-poker-5c3-structures-and-funded-reservations-v1','qualifiedSHA':head,'reconciledMain':BASE,'tree':git('rev-parse','HEAD^{tree}'),'nativeMechanicsLevel1Accepted':True,'fundedStructureBindingLevel2Accepted':True,'testsPassed':{**counts,'inheritedNative':96,'inheritedReference':43,'total':230},'fuzzRuns':fuzz,'retainedRandomizedReferenceCases':1000,'scope':'Native clock/snapshot/blind arithmetic and actual funded entry-backed starting-stack reservations','rules':{'configurableFrozenSchedule':True,'ante':0,'freezeBlindClockOnPause':True,'finalLevelHeld':True,'numericLaunchPresetsSelected':False},'genuineTournamentHandIntegrationAccepted':False,'genuineTournamentBlindPostingAccepted':False,'gameplayPurchasesEnabled':False,'prizeExecutionAccepted':False,'officialTestnetAccepted':False,'productionApproved':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    write(out,'qualification.json',report);print(json.dumps({k:report[k] for k in ['qualifiedSHA','nativeMechanicsLevel1Accepted','fundedStructureBindingLevel2Accepted','testsPassed']}),flush=True)
def allowed_path(f):return any(f==s or f.startswith(s+'/') for s in SCOPE)
if __name__=='__main__':main()
