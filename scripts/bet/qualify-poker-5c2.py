"""Real exact-SHA Level 1 and funded entry-custody Level 2; never gameplay acceptance."""
import argparse,hashlib,json,os,re,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone
from importlib.metadata import version

ROOT=Path(__file__).resolve().parents[2]
BASE='269262583f86d996935afc8ee1a4a3064123c630'
SCOPE=['contracts/src/bet/tournament/PokerTournamentEntryEscrow420.sol','contracts/src/bet/tournament/PokerTournamentPurchaseAccounting420.sol','contracts/test/tournament-5c2','scripts/bet/qualify-poker-5c2.py','scripts/bet/poker-5c2-static-review.json','docs/bet/BET-AUDIT-5C.2-ENTRY-ACCOUNTING.md','.github/workflows/420bet-poker-5c2-level2.yml']
INHERITED=['contracts/src/bet/tournament/PokerTournamentPolicy420.sol','contracts/src/bet/tournament/PokerTournamentPolicyRegistry420.sol','contracts/test/tournament-5c1/PokerTournamentPolicy420.t.sol','clients/420bet-poker/tournament/lifecycle.py','clients/420bet-poker/tournament/check_lifecycle.py']

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(out,name,value):(out/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def execute(cmd,cwd,env,out,name,allow_detector_exit=False):
    print('Executing '+name,flush=True);r=subprocess.run(list(map(str,cmd)),cwd=cwd,env=env,capture_output=True)
    (out/(name+'.stdout.log')).write_bytes(r.stdout);(out/(name+'.stderr.log')).write_bytes(r.stderr)
    if r.returncode and not allow_detector_exit:raise RuntimeError('Actual execution failed: '+name)
    return r
def native(r,source,expected):
    suites=json.loads(r.stdout.decode('utf-8-sig'));tests=[(suite,n,t) for suite,s in suites.items() for n,t in s['test_results'].items()]
    names=set(re.findall(r'function\s+(test\w+)\s*\(',source.read_text(encoding='utf-8')))
    if len(tests)!=expected or {n.split('(')[0] for s,n,t in tests}!=names or any(t['status']!='Success' for s,n,t in tests):raise RuntimeError('Incomplete/failed actual native inventory')
    return tests

def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()):raise RuntimeError('Fresh evidence directory required')
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('Tracked clean scope required')
    head=git('rev-parse','HEAD');subprocess.check_call(['git','merge-base','--is-ancestor',BASE,head],cwd=ROOT)
    changed=git('diff','--name-only',BASE,head).splitlines()
    if any(not any(f==s or f.startswith(s+'/') for s in SCOPE) for f in changed):raise RuntimeError('Unrelated changes beyond reconciled main')
    for f in INHERITED:
        if git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited source identity changed: '+f)
    sources={f:sha(ROOT/f) for f in git('ls-files','--',*SCOPE,*INHERITED).splitlines()}
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c2',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0')
    tool=execute([a.forge,'--version'],ROOT,env,out,'foundry-version').stdout.decode()
    if '1.8.6' not in tool or version('slither-analyzer')!='0.11.6' or sys.version_info[:2]!=(3,12):raise RuntimeError('Unqualified toolchain version')
    r=execute([a.forge,'test','--no-dynamic-test-linking','--use',a.solc,'--json'],ROOT/'contracts',env,out,'entry-tests')
    tests=native(r,ROOT/'contracts/test/tournament-5c2/PokerTournamentEntryEscrow420.t.sol',60)
    counts={name:sum(s.endswith(':'+name) for s,n,t in tests) for name in ['TournamentEntryFunded420Test','TournamentPurchaseMath420Test','TournamentAssetAttack420Test']}
    if counts!={'TournamentEntryFunded420Test':46,'TournamentPurchaseMath420Test':7,'TournamentAssetAttack420Test':7}:raise RuntimeError('Level 1/2 suite inventory mismatch')
    inheritedenv=dict(env,FOUNDRY_TEST='test/tournament-5c1')
    r=execute([a.forge,'test','--no-dynamic-test-linking','--use',a.solc,'--json'],ROOT/'contracts',inheritedenv,out,'inherited-policy-tests')
    old=native(r,ROOT/INHERITED[2],36)
    fuzz={n:t['kind']['Fuzz']['runs'] for s,n,t in tests+old if 'Fuzz' in t['kind']}
    if len(fuzz)!=4 or any(n<2500 for n in fuzz.values()):raise RuntimeError('Incomplete native fuzz execution')
    r=execute([sys.executable,INHERITED[4]],ROOT,env,out,'inherited-reference-tests');log=r.stderr.decode('utf-8').replace('\r\n','\n')
    if not re.search(r'Ran 43 tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('Incomplete reference regression')
    execute([a.forge,'test','--no-dynamic-test-linking','--use',a.solc,'--match-test','testLegitimateFundedPurchaseAndFullRefund','-vvvv'],ROOT/'contracts',env,out,'funded-trace')
    trace=(out/'funded-trace.stdout.log').read_text(encoding='utf-8-sig');line=next((s for s in trace.splitlines() if 'emit FundedIdentity(' in s),'')
    addresses=re.findall(r'0x[0-9a-fA-F]{40}\b',line);hashes=re.findall(r'0x[0-9a-fA-F]{64}\b',line)
    if len(addresses)!=4 or len(hashes)!=2 or 'liability: 103' not in line:raise RuntimeError('Missing actual funded runtime/manifest identity')
    write(out,'executed-identities.json',{'escrow':addresses[0],'runtimeKeccak256':hashes[0],'manifest':hashes[1],'asset':addresses[1],'identity':addresses[2],'policies':addresses[3],'fundedLiabilityInTrace':103,'trace':'funded-trace.stdout.log'})
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
        if file.stem=='PokerTournamentEntryEscrow420':
            allowed={'DOMAIN','CREATE','ENTER','policies','authorization','identities','issuer','credentialType','asset','developmentFund','scope','eventOf','entryOf','configOf','quote','personKey','create','purchase','unregister','tick','refundCancelled','withdraw','solvent','gameplayPurchasesEnabled','purchaseExtra','admittedUniquePlayers','activeReceipt','nonceOf','credit','capabilitySpend','totalLiability','heldPrizes','heldFees','totalCredits','totalReceived','totalWithdrawn'}
            if {x['name'] for x in d['abi'] if x['type']=='function'}!=allowed or any(x.get('stateMutability')=='payable' for x in d['abi']):raise RuntimeError('Unqualified ABI/custody escape')
            abi_seen=True
        artifacts[file.relative_to(out).as_posix()]={'sha256':sha(file),'runtimeBytes':size,'creationBytes':creation}
    if not abi_seen:raise RuntimeError('Escrow artifact missing')
    for f in closure:
        if f not in SCOPE and not f.startswith('contracts/test/tournament-5c2/') and git('rev-parse',BASE+':'+f)!=git('rev-parse',head+':'+f):raise RuntimeError('Inherited compiled dependency changed')
    write(out,'compiled-identities.json',{'artifacts':artifacts,'sourceClosureSHA256':closure})
    staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    execute([sys.executable,'-m','slither',SCOPE[0],'--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',out/'static-raw.json'],ROOT,staticenv,out,'static',True)
    raw=json.loads((out/'static-raw.json').read_text(encoding='utf-8'));review=json.loads((ROOT/'scripts/bet/poker-5c2-static-review.json').read_text(encoding='utf-8'))
    if not raw.get('success'):raise RuntimeError('Analyzer did not succeed')
    for f,h in review['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/f).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('Reviewed source drift')
    severe=[f for f in raw['results']['detectors'] if f['impact'] in ['High','Medium']];actual={}
    for f in severe:
        desc=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());h=hashlib.sha256((f['check']+'\n'+desc).encode()).hexdigest()
        if h in actual:raise RuntimeError('Duplicate severe finding')
        actual[h]=f
    if set(actual)!=set(review['dispositions']) or any(actual[h]['impact']!=v['severity'] or actual[h]['check']!=v['check'] for h,v in review['dispositions'].items()):raise RuntimeError('Unreviewed severe static finding')
    write(out,'static-review.json',{'analyzerSucceeded':True,'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0,'independentSecurityApproval':False,'review':review})
    if git('rev-parse','HEAD')!=head or git('status','--porcelain','--',*SCOPE) or any(sha(ROOT/f)!=h for f,h in {**sources,**closure}.items()):raise RuntimeError('Source drift during execution')
    evidence={f.relative_to(out).as_posix():sha(f) for f in out.rglob('*') if f.is_file() and not any(x in f.relative_to(out).parts for x in ['build','cache'])}
    report={'schema':'420-poker-5c2-funded-entry-level1-level2-v1','qualifiedSHA':head,'reconciledMain':BASE,'tree':git('rev-parse','HEAD^{tree}'),'level1Accepted':True,'fundedEntryCustodyLevel2Accepted':True,'testsPassed':{**counts,'inheritedNative':36,'inheritedReference':43,'total':139},'fuzzRuns':fuzz,'retainedRandomizedNominalModelCases':1000,'scope':'Actual initial-entry, sponsorship, fee segregation and refund custody; extra financial rules only','gameplayDependentPurchasesEnabled':False,'genuineTournamentHandsAccepted':False,'prizeExecutionAccepted':False,'officialTestnetAccepted':False,'productionApproved':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    write(out,'qualification.json',report);print(json.dumps({k:report[k] for k in ['qualifiedSHA','level1Accepted','fundedEntryCustodyLevel2Accepted','testsPassed']}),flush=True)
if __name__=='__main__':main()
