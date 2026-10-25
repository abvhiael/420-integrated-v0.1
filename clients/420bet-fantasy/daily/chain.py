"""Pinned, read-through canonical daily-pool interface. No user transaction signer."""
import json
from pathlib import Path
from urllib.parse import urlparse
from web3 import Web3
from eth_abi import encode

ABI=Path(__file__).parent/"abi"
ZERO="0x"+"00"*32
POOL_FIELDS="state manifest launcherAccount count revealed lastAcceptedAt revision publishedRevision gross netPrize fee publishedCandidate".split()
CONFIG_FIELDS="slate candidateFeed launcher entryFee freePrize cap paid inviteOnly".split()
ENTRY_FIELDS="subject userKey beneficiary commitment nonce revealed claimed lineup".split()
SLATE_FIELDS="manifest feed custodianKeyHash custodianUserKey validator lockAt cutoff resolvedAt earlyStart gameCount eligibleGames".split()
DPOOL_FIELDS="state correctionEnd challengeEnd deadline reviewUntil generation statRevision pending candidate invalidated".split()
SUB_ABI="(bytes32,uint64,uint64,bytes,bytes)"


def hx(value):return "0x"+bytes(value).hex()
def b32(value):
    if not isinstance(value,str) or len(value)!=66 or not value.startswith("0x"):raise ValueError("invalid bytes32")
    return bytes.fromhex(value[2:])
def named(fields,values):return {k:hx(v) if isinstance(v,(bytes,bytearray)) else v for k,v in zip(fields,values)}


class Chain:
    def __init__(self,config):
        self.config=config
        url=urlparse(config["rpc"])
        if url.scheme!="https" and not(url.scheme=="http" and url.hostname in ("127.0.0.1","localhost","::1")):raise ValueError("RPC must use HTTPS or loopback")
        self.w3=Web3(Web3.HTTPProvider(config["rpc"],request_kwargs={"timeout":10}))
        if self.w3.eth.chain_id!=config["chainID"]:raise ValueError("wrong configured chain")
        if config.get("localQualification") and (config["chainID"]!=31337 or url.hostname not in ("127.0.0.1","localhost")):raise ValueError("local qualification requires isolated loopback Anvil")
        self.engine=self.contract("FantasyContestEngine420",config["engine"])
        self.book=self.contract("FantasySlateBook420",self.engine.functions.slateBook().call())
        self.disputes=self.contract("FantasyDisputeController420",self.engine.functions.disputes().call())
        self.admission=self.contract("FantasyAdmission420",self.engine.functions.admission().call())
        self.auth=self.contract("BetAuthorization420",self.engine.functions.authorization().call())
        self.policy=self.contract("FantasyPayoutPolicy420",self.engine.functions.payoutPolicy().call())
        self.rankings=self.contract("FantasyRankingBook420",self.engine.functions.rankings().call())
        asset=self.engine.functions.asset().call()
        if int(asset,16)==0:raise ValueError("daily app requires configured canonical ERC20 $420")
        self.token=self.contract("ERC20Template420",asset)
        if asset.lower()!=config["asset"].lower():raise ValueError("wrong canonical $420")
        self.decimals=self.token.functions.decimals().call()
        if not 0<=self.decimals<=36:raise ValueError("unsupported token precision")
        for address,digest in config["codeHashes"].items():
            if hx(Web3.keccak(self.w3.eth.get_code(Web3.to_checksum_address(address)))).lower()!=digest.lower():raise ValueError("deployed code identity changed")
        for contract in (self.engine,self.book,self.disputes,self.admission,self.auth,self.rankings,self.policy,self.token):
            if contract.address.lower() not in {a.lower() for a in config["codeHashes"]}:raise ValueError("missing pinned module identity")
    def contract(self,name,address):return self.w3.eth.contract(address=Web3.to_checksum_address(address),abi=json.loads((ABI/(name+".json")).read_text()))
    def snapshot(self,tag="latest"):
        block=self.w3.eth.get_block(tag)
        return {"number":block.number,"timestamp":block.timestamp,"hash":hx(block.hash)}
    def state(self,pool,block=None):
        block=self.snapshot()["number"] if block is None else block
        c=named(CONFIG_FIELDS,self.engine.functions.configOf(b32(pool)).call(block_identifier=block))
        p=named(POOL_FIELDS,self.engine.functions.poolOf(b32(pool)).call(block_identifier=block))
        s=named(SLATE_FIELDS,self.book.functions.slateOf(b32(c["slate"])).call(block_identifier=block))
        return c,p,s
    def entry(self,pool,index,block=None):return named(ENTRY_FIELDS,self.engine.functions.entryOf(b32(pool),index).call(block_identifier="latest" if block is None else block))
    def roster(self,slate,block):
        records=self.config["slates"][slate]["athletes"]
        result={}
        for meta in records:
            aid,game,pos=self.book.functions.athleteOf(b32(slate),int(meta["id"])).call(block_identifier=block)
            if not aid:raise ValueError("unpublished roster athlete")
            result[aid]={"id":aid,"name":meta["name"],"game":hx(game),"positions":pos}
        return result
    def preflight(self,pool,subject,credential,actor):
        actor=Web3.to_checksum_address(actor);snap=self.snapshot();block=snap["number"];c,p,s=self.state(pool,block)
        lock=s["earlyStart"] or s["lockAt"]
        if p["state"]!=1 or snap["timestamp"]>=lock:raise ValueError("pool is locked")
        if s["manifest"]==ZERO:raise ValueError("unsealed slate")
        index=self.engine.functions.entryForSubject(b32(pool),b32(subject)).call(block_identifier=block)
        if index:
            self.admission.functions.requireEntryActor(b32(subject),actor,b32(pool)).call(block_identifier=block)
            entry=self.entry(pool,index,block);user_key=entry["userKey"];nonce=entry["nonce"]+1
        else:
            user_key=hx(self.admission.functions.requireUser(b32(subject),b32(credential),actor,b32(pool),c["entryFee"]).call(block_identifier=block));nonce=1
            if self.engine.functions.entryForUser(b32(pool),b32(user_key)).call(block_identifier=block):raise ValueError("one lineup per canonical user")
            if c["cap"] and p["count"]>=c["cap"]:raise ValueError("pool capacity reached")
            if c["inviteOnly"] and not self.engine.functions.invited(b32(pool),b32(subject)).call(block_identifier=block):raise ValueError("invitation required")
        if user_key==s["custodianUserKey"]:raise ValueError("custodian cannot enter its own pools")
        return {"snapshot":snap,"config":c,"pool":p,"slate":s,"index":index,"nonce":nonce,"userKey":user_key,"lock":lock,"roster":self.roster(c["slate"],block)}
    def pools(self):
        latest=self.snapshot();events=[]
        for start in range(self.config["deploymentBlock"],latest["number"]+1,5000):events.extend(self.engine.events.PoolCreated().get_logs(from_block=start,to_block=min(start+4999,latest["number"])))
        result=[]
        for event in events:
            pid=hx(event["args"]["pool"]);c,p,s=self.state(pid,latest["number"])
            result.append({"id":pid,"config":c,"pool":p,"slate":s})
        return result
    def view(self,pool,actor,start=1):
        snap=self.snapshot();c,p,s=self.state(pool,snap["number"]);rows=[]
        start=int(start)
        if start<1 or start>max(1,p["count"]):raise ValueError("invalid entry page")
        for i in range(start,min(p["count"]+1,start+50)):
            entry=self.entry(pool,i,snap["number"]);node=self.rankings.functions.nodeOf(b32(pool),p["revision"],i).call(block_identifier=snap["number"])
            rows.append({"id":i,**entry,"score":str(node[0]) if node[3] else None,"payout":str(self.rankings.functions.payoutOf(b32(pool),p["publishedRevision"],i).call(block_identifier=snap["number"]))})
        claims=[]
        for event in self.disputes.events.Challenged().get_logs(from_block=self.config["deploymentBlock"],to_block=snap["number"]):
            args=event["args"]
            if hx(args["poolId"])==pool:
                claim=self.disputes.functions.claimOf(args["claimId"]).call(block_identifier=snap["number"])
                claims.append({"id":hx(args["claimId"]),**named("poolId subject payer candidate evidence bond createdAt verdict collected".split(),claim)})
        actor=Web3.to_checksum_address(actor)
        own=[]
        for profile in self.config['profiles']:
            if profile['account'].lower()==actor.lower():
                index=self.engine.functions.entryForSubject(b32(pool),b32(profile['subject'])).call(block_identifier=snap['number'])
                if index:own.append({'id':index,**self.entry(pool,index,snap['number'])})
        return {"payoutWeights":self.policy.functions.weightsFor(b32(pool),2 if c["cap"]==2 else 3).call(block_identifier=snap["number"]),"ownEntries":own,"pageStart":start,"nextPage":start+50 if start+50<=p['count'] else None,"id":pool,"config":c,"pool":p,"slate":s,"dispute":named(DPOOL_FIELDS,self.disputes.functions.poolOf(b32(pool)).call(block_identifier=snap["number"])),"entries":rows,"claims":claims,
                "balance":str(self.token.functions.balanceOf(actor).call(block_identifier=snap["number"])),"credit":str(self.engine.functions.credit(actor).call(block_identifier=snap["number"])),"bondCredit":str(self.disputes.functions.credit(actor).call(block_identifier=snap["number"])),"challengeBond":str(self.disputes.functions.bondFor(b32(pool)).call(block_identifier=snap["number"])),"timestamp":snap["timestamp"]}
    def draft(self,action,payload,actor):
        actor=Web3.to_checksum_address(actor);pid=b32(payload.get("pool",ZERO));value=0;approval=None
        if action=="create":
            slate=b32(payload["slate"]);fee=int(payload["entryFee"]);prize=int(payload["freePrize"]);cap=int(payload["cap"])
            if fee<0 or prize<0 or (fee and prize) or (cap and cap<2):raise ValueError("invalid pool funding")
            weights=[int(w) for w in payload.get("payoutWeights",[6000,3000,1000])]
            if not 1<=len(weights)<=3 or any(w<0 or w>10000 for w in weights) or sum(weights)!=10000:raise ValueError("payout percentages must total 100")
            bands=[] if cap==2 else [(3,cap or 2**64-1,weights)]
            cfg=(slate,b32(self.config.get("candidateFeeds",{}).get(payload["pool"],self.config["candidateFeed"])),b32(payload["subject"]),fee,prize,cap,bool(fee),bool(payload["inviteOnly"]))
            fn=self.engine.functions.createPool(pid,cfg,encode(["(uint64,uint64,uint16[])[]"],[bands]));approval=(self.engine.address,prize)
        elif action in ("enter","edit"):
            sub=payload["receipt"];submission=(b32(sub["commitment"]),int(sub["nonce"]),int(sub["expiry"]),bytes.fromhex(sub["envelope"][2:]),bytes.fromhex(sub["signature"][2:]))
            if action=="enter":
                fn=self.engine.functions.enterPool(pid,b32(payload["subject"]),b32(payload["credential"]),submission);approval=(self.engine.address,self.engine.functions.configOf(pid).call()[3])
            else:fn=self.engine.functions.editLineup(pid,int(payload["index"]),submission)
        elif action=="invite":fn=self.engine.functions.setInvitation(pid,b32(payload["subject"]),bool(payload["allowed"]))
        elif action in ("lock","recover","settle","collect","withdraw","development"):
            fn={"lock":lambda:self.engine.functions.lockPool(pid),"recover":lambda:self.engine.functions.recover(pid),"settle":lambda:self.engine.functions.settle(pid),"collect":lambda:self.engine.functions.collect(pid,int(payload["index"])),"withdraw":lambda:self.engine.functions.withdrawCredit(),"development":lambda:self.engine.functions.forwardDevelopment()}[action]()
        elif action=="challenge":
            fn=self.disputes.functions.challenge(pid,b32(payload["subject"]),b32(payload["evidence"]));approval=(self.disputes.address,self.disputes.functions.bondFor(pid).call())
        elif action=="resolve":fn=self.disputes.functions.resolve(b32(payload["claim"]),bool(payload["upheld"]),b32(payload["reason"]),b32(payload["candidate"]),b32(payload["subject"]),b32(payload["credential"]),0)
        elif action=="collectBond":fn=self.disputes.functions.collectBond(b32(payload["claim"]))
        elif action=="withdrawBond":fn=self.disputes.functions.withdrawCredit()
        elif action=="finalize":fn=self.disputes.functions.finalize(pid)
        else:raise ValueError("unsupported transaction action")
        calls=[]
        if approval and approval[1] and self.token.functions.allowance(actor,approval[0]).call()<approval[1]:
            # Exact allowance, never an unlimited grant or interchangeable spender.
            if self.token.functions.allowance(actor,approval[0]).call():calls.append({"to":self.token.address,"data":self.token.functions.approve(approval[0],0)._encode_transaction_data(),"value":"0x0"})
            calls.append({"to":self.token.address,"data":self.token.functions.approve(approval[0],approval[1])._encode_transaction_data(),"value":"0x0"})
        calls.append({"to":fn.address,"data":fn._encode_transaction_data(),"value":hex(value)})
        return calls
