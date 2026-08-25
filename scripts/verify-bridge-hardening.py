#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]; e=[]
required=['BridgeRouteRegistry.sol','BridgeRiskManager.sol','BridgeTransferRegistry.sol','GatewayRouter420.sol','BridgeAccountingRegistry.sol','VerifiedGateway420.sol']
for f in required:
    if not (root/'contracts/src/bridge'/f).exists(): e.append('missing '+f)
L=json.loads((root/'contracts/config/bridge/risk-limits.json').read_text())
if L.get('status')!='FROZEN_GENESIS_LIMITS': e.append('limits not frozen')
a={x['asset']:x for x in L['asset_aggregate_limits']}
if a['BTC']['max_tvl']!=0:e.append('BTC exposure nonzero')
if a['CADC']['max_tvl']!=2000000:e.append('CADC cap')
if a['USDC']['max_tvl']!=2000000:e.append('USDC cap')
r=(root/'contracts/src/bridge/BridgeRiskManager.sol').read_text()
for t in ['trustedRouter','_requireOperational','IRiskLimits420','maxHourlyIn','maxDailyOut','maxTVL']:
    if t not in r:e.append('risk missing '+t)
for forbidden in ['routeInboundPaused','routeOutboundPaused','assetPaused','allPaused']:
    if forbidden in r:e.append('legacy local pause state retained: '+forbidden)
t=(root/'contracts/src/bridge/BridgeTransferRegistry.sol').read_text()
for x in ['SOURCE_FINALIZED','PROOF_PENDING','VERIFIED','COMPLETED','consumedTransferId','IReplayProtection420','trustedRouter']:
    if x not in t:e.append('transfer missing '+x)
g=(root/'contracts/src/bridge/GatewayRouter420.sol').read_text()
for x in ['_resolveRequired(BridgeIds420.RISK_MANAGER)','_resolveRequired(BridgeIds420.TRANSFER_REGISTRY)','_requireRouteDirection','_requireRouteHealthy']:
    if x not in g:e.append('router missing '+x)
for tf in ['BridgeGenesisIntegration420.t.sol','BridgeRiskFuzz420.t.sol','BridgeInvariant420.t.sol']:
    if not (root/'contracts/test'/tf).exists(): e.append('missing test '+tf)
o={'pass':not e,'errors':e,'routes':len(L['route_limits']),'assets':len(a),'shared_pause_authority':True}
(root/'contracts/config/bridge/hardening-verification.json').write_text(json.dumps(o,indent=2)+'\n')
print(json.dumps(o,indent=2));sys.exit(0 if not e else 2)
