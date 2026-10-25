"""Confidential season preference/waiver receipts and permissionless release worker."""
import json,sqlite3
from pathlib import Path
from Crypto.PublicKey import ECC
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from eth_abi import encode,decode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys import keys
from nhl import merkle,k256
from .client import contract,encrypt,decrypt,aad


class SeasonClient:
    def __init__(self,w3,build,host,pins):
        self.w3=w3;self.host=contract(w3,build,'FantasySeasonEscrow420',host)
        self.actions=contract(w3,build,'FantasySeasonActions420',self.host.functions.actions().call())
        self.data=contract(w3,build,'FantasySeasonData420',self.host.functions.data().call())
        self.roster=contract(w3,build,'FantasySeasonRoster420',self.host.functions.roster().call())
        self.transactions=contract(w3,build,'FantasySeasonTransactions420',self.host.functions.transactions().call())
        self.admission=contract(w3,build,'FantasyAdmission420',self.host.functions.admission().call())
        self.auth=contract(w3,build,'BetAuthorization420',self.data.functions.authorization().call())
        if any(a not in pins for a in (host,self.actions.address,self.data.address,self.roster.address,self.transactions.address)):raise ValueError('complete season runtime pins required')
        for address,expected in pins.items():
            if w3.keccak(w3.eth.get_code(address)).hex().removeprefix('0x')!=expected.removeprefix('0x'):raise ValueError('season runtime mismatch')

    def preference(self,id,member,ranking,salts):
        if len(ranking)!=len(salts) or not ranking or len(set(ranking))!=len(ranking):raise ValueError('unique salted preference list required')
        domain=self.roster.functions.DOMAIN().call()
        leaves=[k256(k256(encode(['bytes32','uint256','address','bytes32','uint8','uint16','uint32','bytes32'],[domain,self.w3.eth.chain_id,self.roster.address,id,member,i,a,salt]))) for i,(a,salt) in enumerate(zip(ranking,salts))]
        if leaves[0]!=self.roster.functions.preferenceLeaf(id,member,0,ranking[0],salts[0]).call():raise ValueError('preference ABI mismatch')
        root,proofs=merkle(leaves);return root,encode(['uint32[]','bytes32[]'],[ranking,salts]),proofs

    def waiver(self,id,week,member,claims,salt):
        root=k256(encode(['bytes32','uint256','address','bytes32','uint16','uint8','(uint32,uint32)[]','bytes32'],[self.transactions.functions.DOMAIN().call(),self.w3.eth.chain_id,self.transactions.address,id,week,member,claims,salt]))
        return root,encode(['(uint32,uint32)[]','bytes32'],[claims,salt])

    def prepare(self,id,subject,week,root,length,payload,public):
        member=self.host.functions.memberForSubject(id,subject).call();config=self.data.functions.configOf(id).call()
        if member==0:raise ValueError('funded member required')
        m=self.roster.functions.memberOf(id,member).call();nonce=self.actions.functions.privateNonce(id,week,member).call()+1
        deadline=config[4] if week==0 else self.data.functions.periodOf(id,week).call()[3]
        context=aad(self.w3.eth.chain_id,self.actions.address,id,self.host.functions.manifestOf(id).call(),subject,nonce)+encode(['uint16'],[week])
        envelope=encrypt(public,payload,get_random_bytes(32),context);unsigned=(root,length,nonce,deadline,envelope,b'')
        digest=self.actions.functions.privateDigest(id,subject,week,unsigned).call()
        message=f'420Bet season private custody authorization\nChain: {self.w3.eth.chain_id}\nActions: {self.actions.address}\nReceipt: {digest.hex()}\nActor: {m[2].lower()}'
        return {'id':id,'subject':subject,'week':week,'unsigned':unsigned,'message':message}


class SeasonCustodian:
    def __init__(self,client,private_directory):
        self.client=client;root=Path(private_directory);self.encryption=ECC.import_key((root/'encryption.pem').read_bytes());self.signing=keys.PrivateKey(bytes.fromhex((root/'validator.key').read_text().strip()));self.storage=(root/'storage.key').read_bytes()
        self.db=sqlite3.connect(root/'season-private.sqlite3');self.db.execute('PRAGMA synchronous=FULL');self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS records(digest BLOB PRIMARY KEY,id BLOB,subject BLOB,week INTEGER,nonce INTEGER,root BLOB,sealed BLOB)');self.db.commit()

    def attest(self,request,signature):
        c=self.client;id=request['id'];subject=request['subject'];week=request['week'];unsigned=request['unsigned'];root,length,nonce,expiry,envelope,_=unsigned
        if len(envelope)>131072:raise ValueError('bounded private envelope required')
        config=c.data.functions.configOf(id).call();member=c.host.functions.memberForSubject(id,subject).call();m=c.roster.functions.memberOf(id,member).call()
        deadline=config[4] if week==0 else c.data.functions.periodOf(id,week).call()[3];now=c.w3.eth.get_block('latest').timestamp
        if member==0 or nonce!=c.actions.functions.privateNonce(id,week,member).call()+1 or not now<=expiry<=deadline or now>=deadline or c.host.functions.stateOf(id).call() not in (1,2):raise ValueError('private custody timing/identity/nonce')
        c.admission.functions.requireEntryActor(subject,m[2],id).call()
        if c.admission.functions.currentUserKey(subject).call()!=m[1]:raise ValueError('credential changed')
        signer=self.signing.public_key.to_checksum_address();scope=c.auth.functions.scopeForContest(id).call()
        if signer.lower()!=config[9].lower() or k256(self.encryption.public_key().export_key(format='raw'))!=config[10] or not c.auth.functions.isAuthorized(signer,k256(b'BET_FANTASY_VALIDATE_SEASON_PRIVATE.V1'),scope,0).call():raise ValueError('season validator key/authority')
        digest=c.actions.functions.privateDigest(id,subject,week,unsigned).call();message=f'420Bet season private custody authorization\nChain: {c.w3.eth.chain_id}\nActions: {c.actions.address}\nReceipt: {digest.hex()}\nActor: {m[2].lower()}'
        if request['message']!=message or Account.recover_message(encode_defunct(text=message),signature=signature).lower()!=m[2].lower():raise ValueError('private wallet consent')
        context=aad(c.w3.eth.chain_id,c.actions.address,id,c.host.functions.manifestOf(id).call(),subject,nonce)+encode(['uint16'],[week]);payload,_=decrypt(self.encryption,envelope,context)
        if week==0:
            ranking,salts=decode(['uint32[]','bytes32[]'],payload)
            if length!=len(ranking) or length>c.data.functions.athleteCount(id).call() or any(c.data.functions.positions(id,a).call()==0 for a in ranking):raise ValueError('preference inventory')
            computed,_,_=c.preference(id,member,ranking,salts)
        else:
            claims,salt=decode(['(uint32,uint32)[]','bytes32'],payload)
            if length!=len(claims) or length>32 or any(c.data.functions.positions(id,a).call()==0 or c.data.functions.positions(id,d).call()==0 for a,d in claims):raise ValueError('waiver inventory')
            computed,_=c.waiver(id,week,member,claims,salt)
        if computed!=root:raise ValueError('private plaintext commitment mismatch')
        cipher=AES.new(self.storage,AES.MODE_GCM,nonce=get_random_bytes(12));cipher.update(digest);encrypted,tag=cipher.encrypt_and_digest(payload)
        pending=self.db.execute('SELECT count(*) FROM records WHERE id=? AND subject=? AND week=? AND nonce=?',(id,subject,week,nonce)).fetchone()[0]
        if pending>=8 and not self.db.execute('SELECT 1 FROM records WHERE digest=?',(digest,)).fetchone():raise ValueError('bounded private pending receipts')
        self.db.execute('INSERT OR IGNORE INTO records VALUES(?,?,?,?,?,?,?)',(digest,id,subject,week,nonce,root,cipher.nonce+tag+encrypted));self.db.commit()
        if c.w3.eth.get_block('latest').timestamp>=deadline or nonce!=c.actions.functions.privateNonce(id,week,member).call()+1:raise ValueError('private custody state changed')
        sig=self.signing.sign_msg_hash(digest);return unsigned[:5]+(sig.r.to_bytes(32,'big')+sig.s.to_bytes(32,'big')+bytes([sig.v+27]),)

    def _accepted(self,id,subject,week):
        c=self.client;member=c.host.functions.memberForSubject(id,subject).call();nonce=c.actions.functions.privateNonce(id,week,member).call()
        root=c.roster.functions.memberOf(id,member).call()[3] if week==0 else c.transactions.functions.queueCommitment(id,week,member).call()
        rows=self.db.execute('SELECT digest,sealed FROM records WHERE id=? AND subject=? AND week=? AND nonce=? AND root=?',(id,subject,week,nonce,root)).fetchall()
        if not rows:raise ValueError('accepted private payload unavailable')
        digest,sealed=rows[0];cipher=AES.new(self.storage,AES.MODE_GCM,nonce=sealed[:12]);cipher.update(digest);return member,cipher.decrypt_and_verify(sealed[28:],sealed[12:28])

    def autopick(self,id):
        c=self.client;league=c.roster.functions.leagueOf(id).call();now=c.w3.eth.get_block('latest').timestamp;member=c.roster.functions.actor(id).call()
        if not member or now<league[2]+60:raise ValueError('draft timeout not reached')
        m=c.roster.functions.memberOf(id,member).call()
        if m[4]==0:return c.actions.functions.autoPick(id,[])
        _,payload=self._accepted(id,m[0],0);ranking,salts=decode(['uint32[]','bytes32[]'],payload);_,_,proofs=c.preference(id,member,ranking,salts);prefix=[]
        start=c.roster.functions.preferenceCursor(id).call()
        for i in range(start,min(start+1,len(ranking))):
            athlete,salt=ranking[i],salts[i];prefix.append((i,athlete,salt,proofs[i]))
            if c.roster.functions.autoEligible(id,athlete).call():break
        fn=c.actions.functions.autoPick(id,prefix);fn.call();return fn

    def waivers_due(self,id,week):
        c=self.client
        if c.w3.eth.get_block('latest').timestamp<c.data.functions.periodOf(id,week).call()[3]:raise ValueError('waiver confidentiality window')
        out=[]
        for member in range(1,c.roster.functions.leagueOf(id).call()[0]+1):
            m=c.roster.functions.memberOf(id,member).call()
            if c.transactions.functions.queueCommitment(id,week,member).call()==bytes(32) or c.transactions.functions.queueRevealed(id,week,member).call():continue
            _,payload=self._accepted(id,m[0],week);claims,salt=decode(['(uint32,uint32)[]','bytes32'],payload);out.append(c.transactions.functions.revealWaivers(id,week,member,claims,salt))
        return out

    def close(self):self.db.close()
