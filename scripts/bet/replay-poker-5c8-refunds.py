"""Authenticate C8 refund receipts against purchases, funding and actual fixed-payee withdrawals."""
import argparse,importlib.util,json,re
from pathlib import Path
from collections import defaultdict
s=importlib.util.spec_from_file_location('refunds',Path(__file__).with_name('replay-poker-5c7-refunds.py'));base=importlib.util.module_from_spec(s);s.loader.exec_module(base);m=base.m

def replay(trace):
 result=base.replay(trace);bindings=re.findall(r'emit C8RecoveryBinding\(([^\n]+)',trace);assert bindings
 banks={m.event_address(line,'bank')for line in bindings};assert len(banks)==1;bank=banks.pop();pending=[];purchases={};outgoing=defaultdict(int);start=trace.index('emit C7FundingTermsData(')
 for name,line in re.findall(r'emit (Transfer|Purchased)\(([^)\n]+)\)',trace[start:]):
  if name=='Transfer':
   sender=m.event_address(line,'from');receiver=m.event_address(line,'to');amount=m.event_number(line,'amount')
   if receiver==bank:pending.append((sender,amount))
   if sender==bank:outgoing[receiver]+=amount
  else:
   row=[m.event_number(line,'id'),m.event_number(line,'receipt'),m.event_number(line,'person'),m.event_address(line,'payer'),m.event_number(line,'nonce'),m.event_number(line,'buyIn'),m.event_number(line,'fee'),m.event_number(line,'chips')];assert row[1]not in purchases
   if row[5]+row[6]:assert pending and pending.pop(0)==(row[3],row[5]+row[6]),'actual token funding payer'
   purchases[row[1]]=row
 assert not pending and purchases
 seen=set()
 for w in m.packets(trace,'C6ReceiptData',13):
  assert purchases[w[1]]==[w[0],w[1],w[4],w[5],w[6],w[7],w[8],w[9]],'actual historical receipt payer'
  seen.add(w[1])
 assert seen==set(purchases)
 terms=m.packets(trace,'C7FundingTermsData',7)[0];expected=defaultdict(int)
 if terms[2]:expected[terms[4]]+=terms[2]
 for row in purchases.values():
  if row[5]+row[6]:expected[row[3]]+=row[5]+row[6]
 assert dict(outgoing)==dict(expected),'actual withdrawal payees differ from original funders'
 result.update(actualFundingAndPurchaseEventsVerified=True,actualOriginalPayerWithdrawalsVerified=True,historicalReceiptPayersVerified=len(purchases));return result

def mutate_receipt(trace):
 match=re.search(r'emit C6ReceiptData\(encoded: (0x[0-9a-fA-F]+)',trace);assert match;raw=bytearray.fromhex(match[1][2:]);raw[5*32+31]^=1
 return trace[:match.start(1)]+'0x'+raw.hex()+trace[match.end(1):]

def mutate_field(trace,event,field,predicate=lambda _:True):
 for match in re.finditer(r'emit '+event+r'\(([^)\n]+)\)',trace):
  if not predicate(match[1]):continue
  fieldmatch=re.search(r'\b'+field+r': ([^,\n]+)',match[1]);assert fieldmatch
  address=re.search(r'0x[0-9a-fA-F]{40}\b',fieldmatch[1]);assert address
  at=match.start(1)+fieldmatch.start(1)+address.start();replacement='0x'+format(int(address[0],16)^1,'040x');return trace[:at]+replacement+trace[at+42:]
 raise AssertionError((event,field))

def tamper(trace):
 replay(trace);bank=base.m.event_address(re.search(r'emit C8RecoveryBinding\(([^\n]+)',trace)[1],'bank')
 cases=[mutate_receipt(trace),mutate_field(trace,'Purchased','payer'),mutate_field(trace,'Transfer','from',lambda l:m.event_address(l,'to')==bank),mutate_field(trace,'Transfer','to',lambda l:m.event_address(l,'from')==bank)]
 for altered in cases:
  try:replay(altered)
  except (AssertionError,ValueError,KeyError,IndexError):continue
  raise AssertionError('Altered refund evidence accepted')
 return len(cases)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('trace');p.add_argument('--output',required=True);a=p.parse_args();text=Path(a.trace).read_text(encoding='utf-8-sig');r=replay(text);r['alteredRefundEvidenceRejected']=tamper(text);Path(a.output).write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
