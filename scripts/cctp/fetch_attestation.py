#!/usr/bin/env python3
"""Read-only Iris acquisition and issuer-signature preflight. Native onchain
MessageTransmitter policy and replay state remain authoritative at submission.
"""
import argparse
import json
from pathlib import Path
import urllib.parse
import urllib.request
from cctp import parse_message,verify_attestation,raw_hex,uint

def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'420Bridge-CCTP/1.0'}),timeout=30) as r:
  result=r.read(2_000_001)
  if len(result)>2_000_000:raise ValueError('oversized Iris response')
  return json.loads(result)

def main():
 p=argparse.ArgumentParser();p.add_argument('--environment',choices=['mainnet','sandbox'],default='mainnet');p.add_argument('--source-domain',type=int,required=True);query=p.add_mutually_exclusive_group(required=True);query.add_argument('--transaction-hash');query.add_argument('--nonce');p.add_argument('--signature-threshold',type=int,required=True);p.add_argument('--out',required=True);a=p.parse_args();uint(a.source_domain,32)
 host='https://iris-api.circle.com' if a.environment=='mainnet' else 'https://iris-api-sandbox.circle.com'
 args={'transactionHash':a.transaction_hash} if a.transaction_hash else {'nonce':a.nonce}
 response=get(host+'/v2/messages/'+str(a.source_domain)+'?'+urllib.parse.urlencode(args));keys=get(host+'/v2/publicKeys');verified=[]
 for row in response['messages']:
  if row.get('cctpVersion')!=2 or row.get('status')!='complete':continue
  raw=raw_hex(row['message']);parse_message(raw);signers=verify_attestation(raw,raw_hex(row['attestation']),keys,a.signature_threshold);verified.append({'nonce':row['eventNonce'],'authorized_signers':signers})
 out={'environment':a.environment,'issuer_response':response,'issuer_public_keys':keys,'signature_threshold_observed_by_caller':a.signature_threshold,'verified_v2':verified,'onchain_submission_or_mint':False}
 Path(a.out).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'verified_v2_messages':len(verified),'minted':False}))
if __name__=='__main__':main()
