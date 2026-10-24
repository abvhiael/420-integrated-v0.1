import json,pathlib
r=pathlib.Path(__file__).resolve().parents[2]
a=json.loads((r/'config/genesis-applications.json').read_text())
i=json.loads((r/'docs/audit/genesis-contract-documentation-inventory.json').read_text())
m=json.loads((r/'contracts/config/genesis-dapp-contract-map.json').read_text())
assert a['status']=='FROZEN'
assert not any(x['name']=='420Arcade' for x in a['apps'])
assert any(x['name']=='420 Gaming Protocol' for x in a['apps'])
assert i['launch_scope_amendment']['deferred']=='420Arcade'
assert any(x['name']=='420 Gaming Protocol' for x in i['surfaces'])
assert not any(x['dapp']=='420Arcade' for x in m['apps'])
assert any(x['dapp']=='420 Gaming Protocol' for x in m['apps'])
assert any('420Arcade' in x and 'wallet-free' in x for x in a['rules'])
print('PASS: 420Arcade deferred, existing game code not touched; Gaming Protocol remains Genesis')
