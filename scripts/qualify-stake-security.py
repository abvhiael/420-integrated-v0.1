#!/usr/bin/env python3
"""Exact-source Stake security preparation; external review and live acceptance stay open."""
import argparse, hashlib, importlib.util, json, os, pathlib, re, shutil, subprocess, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('isolated',ROOT/'scripts/qualify-stake-isolated.py')
isolated=importlib.util.module_from_spec(spec);spec.loader.exec_module(isolated)
OWNERS=['src/system/'+n+'.sol' for n in ['ValidatorRegistry','CommunityValidatorReserve','RewardController','ConsensusSystemCall420']]+['src/apps/Stake420.sol']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def fingerprint(d):
    elements=[]
    for e in d['elements']:
        m=e['source_mapping']; f=m['filename_relative'].split('/src/')[-1]
        elements.append([e['type'],e['name'],f,m['start'],m['length']])
    return hashlib.sha256(json.dumps([d['check'],d['impact'],elements],sort_keys=True).encode()).hexdigest()
def run(cmd,log,cwd=ROOT,allowed=(0,)):
    with log.open('w') as f:r=subprocess.run(cmd,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
    if r.returncode not in allowed:raise RuntimeError(f'{cmd[0]} failed ({r.returncode}); see {log}')
def validate_findings(raw,review):
    assert raw['success'], 'Slither analysis failed'
    observed={fingerprint(d):d for d in raw['results']['detectors']}
    assert len(observed)==len(raw['results']['detectors']), 'duplicate fingerprints'
    expected={d['fingerprint']:d for d in review['findings']}
    assert len(expected)==len(review['findings']), 'duplicate review fingerprints'
    assert observed.keys()==expected.keys(), 'unreviewed or changed static finding set'
    for k,d in observed.items():
        assert expected[k]['check']==d['check'] and expected[k]['reason'].strip() and expected[k]['evidence'].strip()
    return len(observed)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=pathlib.Path,required=True)
    p.add_argument('--verify-retained',action='store_true',help='verify source-bound retained local executions without rerunning unchanged suites')
    p.add_argument('--reuse-solidity',type=pathlib.Path,help='reuse only hash-identical previously executed original owners')
    a=p.parse_args();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
    (out/'result.json').unlink(missing_ok=True)
    review=json.loads((ROOT/'docs/STAKE-AUDIT-10-STATIC-REVIEW.json').read_text())
    safety_owners=[ROOT/'contracts/src/system/StakeSystemSafety420.sol',ROOT/'contracts/src/governance/GovernanceTimelock.sol',ROOT/'contracts/src/apps/ProtocolRegistry.sol']
    safety_deps=isolated.closure(safety_owners)
    assert {str(p.relative_to(ROOT)):sha(p) for p in safety_deps}==review['safety']['source_sha256'], 'safety source review changed'
    deps=isolated.closure([ROOT/'contracts'/x for x in OWNERS])
    for scope_review in [review,review['safety']]:
        for finding in scope_review['findings']:
            for reference in finding['evidence'].split(';'):
                file,_,function=reference.partition(':')
                path=ROOT/file if file.startswith('contracts/') else ROOT/'contracts/test'/file
                assert path.is_file(),reference
                if function:assert 'function '+function+'(' in path.read_text(),reference
    hashes={str(x.relative_to(ROOT)):sha(x) for x in deps}
    assert hashes==review['source_sha256'], 'reviewed source closure changed'
    # Prose correction must preserve every previously qualified shell command.
    doc='docs/STAKE-AUDIT-9.7-VALIDATOR-OPERATOR-RUNBOOK.md'
    text=(ROOT/doc).read_text(); old=subprocess.check_output(['git','show',review['operationalBaseline']+':'+doc],cwd=ROOT,text=True)
    blocks=lambda s:re.findall(r'```(?:bash|sh|shell)\n(.*?)```',s,re.S)
    assert blocks(text)==blocks(old) and blocks(text), 'operator commands require requalification'
    provider=json.loads((ROOT/'deployments/stake-security/safety-provider.json').read_text())
    assert provider['address'] is None and not provider['liveBindingVerified'] and not provider['externalReviewComplete']
    assert sha(ROOT/provider['compiledArtifact'])==provider['artifactSha256']
    assert sha(ROOT/provider['source'])==provider['sourceSha256']
    assert sha(ROOT/provider['storageLayout'])==provider['storageSha256']
    artifact=json.loads((ROOT/provider['compiledArtifact']).read_text())
    assert artifact['metadata']['compiler']['version']=='0.8.24+commit.e11b9ed9'
    assert artifact['metadata']['settings']['optimizer']=={'enabled':True,'runs':200}
    assert artifact['metadata']['settings']['viaIR'] and artifact['metadata']['settings']['evmVersion']=='cancun'
    for name,record in artifact['metadata']['sources'].items():
        actual=subprocess.check_output(['cast','keccak','0x'+(ROOT/'contracts'/name).read_bytes().hex()],text=True).strip()
        assert actual==record['keccak256'],name
    addresses=json.loads((ROOT/'contracts/config/predeploy/stake-genesis-config-v1.json').read_text())['addresses']
    assert provider['constructor']['timelock_']==addresses['governanceTimelock']
    assert provider['registry']==addresses['protocolRegistry']
    assert re.search('CommunityValidatorReserve\\s+`'+addresses['communityValidatorReserve']+'`',text)
    assert re.search('ProtocolReserve is the distinct\\s+`'+addresses['protocolReserve']+'`',text)
    run(['python3','scripts/verify-stake-audit-7-predeploy.py'],out/'predeploy.log')
    if not a.verify_retained:run(['go','vet','-tags','blst','./consensus/...','./execution/systemcall/...','./indexer/...'],out/'go-vet.log')
    if a.verify_retained:a.reuse_solidity=ROOT/'docs/stake-security-evidence'
    if a.reuse_solidity:
        original=review['originalRegression']
        assert original['result']=='PASS' and original['profile']=='default'
        for path,h in original['files'].items():assert sha(ROOT/path)==h,path
        inputs=json.loads((a.reuse_solidity/'inputs.json').read_text())
        expected=sorted([p.name for p in (ROOT/'contracts/test').glob('Stake*.t.sol')]+['ConsensusSystemCall420.t.sol','ValidatorEligibility420.t.sol'])
        assert sorted(inputs['owners'])==expected==sorted(original['owners']), 'original owner coverage changed'
        expected_deps=isolated.closure([ROOT/'contracts/test'/n for n in expected])
        assert set(inputs['source_sha256'])=={str(p.relative_to(ROOT)) for p in expected_deps}, 'incomplete original source binding'
        assert inputs['profile']=='default'
        assert inputs['foundry_config_sha256']==sha(ROOT/'contracts/foundry.toml')
        for path,h in inputs['source_sha256'].items():assert sha(ROOT/path)==h,path
        total=0
        for owner in inputs['owners']:
            log=(a.reuse_solidity/(owner+'.log')).read_text()
            assert re.search(r'[1-9][0-9]* tests? passed, 0 failed',log) and '[FAIL' not in log,owner
            total+=sum(map(int,re.findall(r'Ran 1 test suite[^\n]*?: (\d+) tests? passed',log)))
        assert total==original['passed']==59, 'original execution count changed'
        shutil.copytree(a.reuse_solidity,out/'solidity',dirs_exist_ok=True)
    else:run(['python3','scripts/qualify-stake-isolated.py','--audit','8','--log-dir',str(out/'solidity')],out/'solidity.log')
    with tempfile.TemporaryDirectory(prefix='stake-security-') as folder:
        scope=pathlib.Path(folder)
        extra=ROOT/'contracts/test/SecurityStakeFinal420.t.sol'
        safety_test=ROOT/'contracts/test/SecurityStakeSafety420.t.sol'
        for source in isolated.closure([extra,safety_test]+[ROOT/'contracts'/x for x in OWNERS]):
            target=scope/source.relative_to(ROOT/'contracts');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        shutil.copyfile(ROOT/'contracts/foundry.toml',scope/'foundry.toml')
        if a.verify_retained:
            retained=json.loads((ROOT/'docs/stake-security-evidence/focused-inputs.json').read_text())
            assert retained['source_sha256']=={str(p.relative_to(ROOT)):sha(p) for p in isolated.closure([extra,safety_test])}
            gofiles=[ROOT/'go.mod',ROOT/'go.sum']+[p for folder in ['consensus','execution/systemcall','indexer'] for p in (ROOT/folder).rglob('*.go')]
            assert retained['go_source_sha256']=={str(p.relative_to(ROOT)):sha(p) for p in gofiles}, 'Go vet source closure changed'
            assert retained['goVetExitCode']==0
            assert retained['config_sha256']==sha(ROOT/'contracts/foundry.toml')
            for name,h in retained['logs'].items():
                source=ROOT/'docs/stake-security-evidence'/name;assert sha(source)==h;shutil.copyfile(source,out/name)
            assert '3 tests passed, 0 failed' in (out/'authority-tests.log').read_text()
            assert '[PASS] testSecurityOnlyRegisteredRecipientCanWithdraw()' in (out/'authority-extra-tests.log').read_text()
            authority_initial=(ROOT/'docs/stake-security-evidence/authority-initial-test.sol.txt').read_text()
            assert extra.read_text().split('\n    function testSecurityOnlyRegisteredRecipientCanWithdraw',1)[0]==authority_initial.rsplit('\n}',1)[0], 'previous authority cases changed'
            assert '3 tests passed, 0 failed' in (out/'safety-tests.log').read_text()
            assert '[FAIL' not in ''.join((out/n).read_text() for n in ['authority-tests.log','authority-extra-tests.log','safety-tests.log'])
            count=validate_findings(json.loads((out/'slither.json').read_text()),review)
            count+=validate_findings(json.loads((out/'safety-slither.json').read_text()),review['safety'])
        else:
            assert subprocess.check_output(['slither','--version'],text=True).strip()=='0.11.3'
            run(['forge','test','--root',str(scope),'--match-path','test/SecurityStakeFinal420.t.sol','--match-test','^testSecurity','-vv'],out/'authority-tests.log')
            run(['forge','test','--root',str(scope),'--match-path','test/SecurityStakeSafety420.t.sol','--match-test','^testSecurity','-vv'],out/'safety-tests.log')
            for name,count_ in [('authority-tests.log',4),('safety-tests.log',3)]:
                assert str(count_)+' tests passed, 0 failed' in (out/name).read_text() and '[FAIL' not in (out/name).read_text()
            (scope/'Review.sol').write_text('// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\n'+''.join('import "./'+x+'";\n' for x in OWNERS))
            raw=out/'slither.json'
            if raw.exists():raw.unlink()
            run(['slither',str(scope/'Review.sol'),'--compile-force-framework','solc','--solc',os.environ.get('FOUNDRY_SOLC','solc'),'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',str(raw)],out/'slither.log',allowed=(0,255))
            count=validate_findings(json.loads(raw.read_text()),review)
            (scope/'Review.sol').write_text('// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\nimport "./src/system/StakeSystemSafety420.sol";\nimport "./src/governance/GovernanceTimelock.sol";\nimport "./src/apps/ProtocolRegistry.sol";\n')
            raw=out/'safety-slither.json'
            if raw.exists():raw.unlink()
            run(['slither',str(scope/'Review.sol'),'--compile-force-framework','solc','--solc',os.environ.get('FOUNDRY_SOLC','solc'),'--solc-args','--optimize --optimize-runs 200 --via-ir --evm-version cancun','--json',str(raw)],out/'safety-slither.log',allowed=(0,255))
            count+=validate_findings(json.loads(raw.read_text()),review['safety'])
    versions=retained['tools'] if a.verify_retained else {}
    if not a.verify_retained:
        for tool in ['forge','cast','anvil','go','slither']:
            versions[tool]=subprocess.check_output([tool,'version'] if tool=='go' else [tool,'--version'],text=True).strip()
    sourcefiles=set(deps+safety_deps+isolated.closure([ROOT/'contracts/test/SecurityStakeFinal420.t.sol',ROOT/'contracts/test/SecurityStakeSafety420.t.sol']))
    sourcefiles.update(ROOT/x for x in ['contracts/foundry.toml','scripts/qualify-stake-security.py','scripts/qualify-stake-isolated.py','docs/STAKE-AUDIT-10-SECURITY-REVIEW.md','docs/STAKE-AUDIT-10-STATIC-REVIEW.json','contracts/config/security/stake-hardening-v1.json','contracts/config/security/genesis-suite-registry.json','docs/STAKE-AUDIT-9.8-OPERATIONAL-QUALIFICATION.json','docs/STAKE-AUDIT-9.8-OPERATIONAL-CLOSEOUT.md','docs/STAKE-TESTNET-OPERATIONAL-ACCEPTANCE.md'])
    for folder in ['contracts/config/predeploy','contracts/artifacts']:
        sourcefiles.update((ROOT/folder).rglob('*.json'))
    original_inputs=json.loads((out/'solidity/inputs.json').read_text())
    sourcefiles.update(ROOT/p for p in original_inputs['source_sha256'])
    for folder in ['consensus','execution','indexer','internal','integration']:
        sourcefiles.update(p for p in (ROOT/folder).rglob('*') if p.is_file() and p.suffix in {'.go','.in','.py'})
    sourcefiles.update((ROOT/'docs').glob('STAKE-AUDIT-9.*'))
    sourcefiles.update((ROOT/'docs/stake-security-evidence').iterdir())
    sourcefiles.update((ROOT/'deployments/stake-security').iterdir())
    sourcefiles.update(ROOT/x for x in ['scripts/test-stake-security.py','scripts/build-node420-upstream.sh','scripts/verify-stake-audit-7-predeploy.py','scripts/test-stake-audit-7-predeploy.py','scripts/generate-stake-audit-7-predeploy.py','docs/architecture/decisions/STAKE-AUDIT-2-SYSTEM-CALL-DERIVATION.md','go.mod','go.sum'])
    import tarfile
    with tarfile.open(out/'independent-review-package.tar.gz','w:gz') as tar:
        for file in sorted(sourcefiles):tar.add(file,arcname=str(file.relative_to(ROOT)))
    result={'schema':'420-stake-security-preparation-v1','candidate':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'tree':subprocess.check_output(['git','write-tree'],text=True).strip(),'runId':os.getenv('GITHUB_RUN_ID'),'source_sha256':hashes,'tools':versions,'originalRegression':review['originalRegression'],'focusedAuthorityTests':7,'retainedExecutions':a.verify_retained,'reviewPackageSources':{str(p.relative_to(ROOT)):sha(p) for p in sourcefiles},'reviewedStaticFindings':count,'externalReviewComplete':False,'liveAcceptanceComplete':False,'result':'PASS','artifacts':{str(x.relative_to(out)):sha(x) for x in out.rglob('*') if x.is_file() and x.name!='qualification.log'}}
    (out/'result.json').write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
