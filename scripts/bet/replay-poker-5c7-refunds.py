"""Independently reconcile actual full-refund receipts, payees and final bank conservation."""
import argparse,importlib.util,json,re
from pathlib import Path
spec=importlib.util.spec_from_file_location('replay',Path(__file__).with_name('replay-poker-5c7.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def replay(trace):
 assert '[PASS]'in trace and '[FAIL'not in trace
 terms=m.packets(trace,'C7FundingTermsData',7)[0];records={};before={};started=False
 for name,line in re.findall(r'emit (C6ReceiptData|C7FinancialState)\(([^\n]+)',trace):
  if name=='C7FinancialState':
   if re.search(r'mode: 5[,)]',line):assert not started;started=True;before=dict(records)
   continue
  raw=bytes.fromhex(re.search(r'encoded: (0x[0-9a-fA-F]+)',line)[1][2:]);w=[int.from_bytes(raw[i:i+32],'big')for i in range(0,len(raw),32)];assert len(w)==13
  if w[1]in records:assert all(w[i]==records[w[1]][i]for i in range(13)if i!=3)
  else:assert w[7:10]==[terms[0],terms[3],terms[1]]
  records[w[1]]=w
 assert started and records and all(w[3]==3 for w in records.values())
 expected={index:w for index,w in before.items()if w[3]!=3};seen=set();sponsor=0
 pattern=r'emit C7FinancialCredit\(eventId: (0x[0-9a-fA-F]+), kind: (\d+), person: (0x[0-9a-fA-F]+), receipt: (\d+), payee: .*?\[(0x[0-9a-fA-F]{40})\], prize: (\d+), fee: (\d+)\)'
 for row in re.findall(pattern,trace):
  event,kind,person,index,payee,prize,fee=[int(v,16)if v.startswith('0x')else int(v)for v in row]
  if kind==3:assert sponsor==0 and payee==terms[4] and prize==terms[2] and fee==0;sponsor+=1
  else:
   assert kind==2 and index not in seen and index in expected;w=expected[index];assert [event,person,payee,prize,fee]==[w[0],w[4],w[5],w[7],w[8]];seen.add(index)
 assert sponsor==1 and seen==set(expected)
 final=m.packets(trace,'C7FinalFinanceData',12)[0];received=terms[2]+sum(w[7]+w[8]for w in records.values());assert final[1]==6 and final[3:10]==[received,received,0,0,0,0,0] and final[10]==0 and final[11]==200000
 return {'originalPayerRefundsVerified':len(seen),'previouslyRefundedReceipts':len(records)-len(seen),'sponsorReturned':terms[2],'totalActualWithdrawals':received,'finalBankLiability':0,'independentRefundReplay':True}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('trace');p.add_argument('--output',required=True);a=p.parse_args();r=replay(Path(a.trace).read_text(encoding='utf-8-sig'));Path(a.output).write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
