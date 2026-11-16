#!/usr/bin/env python3
"""Reconcile catalogue/Bridge profiles and retained source observations without RPC admission."""
import argparse,base64,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'contracts/config/bridge'
def require(ok,message):
    if not ok:raise ValueError(message)
def profiles():
    result=[]
    for p in sorted(CONFIG.glob('*.json')):
        d=json.loads(p.read_text());a=d.get('asset',{})
        if isinstance(a,dict) and ('ethereum_token' in a or 'solana_mint_bytes32' in a) and d.get('integration_type')=='TOKEN_OVER_EXISTING_CANONICAL_CHAIN_ADAPTER':
            chain='ethereum' if 'ethereum_token' in a else 'solana'
            result.append({'config':p.name,'config_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'symbol':a['symbol'],'asset_id':a['asset_id'],'source_network':a['canonical_network'],'source_asset':('0x'+a['ethereum_token'][2:].lower().zfill(64)) if chain=='ethereum' else a['solana_mint_bytes32'],'source_decimals':a['decimals'],'route_id':d['route']['route_id'],'adapter_id':d['route']['adapter_id'],'adapter':d['route']['adapter'],'source_route_chain_id':json.loads((CONFIG/(chain+'-mainnet-v12.5.'+('4' if chain=='ethereum' else '2')+'.json')).read_text())['route_chain_id'],'destination_token':None,'destination_decimals':None,'status':'APPROVED_INACTIVE_PENDING_DEPLOYED_REGISTRY_AND_CHAIN_DEPENDENCIES','precision':'EXACT_BIDIRECTIONAL_NO_DUST_OR_OVERFLOW','underlying_verifier':d['route']['verifier'],'activation_blockers':d['activation_blockers']})
    return result

def fixture(rows):
    s='// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\n// Generated from the authoritative Bridge token JSON profiles; checked by verify-token-routes.py.\nlibrary TokenCatalogueFixture420 {\n function expected(uint256 i) internal pure returns(bytes32 asset,bytes32 route,bytes32 source,uint8 decimals,bytes32 adapter){\n'
    for i,r in enumerate(rows):s+=f'  if(i=={i})return(keccak256("{r["asset_id"]}"),keccak256("{r["route_id"]}"),{r["source_asset"]},{r["source_decimals"]},keccak256("{r["adapter_id"]}"));\n'
    return s+'  revert("catalogue index");\n }\n}\n'

def expected_ledger():
    rows=profiles();require(len(rows)==9,'generic route count')
    catalogue=json.loads((CONFIG/'launch-catalog-v12.5.1.json').read_text())['assets']
    declared={(x['symbol'],x['canonical_network']) for x in catalogue if 'token-qualification-over-' in x['adapter_slice']}
    require(declared=={(x['symbol'],x['source_network']) for x in rows},'catalogue/profile disagreement')
    issuer=[]
    cctp=json.loads((CONFIG/'token-route-dependencies/usdc-cctp-v2-qualified.json').read_text())
    for domain,p in cctp['source_peers'].items():issuer.append({'symbol':'USDC','source_network':p['name'],'source_asset':'0x'+p['usdc'],'source_decimals':6,'issuer_domain':int(domain),'destination_token':None,'destination_asset_id':None,'protocol':'Circle CCTP V2','qualified_sha':'0a677dc9c7eedc2f56c5b35141ae770a2e13e679','pr':1168,'status':'ISSUER_DEPENDENCY_QUALIFIED_UNMERGED_420_AUTHORIZATION_AND_DEPLOYMENT_OPEN','generic_adapter_allowed':False})
    cadc=json.loads((CONFIG/'token-route-dependencies/cadc-layerzero-qualified.json').read_text())
    for p in cadc['known_source_deployments']:issuer.append({'symbol':'CADC','source_network':p['chain'],'source_asset':p['token'],'legacy_source_asset_excluded':p['legacy_token'],'source_decimals':6,'destination_token':None,'destination_asset_id':None,'protocol':'LayerZero V2 issuer OFT','qualified_sha':'6ca38ccba5fbec26dced66ee21d08ddecd5a5b16','pr':1169,'status':'ISSUER_SUPPORT_PAUSED' if p['chain']=='Arbitrum' else 'ISSUER_DEPENDENCY_QUALIFIED_UNMERGED_420_AUTHORIZATION_AND_DEPLOYMENT_OPEN','generic_adapter_allowed':False})
    limits={(x['asset'],x['route'].split('<->')[0]) for x in json.loads((CONFIG/'risk-limits.json').read_text())['route_limits'] if x['asset'] in ['USDC','CADC']}
    require(limits=={(x['symbol'],x['source_network']) for x in issuer},'issuer route risk/profile reconciliation')
    return {'schema':'420-supported-token-route-qualification-v1','base_main_sha':'97413f2eea862d5f2ec3117313cd3beb15a634f4','production_active':False,'registry_authority':'BridgeAssetRegistry plus Registry-resolved canonical asset, route and chain registries; JSON never substitutes for deployed state','generic_routes':rows,'issuer_routes':issuer,'unsupported':'Unknown ERC20/BEP20 contracts, legacy QCAD/CADC, unknown SPL mints, Token-2022, precision dust/overflow, SPL uint64 wire overflow, transfer fees, sender surcharges, changed decimals, rebasing deltas and malformed/failed token returns are rejected. Issuer assets cannot use the generic token path.','reused_verifiers':{'ethereum':{'pr':1157,'sha':'2d766cb0421cdfb3b28a1cd5dc14991b03c16cc3','original_passes':93,'fuzz_inputs':12500,'invariant_calls':8192,'ci_run_ids':[]},'solana':{'pr':1161,'sha':'6de0a1a34cdb33156caeca32d2847f1dfe214995','original_solidity_passes':53,'original_sbf_passes':6,'historical_transactions':1053,'ci_run_ids':[]}},'source_observation_boundary':'Retained historical Ethereum decimals calls and finalized Solana mint-account responses are observations only. Underlying authenticated chain proofs, approved gateway code and actual committed execution remain mandatory.'}

def verify_dependencies():
    manifest=json.loads((ROOT/'docs/audit/token-route-qualification/ethereum-dependency.json').read_text())
    changed=set(manifest['modified_token_integration_files'])
    for name,digest in manifest['sources'].items():
        if name not in changed:require(hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,'qualified consensus dependency drift: '+name)

def verify_observations(rows):
    obs=json.loads((ROOT/'contracts/test/fixtures/token-routes/source-observations.json').read_text());by_config={x['config']:x for x in obs['ethereum']+obs['solana']}
    alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    for r in rows:
        o=by_config[r['config']];require('error' not in o and 'error' not in o['response'],'observation unavailable: '+r['config'])
        if r['source_network']=='ETHEREUM':
            require('0x'+o['request']['params'][0]['to'][2:].lower().zfill(64)==r['source_asset'],'observed contract');require(int(o['response']['result'],16)==r['source_decimals'],'source decimals')
        else:
            key=o['request']['params'][0];value=0
            for ch in key:value=value*58+alphabet.index(ch)
            require('0x'+value.to_bytes(32,'big').hex()==r['source_asset'],'raw mint identity')
            account=o['response']['result']['value'];raw=base64.b64decode(account['data'][0]);require(account['owner']=='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' and len(raw)==82 and raw[44]==r['source_decimals'] and raw[45]==1,'classic initialized SPL mint')
    source=ROOT/'contracts/src/bridge/verifiers/solana/vendor/Sha512.sol';require(hashlib.sha256(source.read_bytes()).hexdigest()=='96a74497a31f38c57bbf989e66575ae72338bbce950cbbf9bc202cb52cd91eb8','exact original Solana vendor')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args();data=expected_ledger();ledger=CONFIG/'supported-token-routes-v1.json';generated=ROOT/'contracts/test/helpers/TokenCatalogueFixture420.sol'
    if args.write:ledger.write_text(json.dumps(data,indent=2)+'\n');generated.write_text(fixture(data['generic_routes']))
    require(json.loads(ledger.read_text())==data,'route ledger drift');require(generated.read_text()==fixture(data['generic_routes']),'independent Solidity catalogue fixture drift');verify_observations(data['generic_routes']);verify_dependencies()
    print(json.dumps({'pass':True,'generic_token_routes':len(data['generic_routes']),'issuer_route_declarations':len(data['issuer_routes']),'paused_issuer_routes':sum(r['status']=='ISSUER_SUPPORT_PAUSED' for r in data['issuer_routes']),'source_decimals_and_mint_observations':9,'active_routes':0,'consensus_suites_rerun':False},indent=2))
if __name__=='__main__':main()
