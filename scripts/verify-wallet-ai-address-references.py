#!/usr/bin/env python3
"""Fail closed when user-facing inventory claims an obsolete or unverified Genesis address."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))
def normalized(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith('0x'):
        raise ValueError(f'expected full EVM address, received {value!r}')
    int(value[2:], 16)
    return value.lower()
def check():
    errors=[]
    frozen={x['name']: normalized(x['address']) for x in read('contracts/config/system-addresses.json')['assignments']}
    wallet=read('wallet/deployment-inventory.json')
    candidates={x['contract'].removesuffix('.sol'): normalized(x['candidateAddress']) for x in read('contracts/config/wallet-authority-address-reconciliation.json')['walletAuthorityCandidates']}
    actual=wallet['walletAuthority']
    expected={
        'smartAccountFactory420':candidates['SmartAccountFactory420'],
        'capabilityRegistry420':candidates['CapabilityRegistry420'],
        'protocolRegistry':frozen['ProtocolRegistry'],
        'names420':frozen['Names420'],
        'identity420':frozen['Identity420']
    }
    for key,address in expected.items():
        item=actual.get(key,{})
        if normalized(item.get('address'))!=address:
            errors.append(f'Wallet {key} must resolve to {address}')
    for key in ('smartAccountFactory420','capabilityRegistry420'):
        if 'NOT_DEPLOYED' not in actual[key].get('status',''):
            errors.append(f'{key} must remain not deployed until attested')
    if wallet.get('readyForLiveTestnet') is not False:
        errors.append('unqualified Wallet inventory must not be live')
    ai=read('ai/web/runtime-config.json')
    for name in ('AIProviderRegistry','AIModelRegistry','AIJobManager','AIJobEscrow','AIReputationRegistry','ProtocolRegistry'):
        if normalized(ai['contracts'].get(name))!=frozen[name]:
            errors.append(f'AI browser {name} differs from frozen system assignment')
    if ai.get('features',{}).get('writes') is not False:
        errors.append('unqualified AI browser writes must be disabled')
    hub=read('developer-hub/manifests/local.example.json')
    for name,item in hub['contracts'].items():
        address=normalized(item['address'])
        owner=next((key for key,value in frozen.items() if value==address),None)
        if owner and owner!=name:
            errors.append(f'Developer Hub sample {name}@{address} collides with frozen {owner}')
    return errors
if __name__=='__main__':
    try: failures=check()
    except (KeyError,OSError,ValueError,TypeError) as exc: failures=[f'cannot verify Wallet/AI references: {exc}']
    print(json.dumps({'pass':not failures,'errors':failures},indent=2))
    sys.exit(1 if failures else 0)
