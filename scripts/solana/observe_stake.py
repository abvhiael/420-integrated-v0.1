#!/usr/bin/env python3
"""Reproduce an explicitly UNTRUSTED stake observation. Never install this root."""
import os,zipfile
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[2])
archive=zipfile.ZipFile('contracts/test/fixtures/solana/rpc-observations.zip')
import pathlib,json,base58,sys
sys.path.insert(0,'scripts');import solana_bridge420 as sdk
v=json.loads(archive.read('solana-vote-accounts.json'))['result'];rows=sorted([a for k in ['current','delinquent'] for a in v[k] if a['activatedStake']>0],key=lambda a:-a['activatedStake']);items={};responses=[{'id':0,'result':json.loads(archive.read('solana-vote-authorities.json'))['result']}]+json.loads(archive.read('solana-complete-authorities.json'))
contexts=[]
for resp in responses:
 start=resp['id'];contexts.append(resp['result']['context']['slot'])
 for row,account in zip(rows[start:start+100],resp['result']['value']):
  assert account['owner']=='Vote111111111111111111111111111111111111111' and account['data']['program']=='vote'
  info=account['data']['parsed']['info'];assert info['nodePubkey']==row['nodePubkey']
  authority=max((v for v in info['authorizedVoters'] if v['epoch']<=1086),key=lambda v:v['epoch'])['authorizedVoter'];items[row['votePubkey']]=(base58.b58decode(row['votePubkey']),base58.b58decode(authority),row['activatedStake'])
assert len(items)==len(rows) and all(s//432000==1086 for s in contexts)
records,total,root,branches=sdk.merkle_manifest(1086,list(items.values()));result={'status':'UNAUTHENTICATED_RPC_OBSERVATION_DO_NOT_INSTALL_AS_TRUSTED_STATE','genesis':sdk.GENESIS.hex(),'epoch':1086,'context_slot_range':[min(contexts),max(contexts)],'observed_staked_vote_accounts':len(records),'total_observed_activated_stake':total,'candidate_root':root.hex(),'native_bank_hash':None,'limitations':['RPC observations do not establish native consensus eligibility, replayed epoch-bank authenticity or bridge attestation authorization.','No production validator certificate has been obtained or fabricated.'], 'records':[{'vote_account':a.hex(),'authorized_voter':k.hex(),'observed_stake':s,'index':i,'branch':[b.hex() for b in branches[i]]} for i,(a,k,s) in enumerate(records)]}
pathlib.Path('contracts/test/fixtures/solana/observed-stake-candidate.json').write_text(json.dumps(result,indent=2)+'\n');print('Captured candidate for',len(records),'vote accounts; deliberately UNTRUSTED, not registered')
