#!/usr/bin/env python3
"""W14.1/W14.6 Wallet inventory checks after Step 6.2 frozen-owner reconciliation."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []

def load(name):
    try:
        return json.loads((ROOT / name).read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        errors.append(f'{name}: {exc}')
        return {}

inventory = load('wallet/deployment-inventory.json')
canonical = load('contracts/config/genesis-canonical-addresses.json')
system = load('contracts/config/system-addresses.json')
bridge = load('config/swap-bridge-extension-addresses.json')
wallet = load('contracts/config/420wallet-genesis.json')
if inventory.get('schema') != '420-wallet-deployment-inventory-v1' or inventory.get('phase') not in ('W14.1', 'W14.6'):
    errors.append('invalid Wallet inventory schema/phase')
if inventory.get('readyForLiveTestnet') is not False:
    errors.append('Wallet live testnet must remain disabled')
source = inventory.get('sourceOfTruth', {})
if source.get('conflictPolicy') != 'FAIL_CLOSED' or source.get('canonicalAddressRegistry') != 'contracts/config/genesis-canonical-addresses.json':
    errors.append('Wallet authority source/policy drift')
if source.get('networkManifest') != 'developer-hub/manifests/testnet.json':
    errors.append('Wallet testnet manifest source drift')
network = inventory.get('network', {})
if network.get('environment') != 'testnet' or network.get('expectedChainId') != '420' or network.get('status') != 'BLOCKED_OFFICIAL_TESTNET_MANIFEST':
    errors.append('Wallet network must remain blocked on official testnet manifest')
for key in ('rpcHttp','rpcWebSocket','explorerUrl','faucetUrl','ecosystemManifestUrl'):
    if network.get(key) is not None:
        errors.append(f'Wallet unqualified network hint: {key}')
if (ROOT / 'developer-hub/manifests/testnet.json').exists():
    errors.append('Official testnet manifest exists; requalify blocked Wallet inventory')

anchors = {item['contract'].removesuffix('.sol'):item['address'].lower() for item in canonical.get('anchors', [])}
resolved = {item['contract'].removesuffix('.sol'):item for item in canonical.get('registry_resolved', [])}
frozen = {item['name']:item['address'].lower() for item in system.get('assignments', [])}
authority = inventory.get('walletAuthority', {})
for key, name in (('protocolRegistry','ProtocolRegistry'),('names420','Names420'),('identity420','Identity420')):
    entry = authority.get(key, {})
    actual = entry.get('address')
    if not isinstance(actual, str) or actual.lower() != frozen.get(name) or anchors.get(name) != frozen.get(name):
        errors.append(f'Wallet {key} does not reference fixed Step 6.2 owner {name}')
    if entry.get('deploymentVerified') is not False or entry.get('status') != 'FROZEN_SYSTEM_NOT_CHAIN_VERIFIED':
        errors.append(f'Wallet {key} falsely advertises deployment')
for key, name in (('smartAccountFactory420','SmartAccountFactory420'),('capabilityRegistry420','CapabilityRegistry420')):
    entry = authority.get(key, {})
    if name not in resolved or name in anchors or entry.get('address') is not None:
        errors.append(f'Wallet {key} must remain registry-resolved without a live address')
    if entry.get('deploymentVerified') is not False or entry.get('status') != 'CANDIDATE_NOT_DEPLOYED_NOT_GENESIS_APPROVED':
        errors.append(f'Wallet {key} candidate falsely promoted')
    candidate = entry.get('candidateAddress')
    if candidate not in ('0x0000000000000000000000000000000000000446','0x0000000000000000000000000000000000000447'):
        errors.append(f'Wallet {key} candidate was silently reassigned')
    elif candidate.lower() in {x['address'].lower() for x in system.get('assignments', []) + bridge.get('assignments', [])}:
        errors.append(f'Wallet {key} candidate collides with system/bridge claim')
entry = authority.get('entryPoint420', {})
reserved = {i['id']:i for i in canonical.get('reserved', [])}
if entry.get('address') != reserved.get('entry-point', {}).get('address') or entry.get('status') != 'RESERVED_PENDING_PRODUCTION_IMPLEMENTATION':
    errors.append('EntryPoint pending reservation drift')
if '0x0000000000000000000000000000000000000445' not in {x['address'] for x in canonical.get('reserved', []) if x.get('status') == 'RETIRED_NOT_DEPLOYABLE'}:
    errors.append('duplicate Names 0x0445 proposal must remain explicitly retired')
for key in ('officialTestnetManifestPublished','canonicalAddressConflictResolved','entryPointProductionBytecodeBound','rpcChainIdentityQualified','canonicalWalletContractsHaveCode','faucetAndExplorerPublished','walletRuntimeConfigGenerated','registryPublicationGovernanceVerified'):
    if inventory.get('releaseGates', {}).get(key) is not False:
        errors.append(f'Wallet release gate unexpectedly true/missing: {key}')
if wallet.get('deploymentInventory') != 'wallet/deployment-inventory.json':
    errors.append('Wallet genesis profile inventory reference drift')
print(json.dumps({'pass':not errors,'phase':inventory.get('phase'),'readyForLiveTestnet':False,'errors':errors}, indent=2))
sys.exit(bool(errors))
