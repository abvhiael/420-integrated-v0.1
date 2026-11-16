#!/usr/bin/env python3
"""Independent stdlib wire/receipt corroboration of the historical message used by V.21.
Signature acceptance is exercised by pinned native Circle bytecode, not this decoder.
"""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify():
 fixture=ROOT/'contracts/test/fixtures/cctp';record=json.loads((fixture/'base-standard.json').read_text())
 raw=bytes.fromhex((fixture/'base-standard.message.hex').read_text().strip());att=bytes.fromhex((fixture/'base-standard.attestation.hex').read_text().strip())
 word=lambda pos,n=32:int.from_bytes(raw[pos:pos+n],'big')
 assert word(0,4)==word(148,4)==1 and word(4,4)==6 and word(8,4)==0
 assert len(att)==130 and raw.hex()==record['issuer_response']['messages'][0]['message'][2:]
 assert att.hex()==record['issuer_response']['messages'][0]['attestation'][2:]
 tx=record['destination_transaction'];assert tx['result']=='success'
 encoded=bytes.fromhex(tx['raw_input'][2:]);assert encoded[:4].hex()=='57ecfd28';args=encoded[4:]
 def dynamic(at):
  offset=int.from_bytes(args[at:at+32],'big');n=int.from_bytes(args[offset:offset+32],'big');return args[offset+32:offset+32+n]
 assert dynamic(0)==raw and dynamic(32)==att
 recipient='0x'+raw[184:216][-20:].hex();amount=word(216);fee=word(312);nonce='0x'+raw[12:44].hex()
 assert recipient=='0x1d88785ddd08d752da653c3359938e7351cd3694' and amount==51757000000 and fee==0
 transfers=[]
 for event in record['destination_logs']['items']:
  assert event['transaction_hash']==tx['hash']
  if event['address']['hash'].lower()=='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' and event['topics'][0]=='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef':
   assert int(event['topics'][1],16)==0 and '0x'+event['topics'][2][-40:]==recipient
   assert int(event['data'],16)==amount-fee;transfers.append(event)
 assert len(transfers)==1
 checks=0
 for line in (fixture/'SHA256SUMS').read_text().splitlines():
  digest,name=line.split(None,1);assert hashlib.sha256((ROOT/name.strip()).read_bytes()).hexdigest()==digest;checks+=1
 return {'historical_destination_transaction':tx['hash'],'historical_source_domain':6,'historical_destination_domain':0,'native_recipient':recipient,'burned_amount':amount,'fee':fee,'delivered_amount':amount-fee,'nonce':nonce,'message_sha256':hashlib.sha256(raw).hexdigest(),'attestation_sha256':hashlib.sha256(att).hexdigest(),'original_fixture_checksums_verified':checks,'independent_checks':'stdlib message offsets, destination call ABI, successful transaction identity and original USDC mint Transfer log','limits':'No source-block SPV claim; source finality/message authorization use Circle issuer attestation. Reconstructed local token/governance state is not native deployed USDC or 420Chain approval.'}
if __name__=='__main__':print(json.dumps(verify(),indent=2))
