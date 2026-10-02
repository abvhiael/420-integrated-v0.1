#!/usr/bin/env python3
import json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]

def fail(msg): errors.append(msg)
def text(path): return (ROOT/path).read_text(encoding='utf-8')
def load(path): return json.loads(text(path))
def blob(path):
    return subprocess.check_output(['git','hash-object',str(ROOT/path)],cwd=ROOT,text=True).strip()

manifest=load('420-indexer/descriptors/bridge420-v1.json')
if manifest.get('schema')!='420-bridge-artifact-descriptor-v1': fail('Bridge descriptor schema mismatch')
if manifest.get('descriptorVersion')!=1: fail('Bridge descriptor version mismatch')
if manifest.get('protocol')!='420Bridge': fail('Bridge descriptor protocol mismatch')
if manifest.get('authority')!='artifact_events_only_addresses_resolved_by_deployment':
    fail('Bridge descriptor must remain address-unbound until deployment resolution')

expected_contracts={
 'BridgeChainRegistry420','BridgeAssetRegistry','BridgeRouteRegistry','BridgeRiskManager',
 'BridgeTransferRegistry','BridgeAccountingRegistry','GatewayRouter420','VerifiedGateway420','CADCBridgeIntegration'
}
contracts=manifest.get('contracts',[])
names={item.get('contractName') for item in contracts}
if names!=expected_contracts: fail('Bridge descriptor contract inventory mismatch')
events=[]
for item in contracts:
    path=item.get('sourcePath','')
    if not path.startswith('contracts/src/bridge/') or not path.endswith('.sol'): fail('invalid Bridge descriptor source path '+path)
    if item.get('sourceBlobSha')!=blob(path): fail('Bridge descriptor source blob drift '+path)
    source=text(path)
    for event in item.get('events',[]):
        name=event.get('name',''); sig=event.get('signature','')
        if f'event {name}' not in source: fail(f'Bridge descriptor event not present in source: {item.get("contractName")}.{name}')
        if not sig.startswith(name+'('): fail('Bridge descriptor signature/name drift '+sig)
        events.append(name)
if len(events)!=27: fail(f'Bridge descriptor event count mismatch: {len(events)}')
for required in ['TransferCreated','OutboundTransferCreated','TransferStatus','TransferTransition','InboundAccepted','OutboundTransferRegistered','ReconciliationHealth']:
    if required not in events: fail('missing canonical Bridge descriptor event '+required)

lifecycle=text('420-indexer/src/lifecycle-reducer.ts')
for required in ['TransferCreated','TransferStatus','TransferTransition',"'7': 'COMPLETED'","'13': 'REFUNDED'"]:
    if required not in lifecycle: fail('Indexer canonical Bridge lifecycle missing '+required)
for obsolete in ['TransferRequested','BridgeTransferRequested','TransferFinalized','BridgeTransferFinalized','TransferCancelled']:
    if obsolete in lifecycle: fail('obsolete synthetic Bridge lifecycle remains '+obsolete)

decoder=text('420-indexer/src/protocol-decoder.ts')
for required in ['Map<string, ProtocolEventDescriptor420[]>','candidate.contractAddress?.toLowerCase() === address','protocol topic wildcard collision']:
    if required not in decoder: fail('Indexer address-bound topic dispatch missing '+required)

bridge_desc=text('420-indexer/src/bridge-descriptors.ts')
for required in ['BRIDGE_CONTRACTS_420','artifact_events_only_addresses_resolved_by_deployment','bindBridgeDescriptors420','Bridge deployment address invalid']:
    if required not in bridge_desc: fail('Bridge descriptor binding guard missing '+required)

exchange=text('exchange/read-service/src/projection.mjs')
for required in ['BRIDGE_LIFECYCLE','TransferCreated','TransferStatus','TransferTransition','OutboundTransferRegistered','OutboundTransferCreated','bridgeLifecycleState']:
    if required not in exchange: fail('Exchange Bridge projection missing '+required)
if 'TransferFinalized' in exchange: fail('Exchange projection retains obsolete synthetic Bridge event')

notification=text('420-indexer/src/notifications-adapter.ts')
for required in ["Pick<IndexerEventStream420, 'protocolEvents'>",'matchIndexerEventSubscriptions420','authoritative: false']:
    if required not in notification: fail('Notifications Indexer boundary missing '+required)

analytics=text('analytics/metrics/protocol.go')
for required in ['SourceIndexer','ProtocolObjectProjection','LifecycleState','qualified 420Indexer provenance']:
    if required not in analytics: fail('Analytics Indexer protocol boundary missing '+required)

docs_paths=[
 'docs/apps/bridge/index.md','docs/developers/bridge-integration.md','docs/apps/bridge/security.md',
 'docs/apps/bridge/deployment-operations.md','docs/apps/explorer/index.md','docs/apps/notifications/index.md',
 'docs/apps/analytics/index.md','docs/apps/wallet/index.md','docs/troubleshooting/value-movement-economics.md'
]
combined='\n'.join(text(p) for p in docs_paths)
for required in ['TransferCreated','TransferStatus','TransferTransition','COMPLETED','REFUNDED','420Indexer']:
    if required not in combined: fail('Bridge consumer/docs vocabulary missing '+required)
for required in ['derived','non-authoritative','canonical']:
    if required.lower() not in combined.lower(): fail('Bridge consumer authority language missing '+required)

audit=text('docs/audit/420BRIDGE-COMPLETE-AUDIT-20261001.md')
matrix_start=audit.find('## Requirement matrix')
matrix_end=audit.find('## Files',matrix_start)
matrix=audit[matrix_start:matrix_end]
for forbidden in ['| PARTIAL |','| BROKEN |','| MISSING |','| STALE |']:
    if forbidden in matrix: fail('repository-remediable stale audit matrix status remains '+forbidden)
if 'BRIDGE-AUDIT-9' not in matrix or 'BLOCKED' not in matrix:
    fail('live testnet blocker must remain explicit in requirement matrix')

if errors:
    print('BRIDGE_AUDIT_8_INTEGRATION=FAIL')
    for err in errors: print('- '+err)
    sys.exit(1)
print('BRIDGE_AUDIT_8_INTEGRATION=PASS')
print('canonical_contracts=9')
print('canonical_events=27')
print('derived_consumers=wallet,exchange,explorer,notifications,analytics')
