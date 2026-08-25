#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]; e=[]
required=[
'CanonicalMarketRegistry.sol','GenesisDEXFactory.sol','PermissionlessDEXFactory.sol','TWAPOracle.sol',
'PublicBatchAuction.sol','ApprovedQuoteAssetRegistry.sol','CanonicalSwapExecutor420.sol','SwapIds420.sol'
]
for f in required:
    if not (root/'contracts/src/swap'/f).exists(): e.append('missing '+f)
for f in required:
    if f in ('SwapIds420.sol',): continue
    text=(root/'contracts/src/swap'/f).read_text()
    if 'GenesisResidentAccess420' not in text and f!='CanonicalPool420.sol': e.append(f+' not genesis-resident')
exe=(root/'contracts/src/swap/CanonicalSwapExecutor420.sol').read_text()
for t in ['_canonicalSettlementAsset','_requireHealthyMarket','trustedCaller','CANONICAL_MARKET_REGISTRY','input overspend','under settlement','ACTION_EXECUTE_SWAP']:
    if t not in exe:e.append('executor missing '+t)
market=(root/'contracts/src/swap/CanonicalMarketRegistry.sol').read_text()
for t in ['pool.code.length','_requireOperational','Role.CANONICAL_CAD' if False else 'CANONICAL_CAD']:
    if t not in market:e.append('market registry missing '+t)
for tf in ['SwapGenesisIntegration420.t.sol','SwapFuzz420.t.sol','SwapInvariant420.t.sol','PaySwapGenesisIntegration420.t.sol','PaySwapBridgeGenesisIntegration420.t.sol']:
    if not (root/'contracts/test'/tf).exists():e.append('missing test '+tf)
mapj=json.loads((root/'contracts/config/genesis-dapp-contract-map.json').read_text())
swap=next(x for x in mapj['apps'] if x['dapp']=='420 Swap')
if 'CanonicalSwapExecutor420.sol' not in swap['contracts']:e.append('executor absent from dapp map')
out={'pass':not e,'errors':e,'shared_interface_v1':True,'production_pool_execution':'SCAFFOLD_REMAINS'}
(root/'contracts/config/swap/interface-v1-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2));sys.exit(0 if not e else 2)
