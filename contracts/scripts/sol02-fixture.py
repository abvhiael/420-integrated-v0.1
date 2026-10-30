#!/usr/bin/env python3
"""Run the unmodified legacy Decision #10 harness and enforce its canonical fixture contract."""
import hashlib,json,os,subprocess
from pathlib import Path

EXPECTED={
 "schema":"420.creative.kernel.fixture.v1",
 "workId":1,"originalRecordingId":1,"remixRecordingId":2,
 "remixOfferId":1,"remixLicenseId":1,"rightsTransferId":1,
 "scheduleVersion":1,"workRightsVersion":1,
 "originalRightsVersion":2,"remixRightsVersion":1,
 "expectedWorkPoolWei":"30000000000000000000",
 "expectedOriginalPoolWei":"151000000000000000000",
 "expectedRemixPoolWei":"72500000000000000000",
 "expectedTreasuryWei":"6500000000000000000",
 "expectedVaultBalanceWei":"260000000000000000000"
}
def main():
    root=Path.cwd()
    if not (root/'foundry.toml').is_file():
        raise RuntimeError("Run from contracts/")
    output=root.parent/'artifacts/sol02'
    output.mkdir(parents=True,exist_ok=True)
    harness=root/'script/Decision10DeploySeed420.s.sol'
    if not harness.is_file():
        raise RuntimeError("Missing canonical Decision #10 harness")
    fixture=root.parent/'artifacts/contracts/creative-kernel-v1.fixture.json'
    fixture.parent.mkdir(parents=True,exist_ok=True)
    if fixture.exists():fixture.unlink()  # No stale passing evidence.
    env=os.environ.copy()
    for key in ('FOUNDRY_PROFILE','FOUNDRY_SRC','FOUNDRY_TEST','FOUNDRY_SCRIPT',
                'FOUNDRY_OUT','FOUNDRY_CACHE_PATH','FOUNDRY_SOLC_VERSION'):
        env.pop(key,None)  # Precisely match the legacy fixture environment.
    cmd=['forge','script','script/Decision10DeploySeed420.s.sol:Decision10DeploySeed420',
         '--sig','run()','-vvv']
    with (output/'decision10.log').open('w') as log:
        p=subprocess.run(cmd,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
    if p.returncode or not fixture.is_file():
        raise RuntimeError("Canonical Decision #10 harness failed")
    data=json.loads(fixture.read_text())
    for key,value in EXPECTED.items():
        if data.get(key)!=value:
            raise RuntimeError(f"Canonical Decision #10 fixture mismatch: {key}")
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    checked=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
    result={
        'schema':'420.ci.sol02.fixture-equivalence.v1',
        'sha':checked,'passed':True,'harness':'script/Decision10DeploySeed420.s.sol:Decision10DeploySeed420',
        'harnessSHA256':sha(harness),'fixtureSHA256':sha(fixture),
        'legacyContract':EXPECTED,'actual':{k:data[k] for k in EXPECTED},
        'legacyCommand':cmd,'canonicalManifestPath':'artifacts/contracts/creative-kernel-v1.fixture.json'
    }
    (output/'sol02-fixture.json').write_text(json.dumps(result,sort_keys=True,indent=2)+'\n')
if __name__=='__main__':main()
