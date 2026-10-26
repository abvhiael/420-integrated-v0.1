"""Reject altered card, receipt, standings and financial evidence from actual passing runs."""
import argparse,importlib.util,json,re
from pathlib import Path
spec=importlib.util.spec_from_file_location('replay',Path(__file__).with_name('replay-poker-5c7.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def alter(trace,label,index):
 pattern=r'(emit '+label+r'\(encoded: )(0x[0-9a-fA-F]+)'
 def change(match):
  raw=bytes.fromhex(match[2][2:]);words=[int.from_bytes(raw[i:i+32],'big')for i in range(0,len(raw),32)];words[index]^=1
  return match[1]+'0x'+m.encoded(words).hex()
 changed,n=re.subn(pattern,change,trace,count=1);assert n==1;return changed
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--traces',required=True);p.add_argument('--output',required=True);a=p.parse_args();folder=Path(a.traces)
 traces={name:(folder/(name+'-trace.stdout.log')).read_text(encoding='utf-8-sig')for name in ['legitimate','rebuy','free','heads']}
 for trace in traces.values():assert m.replay(trace)['independentPrizeReplay']
 cases=[('C7FundingTermsData',0),('C7ExecutedHandData',4),('C6ReceiptData',5),('C7CertifiedStandingsData',3),('C7CertifiedStandingsData',32),('C7PayoutTermsData',6),('C7FinancialSeedData',5),('C7FinancialSeedData',11),('C7FinalFinanceData',4),('C7FinalFinanceData',11)]
 for label,index in cases:
  try:m.replay(alter(traces['legitimate'],label,index))
  except (AssertionError,ValueError,KeyError):continue
  raise RuntimeError('Altered evidence accepted: '+str((label,index)))
 report={'actualFundedTracesReplayed':4,'alteredEvidenceRejected':len(cases),'syntheticHandAcceptance':False};Path(a.output).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
