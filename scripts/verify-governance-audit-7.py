#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
MODEL=ROOT/"contracts/config/interfaces/governance-cross-protocol-integration.json"
DEPLOY=ROOT/"contracts/config/governance-deployment-v1.json"
DEPMODEL=ROOT/"contracts/config/interfaces/governance-dependency-model.json"
SEARCH=ROOT/"contracts/config/420search-genesis.json"
EXPLORER=ROOT/"contracts/config/420explorer-genesis.json"
NOTIFY=ROOT/"contracts/config/420notifications-genesis.json"
TREASURY=ROOT/"contracts/config/420treasury-genesis.json"
WALLET=ROOT/"wallet/web/core/governance-management.js"
INDEXER=ROOT/"420-indexer/src/governance-descriptors.ts"
GOVSRC=ROOT/"contracts/src/governance"
SRC=ROOT/"contracts/src"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def need(cond,msg,errors):
    if not cond: errors.append(msg)

def main():
    errors=[]
    model=load(MODEL); deploy=load(DEPLOY); dep=load(DEPMODEL)
    search=load(SEARCH); explorer=load(EXPLORER); notify=load(NOTIFY); treasury=load(TREASURY)
    wallet=WALLET.read_text(encoding="utf-8")
    indexer=INDEXER.read_text(encoding="utf-8")

    need(model.get("schema")=="420-governance-cross-protocol-integration-v1","integration model schema drift",errors)
    need(model.get("status")=="CANONICAL","integration model not canonical",errors)
    need(model.get("canonicalAuthority",{}).get("execution")=="GovernanceTimelock@0x0000000000000000000000000000000000000429","execution authority drift",errors)
    need(model.get("canonicalAuthority",{}).get("runtimeSharedDependencies")==[],"Governance gained shared runtime dependency",errors)
    need(dep.get("normative_shared_runtime_dependencies")==[],"GOV-AUDIT-1 shared runtime dependency drift",errors)

    integ={x.get("name"):x for x in model.get("integrations",[])}
    for name in ["420Registry","420Stake","420Treasury","420Vault","420Wallet","420Indexer","420Search","420Explorer","420Notifications","other_genesis_systemaccess_consumers"]:
        need(name in integ,f"missing integration boundary: {name}",errors)

    # Registry/discovery authority must exactly match the deployment publication namespace.
    need(deploy.get("registry",{}).get("address","").lower()=="0x0000000000000000000000000000000000000434","ProtocolRegistry address drift",errors)
    ids={x["name"]:x["componentId"]["preimage"] for x in deploy.get("registryResolvedComponents",[])}
    expected={
      "CivicConstitution420":"420/component/governance/civic-constitution/v1",
      "CivicProposalRegistry420":"420/component/governance/civic-proposal-registry/v1",
      "CivicElectorateRegistry420":"420/component/governance/civic-electorate-registry/v1",
      "CivicVoting420":"420/component/governance/civic-voting/v1",
      "CivicGovernor420":"420/component/governance/civic-governor/v1",
    }
    need(ids==expected,"canonical Civic Registry component IDs drift",errors)
    need(deploy.get("registry",{}).get("serviceId",{}).get("preimage")=="420/service/governance/v1","Governance service ID drift",errors)

    # Civic runtime may not consume Stake/Treasury/Vault/derived services.
    forbidden_core=["ValidatorRegistry","Stake420","Treasury","Vault","420Search","420Explorer","420Notifications"]
    for p in GOVSRC.glob("*.sol"):
        if p.name=="Governance420.sol": # deployment/bootstrap compatibility surface is allowed to publish Registry records
            continue
        text=p.read_text(encoding="utf-8")
        for token in forbidden_core:
            need(token not in text,f"{p.name} gained forbidden cross-protocol runtime reference: {token}",errors)
        need("ProtocolRegistry" not in text,f"{p.name} gained ProtocolRegistry runtime authority",errors)

    # No external Genesis contract may import/use Civic proposal/voting modules as reciprocal authority.
    forbidden_external=[
      "CivicConstitution420","CivicProposalRegistry420","CivicElectorateRegistry420",
      "CivicVoting420","CivicGovernor420","Governance420.sol"
    ]
    governed_consumers=[]
    for p in SRC.rglob("*.sol"):
        if GOVSRC in p.parents: continue
        text=p.read_text(encoding="utf-8")
        if "SystemAccess" in text or "onlyGovernance" in text or "governanceTimelock" in text:
            governed_consumers.append(str(p.relative_to(ROOT)))
        for token in forbidden_external:
            need(token not in text,f"circular Civic authority reference outside governance: {p.relative_to(ROOT)} -> {token}",errors)

    # Stake separation: electorate source is fixed one-member/one-vote and deployment policy explicitly rejects stake weighting.
    source=(GOVSRC/"CivicMerkleElectorateSource420.sol").read_text(encoding="utf-8")
    need('VALIDATOR_SOURCE_TYPE = keccak256("420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1")' in source,"validator equal-weight source type drift",errors)
    need(re.search(r"return\s+1\s*;",source) is not None,"validator/community source no longer returns unit voting weight",errors)
    val=deploy.get("canonicalInputs",{}).get("validatorElectorateSource",{})
    need(val.get("weighting")=="ONE_ACTIVE_VALIDATOR_OWNER_ONE_VOTE_NOT_STAKE_WEIGHTED","validator stake-separation policy drift",errors)

    # Treasury commitments/custody separation.
    need("420Vault VAULT_TREASURY" in treasury.get("custody_model",""),"Treasury custody separation drift",errors)
    need("GovernanceTimelock/Civic-controlled" in treasury.get("governance_model",""),"Treasury governance boundary drift",errors)
    treasury_budget=(SRC/"treasury/TreasuryBudgetRegistry420.sol").read_text(encoding="utf-8")
    treasury_disb=(SRC/"treasury/TreasuryDisbursementRegistry420.sol").read_text(encoding="utf-8")
    need("civicActionHash" in treasury_budget and "external onlyGovernance" in treasury_budget,"Treasury budget Civic commitment/governance gate missing",errors)
    need("b.civicActionHash!=civicActionHash" in treasury_disb.replace(" ",""),"Treasury disbursement no longer binds parent Civic action hash",errors)
    vault_policy=(SRC/"vault/VaultPolicyRegistry420.sol").read_text(encoding="utf-8")
    need("external onlyGovernance" in vault_policy,"Vault policy governance gate missing",errors)
    asset_vault=(SRC/"vault/AssetVault420.sol").read_text(encoding="utf-8")
    need("authorization.isRouteAuthorized" in asset_vault and "authorization.isAuthorized" in asset_vault,"Vault custody authorization boundary missing",errors)

    # Wallet remains a verified transaction client, not a governance authority.
    for required in ["Governance requires canonical ProtocolRegistry discovery","ProtocolRegistry resolution mismatch","contract identity mismatch","Wrong network","account is no longer authorized"]:
        need(required in wallet,f"Wallet governance fail-closed boundary missing: {required}",errors)
    for forbidden in ["createProposal(", ".queue(", ".execute("]:
        need(forbidden not in wallet,f"Wallet exposes forbidden ordinary governance control: {forbidden}",errors)

    # Indexer/Search/Explorer/Notifications remain derived/non-authoritative.
    need("artifact_events_only_addresses_resolved_by_deployment" in indexer,"Indexer Governance descriptor authority drift",errors)
    need(search.get("canonicalStateAuthority") is False and search.get("indexing",{}).get("databaseIsNonCanonical") is True,"Search became canonical authority",errors)
    need(any("no custody, smart-account execution, governance" in x for x in search.get("invariants",[])),"Search no-governance invariant missing",errors)
    need(explorer.get("canonicalStateAuthority") is False and explorer.get("indexing",{}).get("databaseIsNonCanonical") is True,"Explorer became canonical authority",errors)
    need(any("gain no custody, smart-account execution, governance" in x for x in explorer.get("invariants",[])),"Explorer no-governance invariant missing",errors)
    need(notify.get("canonicalStateAuthority") is False,"Notifications became canonical authority",errors)
    auth=notify.get("authority",{})
    for k in ["canSignTransactions","canGrantCapabilities","canApproveSpending","canMutateProtocolState","canCreateCanonicalEvents","canOverrideWalletConfirmation"]:
        need(auth.get(k) is False,f"Notifications authority drift: {k}",errors)
    need("governance proposals and deadlines" in notify.get("delivery",{}).get("supportedClasses",[]),"Notifications Governance delivery class missing",errors)

    invariants=model.get("invariants",[])
    for n in range(1,9):
        need(any(x.startswith(f"GOV7-INV-{n:03d}:") for x in invariants),f"missing GOV7 invariant {n}",errors)

    print(json.dumps({
      "step":"GOV-AUDIT-7",
      "pass":not errors,
      "errors":errors,
      "governedSystemAccessConsumers":len(set(governed_consumers)),
      "integrations":sorted(integ),
      "canonicalRegistryComponents":ids,
    },indent=2))
    return 0 if not errors else 2

if __name__=="__main__":
    raise SystemExit(main())
