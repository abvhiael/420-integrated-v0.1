"""Scoped, clean-SHA Level 1 and funded local Level 2; never live acceptance."""
import argparse,hashlib,json,os,re,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SCOPE=['clients/420bet-fantasy','contracts/src/bet/fantasy','contracts/test/fantasy-approved','contracts/test/fantasy','contracts/script/fantasy','scripts/fantasy','.github/workflows/420bet-fantasy-approved-level2.yml','docs/bet/BET-FANTASY-APPROVED-RULES-V1.md','docs/bet/BET-FANTASY-APPROVED-IMPLEMENTATION-V1.md','docs/420BET-TESTNET-WORK-ROADMAP.md','docs/bet/BET-FANTASY-HOCKEY-ROADMAP.md','docs/bet/BET-FANTASY-FORMAT-FRAMEWORKS-V1.md']
FORMATS={'salary','captain','peer-two','peer-three','house-two','house-three','same-game-peer','same-game-house','peer-partial-void','house-refund-below-two','house-losing-card','free-launcher-prize','whole-token-salary','whole-token-house','peer-denied','peer-upheld','peer-unresolved','peer-delegated','house-upheld','house-unresolved','house-partially-affected'}
SEASONS={'mode-0','mode-1','mode-2','mode-3','early-start-lineup','early-start-waiver-intent','free-launcher-season','all-weeks-void','weekly-dispute-timeout','withheld-draft-entropy','underfilled-league','official-season-cancellation','full-nhl-inventory'}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def sha256(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(command,env,out,name,cwd=ROOT):
    print('Executing '+name,flush=True)
    r=subprocess.run(list(map(str,command)),cwd=cwd,env=env,capture_output=True)
    (out/(name+'.stdout.log')).write_bytes(r.stdout);(out/(name+'.stderr.log')).write_bytes(r.stderr)
    if r.returncode:raise RuntimeError('actual execution failed: '+name+'; inspect retained raw logs')
    return r

def main():
    p=argparse.ArgumentParser();p.add_argument('--forge',default='forge');p.add_argument('--anvil',default='anvil');p.add_argument('--solc',default='0.8.30');p.add_argument('--analyzer-solc',default='solc');p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);certificate=out/'qualification.json';certificate.unlink(missing_ok=True)
    if git('status','--porcelain','--',*SCOPE):raise RuntimeError('qualification scope must be tracked and clean')
    sha=git('rev-parse','HEAD');paths=git('ls-files','--',*SCOPE).splitlines();sources={x:sha256(ROOT/x) for x in paths}
    env=dict(os.environ,FOUNDRY_PROFILE='pr',FOUNDRY_FUZZ_RUNS='2500',FOUNDRY_VIA_IR='true',NO_COLOR='1',PYTHONUTF8='1')
    for secret in ['SPORTRADAR_API_KEY','SPORTRADAR_API_KEY_FILE']:env.pop(secret,None)
    counts={}
    for name,command,expected in [('approved',[sys.executable,'clients/420bet-fantasy/formats/check_approved.py'],48),('frameworks',[sys.executable,'clients/420bet-fantasy/formats/check_frameworks.py'],56),('inherited-client',[sys.executable,'-m','unittest','discover','-s','clients/420bet-fantasy','-p','test_*.py','-v'],77)]:
        r=run(command,env,out,name);log=r.stderr.decode().replace('\r\n','\n')
        if not re.search(rf'Ran {expected} tests\b',log) or '\nOK\n' not in log or 'skipped=' in log:raise RuntimeError('incomplete unit execution '+name)
        counts[name]=expected
    build=out/'build';cache=out/'cache'
    buildenv=dict(env,FOUNDRY_SRC='script/fantasy',FOUNDRY_SCRIPT='script/fantasy',FOUNDRY_TEST='test/__approved_empty__',FOUNDRY_OUT=str(build),FOUNDRY_CACHE_PATH=str(cache))
    run([a.forge,'test','--no-dynamic-test-linking','--no-match-test','.*','--use',a.solc],buildenv,out,'compile',ROOT/'contracts')
    sys.path.insert(0,str(ROOT/'clients/420bet-fantasy'));from nhl import k256
    artifacts={};closure={}
    for path in build.glob('*/*.json'):
        d=json.loads(path.read_text());runtime=d.get('deployedBytecode',{}).get('object','').removeprefix('0x');creation=d.get('bytecode',{}).get('object','').removeprefix('0x')
        if not runtime:continue
        if len(bytes.fromhex(runtime))>24576 or len(bytes.fromhex(creation))>49152:raise RuntimeError('normal EVM code size exceeded '+path.stem)
        metadata=d['metadata']
        if not metadata['compiler']['version'].startswith('0.8.30+'):raise RuntimeError('unexpected compiler')
        for relative,source in metadata['sources'].items():
            file=ROOT/'contracts'/relative
            if not file.is_file() or k256(file.read_bytes().replace(b'\r\n',b'\n')).hex()!=source['keccak256'].removeprefix('0x'):raise RuntimeError('compiled source identity mismatch '+relative)
            closure['contracts/'+relative]=sha256(file)
        artifacts[path.parent.name+'/'+path.name]={'sha256':sha256(path),'runtimeBytes':len(bytes.fromhex(runtime)),'creationBytes':len(bytes.fromhex(creation)),'compiler':metadata['compiler']['version']}
    if not artifacts:raise RuntimeError('missing actual compiled artifacts')
    (out/'compiled-identities.json').write_text(json.dumps({'artifacts':artifacts,'sourceClosureSHA256':closure,'solcSourceNormalization':'LF, as loaded by Foundry; file SHA256 preserves exact checkout bytes'},indent=2)+'\n')
    staticenv=dict(env)
    if os.name=='nt':staticenv.setdefault('VIRTUAL_ENV',str(out/'analyzer-state'))
    raw=out/'static-raw.json'
    staticcommand=[sys.executable,'-m','slither','contracts/script/fantasy/FantasyApprovedLocalImports420.sol','--compile-force-framework','solc','--solc',a.analyzer_solc,'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',str(raw)]
    print('Executing scoped Slither analysis',flush=True);r=subprocess.run(staticcommand,cwd=ROOT,env=staticenv,capture_output=True)
    (out/'static.stdout.log').write_bytes(r.stdout);(out/'static.stderr.log').write_bytes(r.stderr)
    if not raw.is_file() or not json.loads(raw.read_text(encoding='utf-8')).get('success'):raise RuntimeError('actual scoped analyzer failed')
    run([sys.executable,'scripts/fantasy/review-approved-static.py',raw,out/'static-review.json'],env,out,'static-review')
    nativeenv=dict(env,FOUNDRY_SRC='src/bet/fantasy',FOUNDRY_TEST='test/fantasy-approved',FOUNDRY_SCRIPT='script/__empty__',FOUNDRY_OUT=str(out/'native-build'),FOUNDRY_CACHE_PATH=str(out/'native-cache'))
    r=run([a.forge,'test','--no-dynamic-test-linking','--match-contract','FantasySeasonMath420Test','--use',a.solc,'--json'],nativeenv,out,'native',ROOT/'contracts');suites=json.loads(r.stdout.decode('utf-8-sig'))
    tests=[(name,test) for suite in suites.values() for name,test in suite['test_results'].items()]
    expected=set(re.findall(r'function\s+(test\w+)\s*\(', (ROOT/'contracts/test/fantasy-approved/FantasySeasonMath420.t.sol').read_text()))
    if len(tests)!=9 or {n.split('(')[0] for n,t in tests}!=expected or any(t['status']!='Success' for n,t in tests):raise RuntimeError('incomplete native tests')
    fuzz={n:t['kind']['Fuzz']['runs'] for n,t in tests if 'Fuzz' in t['kind']}
    if len(fuzz)!=2 or any(n<2500 for n in fuzz.values()):raise RuntimeError('incomplete independent matching fuzz')
    counts['native']=len(tests)
    dailyenv=dict(nativeenv,FOUNDRY_TEST='test/fantasy',FOUNDRY_OUT=str(out/'daily-build'),FOUNDRY_CACHE_PATH=str(out/'daily-cache'))
    owners={'FantasyContestEngine420Test':('FantasyContestEngine420.t.sol',73),'FantasySlatePublication420Test':('FantasySlatePublication420.t.sol',6),'FantasyMixedGames420Test':('FantasyMixedGames420.t.sol',1)}
    r=run([a.forge,'test','--no-dynamic-test-linking','--match-contract','('+'|'.join(owners)+')','--use',a.solc,'--json'],dailyenv,out,'daily-native',ROOT/'contracts');daily=json.loads(r.stdout.decode('utf-8-sig'));daily_fuzz={};daily_count=0
    if {x.split(':')[-1] for x in daily}!=set(owners):raise RuntimeError('missing affected daily owner')
    for key,suite in daily.items():
        owner=key.split(':')[-1];file,count=owners[owner];cases=suite['test_results']
        inventory=set(re.findall(r'function\s+(test\w+)\s*\(', (ROOT/'contracts/test/fantasy'/file).read_text(encoding='utf-8')))
        if len(cases)!=count or {x.split('(')[0] for x in cases}!=inventory or any(x['status']!='Success' for x in cases.values()):raise RuntimeError('missing/failed inherited daily tests '+owner)
        daily_count+=len(cases)
        for name,test in cases.items():
            if 'Fuzz' in test['kind']:daily_fuzz[owner+':'+name]=test['kind']['Fuzz']['runs']
    if daily_count!=80 or not daily_fuzz or any(n<2500 for n in daily_fuzz.values()):raise RuntimeError('incomplete daily regression')
    counts['daily-native']=daily_count
    funded={};rejections={}
    for name,required in [('formats',FORMATS),('seasons',SEASONS)]:
        target=out/name
        command=[sys.executable,'scripts/fantasy/diagnose-approved-'+name+'.py','--anvil',a.anvil,'--build',build,'--output',target]
        if name=='seasons':command+=['--all-modes']
        run(command,env,out,'funded-'+name)
        diagnostic=json.loads((target/'diagnostic.json').read_text());execution=json.loads((target/'execution.json').read_text())
        if {x['case'] for x in diagnostic['outcomes']}!=required or len(diagnostic['outcomes'])!=len(required):raise RuntimeError('missing mandatory funded cases '+name)
        if len(diagnostic['expectedRejections'])<100 or not execution['transactions'] or execution['asset']!='canonical Wrapped420' or execution['maximumTransactionGas']>20000000:raise RuntimeError('incomplete funded evidence '+name)
        if any(tx['receipt']['status']!=1 for tx in execution['transactions']):raise RuntimeError('failed funded transaction')
        if any(x['runtimeBytes']>24576 for x in execution['deployments']):raise RuntimeError('deployed code size exceeded')
        funded[name]=len(required);rejections[name]=len(diagnostic['expectedRejections'])
    if sha!=git('rev-parse','HEAD') or git('status','--porcelain','--',*SCOPE) or any(sha256(ROOT/x)!=h for x,h in sources.items()) or any(sha256(ROOT/x)!=h for x,h in closure.items()):raise RuntimeError('source drift during qualification')
    evidence={x.relative_to(out).as_posix():sha256(x) for x in out.rglob('*') if x.is_file() and x!=certificate and not any(t in x.relative_to(out).parts for t in ['build','native-build','daily-build','cache','native-cache','daily-cache'])}
    report={'schema':'420-fantasy-approved-local-level2-v1','qualifiedSHA':sha,'tree':git('rev-parse','HEAD^{tree}'),'level':2,'level1TestsPassed':counts,'fuzzRuns':fuzz,'dailyNativeFuzzRuns':daily_fuzz,'fundedScenariosPassed':funded,'expectedEVMRejections':rejections,'fundedLocalLevel2Accepted':True,'officialNetworkAccepted':False,'liveSportsDataAccepted':False,'independentProviderControlAccepted':False,'productionApproved':False,'sourceSHA256':sources,'compiledSourceClosureSHA256':closure,'evidenceSHA256':evidence,'completedAt':datetime.now(timezone.utc).isoformat()}
    certificate.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:report[k] for k in ['qualifiedSHA','level1TestsPassed','fundedScenariosPassed','expectedEVMRejections','fundedLocalLevel2Accepted']}),flush=True)
if __name__=='__main__':main()
