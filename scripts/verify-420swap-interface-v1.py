#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]; e=[]
required=[
'CanonicalMarketRegistry.sol','GenesisDEXFactory.sol','PermissionlessDEXFactory.sol','TWAPOracle.sol',
'PublicBatchAuction.sol','ApprovedQuoteAssetRegistry.sol','CanonicalSwapExecutor420.sol','SwapIds420.sol',
'CanonicalConstantProductPool420.sol'
]
for f in required:
    if not (root/'contracts/src/swap'/f).exists(): e.append('missing '+f)
legacy=root/'contracts/src/swap/CanonicalPool420.sol'
if legacy.exists(): e.append('obsolete CanonicalPool420.sol scaffold still present')
for f in required:
    if f in ('SwapIds420.sol','CanonicalConstantProductPool420.sol'): continue
    text=(root/'contracts/src/swap'/f).read_text()
    if 'GenesisResidentAccess420' not in text: e.append(f+' not genesis-resident')

factory=(root/'contracts/src/swap/GenesisDEXFactory.sol').read_text()
for t in ['REGISTRATION_ONLY','registration-only','registerPool','poolImplementation','_requireGenesisGovernance','_requireOperational']:
    if t not in factory:e.append('genesis factory missing '+t)
if 'new CanonicalConstantProductPool420' in factory or 'function createPool' in factory or 'create2(' in factory.lower():
    e.append('genesis factory unexpectedly contains pool deployment semantics')

permissionless=(root/'contracts/src/swap/PermissionlessDEXFactory.sol').read_text()
for t in [
    'REGISTRATION_ONLY','registerExistingPool','poolIdByAddress','poolImplementationCodeHash',
    'PermissionlessPoolRegistered','pool.codehash','pair mismatch','pair introspection',
    'IPermissionlessPoolIntrospection420.token0.selector','IPermissionlessPoolIntrospection420.token1.selector',
    '_requireOperational'
]:
    if t not in permissionless:e.append('permissionless factory missing '+t)
if 'function createPool' in permissionless or 'create2(' in permissionless.lower():
    e.append('permissionless factory unexpectedly contains pool deployment semantics')

exe=(root/'contracts/src/swap/CanonicalSwapExecutor420.sol').read_text()
for t in ['_canonicalSettlementAsset','_requireHealthyMarket','trustedCaller','CANONICAL_MARKET_REGISTRY','input overspend','under settlement','ACTION_EXECUTE_SWAP']:
    if t not in exe:e.append('executor missing '+t)
market=(root/'contracts/src/swap/CanonicalMarketRegistry.sol').read_text()
for t in ['pool.code.length','_requireOperational','CANONICAL_CAD']:
    if t not in market:e.append('market registry missing '+t)
pool=(root/'contracts/src/swap/CanonicalConstantProductPool420.sol').read_text()
for t in ['nonReentrant','quoteCanonicalSwap','executeCanonicalSwap','MINIMUM_LIQUIDITY','UnsupportedTokenBehavior','UnauthorizedExecutor','inputAmount','exactSettlementAmount']:
    if t not in pool:e.append('production pool missing '+t)

for tf in [
    'CanonicalConstantProductPool420.t.sol','SwapGenesisDEXFactory420.t.sol','SwapPermissionlessDEXFactory420.t.sol',
    'SwapGenesisIntegration420.t.sol','SwapFuzz420.t.sol','SwapInvariant420.t.sol',
    'PaySwapGenesisIntegration420.t.sol','PaySwapBridgeGenesisIntegration420.t.sol'
]:
    if not (root/'contracts/test'/tf).exists():e.append('missing test '+tf)

tiers=json.loads((root/'contracts/config/swap/market-tiers.json').read_text())
perm=tiers.get('tiers',{}).get('PERMISSIONLESS',{})
if perm.get('creation') != 'ANYONE': e.append('permissionless creation policy changed')
if perm.get('registration_model') != 'DEPLOY_EXTERNALLY_THEN_REGISTER_EXISTING_POOL':
    e.append('permissionless registration model not explicit')
if perm.get('protocol_oracle_eligible') is not False or perm.get('wallet_default_eligible') is not False:
    e.append('permissionless noncanonical eligibility boundary changed')

mapj=json.loads((root/'contracts/config/genesis-dapp-contract-map.json').read_text())
swap=next((x for x in mapj['apps'] if x['dapp']=='420 Swap'),None)
if swap is None:e.append('420 Swap absent from dapp map')
else:
    for f in ['CanonicalSwapExecutor420.sol','CanonicalConstantProductPool420.sol','PermissionlessDEXFactory.sol']:
        if f not in swap['contracts']:e.append(f+' absent from dapp map')

out={
    'pass':not e,
    'errors':e,
    'shared_interface_v1':True,
    'genesis_dex_factory_semantics':'REGISTRATION_ONLY' if not e else 'QUALIFICATION_FAILED',
    'permissionless_pool_lifecycle':'DEPLOY_EXTERNALLY_THEN_PERMISSIONLESS_REGISTER' if not e else 'QUALIFICATION_FAILED',
    'production_pool_execution':'PRODUCTION_CANDIDATE_PRESENT' if not e else 'QUALIFICATION_FAILED'
}
(root/'contracts/config/swap/interface-v1-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2));sys.exit(0 if not e else 2)
