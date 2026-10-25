"""Initialize a new private custodian directory; never prints private material."""
import argparse
import json
import os
from pathlib import Path
from Crypto.PublicKey import ECC
from Crypto.Random import get_random_bytes
from eth_account import Account
from web3 import Web3
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);args=p.parse_args()
root=Path(args.directory).resolve();root.mkdir(mode=0o700,parents=True,exist_ok=False)
validator=Account.create();publisher=Account.create();encryption=ECC.generate(curve='Curve25519')
for name,value in [('validator.key',validator.key.hex().encode()),('publisher.key',publisher.key.hex().encode()),('encryption.pem',encryption.export_key(format='PEM').encode()),('storage.key',get_random_bytes(32))]:
    with (root/name).open('xb') as file:file.write(value)
    os.chmod(root/name,0o600)
public=encryption.public_key().export_key(format='raw')
print(json.dumps({'validator':validator.address,'publisher':publisher.address,'encryptionPublicKey':'0x'+public.hex(),'custodianKeyHash':'0x'+Web3.keccak(public).hex().removeprefix('0x')},indent=2))
