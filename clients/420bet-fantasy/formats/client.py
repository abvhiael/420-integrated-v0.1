"""Pinned funded-format client and durable, consent-authorized lineup custody."""
import json
import sqlite3
import threading
from pathlib import Path
from Crypto.Cipher import AES
from Crypto.PublicKey import ECC
from Crypto.Protocol.DH import key_agreement,import_x25519_public_key
from Crypto.Protocol.KDF import HKDF
from Crypto.Hash import SHA256
from Crypto.Random import get_random_bytes
from eth_abi import encode,decode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys import keys
from web3 import Web3
from nhl import k256

DOMAIN=b'420.FANTASY.FUNDED.FORMAT.TRANSPORT.V1'


def contract(w3,build,name,address):
    artifact=json.loads((Path(build)/(name+'.sol')/(name+'.json')).read_text())
    return w3.eth.contract(address=address,abi=artifact['abi'])


def aad(chain,host,pool,manifest,subject,nonce):
    return DOMAIN+encode(['uint256','address','bytes32','bytes32','bytes32','uint64'],[chain,host,pool,manifest,subject,nonce])


def encrypt(public,selection,salt,context):
    if len(salt)!=32 or not 1<=len(selection)<=131072:raise ValueError('bounded selection and secret salt required')
    ephemeral=ECC.generate(curve='Curve25519')
    shared=key_agreement(eph_priv=ephemeral,static_pub=import_x25519_public_key(public),kdf=lambda z:HKDF(z,32,k256(context),SHA256,context=DOMAIN))
    cipher=AES.new(shared,AES.MODE_GCM,nonce=get_random_bytes(12));cipher.update(context)
    ciphertext,tag=cipher.encrypt_and_digest(encode(['bytes','bytes32'],[selection,salt]))
    return ephemeral.public_key().export_key(format='raw')+cipher.nonce+tag+ciphertext


def decrypt(private,envelope,context):
    if not 60<len(envelope)<=131300:raise ValueError('bounded encrypted envelope required')
    shared=key_agreement(static_priv=private,eph_pub=import_x25519_public_key(envelope[:32]),kdf=lambda z:HKDF(z,32,k256(context),SHA256,context=DOMAIN))
    cipher=AES.new(shared,AES.MODE_GCM,nonce=envelope[32:44]);cipher.update(context)
    return decode(['bytes','bytes32'],cipher.decrypt_and_verify(envelope[60:],envelope[44:60]))


class FormatClient:
    def __init__(self,w3,build,host,code_hashes):
        self.w3=w3;self.host=contract(w3,build,'FantasyFormatEscrow420',host)
        self.book=contract(w3,build,'FantasyFormatBook420',self.host.functions.book().call())
        self.slates=contract(w3,build,'FantasySlateBook420',self.book.functions.slates().call())
        self.admission=contract(w3,build,'FantasyAdmission420',self.host.functions.admission().call())
        self.auth=contract(w3,build,'BetAuthorization420',self.slates.functions.authorization().call())
        if not code_hashes:raise ValueError('pinned runtime identities required')
        for address,expected in code_hashes.items():
            if Web3.keccak(w3.eth.get_code(address)).hex().removeprefix('0x')!=expected.removeprefix('0x'):raise ValueError('runtime identity mismatch')
        if host not in code_hashes or self.book.address not in code_hashes:raise ValueError('host and rule book must be pinned')

    def prepare(self,pool,subject,credential,actor,selection,salt,encryption_public):
        config=self.host.functions.configOf(pool).call();p=self.host.functions.poolOf(pool).call();f=self.book.functions.configOf(config[0]).call();s=self.slates.functions.slateOf(f[1]).call()
        index=self.host.functions.entryForSubject(pool,subject).call();nonce=self.host.functions.entryOf(pool,index).call()[4]+1 if index else 1
        key=self.admission.functions.requireUser(subject,credential,actor,pool,0 if index else config[2]).call()
        if self.w3.eth.get_block('latest').timestamp>=(s[8] or s[5]) or not self.book.functions.validate(config[0],selection).call():raise ValueError('lineup/card invalid or locked')
        context=aad(self.w3.eth.chain_id,self.host.address,pool,p[1],subject,nonce)
        envelope=encrypt(encryption_public,selection,salt,context)
        commitment=self.host.functions.commitmentOf(pool,subject,nonce,selection,salt).call()
        unsigned=(commitment,nonce,s[5],envelope,b'')
        digest=self.host.functions.submissionDigest(pool,subject,key,unsigned).call()
        message=f'420Bet funded format custody authorization\nChain: {self.w3.eth.chain_id}\nHost: {self.host.address}\nReceipt: {digest.hex()}\nCredential: {credential.hex()}\nActor: {actor.lower()}'
        return {'pool':pool,'subject':subject,'credential':credential,'actor':actor,'unsigned':unsigned,'message':message}


class FormatCustodian:
    def __init__(self,client,private_directory):
        self.client=client;self.root=Path(private_directory);self.lock=threading.RLock()
        self.key=ECC.import_key((self.root/'encryption.pem').read_bytes());self.signing=keys.PrivateKey(bytes.fromhex((self.root/'validator.key').read_text().strip()))
        self.storage=(self.root/'storage.key').read_bytes()
        if len(self.storage)!=32:raise ValueError('storage key')
        self.db=sqlite3.connect(self.root/'formats.sqlite3',check_same_thread=False);self.db.execute('PRAGMA journal_mode=WAL');self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS receipts (digest BLOB PRIMARY KEY,pool BLOB,subject BLOB,nonce INTEGER,commitment BLOB,sealed BLOB)');self.db.commit()

    def attest(self,request,wallet_signature):
        client=self.client;host=client.host;w3=client.w3;pool=request['pool'];subject=request['subject'];unsigned=request['unsigned'];commitment,nonce,expiry,envelope,_=unsigned
        config=host.functions.configOf(pool).call();p=host.functions.poolOf(pool).call();f=client.book.functions.configOf(config[0]).call();s=client.slates.functions.slateOf(f[1]).call()
        key=client.admission.functions.requireUser(subject,request['credential'],request['actor'],pool,config[2]).call()
        index=host.functions.entryForSubject(pool,subject).call();current_nonce=host.functions.entryOf(pool,index).call()[4] if index else 0
        signer=self.signing.public_key.to_checksum_address()
        scope=client.auth.functions.scopeForContest(f[1]).call()
        if p[0]!=1 or nonce!=current_nonce+1 or w3.eth.get_block('latest').timestamp>=(s[8] or s[5]) or expiry>s[5] or expiry<w3.eth.get_block('latest').timestamp:raise ValueError('custody lock/nonce/expiry')
        if s[4].lower()!=signer.lower() or s[2]!=k256(self.key.public_key().export_key(format='raw')) or not client.auth.functions.isAuthorized(signer,client.slates.functions.VALIDATE_LINEUP().call(),scope,0).call():raise ValueError('custodian authority/key mismatch')
        digest=host.functions.submissionDigest(pool,subject,key,unsigned).call()
        message=f'420Bet funded format custody authorization\nChain: {w3.eth.chain_id}\nHost: {host.address}\nReceipt: {digest.hex()}\nCredential: {request["credential"].hex()}\nActor: {request["actor"].lower()}'
        if request['message']!=message or Account.recover_message(encode_defunct(text=message),signature=wallet_signature).lower()!=request['actor'].lower():raise ValueError('wallet consent mismatch')
        selection,salt=decrypt(self.key,envelope,aad(w3.eth.chain_id,host.address,pool,p[1],subject,nonce))
        if not client.book.functions.validate(config[0],selection).call() or host.functions.commitmentOf(pool,subject,nonce,selection,salt).call()!=commitment:raise ValueError('ciphertext selection/commitment invalid')
        cipher=AES.new(self.storage,AES.MODE_GCM,nonce=get_random_bytes(12));cipher.update(digest)
        encrypted,tag=cipher.encrypt_and_digest(encode(['bytes','bytes32'],[selection,salt]));blob=cipher.nonce+tag+encrypted
        with self.lock:
            count=self.db.execute('SELECT count(*) FROM receipts WHERE pool=? AND subject=? AND nonce=?',(pool,subject,nonce)).fetchone()[0]
            if count>=8 and not self.db.execute('SELECT 1 FROM receipts WHERE digest=?',(digest,)).fetchone():raise ValueError('bounded pending receipts')
            self.db.execute('INSERT OR IGNORE INTO receipts VALUES (?,?,?,?,?,?)',(digest,pool,subject,nonce,commitment,blob));self.db.commit()
        # Recheck acceptance after durable disk I/O; a stale receipt must not be signed.
        if host.functions.poolOf(pool).call()[1]!=p[1] or w3.eth.get_block('latest').timestamp>=(s[8] or s[5]):raise ValueError('chain changed during custody')
        sig=self.signing.sign_msg_hash(digest)
        return unsigned[:4]+(sig.r.to_bytes(32,'big')+sig.s.to_bytes(32,'big')+bytes([sig.v+27]),)

    def due(self):
        records=list(self.db.execute('SELECT digest,pool,subject,nonce,commitment,sealed FROM receipts ORDER BY nonce DESC'));out=[];seen=set()
        for digest,pool,subject,nonce,commitment,sealed in records:
            if (pool,subject) in seen:continue
            p=self.client.host.functions.poolOf(pool).call();config=self.client.host.functions.configOf(pool).call();f=self.client.book.functions.configOf(config[0]).call();s=self.client.slates.functions.slateOf(f[1]).call();now=self.client.w3.eth.get_block('latest').timestamp
            if now<s[5] or p[0]!=1:continue
            index=self.client.host.functions.entryForSubject(pool,subject).call();e=self.client.host.functions.entryOf(pool,index).call()
            if not index or e[4]!=nonce or e[3]!=commitment or e[5]:continue
            if now>s[5]+3600:raise ValueError('publication deadline missed; recover escrow')
            cipher=AES.new(self.storage,AES.MODE_GCM,nonce=sealed[:12]);cipher.update(digest)
            selection,salt=decode(['bytes','bytes32'],cipher.decrypt_and_verify(sealed[28:],sealed[12:28]));out.append(self.client.host.functions.reveal(pool,index,selection,salt));seen.add((pool,subject))
        return out

    def close(self):self.db.close()
