"""Authenticate C8 refund receipts against purchases, funding and actual fixed-payee withdrawals."""
import argparse,importlib.util,json,re
from pathlib import Path
from collections import defaultdict
s=importlib.util.spec_from_file_location('refunds',Path(__file__).with_name('replay-poker-5c7-refunds.py'));base=importlib.util.module_from_spec(s);s.loader.exec_module(base);m=base.m

def canonical_refunds(trace,expected_bond_balance):
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
 final=m.packets(trace,'C7FinalFinanceData',12)[0];received=terms[2]+sum(w[7]+w[8]for w in records.values());assert final[1]==6 and final[3:10]==[received,received,0,0,0,0,0] and final[10]==0 and final[11]==expected_bond_balance
 return {'originalPayerRefundsVerified':len(seen),'previouslyRefundedReceipts':len(records)-len(seen),'sponsorReturned':terms[2],'totalActualWithdrawals':received,'finalBankLiability':0,'independentRefundReplay':True}

def collateral(trace):
 # These are the retained funded fixture's original independent provider deposits
 # and immutable compensation destination, not operator-supplied settlement data.
 bank_lines=re.findall(r'emit C8RecoveryBinding\(([^\n]+)',trace);assert bank_lines
 bank=m.event_address(bank_lines[0],'bank')
 addresses={int(x,16)for x in re.findall(r'PokerProviderAccountability420: \[(0x[0-9a-fA-F]{40})\]',trace)};assert len(addresses)==1;bonds=addresses.pop();assert bonds!=bank
 locked={};closed=set();slashed=0
 for name,line in re.findall(r'emit (ProviderBondLocked|ProviderBondClosed)\(([^)\n]+)\)',trace):
  hand=m.event_number(line,'handId')
  if name=='ProviderBondLocked':assert hand not in locked;locked[hand]=m.event_number(line,'perProvider');assert locked[hand]>0
  else:
   assert hand in locked and hand not in closed;closed.add(hand);mask=m.event_number(line,'faultMask');amount=m.event_number(line,'slashed');assert 0<=mask<=3 and amount==locked[hand]*mask.bit_count();slashed+=amount
 assert locked and closed==set(locked)
 transferred=0
 for line in re.findall(r'emit Transfer\(([^)\n]+)\)',trace):
  if m.event_address(line,'from')==bonds:
   assert m.event_address(line,'to')==0xB00D;transferred+=m.event_number(line,'amount')
 assert transferred==slashed and slashed<=200000
 final=m.packets(trace,'C7FinalFinanceData',12)[0];assert final[11]==200000-slashed
 return {'providerBondsSlashed':slashed,'finalProviderBondBalance':final[11],'independentProviderBondConservation':True}

def replay(trace):
 bonds=collateral(trace);result=canonical_refunds(trace,bonds['finalProviderBondBalance']);result.update(bonds);bindings=re.findall(r'emit C8RecoveryBinding\(([^\n]+)',trace);assert bindings
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

def mutate_number(trace,event,field):
 match=re.search(r'emit '+event+r'\(([^)\n]+)\)',trace);assert match
 number=re.search(r'\b'+field+r': (\d+)',match[1]);assert number;at=match.start(1)+number.start(1)
 return trace[:at]+str(int(number[1])^1)+trace[at+len(number[1]):]

def mutate_bond_balance(trace):
 match=re.search(r'emit C7FinalFinanceData\(encoded: (0x[0-9a-fA-F]+)',trace);assert match;raw=bytearray.fromhex(match[1][2:]);raw[11*32+31]^=1
 return trace[:match.start(1)]+'0x'+raw.hex()+trace[match.end(1):]

def tamper(trace):
 replay(trace);bank=base.m.event_address(re.search(r'emit C8RecoveryBinding\(([^\n]+)',trace)[1],'bank')
 cases=[mutate_number(trace,'ProviderBondClosed','faultMask'),mutate_number(trace,'ProviderBondClosed','slashed'),mutate_bond_balance(trace),mutate_receipt(trace),mutate_field(trace,'Purchased','payer'),mutate_field(trace,'Transfer','from',lambda l:m.event_address(l,'to')==bank),mutate_field(trace,'Transfer','to',lambda l:m.event_address(l,'from')==bank)]
 for altered in cases:
  try:replay(altered)
  except (AssertionError,ValueError,KeyError,IndexError):continue
  raise AssertionError('Altered refund evidence accepted')
 return len(cases)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('trace');p.add_argument('--output',required=True);a=p.parse_args();text=Path(a.trace).read_text(encoding='utf-8-sig');r=replay(text);r['alteredRefundEvidenceRejected']=tamper(text);Path(a.output).write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
