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
def alter_receipt_payer(trace,receipt):
 changed=False
 def change(match):
  nonlocal changed
  raw=bytes.fromhex(match[2][2:]);words=[int.from_bytes(raw[i:i+32],'big')for i in range(0,len(raw),32)]
  if changed or words[1]!=receipt:return match[0]
  words[5]^=1;changed=True;return match[1]+'0x'+m.encoded(words).hex()
 result=re.sub(r'(emit C6ReceiptData\(encoded: )(0x[0-9a-fA-F]+)',change,trace);assert changed;return result

def alter_event_payer(trace,event,field):
 pattern=r'(emit '+event+r'\([^\n)]*?\b'+field+r': [^,\n]*?)(0x[0-9a-fA-F]{40})'
 result,n=re.subn(pattern,lambda x:x[1]+'0x'+format(int(x[2],16)^1,'040x'),trace,count=1);assert n==1;return result

def alter_withdrawal_payee(trace):
 bank=m.packets(trace,'C7FinancialSeedData',12)[0][2];changed=False
 def change(match):
  nonlocal changed
  if changed or m.event_address(match[1],'from')!=bank:return match[0]
  changed=True
  return 'emit Transfer('+re.sub(r'(\bto: [^,]*?)(0x[0-9a-fA-F]{40})',lambda x:x[1]+'0x'+format(int(x[2],16)^1,'040x'),match[1],count=1)+')'
 result=re.sub(r'emit Transfer\(([^)\n]+)\)',change,trace);assert changed;return result

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--traces',required=True);p.add_argument('--output',required=True);a=p.parse_args();folder=Path(a.traces)
 traces={name:(folder/(name+'-trace.stdout.log')).read_text(encoding='utf-8-sig')for name in ['legitimate','rebuy','free','heads']}
 for trace in traces.values():assert m.replay(trace)['independentPrizeReplay']
 cases=[('C7FundingTermsData',0),('C7ExecutedHandData',4),('C6ReceiptData',5),('C7CertifiedStandingsData',3),('C7CertifiedStandingsData',32),('C7PayoutTermsData',6),('C7FinancialSeedData',5),('C7FinancialSeedData',11),('C7FinalFinanceData',4),('C7FinalFinanceData',11)]
 for label,index in cases:
  try:m.replay(alter(traces['legitimate'],label,index))
  except (AssertionError,ValueError,KeyError):continue
  raise RuntimeError('Altered evidence accepted: '+str((label,index)))
 receipts=sorted({row[1]for row in m.packets(traces['legitimate'],'C6ReceiptData',13)})
 for receipt in receipts:
  try:m.replay(alter_receipt_payer(traces['legitimate'],receipt))
  except (AssertionError,ValueError,KeyError):continue
  raise RuntimeError('Altered original receipt payer accepted: '+str(receipt))
 events=[('Purchased','payer'),('Transfer','from')]
 for event,field in events:
  try:m.replay(alter_event_payer(traces['legitimate'],event,field))
  except (AssertionError,ValueError,KeyError):continue
  raise RuntimeError('Altered purchase/token payer accepted: '+event)
 try:m.replay(alter_withdrawal_payee(traces['legitimate']))
 except (AssertionError,ValueError,KeyError):pass
 else:raise RuntimeError('Altered actual withdrawal payee accepted')
 report={'actualFundedTracesReplayed':4,'alteredEvidenceRejected':len(cases)+len(receipts)+len(events)+1,'withdrawalPayeeMutationCases':1,'receiptPayerMutationCases':len(receipts),'eventPayerMutationCases':len(events),'syntheticHandAcceptance':False};Path(a.output).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
