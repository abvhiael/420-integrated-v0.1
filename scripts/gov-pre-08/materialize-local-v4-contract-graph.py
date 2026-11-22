#!/usr/bin/env python3
"""GOV-PRE-08 Step3: actual 14-component V4-shaped production contract graph on LOCAL Anvil.

Extends, but never replaces, the mined 42m + Vault funding Step2 witness. All 14
founding, Treasury and compensation components execute *real constructors* in the
same persistent chain-31337 Anvil process, with real storage initialization,
canonical Registry component/service resolution, signed-transaction-shaped
synthetic founder claims and one-shot policy wiring. This is NOT signed V4:
all founder and Timelock senders are LOCAL Anvil impersonation ONLY. No remote
endpoint, live chain ID, authentic founder credential or production approval.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
WAD=10**18
TIME="0x0000000000000000000000000000000000000429"
REGISTRY="0x0000000000000000000000000000000000000434"
VALIDATORS="0x0000000000000000000000000000000000000423"
COMMUNITY_RESERVE="0x0000000000000000000000000000000000000425"
BOOTSTRAP="0x0000000000000000000000000000000000000437"

def module(alias,filename):
    spec=importlib.util.spec_from_file_location(alias,HERE/filename)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

funding=module("govpre08_full_funding","materialize-local-vault-funding.py")
stage=module("govpre08_full_materializer","materialize-v4-source-and-audit-local.py")
plan=module("govpre08_full_plan","plan.py")
MODULES=[n for n,_ in plan.MODULES]
COMPONENTS=set(MODULES)

def need(cond,msg):
    if not cond: raise ValueError("GOV-PRE-08 STEP3 14-SOURCE GRAPH: "+msg)

def keccak(s):
    return funding.keccak_bytes(s)

def addr(hexstr):
    return "0x"+format(int(hexstr,16),"040x")

def hcode(rpc,who):
    code=rpc.code(who)
    need(code!="0x","missing executable runtime at "+who)
    return funding.cast("keccak",code).lower()

def read_address(rpc,contract,fn,*args):
    return addr(rpc.read(contract,fn,*args))

def call_send(rpc,sender,to,signature,*args,tag,receipts):
    calldata=funding.calldata(signature,*args)
    tx=rpc.send(sender,to,data=calldata,tag=tag)
    receipts.append(tx)
    return tx

def deploy(rpc,sender,name,constructor,values,receipts):
    actual=funding.bytecode(ROOT,name,constructor,*values)
    proof=rpc.send(sender,data=actual,tag="create:"+name)
    target=proof["contractAddress"]
    need(target is not None and funding.ADDRESS.fullmatch(target)
         and rpc.code(target)!="0x","failed real "+name+" constructor")
    receipts.append(proof)
    return addr(target)

def local_component_id(name):
    # byte-for-byte Solidity keccak256(abi.encode(string,string)), not packed.
    packed=funding.cast("abi-encode","f(string,string)",
                        "GOV-PRE-08/LOCAL-ONLY/COMPONENT",name)
    return funding.cast("keccak",packed).lower()

def predeploy(rpc,creator,name,signature,arguments,fixed,receipts):
    candidate=deploy(rpc,creator,name,signature,arguments,receipts)
    code=rpc.code(candidate)
    need(rpc.code(fixed)=="0x","frozen anchor already has runtime: "+fixed)
    rpc.call("anvil_setCode",[fixed,code])
    need(rpc.code(fixed)==code,"exact local predeploy runtime not set")
    return candidate

def fail_call(rpc,sender,to,signature,*args):
    data=funding.calldata(signature,*args)
    try:
        rpc.call("eth_call",[{"from":sender,"to":to,"data":data},"latest"])
    except ValueError:
        return
    raise ValueError("unauthorized operation accepted "+signature)

def bootstrap(rpc,base):
    """Perform genuine CREATE, local-only fixed-anchor materialization and binding."""
    founders=funding.native_allocations(ROOT)
    need(len(founders)==3 and all(rpc.balance(w)>0 for w in founders),
         "no authentic synthetic native fixture")
    need(set(founders)=={addr("0xa01"),addr("0xa02"),addr("0xa03")},
         "founder identities not exact synthetic 31337 fixtures")
    creator=rpc.call("eth_accounts",[])[0]
    need(rpc.balance(creator)==0,"extra native supply introduced by dev signer")
    need(int(rpc.call("eth_chainId",[]),16)==31337,
         "local 31337 ONLY")
    need(rpc.code(REGISTRY)=="0x" and rpc.code(TIME)=="0x"
         and rpc.code(VALIDATORS)=="0x" and rpc.code(COMMUNITY_RESERVE)=="0x",
         "canonical local graph already initialized (must fail closed on replay)")
    need(rpc.balance(COMMUNITY_RESERVE)==6_300_000*WAD,
         "canonical Stake CommunityValidatorReserve unfunded")
    need(rpc.balance(funding.PROTO)==3_560_000*WAD,
         "Step2 actual Protocol Reserve not funded")
    receipts=[]
    timelockCandidate=predeploy(rpc,creator,"GovernanceTimelock",
                               "constructor(address)",[BOOTSTRAP],TIME,receipts)
    rpc.call("anvil_setStorageAt",[TIME,"0x"+"0"*64,"0x"+format(int(BOOTSTRAP,16),"064x")])
    need(read_address(rpc,TIME,"scheduler()")==addr(BOOTSTRAP)
         and read_address(rpc,TIME,"bootstrapGovernor()")==addr(BOOTSTRAP)
         and int(rpc.read(TIME,"civicAuthorityActivated()"),16)==0,
         "Timelock constructor storage was not exactly materialized")
    predeploy(rpc,creator,"ProtocolRegistry","constructor(address)",[TIME],REGISTRY,receipts)
    need(int(rpc.read(REGISTRY,"protocolVersion()"),16)==4
         and read_address(rpc,REGISTRY,"governanceTimelock()")==addr(TIME),
         "Protocol Registry frozen anchor source drift")
    predeploy(rpc,creator,"CommunityValidatorReserve","constructor(address)",
              [TIME],COMMUNITY_RESERVE,receipts)
    need(read_address(rpc,COMMUNITY_RESERVE,"governanceTimelock()")==addr(TIME)
         and rpc.balance(COMMUNITY_RESERVE)==6_300_000*WAD,
         "Community Validator Reserve anchor drift")
    localManifest=keccak("GOV-PRE-08/LOCAL-ONLY/UNSIGNED-V4-REHEARSAL")
    predeploy(rpc,creator,"ValidatorRegistry","constructor(address,address,bytes32)",
              [TIME,REGISTRY,localManifest],VALIDATORS,receipts)
    need(read_address(rpc,VALIDATORS,"stakeProtocolRegistry()")==addr(REGISTRY),
         "Stake ValidatorRegistry canonical Registry pointer drift")

    # Real 420Civic constructor graph: independently configured but never activated.
    const=deploy(rpc,creator,"CivicConstitution420","constructor(address)",[TIME],receipts)
    prop=deploy(rpc,creator,"CivicProposalRegistry420","constructor(address)",[TIME],receipts)
    elect=deploy(rpc,creator,"CivicElectorateRegistry420","constructor(address)",[TIME],receipts)
    voting=deploy(rpc,creator,"CivicVoting420","constructor(address,address)",[prop,elect],receipts)
    civic=deploy(rpc,creator,"CivicGovernor420","constructor(address,address,address,address)",
                 [const,prop,elect,voting],receipts)
    need(read_address(rpc,civic,"timelock()")==addr(TIME),
         "Civic Governance Timelock immutable drift")

    # The Step2 Vaults and CapabilityRegistry were already created with real
    # constructors. Never redeploy them or move the funded native balances.
    dep={}
    for row in base["txReceipts"]:
        if row["tag"].startswith("deploy:"):
            name=row["tag"].split(":",1)[1]
            proof=rpc.call("eth_getTransactionReceipt",[row["tx"]])
            need(proof is not None and int(proof["status"],16)==1,
                 "missing Step2 base constructor receipt")
            dep.setdefault(name,addr(proof["contractAddress"]))
    for k in ("CapabilityRegistry420","VaultAuthorization420","VaultPolicyRegistry420",
              "VaultRegistry420","VaultAccounting420"):
        need(k in dep and rpc.code(dep[k])!="0x","missing Step2 dependency "+k)
    caps,vAuth,vPolicy,vreg,accounting=[dep[k] for k in
        ("CapabilityRegistry420","VaultAuthorization420","VaultPolicyRegistry420",
         "VaultRegistry420","VaultAccounting420")]
    vaultRouter=deploy(rpc,creator,"VaultRouter420",
                       "constructor(address,address,address)",[vreg,accounting,vAuth],receipts)
    call_send(rpc,creator,caps,"registerProtocolComponent(bytes32,address)",
              keccak("420/TREASURY/COMPONENT/V1"),creator,
              tag="authority:TREASURY",receipts=receipts)
    call_send(rpc,creator,caps,"registerProtocolComponent(bytes32,address)",
              keccak("420/COMPONENT/VAULT/V1"),creator,
              tag="authority:VAULT",receipts=receipts)

    d={}
    d["TreasuryAuthorization420"]=deploy(rpc,creator,"TreasuryAuthorization420",
        "constructor(address)",[caps],receipts)
    d["TreasuryPolicyRegistry420"]=deploy(rpc,creator,"TreasuryPolicyRegistry420",
        "constructor(address)",[TIME],receipts)
    d["TreasuryBudgetRegistry420"]=deploy(rpc,creator,"TreasuryBudgetRegistry420",
        "constructor(address,address)",[TIME,d["TreasuryPolicyRegistry420"]],receipts)
    d["TreasuryDisbursementRegistry420"]=deploy(rpc,creator,"TreasuryDisbursementRegistry420",
        "constructor(address,address,address,address)",
        [TIME,d["TreasuryAuthorization420"],d["TreasuryPolicyRegistry420"],
         d["TreasuryBudgetRegistry420"]],receipts)
    d["TreasuryRouter420"]=deploy(rpc,creator,"TreasuryRouter420",
        "constructor(address,address)",
        [d["TreasuryBudgetRegistry420"],d["TreasuryDisbursementRegistry420"]],receipts)
    admin,andrew,janet=founders
    d["FoundingWalletClaims420"]=deploy(rpc,creator,"FoundingWalletClaims420",
        "constructor(address,address,address,bytes32)",
        [admin,andrew,janet,localManifest],receipts)
    d["FoundingCommitteeMembership420"]=deploy(rpc,creator,"FoundingCommitteeMembership420",
        "constructor(address,address,address,address)",
        [admin,andrew,janet,TIME],receipts)
    d["FoundingRetirementVerifier420"]=deploy(rpc,creator,"FoundingRetirementVerifier420",
        "constructor(address,address,address,address)",
        [VALIDATORS,d["FoundingCommitteeMembership420"],civic,TIME],receipts)
    vaultIds=base["vaultIds"]
    d["FoundingTreasuryAuthority420"]=deploy(rpc,creator,"FoundingTreasuryAuthority420",
        "constructor(address,address,address,address,address,address,address,address,address,address,bytes32,bytes32)",
        [admin,andrew,janet,d["FoundingWalletClaims420"],TIME,d["FoundingRetirementVerifier420"],
         d["TreasuryBudgetRegistry420"],d["TreasuryDisbursementRegistry420"],
         d["TreasuryPolicyRegistry420"],vreg,vaultIds["OPERATIONS"],vaultIds["CONTINGENCY"]],receipts)
    d["FoundingValidatorSponsorship420"]=deploy(rpc,creator,"FoundingValidatorSponsorship420",
        "constructor(address,address,address,address,address)",
        [admin,d["FoundingWalletClaims420"],d["FoundingTreasuryAuthority420"],
         COMMUNITY_RESERVE,VALIDATORS],receipts)
    d["FoundingCommunityRetirementSweep420"]=deploy(rpc,creator,"FoundingCommunityRetirementSweep420",
        "constructor(address,bytes32)",
        [d["FoundingTreasuryAuthority420"],vaultIds["COMMUNITY"]],receipts)
    d["FoundingDeveloperCompensationSplitter420"]=deploy(rpc,creator,
        "FoundingDeveloperCompensationSplitter420",
        "constructor(address,address,address)",[admin,andrew,janet],receipts)
    d["DevelopmentCompensationVault420"]=deploy(rpc,creator,"DevelopmentCompensationVault420",
        "constructor(address,address)",
        [caps,d["FoundingDeveloperCompensationSplitter420"]],receipts)
    d["TreasuryReleaseExecutor420"]=deploy(rpc,creator,"TreasuryReleaseExecutor420",
        "constructor(address,address)",[REGISTRY,d["FoundingTreasuryAuthority420"]],receipts)
    need(set(d)==COMPONENTS and len(set(d.values()))==14,
         "not exactly fourteen distinct real production constructors")

    # One-time authority bindings before founder claims. Reject improper calls.
    for name in ("TreasuryPolicyRegistry420","TreasuryBudgetRegistry420",
                 "TreasuryDisbursementRegistry420"):
        call_send(rpc,creator,d[name],"bindFoundingAuthority(address)",
                  d["FoundingTreasuryAuthority420"],tag="bind:"+name,receipts=receipts)
        need(read_address(rpc,d[name],"foundingAuthority()")==
             addr(d["FoundingTreasuryAuthority420"]),"Treasury binding failed "+name)
    rpc.call("anvil_impersonateAccount",[TIME])
    call_send(rpc,TIME,d["TreasuryBudgetRegistry420"],"setController(address)",
              d["TreasuryDisbursementRegistry420"],tag="bind:BudgetController",receipts=receipts)
    exec_=d["TreasuryReleaseExecutor420"]
    call_send(rpc,creator,d["FoundingTreasuryAuthority420"],
              "bindReleaseExecutor(address,bytes32)",exec_,hcode(rpc,exec_),
              tag="bind:FoundingReleaseExecutor",receipts=receipts)
    call_send(rpc,creator,d["FoundingDeveloperCompensationSplitter420"],
              "bindCompensationVault(address)",d["DevelopmentCompensationVault420"],
              tag="bind:DeveloperCompensation",receipts=receipts)
    call_send(rpc,TIME,d["FoundingCommitteeMembership420"],
              "bindRetirementAuthority(address)",d["FoundingTreasuryAuthority420"],
              tag="bind:CommitteeRetirement",receipts=receipts)
    call_send(rpc,TIME,COMMUNITY_RESERVE,"bindGenesisFoundingSponsorAuthority(address)",
              d["FoundingValidatorSponsorship420"],tag="bind:StakeSponsor",receipts=receipts)
    call_send(rpc,TIME,COMMUNITY_RESERVE,"bindValidatorRegistry(address)",
              VALIDATORS,tag="bind:CommunityValidatorRegistry",receipts=receipts)
    call_send(rpc,TIME,VALIDATORS,"bindCommunityValidatorReserve(address)",
              COMMUNITY_RESERVE,tag="bind:ValidatorCommunityReserve",receipts=receipts)
    need(read_address(rpc,COMMUNITY_RESERVE,"genesisFoundingSponsorAuthority()")==
         addr(d["FoundingValidatorSponsorship420"]),
         "Stake sponsorship registration not bound")
    need(read_address(rpc,VALIDATORS,"communityValidatorReserve()")==
         addr(COMMUNITY_RESERVE),
         "ValidatorRegistry community reserve not bound")

    # These synthetic unowned fixture senders are impersonated ONLY on chain 31337.
    fail_call(rpc,creator,d["FoundingWalletClaims420"],"claimFounderWallet()")
    fail_call(rpc,admin,d["FoundingTreasuryAuthority420"],"initializeBudgets()")
    for source in founders:
        rpc.call("anvil_impersonateAccount",[source])
        call_send(rpc,source,d["FoundingWalletClaims420"],"claimFounderWallet()",
                  tag="synthetic_claim:"+source,receipts=receipts)
        need(int(rpc.read(d["FoundingWalletClaims420"],"claimed(address)",source),16)==1,
             "onchain local founder claim did not persist")
        rpc.call("anvil_stopImpersonatingAccount",[source])
    need(int(rpc.read(d["FoundingWalletClaims420"],"claimedCount()"),16)==3,
         "local claims not three genuine mined chain-31337 transactions")
    rpc.call("anvil_impersonateAccount",[admin])
    call_send(rpc,admin,d["FoundingTreasuryAuthority420"],"initializeNativePolicy()",
              tag="init:NativePolicy",receipts=receipts)
    call_send(rpc,admin,d["FoundingTreasuryAuthority420"],"initializeBudgets()",
              tag="init:FoundingBudgets",receipts=receipts)
    rpc.call("anvil_stopImpersonatingAccount",[admin])
    need(int(rpc.read(d["FoundingTreasuryAuthority420"],"budgetsInitialized()"),16)==1,
         "real budget initialization did not persist")
    for k in ("operationsBudgetId()","contingencyBudgetId()"):
        budgetId=rpc.read(d["FoundingTreasuryAuthority420"],k)
        need(int(rpc.read(d["TreasuryBudgetRegistry420"],"isEffective(bytes32)",budgetId),16)==1,
             "real Treasury budget not currently effective")

    # Source-qualified canonical protocol discovery. Component IDs are LOCAL-ONLY
    # and immutable recorded real code hashes. Source V3 and V4 remain unmodified.
    ids={}
    for name in MODULES:
        componentId=local_component_id(name)
        ids[name]=componentId
        call_send(rpc,TIME,REGISTRY,
                  "registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)",
                  componentId,d[name],"(1,0,0)",2,
                  tag="register:"+name,receipts=receipts)
        need(read_address(rpc,REGISTRY,"resolve(bytes32)",componentId)==addr(d[name]),
             "live local Registry component resolved incorrectly "+name)
        need(rpc.read(REGISTRY,"runtimeCodeHash(bytes32)",componentId).lower()==hcode(rpc,d[name]),
             "registered code hash is not actual deployment "+name)
        need(int(rpc.read(REGISTRY,"currentComponentRevision(bytes32)",componentId),16)==1,
             "not a fresh component revision for "+name)
    services={}
    for name,signature,target in (
        ("TREASURY","420/service/treasury/v1",d["TreasuryRouter420"]),
        ("VAULT","420/service/vault/v1",vaultRouter),
        ("DEVELOPMENT_COMPENSATION","420/service/development-compensation/v1",
         d["DevelopmentCompensationVault420"]),
    ):
        id_=keccak(signature)
        call_send(rpc,TIME,REGISTRY,
                  "publishRegisteredService(bytes32,address,bytes32,uint32,bool,uint8,bytes32,bytes32,bytes32)",
                  id_,target,keccak("GOVPRE08/LOCAL/METADATA"),1,"true",3,
                  localManifest,keccak("GOVPRE08/LOCAL/GRAPH"),keccak("GOVPRE08/LOCAL/INTERFACE"),
                  tag="publish:"+name,receipts=receipts)
        data=rpc.read(REGISTRY,"resolveActive(bytes32)",id_)
        need(addr(data[2:66])==addr(target) and int(data[66:130],16)==1,
             "canonical Registry service discovery failed "+name)
        services[name]={"id":id_,"address":target,"runtimeCodeHash":hcode(rpc,target)}
    # Deny unauthorized Registry mutations, duplicate one-time budget and claim.
    fail_call(rpc,creator,REGISTRY,"registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)",
              ids[MODULES[0]],d[MODULES[0]],"(1,0,0)",2)
    fail_call(rpc,creator,REGISTRY,
              "publishRegisteredService(bytes32,address,bytes32,uint32,bool,uint8,bytes32,bytes32,bytes32)",
              services["TREASURY"]["id"],d["TreasuryRouter420"],
              keccak("GOVPRE08/LOCAL/METADATA"),2,"true",3,
              localManifest,keccak("GOVPRE08/LOCAL/GRAPH"),keccak("GOVPRE08/LOCAL/INTERFACE"))
    fail_call(rpc,admin,d["FoundingWalletClaims420"],"claimFounderWallet()")
    fail_call(rpc,admin,d["FoundingTreasuryAuthority420"],"initializeBudgets()")
    fail_call(rpc,creator,d["TreasuryBudgetRegistry420"],"setController(address)",creator)
    need(int(rpc.read(TIME,"civicAuthorityActivated()"),16)==0,
         "local fixture falsely activated Civic Timelock")
    # Real Civic/Timelock opt-in activation is rehearsed on a disposable branch,
    # NEVER committed as production authority. The test is not a Civic vote.
    fail_call(rpc,creator,TIME,"activateCivicAuthority(address)",civic)
    snapshot=rpc.call("evm_snapshot",[])
    need(snapshot is not None,"local Civic governance snapshot absent")
    rpc.call("anvil_impersonateAccount",[BOOTSTRAP])
    try:
        activation=rpc.send(BOOTSTRAP,TIME,
            funding.calldata("activateCivicAuthority(address)",civic),
            tag="probe:impersonated_bootstrap_governor_Civic")
        need(int(rpc.read(TIME,"civicAuthorityActivated()"),16)==1
             and read_address(rpc,TIME,"scheduler()")==addr(civic),
             "actual Civic/Timelock authority handoff did not execute")
        need(rpc.call("evm_revert",[snapshot]) is True,
             "synthetic Civic authority could not be rolled back")
        need(rpc.call("eth_getTransactionReceipt",[activation["tx"]]) is None,
             "orphaned synthetic Timelock authorization persisted")
        need(int(rpc.read(TIME,"civicAuthorityActivated()"),16)==0
             and read_address(rpc,TIME,"scheduler()")==addr(BOOTSTRAP),
             "synthetic Civic activation contaminated source Genesis")
    finally:
        rpc.call("anvil_stopImpersonatingAccount",[BOOTSTRAP])
    for typ,amount in (("OPERATIONS",4_200_000*WAD),
                       ("CONTINGENCY",840_000*WAD),("COMMUNITY",0)):
        need(rpc.balance(base["vaultAddresses"][typ])==amount,
             "production-graph installation diverted native Vault funds")
    need(rpc.balance(funding.PROTO)==3_560_000*WAD
         and rpc.balance(COMMUNITY_RESERVE)==6_300_000*WAD
         and all(rpc.balance(x)==0 for x in d.values()),
         "extra or diverted funds during local graph installation")

    output={
        "schema":"GOV_PRE_08_STEP3_LOCAL_ACTUAL_FOURTEEN_CONSTRUCTORS_V1",
        "sourceGitHead":stage.head(),
        "unsignedV4CandidateHash":plan.make_candidate(ROOT,with_artifacts=True)["proposedV4"]["genesisConfigHash"],
        "chainId":31337,
        "sourceFoundersFixtureOnly":founders,
        "authenticFounderOwnersVerified":False,
        "productionGovernanceTimelockAuthorized":False,
        "historicalFrozenV3Unchanged":True,
        "approvedV4":False,
        "actualProductionConstructorAddresses":d,
        "actualProductionConstructorRuntimeHashes":{name:hcode(rpc,target) for name,target in d.items()},
        "localRegistryComponentIds":ids,
        "serviceDiscoveries":services,
        "genesisAnchorCodeHashes":{key:hcode(rpc,location) for key,location in
           (("GovernanceTimelock",TIME),("ProtocolRegistry",REGISTRY),
            ("ValidatorRegistry",VALIDATORS),
            ("CommunityValidatorReserve",COMMUNITY_RESERVE))},
        "localCivicGovernor":civic,
        "localCivicGovernorRuntimeHash":hcode(rpc,civic),
        "vaultRouter":vaultRouter,
        "vaultRouterRuntimeHash":hcode(rpc,vaultRouter),
        "predeployMethod":"DISPOSABLE_ANVIL_CONSTRUCTOR_RUNTIME_COPY_WITH_EXPLICIT_STATE_ONLY",
        "localFounderImpersonationOnly":True,
        "locallyPublishedServiceIdsOnly":True,
        "budgetAndFounderClaimsMined":True,
        "disposableCivicTimelockActivationThenReverted":True,
        "totalNativeSupplyWei":str(42_000_000*WAD),
        "fullApplicationRuntimeQualified":False,
        "realConsensusQualified":False,
        "txReceipts":[{"tag":x["tag"],"tx":x["tx"],"blockHash":x["blockHash"],
                       "blockNumber":x["blockNumber"],"gasUsed":x["gasUsed"]}
                      for x in receipts],
    }
    output["deterministicGraphDigestSha256"]=hashlib.sha256(
        stage.canonical({k:v for k,v in output.items() if k!="txReceipts"})).hexdigest()
    verify(rpc,output)
    return output

def verify(rpc,e):
    need(e["schema"]=="GOV_PRE_08_STEP3_LOCAL_ACTUAL_FOURTEEN_CONSTRUCTORS_V1"
         and e["sourceGitHead"]==stage.head() and e["chainId"]==31337
         and int(rpc.call("eth_chainId",[]),16)==31337
         and not e["approvedV4"] and not e["authenticFounderOwnersVerified"]
         and not e["productionGovernanceTimelockAuthorized"],
         "not an unapproved exact-source 31337 graph")
    need(set(e["actualProductionConstructorAddresses"])==COMPONENTS,
         "missing canonical 14 production contracts")
    for name,target in e["actualProductionConstructorAddresses"].items():
        need(hcode(rpc,target)==e["actualProductionConstructorRuntimeHashes"][name],
             "constructor runtime changed or missing on recovery: "+name)
        component=e["localRegistryComponentIds"][name]
        need(read_address(rpc,REGISTRY,"resolve(bytes32)",component)==addr(target),
             "Registry component not recovered: "+name)
        need(rpc.read(REGISTRY,"runtimeCodeHash(bytes32)",component).lower()==hcode(rpc,target),
             "Registry code hash not recovered: "+name)
        need(int(rpc.read(REGISTRY,"currentComponentRevision(bytes32)",component),16)==1,
             "component revision drift: "+name)
    for name,s in e["serviceDiscoveries"].items():
        data=rpc.read(REGISTRY,"resolveActive(bytes32)",s["id"])
        need(addr(data[2:66])==addr(s["address"]) and int(data[66:130],16)==1,
             "service not recovered "+name)
        need(hcode(rpc,s["address"])==s["runtimeCodeHash"],
             "service source runtime changed "+name)
    for key,target in (("GovernanceTimelock",TIME),("ProtocolRegistry",REGISTRY),
                       ("ValidatorRegistry",VALIDATORS),
                       ("CommunityValidatorReserve",COMMUNITY_RESERVE)):
        need(hcode(rpc,target)==e["genesisAnchorCodeHashes"][key],
             "frozen anchor runtime not recovered "+key)
    need(hcode(rpc,e["localCivicGovernor"])==e["localCivicGovernorRuntimeHash"],
         "Civic source runtime changed")
    need(hcode(rpc,e["vaultRouter"])==e["vaultRouterRuntimeHash"],
         "VaultRouter source runtime changed")
    d=e["actualProductionConstructorAddresses"]
    need(int(rpc.read(d["FoundingWalletClaims420"],"claimedCount()"),16)==3,
         "all three local founder claims not durable")
    for founder in e["sourceFoundersFixtureOnly"]:
        need(int(rpc.read(d["FoundingWalletClaims420"],"claimed(address)",founder),16)==1,
             "local founder's claim not durable "+founder)
    need(int(rpc.read(d["FoundingTreasuryAuthority420"],"budgetsInitialized()"),16)==1,
         "founder budget initialization did not survive recovery")
    for signature in ("operationsBudgetId()","contingencyBudgetId()"):
        id_=rpc.read(d["FoundingTreasuryAuthority420"],signature)
        need(int(rpc.read(d["TreasuryBudgetRegistry420"],"isEffective(bytes32)",id_),16)==1,
             "budget not effective after recovery")
    need(read_address(rpc,COMMUNITY_RESERVE,"genesisFoundingSponsorAuthority()")==
         addr(d["FoundingValidatorSponsorship420"])
         and read_address(rpc,VALIDATORS,"communityValidatorReserve()")==addr(COMMUNITY_RESERVE),
         "Stake/Founding cross-protocol binding not recovered")
    need(int(rpc.read(TIME,"civicAuthorityActivated()"),16)==0,
         "unapproved Civic authority unexpectedly activated")
    return True

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--rpc",required=True)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--deploy-from-step2",type=Path)
    group.add_argument("--verify",type=Path)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    try:
        rpc=funding.Rpc(args.rpc)
        if args.deploy_from_step2 is not None:
            need(args.output is not None and not args.output.exists(),
                 "refusing missing or overwriting local runtime output")
            proof=stage.read(args.deploy_from_step2)
            stage.receipt_view(rpc,proof) # actual exact source & canonical 18 tx evidence
            out=bootstrap(rpc,proof)
            stage.emit(args.output,out)
            print("GOV_PRE_08_STEP3_REAL_14_CONSTRUCTOR_REGISTRY_TREASURY_STAKE=PASS LOCAL ONLY",
                  out["deterministicGraphDigestSha256"])
        else:
            need(args.output is None,"verify must not overwrite retained evidence")
            proof=stage.read(args.verify)
            verify(rpc,proof)
            print("GOV_PRE_08_STEP3_REAL_14_CONSTRUCTOR_CROSS_BOUNDARIES_RECOVERED=PASS LOCAL ONLY")
    except (OSError,ValueError,KeyError,IndexError,TypeError,
            subprocess.CalledProcessError,json.JSONDecodeError) as exc:
        parser.exit(1,str(exc)+"\n")

if __name__=="__main__":
    main()
