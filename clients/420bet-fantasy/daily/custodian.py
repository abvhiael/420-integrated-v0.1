"""Confidential custodian: current chain authority, wallet consent and sealed durable storage."""
import json
from pathlib import Path
import sqlite3
import threading
import time
from Crypto.Cipher import AES
from Crypto.PublicKey import ECC
from Crypto.Random import get_random_bytes
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys import keys
from nhl import k256,context,decrypt_lineup,validate_and_sign,receipt_digest,commitment
from chain import b32,hx


class Custodian:
    def __init__(self,chain,private_directory):
        self.chain=chain;self.root=Path(private_directory).resolve();self.lock=threading.RLock()
        self.signing=bytes.fromhex((self.root/"validator.key").read_text().strip())
        self.encryption=(self.root/"encryption.pem").read_text().encode()
        self.storage=(self.root/"storage.key").read_bytes()
        if len(self.storage)!=32 or len(self.signing)!=32:raise ValueError("invalid custodian key length")
        self.public=ECC.import_key(self.encryption).public_key().export_key(format="raw")
        self.signer=keys.PrivateKey(self.signing).public_key.to_checksum_address()
        self.publisher=Account.from_key(bytes.fromhex((self.root/"publisher.key").read_text().strip()))
        self.db=sqlite3.connect(self.root/"custody.sqlite3",check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL");self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("CREATE TABLE IF NOT EXISTS decisions (claim TEXT PRIMARY KEY, text TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS evidence (claim TEXT PRIMARY KEY, text TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS receipts (digest TEXT PRIMARY KEY, pool TEXT, subject TEXT, nonce INTEGER, committed TEXT, sealed BLOB NOT NULL)");self.db.commit()
    def prepare(self,request):
        permitted={"pool","subject","credential","actor","commitment","nonce","expiry","envelope","walletSignature"}
        if not set(request)<=permitted:raise ValueError("unexpected submission fields; plaintext is not accepted")
        chain=self.chain;r=chain.preflight(request["pool"],request["subject"],request["credential"],request["actor"])
        if int(request["nonce"])!=r["nonce"] or not r["snapshot"]["timestamp"]<=int(request["expiry"])<=r["slate"]["lockAt"]:raise ValueError("stale nonce or receipt expiry")
        if r["slate"]["validator"].lower()!=self.signer.lower() or b32(r["slate"]["custodianKeyHash"])!=k256(self.public):raise ValueError("slate custodian key identity differs")
        auth=chain.auth.functions.isAuthorized(self.signer,chain.book.functions.VALIDATE_LINEUP().call(),chain.auth.functions.scopeForContest(b32(r["config"]["slate"])).call(),0).call(block_identifier=r["snapshot"]["number"])
        if not auth:raise ValueError("custodian signing authority revoked")
        envelope=bytes.fromhex(request["envelope"][2:])
        if len(envelope)!=317:raise ValueError("invalid encrypted envelope")
        digest=receipt_digest(chain.config["chainID"],chain.engine.address,b32(request["pool"]),b32(r["pool"]["manifest"]),b32(request["subject"]),b32(r["userKey"]),b32(request["commitment"]),r["nonce"],int(request["expiry"]),envelope)
        message="420Bet encrypted lineup authorization\nChain: "+str(chain.config["chainID"])+"\nEngine: "+chain.engine.address+"\nPool: "+request["pool"]+"\nSubject: "+request["subject"]+"\nCredential: "+request["credential"]+"\nWallet: "+request["actor"].lower()+"\nReceipt digest: "+hx(digest)+"\nThis authorizes custody validation only; your wallet separately confirms funding."
        return r,envelope,digest,message
    def attest(self,request):
        r,envelope,digest,message=self.prepare(request)
        actor=Account.recover_message(encode_defunct(text=message),signature=request["walletSignature"])
        if actor.lower()!=request["actor"].lower():raise ValueError("wallet authorization mismatch")
        lineup,salt=decrypt_lineup(self.encryption,envelope,context(b32(request["pool"]),b32(request["subject"]),r["nonce"]))
        # Validate the real decrypted commitment before any durable reservation.
        # Signature is computed after FULL synchronous database commit below.
        from nhl import validate_lineup
        validate_lineup(lineup,r["roster"])
        if commitment(self.chain.config["chainID"],self.chain.engine.address,b32(request["pool"]),b32(request["subject"]),r["nonce"],lineup,salt)!=b32(request["commitment"]):raise ValueError("encrypted commitment differs")
        aad=bytes.fromhex(hx(digest)[2:]);cipher=AES.new(self.storage,AES.MODE_GCM,nonce=get_random_bytes(12));cipher.update(aad)
        sealed,tag=cipher.encrypt_and_digest(json.dumps({"lineup":lineup,"salt":hx(salt)}).encode())
        blob=cipher.nonce+tag+sealed
        with self.lock:
            existing=self.db.execute("SELECT 1 FROM receipts WHERE digest=?",(hx(digest),)).fetchone()
            count=self.db.execute("SELECT count(*) FROM receipts WHERE pool=? AND subject=? AND nonce=?",(hx(b32(request["pool"])),hx(b32(request["subject"])),r["nonce"])).fetchone()[0]
            if not existing and count>=8:raise ValueError("too many pending receipts for this nonce; submit an existing receipt")
            self.db.execute("INSERT OR IGNORE INTO receipts VALUES (?,?,?,?,?,?)",(hx(digest),hx(b32(request["pool"])),hx(b32(request["subject"])),r["nonce"],hx(b32(request["commitment"])),blob));self.db.commit()
        # Recheck current acceptance after potentially slow decryption/disk I/O.
        current,_,_,_=self.prepare(request)
        if current["nonce"]!=r["nonce"] or current["pool"]["manifest"]!=r["pool"]["manifest"]:raise ValueError("chain changed during validation")
        signature=validate_and_sign(self.signing,self.encryption,envelope,self.chain.config["chainID"],self.chain.engine.address,b32(request["pool"]),b32(r["pool"]["manifest"]),b32(request["subject"]),b32(r["userKey"]),r["nonce"],int(request["expiry"]),r["roster"],b32(request["commitment"]),b32(r["slate"]["custodianKeyHash"]))
        return {"commitment":request["commitment"],"nonce":r["nonce"],"expiry":int(request["expiry"]),"envelope":request["envelope"],"signature":hx(signature)}
    def publish_due(self):
        chain=self.chain;local=chain.config.get("localQualification",False);snap=chain.snapshot("latest" if local else "finalized");published=[]
        with self.lock:records=list(self.db.execute("SELECT digest,pool,subject,nonce,committed,sealed FROM receipts ORDER BY nonce DESC"))
        seen=set();failures=0
        for digest,pool,subject,nonce,committed,sealed in records:
            try:
                if (pool,subject) in seen:continue
                c,p,s=chain.state(pool,snap["number"]);lock=s["earlyStart"] or s["lockAt"]
                if snap["timestamp"]<lock or (not local and time.time()<lock) or p["state"] not in (1,2):continue
                if p["state"]==1:
                    # Lock is its own transaction: underfilled cancellation must not
                    # be rolled back by a subsequent publishLineup state check.
                    latest=chain.state(pool)[1]
                    if latest["state"]!=1:continue
                    fn=chain.engine.functions.lockPool(b32(pool))
                    self._publish_transaction(fn)
                    continue  # wait for a confirmed/finalized LOCKED snapshot
                index=chain.engine.functions.entryForSubject(b32(pool),b32(subject)).call(block_identifier=snap["number"])
                if not index:continue
                entry=chain.entry(pool,index,snap["number"])
                if entry["nonce"]!=nonce or entry["commitment"]!=committed or entry["revealed"]:continue
                seen.add((pool,subject))
                if snap["timestamp"]>lock+chain.engine.functions.PUBLICATION_WINDOW().call():
                    fn=chain.engine.functions.recover(b32(pool))
                else:
                    cipher=AES.new(self.storage,AES.MODE_GCM,nonce=sealed[:12]);cipher.update(b32(digest));plain=json.loads(cipher.decrypt_and_verify(sealed[28:],sealed[12:28]))
                    fn=chain.engine.functions.publishLineup(b32(pool),index,plain["lineup"],b32(plain["salt"]))
                published.append(self._publish_transaction(fn))
            except Exception:failures+=1
        if failures:raise ValueError("one or more publication records require operator recovery")
        return published
    def _publish_transaction(self,fn):
        chain=self.chain
        transaction=fn.build_transaction({"from":self.publisher.address,"nonce":chain.w3.eth.get_transaction_count(self.publisher.address,"pending"),"chainId":chain.config["chainID"],"gas":1500000})
        tx=chain.w3.eth.send_raw_transaction(self.publisher.sign_transaction(transaction).raw_transaction)
        receipt=chain.w3.eth.wait_for_transaction_receipt(tx,timeout=30)
        if receipt.status!=1:raise ValueError("custodian publication transaction reverted")
        return hx(tx)
    def close(self):
        with self.lock:self.db.close()
