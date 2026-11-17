#!/usr/bin/env python3
"""Qualify the operational observer against unmodified frozen contract execution."""
import argparse, hashlib, importlib.util, json, os, pathlib, shutil, subprocess, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--solc',default='0.8.24');a=p.parse_args();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
 spec=importlib.util.spec_from_file_location('scope',ROOT/'scripts/qualify-stake-isolated.py');scope=importlib.util.module_from_spec(spec);spec.loader.exec_module(scope)
 sources=scope.closure([scope.CONTRACTS/'test/StakeAccountingReconciliation420.t.sol'])
 with tempfile.TemporaryDirectory(prefix='stake-accounting-') as tmp:
  dest=pathlib.Path(tmp)
  for source in sources:
   target=dest/source.relative_to(scope.CONTRACTS);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
  shutil.copyfile(scope.CONTRACTS/'foundry.toml',dest/'foundry.toml');(dest/'remappings.txt').write_text('forge-std/=forge-std/\n')
  with (out/'real-evm.log').open('w') as log:subprocess.run(['forge','test','--root',str(dest),'--use',a.solc,'--match-test','testAccountingRealContractsExport','-vv'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,check=True)
  fixture=out/'stake-accounting-real-evm.json';shutil.copyfile(dest/'out/stake-accounting-real-evm.json',fixture)
  env=dict(os.environ,STAKE_ACCOUNTING_EVM_FIXTURE=str(fixture))
  with (out/'reconstruction.log').open('w') as log:subprocess.run(['go','test','-race','-count=1','-v','./consensus/accounting'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,check=True)
 (out/'inputs.json').write_text(json.dumps({'candidate_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'source_sha256':{str(x.relative_to(ROOT)):hashlib.sha256(x.read_bytes()).hexdigest() for x in sources+sorted((ROOT/'consensus/accounting').glob('*.go'))+[pathlib.Path(__file__).resolve()]},'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'scope':'real frozen-contract EVM events and getter observations; local fixture operators, no production signer claim'},indent=2)+'\n')
 print('Stake accounting real-EVM reconstruction PASS:',out)
if __name__=='__main__':main()
