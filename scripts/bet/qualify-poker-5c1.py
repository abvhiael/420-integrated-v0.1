"""Actual scoped Level 1 for the approved noncustodial 5C.1 policy boundary."""
import argparse,hashlib,json,os,re,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE='08b38c077149b60e850f9daea4ea51652d293a52'
SCOPE=['contracts/src/bet/tournament','contracts/test/tournament-5c1','clients/420bet-poker/tournament','scripts/bet/qualify-poker-5c1.py','scripts/bet/poker-5c1-static-review.json','docs/bet/BET-AUDIT-5C.1-TOURNAMENT-DECISIONS.md','docs/bet/BET-AUDIT-5C.1-TOURNAMENT-POLICY.md','docs/420BET-TESTNET-WORK-ROADMAP.md','.github/workflows/420bet-poker-5c1-level1.yml']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def execute(cmd,cwd,env,out,name):
    print('Executing '+name,flush=True);r=subprocess.run(list(map(str,cmd)),cwd=cwd,env=env,capture_output=True)
    (out/(name+'.stdout.log')).write_bytes(r.stdout);(out/(name+'.stderr.log')).write_bytes(r.stderr)
    if r.returncode:raise RuntimeError('actual execution failed: '+name)
    return r

def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if any(out.iterdir()):raise RuntimeError('fresh output directory required; never reuse stale analysis')
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('scope must be tracked and clean')
    sha=git('rev-parse','HEAD');paths=git('ls-files','--',*SCOPE).splitlines();sources={p:digest(ROOT/p) for p in paths}
    subprocess.check_call(['git','merge-base','--is-ancestor',BASE,sha],cwd=ROOT)
    changed=git('diff','--name-only',BASE,sha).splitlines()
    allowed=lambda p:any(p==s or p.startswith(s+'/') for s in SCOPE)
    if any(not allowed(p) for p in changed):raise RuntimeError('unrelated changes beyond reconciled main')
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_SRC='src/bet/tournament',FOUNDRY_TEST='test/tournament-5c1',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'build'),FOUNDRY_CACHE_PATH=str(out/'cache'),FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1',PYTHONHASHSEED='0')
    r=execute([a.forge,'test','--no-dynamic-test-linking','--match-contract','PokerTournamentPolicy420Test','--use',a.solc,'--json'],ROOT/'contracts',env,out,'native');suites=json.loads(r.stdout.decode('utf-8-sig'));tests=[(n,t) for s in suites.values() for n,t in s['test_results'].items()]
    names=set(re.findall(r'function\s+(test\w+)\s*\(', (ROOT/'contracts/test/tournament-5c1/PokerTournamentPolicy420.t.sol').read_text(encoding='utf-8')))
    if len(tests)!=36 or {n.split('(')[0] for n,t in tests}!=names or any(t['status']!='Success' for n,t in tests):raise RuntimeError('incomplete actual native inventory')
    fuzz={n:t['kind']['Fuzz']['runs'] for n,t in tests if 'Fuzz' in t['kind']}
    if len(fuzz)!=2 or any(n<2500 for n in fuzz.values()):raise RuntimeError('incomplete fuzz execution')
    r=execute([sys.executable,'clients/420bet-poker/tournament/check_lifecycle.py'],ROOT,env,out,'reference');log=r.stderr.decode('utf-8').replace('\r\n','\n')
    if not re.search(r'Ran 43 tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('incomplete lifecycle reference execution')
    execute([a.forge,'test','--no-dynamic-test-linking','--match-test','testLegitimateImmutablePublicationWithCanonicalAuthority','--use',a.solc,'-vvvv'],ROOT/'contracts',env,out,'legitimate-trace')
    trace=(out/'legitimate-trace.stdout.log').read_text(encoding='utf-8-sig');line=next((s for s in trace.splitlines() if 'emit PolicyIdentity(' in s),'');addresses=re.findall(r'0x[0-9a-fA-F]{40}\b',line);hashes=re.findall(r'0x[0-9a-fA-F]{64}\b',line)
    if len(addresses)!=4 or len(hashes)!=3:raise RuntimeError('missing executed runtime/policy identity')
    identities={'registry':addresses[0],'runtimeKeccak256':hashes[0],'policyDigest':hashes[1],'ruleset':hashes[2],'asset':addresses[1],'authorization':addresses[2],'operators':addresses[3]}
    (out/'executed-identities.json').write_text(json.dumps(identities,indent=2)+'\n',encoding='utf-8')
    from Crypto.Hash import keccak
    def k256(value):
        h=keccak.new(digest_bits=256);h.update(value);return h.digest()
    artifacts={};closure={}
    for p in (out/'build').glob('*/*.json'):
        d=json.loads(p.read_text(encoding='utf-8'));code=d.get('deployedBytecode',{}).get('object','').removeprefix('0x')
        if not code or p.stem.endswith('Test'):continue
        size=len(bytes.fromhex(code));creation=len(bytes.fromhex(d['bytecode']['object'].removeprefix('0x')))
        if size>24576 or creation>49152 or not d['metadata']['compiler']['version'].startswith('0.8.30+'):raise RuntimeError('compiler/size mismatch '+p.stem)
        for rel,v in d['metadata']['sources'].items():
            file=ROOT/'contracts'/rel
            if k256(file.read_bytes().replace(b'\r\n',b'\n')).hex()!=v['keccak256'].removeprefix('0x'):raise RuntimeError('compiled source mismatch '+rel)
            closure['contracts/'+rel]=digest(file)
        if p.stem=='PokerTournamentPolicyRegistry420':
            allowed={'RULESET','CREATE','APPROVE','PUBLISH','RETIRE','authorization','operators','asset','scope','digest','register','approve','publish','retire','get','usableForNewEvent','quote','defaultGracePolicy','acceptsFunds'}
            if {v['name'] for v in d['abi'] if v['type']=='function'}!=allowed or any(v.get('stateMutability')=='payable' for v in d['abi']):raise RuntimeError('scope expanded into unqualified custody/gameplay')
        artifacts[p.relative_to(out).as_posix()]={'sha256':digest(p),'runtimeBytes':size,'creationBytes':creation}
    (out/'compiled-identities.json').write_text(json.dumps({'artifacts':artifacts,'sourceClosureSHA256':closure},indent=2)+'\n',encoding='utf-8')
    staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    cmd=[sys.executable,'-m','slither','contracts/src/bet/tournament/PokerTournamentPolicyRegistry420.sol','--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',str(out/'static-raw.json')]
    print('Executing scoped static analysis',flush=True);r=subprocess.run(cmd,cwd=ROOT,env=staticenv,capture_output=True);(out/'static.stdout.log').write_bytes(r.stdout);(out/'static.stderr.log').write_bytes(r.stderr)
    raw=json.loads((out/'static-raw.json').read_text(encoding='utf-8'));review=json.loads((ROOT/'scripts/bet/poker-5c1-static-review.json').read_text(encoding='utf-8'))
    if not raw.get('success'):raise RuntimeError('analyzer failed')
    for p,h in review['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/p).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('source drift since review '+p)
    severe=[f for f in raw['results']['detectors'] if f['impact'] in ['High','Medium']];actual={}
    for f in severe:
        description=' '.join(re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/')).split());h=hashlib.sha256((f['check']+'\n'+description).encode()).hexdigest()
        if h in actual:raise RuntimeError('duplicate severe finding')
        actual[h]=f
    if set(actual)!=set(review['dispositions']) or any(actual[h]['impact']!=v['severity'] or actual[h]['check']!=v['check'] for h,v in review['dispositions'].items()):raise RuntimeError('unreviewed severe finding')
    (out/'static-review.json').write_text(json.dumps({'analyzerSucceeded':True,'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0,'review':review},indent=2)+'\n',encoding='utf-8')
    if git('rev-parse','HEAD')!=sha or git('status','--porcelain','--',*SCOPE) or any(digest(ROOT/p)!=h for p,h in {**sources,**closure}.items()):raise RuntimeError('source drift')
    evidence={p.relative_to(out).as_posix():digest(p) for p in out.rglob('*') if p.is_file() and not any(x in p.relative_to(out).parts for x in ['build','cache'])}
    report={'schema':'420-poker-5c1-policy-level1-v1','level':1,'qualifiedSHA':sha,'reconciledMain':BASE,'tree':git('rev-parse','HEAD^{tree}'),'scope':'Approved policy registry and executable reference registration/lifecycle rules; no custody or gameplay authority','approvedDecisions':25,'testsPassed':{'native':36,'reference':43},'fuzzRuns':fuzz,'randomizedNominalConservationCases':1000,'policyLevel1Accepted':True,'fundedTournamentAccepted':False,'hostObservationsAuthenticatedByReferenceModel':False,'genuineTournamentHandIntegrationAccepted':False,'tableBalancingAccepted':False,'prizeExecutionAccepted':False,'officialNetworkAccepted':False,'productionApproved':False,'cashAndProofSourcesChanged':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    (out/'qualification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:report[k] for k in ['qualifiedSHA','testsPassed','policyLevel1Accepted','fundedTournamentAccepted']}),flush=True)
if __name__=='__main__':main()
