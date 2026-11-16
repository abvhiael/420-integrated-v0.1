#!/usr/bin/env python3
"""Read authenticated public issuer publications; never infer a 420 domain.
This does not send an application to Circle or assert private issuer approval.
"""
import argparse
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import urllib.request
from issuer_registry import build_registry,eligibility

URLS={
 'issuer-public-keys.json':'https://iris-api.circle.com/v2/publicKeys',
 'issuer-supported-domains.md':'https://developers.circle.com/cctp/concepts/supported-chains-and-domains.md',
 'issuer-contract-addresses.md':'https://developers.circle.com/cctp/references/contract-addresses.md',
 'issuer-usdc-addresses.md':'https://developers.circle.com/stablecoins/usdc-contract-addresses.md',
 'issuer-solana-programs.md':'https://developers.circle.com/cctp/references/solana-programs.md'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args();root=Path(a.out);root.mkdir(parents=True,exist_ok=True);sources={}
 for name,url in URLS.items():
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'420Bridge-CCTP-Qualification/1.0'}),timeout=30) as response:
   data=response.read(2_000_001)
   if len(data)>2_000_000:raise RuntimeError('oversized issuer response')
  (root/name).write_bytes(data);sources[name]={'url':url,'sha256':hashlib.sha256(data).hexdigest()}
 documents=[(root/name).read_text() for name in ['issuer-supported-domains.md','issuer-contract-addresses.md','issuer-usdc-addresses.md','issuer-solana-programs.md']]
 result={'observed_at':datetime.now(timezone.utc).isoformat(),'sources':sources,'published_deployments':build_registry(*documents),'420chain':eligibility(documents[0],documents[2]),'private_issuer_contact_or_approval':'NOT_ESTABLISHED'}
 (root/'issuer-observation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result['420chain']))
if __name__=='__main__':main()
