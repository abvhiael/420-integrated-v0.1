"""Variable-length encrypted draft-format lineups; separate from daily V1 ABI."""
import json
from Crypto.PublicKey import ECC
from Crypto.Protocol.DH import key_agreement, import_x25519_public_key
from Crypto.Protocol.KDF import HKDF
from Crypto.Hash import SHA256
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from .core import canonical, digest, integer

DOMAIN=b'420.FANTASY.FORMAT.LINEUP.V1'


def context(contest,profile,snapshot,user,nonce):
    if any(not isinstance(v,str) or not v for v in (contest,profile,snapshot,user)): raise ValueError('complete submission context required')
    integer(nonce,1)
    return DOMAIN+canonical([contest,profile,snapshot,user,nonce]).encode()


def _payload(lineup,salt):
    if not isinstance(lineup,(list,tuple)) or not 1<=len(lineup)<=32 or len(set(lineup))!=len(lineup) or any(not isinstance(a,str) or not a or len(a)>128 for a in lineup): raise ValueError('bounded unique athlete IDs required')
    if not isinstance(salt,bytes) or len(salt)!=32: raise ValueError('32-byte secret salt required')
    return {'lineup':list(lineup),'salt':salt.hex()}


def encrypt(public_key,lineup,salt,aad):
    payload=_payload(lineup,salt); ephemeral=ECC.generate(curve='Curve25519')
    shared=key_agreement(eph_priv=ephemeral,static_pub=import_x25519_public_key(public_key),kdf=lambda z:HKDF(z,32,SHA256.new(aad).digest(),SHA256,context=DOMAIN))
    nonce=get_random_bytes(12); cipher=AES.new(shared,AES.MODE_GCM,nonce=nonce); cipher.update(aad)
    ciphertext,tag=cipher.encrypt_and_digest(canonical(payload).encode())
    return {'ephemeral':ephemeral.public_key().export_key(format='raw').hex(),'nonce':nonce.hex(),'ciphertext':ciphertext.hex(),'tag':tag.hex(),'commitment':digest({'aad':aad.hex(),'payload':payload})}


def decrypt(private_key,envelope,aad):
    if set(envelope)!={'ephemeral','nonce','ciphertext','tag','commitment'}: raise ValueError('invalid envelope')
    if len(envelope['ciphertext'])>16384: raise ValueError('oversized ciphertext')
    nonce=bytes.fromhex(envelope['nonce']); tag=bytes.fromhex(envelope['tag'])
    if len(nonce)!=12 or len(tag)!=16: raise ValueError('invalid nonce/tag')
    shared=key_agreement(static_priv=private_key,eph_pub=import_x25519_public_key(bytes.fromhex(envelope['ephemeral'])),kdf=lambda z:HKDF(z,32,SHA256.new(aad).digest(),SHA256,context=DOMAIN))
    cipher=AES.new(shared,AES.MODE_GCM,nonce=nonce); cipher.update(aad)
    payload=json.loads(cipher.decrypt_and_verify(bytes.fromhex(envelope['ciphertext']),tag))
    if set(payload)!={'lineup','salt'}: raise ValueError('invalid plaintext shape')
    validated=_payload(payload['lineup'],bytes.fromhex(payload['salt']))
    if digest({'aad':aad.hex(),'payload':validated})!=envelope['commitment']: raise ValueError('commitment mismatch')
    return validated
