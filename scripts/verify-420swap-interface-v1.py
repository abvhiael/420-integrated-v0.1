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
    'CanonicalConstantProductPool420.t.sol','SwapGenesisIntegration420.t.sol','SwapFuzz420.t.sol',
    'SwapInvariant420.t.sol','PaySwapGenesisIntegration420.t.sol','PaySwapBridgeGenesisIntegration420.t.sol'
]:
    if not (root/'contracts/test'/tf).exists():e.append('missing test '+tf)
mapj=json.loads((root/'contracts/config/genesis-dapp-contract-map.json').read_text())
swap=next((x for x in mapj['apps'] if x['dapp']=='420 Swap'),None)
if swap is None:e.append('420 Swap absent from dapp map')
else:
    for f in ['CanonicalSwapExecutor420.sol','CanonicalConstantProductPool420.sol']:
        if f not in swap['contracts']:e.append(f+' absent from dapp map')
out={
    'pass':not e,
    'errors':e,
    'shared_interface_v1':True,
    'production_pool_execution':'PRODUCTION_CANDIDATE_PRESENT' if not e else 'QUALIFICATION_FAILED'
}
(root/'contracts/config/swap/interface-v1-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2));sys.exit(0 if not e else 2)
