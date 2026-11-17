#!/usr/bin/env python3
"""Slither AST/SlithIR analysis of every production bridge import closure.
Requires slither-analyzer==0.11.3. Static analysis does not execute bytecode;
separate retained and fresh Forge qualifications supply runtime evidence.
"""
import argparse,hashlib,inspect,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 from crytic_compile import CryticCompile
 from crytic_compile.compilation_unit import CompilationUnit
 from crytic_compile.compiler.compiler import CompilerVersion
 from crytic_compile.platform.solc_standard_json import SolcStandardJson,parse_standard_json_output
 from slither.slither import Slither
 from slither.detectors import all_detectors
 from slither.detectors.abstract_detector import AbstractDetector
 p=argparse.ArgumentParser();p.add_argument('--solc',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 pending=list((ROOT/'contracts/src/bridge').rglob('*.sol'));sources={}
 while pending:
  file=pending.pop().resolve();rel=str(file.relative_to(ROOT))
  if rel in sources:continue
  text=file.read_text();sources[rel]={'content':text}
  for dep in re.findall(r'(?:from\s+|import\s+)["\x27]([^"\x27]+)["\x27]',text):
   pending.append((file.parent/dep).resolve())
 standard={'language':'Solidity','sources':sources,'settings':{'optimizer':{'enabled':True,'runs':200},'viaIR':True,'evmVersion':'cancun','outputSelection':{'*':{'*':['abi'],'':['ast']}}}}
 raw=subprocess.run([a.solc,'--standard-json'],input=json.dumps(standard),text=True,capture_output=True,check=True)
 output=json.loads(raw.stdout);errors=[e for e in output.get('errors',[]) if e['severity']=='error'];assert not errors,errors
 # Crytic's standard-json importer requires bytecode keys even for AST-only
 # analysis. Empty markers explicitly mean not requested; no bytecode result
 # or deployment-size claim is produced by this static analysis.
 for contracts in output.get('contracts',{}).values():
  for contract in contracts.values():contract['evm']={'bytecode':{'object':'','sourceMap':''},'deployedBytecode':{'object':'','sourceMap':''}}
 class AstCompilation(SolcStandardJson):
  def compile(self,crytic_compile,**kwargs):
   unit=CompilationUnit(crytic_compile,'bridge-security-ast')
   unit.compiler_version=CompilerVersion(compiler='solc',version='0.8.24',optimized=True,optimize_runs=200)
   parse_standard_json_output(output,unit,solc_working_dir=str(ROOT))
 cc=CryticCompile(AstCompilation(standard));slither=Slither(cc,disallow_partial=True)
 detectors=[c for _,c in inspect.getmembers(all_detectors,inspect.isclass) if issubclass(c,AbstractDetector) and c is not AbstractDetector and c.ARGUMENT!='codex']
 for detector in detectors:slither.register_detector(detector)
 findings=[f for group in slither.run_detectors() for f in group]
 relevant=[f for f in findings if any('/contracts/src/bridge/' in e.get('source_mapping',{}).get('filename_absolute','') for e in f['elements'])]
 report={'tool':'slither-analyzer','version':'0.11.3','mode':'compiler AST and SlithIR; bytecode analysis not claimed','solc':subprocess.check_output([a.solc,'--version'],text=True).strip(),'detectors':len(detectors),'contracts_analyzed':len(slither.contracts),'bridge_sources':len(list((ROOT/'contracts/src/bridge').rglob('*.sol'))),'closure_sources':len(sources),'source_sha256':{p:hashlib.sha256(s['content'].encode()).hexdigest() for p,s in sources.items()},'findings':relevant,'all_closure_findings':len(findings)}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n')
 from collections import Counter
 print(json.dumps({k:report[k] for k in ['detectors','contracts_analyzed','bridge_sources','closure_sources','all_closure_findings']}));print(json.dumps(dict(Counter((f['impact']+':'+f['check']) for f in relevant)),indent=2))
if __name__=='__main__':main()
