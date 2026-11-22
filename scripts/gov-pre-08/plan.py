#!/usr/bin/env python3
"""GOV-PRE-08 source-bound V4 Genesis candidate builder.

This builds a deterministic, UNAPPROVED source candidate, not a signed Genesis or
an assertion of deployment. Historical FROZEN_V3 remains untouched. Exact live
signatures, constructor execution, grants and vault receipts are separate gates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KIEF = 10 ** 18
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
BYTES32 = re.compile(r"0x[0-9a-fA-F]{64}\Z")
ZERO = "0x" + "00" * 20
ROLE_IDS = ("founder-admin-liquid", "founder-andrew-liquid", "founder-janet-liquid")
ROLE_AMOUNTS = (250000, 125000, 125000)
FROZEN_CONFIG = "contracts/config/genesis-config-commitment.json"

# This is deliberately an OFF-NAMESPACE deployment graph. No 0x04xx address
# can be silently assigned to dynamically deployed founder/Treasury contracts.
MODULES = (
    ("FoundingWalletClaims420", "governance/FoundingWalletClaims420.sol"),
    ("FoundingCommitteeMembership420", "governance/FoundingCommitteeMembership420.sol"),
    ("FoundingRetirementVerifier420", "governance/FoundingRetirementVerifier420.sol"),
    ("FoundingTreasuryAuthority420", "treasury/FoundingTreasuryAuthority420.sol"),
    ("FoundingValidatorSponsorship420", "treasury/FoundingValidatorSponsorship420.sol"),
    ("FoundingCommunityRetirementSweep420", "treasury/FoundingCommunityRetirementSweep420.sol"),
    ("FoundingDeveloperCompensationSplitter420", "revenue/FoundingDeveloperCompensationSplitter420.sol"),
    ("DevelopmentCompensationVault420", "revenue/DevelopmentCompensationVault420.sol"),
    ("TreasuryAuthorization420", "treasury/TreasuryAuthorization420.sol"),
    ("TreasuryPolicyRegistry420", "treasury/TreasuryPolicyRegistry420.sol"),
    ("TreasuryBudgetRegistry420", "treasury/TreasuryBudgetRegistry420.sol"),
    ("TreasuryDisbursementRegistry420", "treasury/TreasuryDisbursementRegistry420.sol"),
    ("TreasuryRouter420", "treasury/TreasuryRouter420.sol"),
    ("TreasuryReleaseExecutor420", "treasury/TreasuryReleaseExecutor420.sol"),
)
AUTHORITY_PATHS = (
    "contracts/config/genesis-address-namespace.json",
    "contracts/config/system-addresses.json",
    "contracts/config/interfaces/genesis-interface-layer.json",
    "config/genesis-applications.json",
    "config/genesis-allocations.json",
    "config/ai-genesis.json",
    "contracts/config/founder-wallet-reservations.json",
    "contracts/config/founding-genesis-integration-v1.json",
)

def require(test, msg):
    if not test:
        raise ValueError(msg)

def read(root, path):
    return json.loads((root / path).read_text(encoding="utf-8"))

def git(root, *args):
    return subprocess.check_output(("git", *args), cwd=root, text=True).strip()

def gitblob(root, path):
    require((root / path).is_file(), "missing authority/source file: " + path)
    return git(root, "hash-object", path)

def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))

def digest(obj):
    return "0x" + hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()

def keccak(root, obj):
    data = canonical(obj).encode("utf-8")
    return subprocess.check_output(("cast", "keccak", "0x" + data.hex()),
                                   cwd=root, text=True).strip().lower()

def check_ledger(ledger, wallets, system, integration):
    require(ledger["schema"] == "420-integrated-genesis-allocations-v1",
            "unexpected Genesis ledger")
    require(ledger["genesis_supply_420"] == 42000000 and
            int(ledger["genesis_supply_kief"]) == 42000000 * KIEF,
            "42m supply identity drift")
    allocation = ledger["allocations"]
    require(len({x["id"] for x in allocation}) == len(allocation),
            "duplicate Genesis allocation ID")
    require(all(x["amount_420"] >= 0 and
                int(x["amount_kief"]) == x["amount_420"] * KIEF for x in allocation),
            "inconsistent native denomination")
    require(sum(x["amount_420"] for x in allocation) == 42000000,
            "Genesis supply is not conserved")
    alloc = {x["id"]: x for x in allocation}
    expected = {
        "founder-vesting":500000,
        "founder-admin-liquid":250000,
        "founder-andrew-liquid":125000,
        "founder-janet-liquid":125000,
        "validator-bootstrap-reserve":3000000,
        "attention-bootstrap":4200000,
        "development-bootstrap":4200000,
        "community-validator-credit-reserve":6300000,
        "community-testnet-reward-reserve":2100000,
        "public-distribution-genesis-tranche":4200000,
        "public-distribution-day180-tranche":4200000,
        "public-distribution-day365-tranche":4200000,
        "protocol-reserve":8600000,
    }
    require({key: row["amount_420"] for key,row in alloc.items()} == expected,
            "canonical 13-tranche distribution changed")
    for key, slot in (
        ("validator-bootstrap-reserve",0x42e),
        ("attention-bootstrap",0x421), ("development-bootstrap",0x422),
        ("community-validator-credit-reserve",0x425),
        ("community-testnet-reward-reserve",0x426),
        ("public-distribution-genesis-tranche",0x42a),
        ("public-distribution-day180-tranche",0x42a),
        ("public-distribution-day365-tranche",0x42a),
    ):
        require(int(alloc[key]["destination"],16) == slot,
                "canonical tranche destination changed: "+key)
    require(alloc["founder-vesting"]["amount_420"] == 500000 and
            int(alloc["founder-vesting"]["destination"], 16) == 0x427,
            "locked founder allocation drift")
    require(len(wallets["founders"]) == 3 and
            [x["genesis_liquid_420"] for x in wallets["founders"]] == list(ROLE_AMOUNTS) and
            [x["genesis_locked_420"] for x in wallets["founders"]] == [250000,125000,125000] and
            [x["developer_compensation_bps"] for x in wallets["founders"]] == [5000,2500,2500],
            "three-founder vesting/compensation drift")
    for idx, key in enumerate(ROLE_IDS):
        row = alloc[key]
        founder = wallets["founders"][idx]
        require(row["amount_420"] == ROLE_AMOUNTS[idx], "founder liquid split drift")
        if founder["wallet_address"] is None:
            require(row["destination"] is None and
                    row.get("status") == "AWAITING_ADDRESS_SIGNATURE",
                    "unverified founder destination falsely funded")
        else:
            address = founder["wallet_address"]
            require(ADDRESS.fullmatch(address) and
                    address.lower() != ZERO and
                    not 0x41f <= int(address, 16) <= 0x4ff and
                    row["destination"] is not None and
                    row["destination"].lower() == address.lower(),
                    "founder Genesis destination/identity mismatch")
    reserve = alloc["protocol-reserve"]
    earmarks = reserve["earmarks_420"]
    require(reserve["amount_420"] == 8600000 and
            [earmarks.get(x) for x in ("founding_operations",
                                       "founding_contingency",
                                       "unearmarked_protocol_reserve")] ==
            [4200000, 840000, 3560000] and
            sum(earmarks.values()) == 8600000 and
            int(reserve["destination"],16) == 0x424,
            "8.6m Protocol Reserve earmark conservation failed")
    frozen = {x["name"]: x["address"].lower() for x in system["assignments"]}
    for key, slot in (("ProtocolReserve",0x424),("FounderVestingRegistry",0x427),
                      ("CommunityValidatorReserve",0x425),("CommunityRewardReserve",0x426),
                      ("RewardController",0x420),("GovernanceTimelock",0x429),
                      ("ProtocolRegistry",0x434)):
        require(int(frozen[key],16) == slot, "frozen system slot drift: " + key)
    require(integration["genesis"]["modeledTotalSupply"] == "42000000" and
            integration["budget"]["operationsTokens"] == "4200000" and
            integration["budget"]["contingencyTokens"] == "840000" and
            integration["founderFunding"]["fullySponsoredRewardBasisPoints"] == 1000 and
            integration["retirement"]["validatorEligibleOwnerMinimum"] == 60 and
            integration["retirement"]["committeeMemberMinimum"] == 15 and
            integration["retirement"]["continuousDays"] == 30,
            "founding Genesis, sponsorship or constitutional policies drift")
    return alloc


def check_consumers(root):
    """Verify seven distinct consumer boundaries from actual canonical configs.

    No consumer is declared live-qualified merely because its config parses.
    Registry and Indexer remain derived/discovery surfaces, never Civic authority.
    """
    wallet=read(root,"contracts/config/420wallet-genesis.json")
    registry=read(root,"contracts/config/420registry-genesis.json")
    explorer=read(root,"contracts/config/420explorer-genesis.json")
    treasury=read(root,"contracts/config/420treasury-genesis.json")
    stake=read(root,"contracts/config/predeploy/stake-genesis-config-v1.json")
    governance=read(root,"contracts/config/governance-deployment-v1.json")
    cross=read(root,"contracts/config/interfaces/governance-cross-protocol-integration.json")
    indexer=read(root,"420-indexer/package.json")
    require(wallet["walletCore"]["protocolDiscovery"] == "420Registry / ProtocolRegistry"
            and not wallet["canonicalStateAuthority"]
            and wallet["walletCore"]["createsIndependentWalletAuthority"] is False,
            "Wallet must use Registry discovery without acquiring Governance authority")
    require(registry["protocolVersion"] == 4
            and registry["authority"]["publisher"] == "GovernanceTimelock"
            and registry["authority"]["defaultDeny"]
            and registry["registration"]["strictPublicationRequiresRuntimeCode"],
            "Registry publication/runtime authority boundary drift")
    require(stake["chainId"] == 420
            and int(stake["addresses"]["validatorRegistry"],16) == 0x423
            and int(stake["addresses"]["rewardController"],16) == 0x420
            and int(stake["addresses"]["communityValidatorReserve"],16) == 0x425
            and stake["committee"]["minBondedEligible"] == 60
            and stake["committee"]["minActive"] == 15,
            "Stake source and constitutional owner thresholds drift")
    require(treasury["new_frozen_predeploy_required"] is False
            and "420Vault VAULT_TREASURY" in treasury["custody_model"]
            and treasury["vault_release_evidence_model"]["treasury_verifies_vault_release"] is False,
            "Treasury cannot claim new fixed address or self-verified custody")
    require(explorer["indexerConsumer"]["requiredChainId"] == 420
            and not explorer["canonicalStateAuthority"]
            and explorer["indexerConsumer"]["independentChainIngestion"] is False,
            "Explorer must be a derived 420Indexer consumer")
    require(indexer["name"] == "@420/indexer"
            and "tsc -p tsconfig.json" in indexer["scripts"]["build"]
            and (root/"420-indexer/src/protocol-decoder.ts").is_file()
            and (root/"420-indexer/src/protocol-projections.ts").is_file(),
            "canonical Indexer decoder or rebuild source missing")
    compiler=governance["compiler"]
    require(compiler["solidity"] == "0.8.24"
            and compiler["evmVersion"] == "cancun"
            and compiler["optimizer"] and compiler["optimizerRuns"] == 200
            and compiler["viaIR"]
            and {int(x["address"],16) for x in governance["fixedPredeploys"]} == {0x429,0x437},
            "Governance compiler or frozen bootstrap locations drift")
    require(governance["genesisBootstrapCommitment"]["status"] ==
            "GENESIS_RELEASE_INPUTS_PENDING_FAIL_CLOSED",
            "unapproved constitutional bootstrap promoted to live")
    found={x["name"]:x["classification"] for x in cross["integrations"]}
    expected={
        "420Registry":"deployment_and_consumer_discovery",
        "420Wallet":"transaction_client",
        "420Indexer":"derived_projection",
        "420Stake":"electorate_membership_source_only",
        "420Treasury":"governed_target_not_governance_authority",
        "420Explorer":"derived_consumer",
    }
    require(all(found.get(k) == v for k,v in expected.items()),
            "Governance cross-protocol authority classifications drift")
    return [
        {"name":name,"canonicalSourceBindingsChecked":True,
         "materializedV4DeploymentVerified":False,
         "sourceQualifiedOnly":True}
        for name in ("420Wallet","420Registry","420Indexer","420Stake",
                     "420Treasury","420Explorer","420Governance")
    ]

def make_candidate(root=ROOT, with_artifacts=True):
    root = Path(root)
    existing = read(root, FROZEN_CONFIG)
    require(existing["status"] == "FROZEN_V3" and
            existing["genesisConfigHash"].lower() ==
            "0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d",
            "historical V3 must remain explicitly frozen")
    ledger = read(root, "config/genesis-allocations.json")
    wallets = read(root, "contracts/config/founder-wallet-reservations.json")
    integration = read(root, "contracts/config/founding-genesis-integration-v1.json")
    system = read(root, "contracts/config/system-addresses.json")
    alloc = check_ledger(ledger, wallets, system, integration)
    inputs = [{"path":p, "gitBlobSha1":gitblob(root,p)} for p in AUTHORITY_PATHS]
    original = {x["path"]:x["gitBlobSha1"] for x in
                existing["commitmentPayload"]["authorityInputs"]}
    require(set(original).issubset(set(AUTHORITY_PATHS)),
            "unrecognized historical V3 authority input")
    changed = [p for p in original if original[p] != gitblob(root,p)]
    require("contracts/config/system-addresses.json" in changed and
            "config/genesis-allocations.json" in changed,
            "expected amended source authority inputs not present")
    payload = {
        "domain":"420/GENESIS/CONFIG/V4",
        "scope":"GENESIS_RESIDENT_CONTRACT_CONFIGURATION",
        "initializationVersion":1,
        "governanceTimelock":"0x0000000000000000000000000000000000000429",
        "protocolRegistry":"0x0000000000000000000000000000000000000434",
        "authorityInputs":inputs,
    }
    proposed_hash = keccak(root,payload)
    v4path = "contracts/config/candidates/genesis-config-commitment-v4-unsigned.json"
    proposed = read(root,v4path)
    require(proposed["schema"] == "420-genesis-v4-unsigned-source-candidate-v1"
            and proposed["status"] == "UNAPPROVED_NOT_FOR_GENESIS_EXECUTION"
            and proposed["commitmentPayload"] == payload
            and proposed["genesisConfigHash"].lower() == proposed_hash,
            "retained V4 candidate is stale, malformed or falsely approved")
    require(proposed["approvals"]["founderProofs"] == 0
            and proposed["approvals"]["independentGenesisApproval"] is False
            and proposed["approvals"]["liveDeploymentReceiptsVerified"] is False,
            "missing signatures cannot be represented as approved V4")
    components = []
    for name, short in MODULES:
        path = "contracts/src/" + short
        item = {"name":name, "source":path,
                "sourceGitBlobSha1":gitblob(root,path),
                "deploymentKind":"REGISTRY_RESOLVED_POST_GENESIS",
                "deployedAddress":None, "verifiedRuntimeCodeHash":None,
                "constructorBindingsVerified":False}
        if with_artifacts:
            a = root / "contracts/out" / (name + ".sol") / (name + ".json")
            require(a.is_file(), "missing actual compiled artifact: " + str(a.relative_to(root)))
            artifact = json.loads(a.read_text())
            creation = artifact["bytecode"]["object"]
            runtime = artifact["deployedBytecode"]["object"]
            require(all(isinstance(b,str) and b.startswith("0x") and len(b) > 4 and
                        re.fullmatch(r"0x[0-9a-fA-F]+",b) for b in (creation,runtime)),
                    "invalid unlinked Solidity artifact: " + name)
            layout=artifact.get("storageLayout")
            require(isinstance(layout,dict) and isinstance(layout.get("storage"),list)
                    and isinstance(layout.get("types"),dict),
                    "compiled storageLayout missing: "+name)
            item.update({
                "storageLayoutSha256":digest(layout),
                "constructorStorageVerified":False,
                "creationTemplateSha256":hashlib.sha256(bytes.fromhex(creation[2:])).hexdigest(),
                "runtimeTemplateSha256":hashlib.sha256(bytes.fromhex(runtime[2:])).hexdigest(),
                "abiSha256":digest(artifact["abi"]),
                "constructorInputTypes":[x["type"] for e in artifact["abi"]
                                         if e["type"] == "constructor"
                                         for x in e["inputs"]],
                "immutableReferences":artifact["deployedBytecode"].get("immutableReferences", {}),
            })
        components.append(item)
    return {
        "schema":"420-gov-pre-08-v4-source-candidate-v1",
        "status":"UNAPPROVED_SOURCE_CANDIDATE_NOT_DEPLOYED",
        "exactSourceCommit":git(root,"rev-parse","HEAD"),
        "historicalV3":{"sourcePath":FROZEN_CONFIG,
                        "hash":existing["genesisConfigHash"],
                        "gitBlobSha1":gitblob(root,FROZEN_CONFIG)},
        "proposedV4":{"commitmentPayload":payload,
                      "genesisConfigHash":proposed_hash,
                      "approvalSignatures":None,
                      "independentlyApproved":False},
        "sourceDriftFromV3":changed,
        "retainedUnsignedV4Source":v4path,
        "supply420":42000000,
        "founderFunding":[{"id":role,"amount420":amount,
                           "destination":alloc[role]["destination"],
                           "requiresIndependentSignature":True}
                          for role,amount in zip(ROLE_IDS,ROLE_AMOUNTS)],
        "fundingTransfers":[
            {"source":"ProtocolReserve@0x0424","destinationVaultId":None,
             "purpose":"OPERATIONS","amount420":4200000,"status":"NOT_TRANSFERRED"},
            {"source":"ProtocolReserve@0x0424","destinationVaultId":None,
             "purpose":"CONTINGENCY","amount420":840000,"status":"NOT_TRANSFERRED"},
        ],
        "unearmarkedProtocolReserve420":3560000,
        "founderVestingPredeploy":{"address":"0x0000000000000000000000000000000000000427",
                                  "locked420":500000, "verifiedGenesisBalance":False},
        "communityRewardReserve":"0x0000000000000000000000000000000000000426",
        "sponsoredRewardCommunityBasisPoints":1000,
        "components":components,
        "consumerIntegrations":check_consumers(root),
        "registrationsAndCapabilitiesVerified":False,
        "sourceBoundLiveGenesisReceipts":None,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",type=Path,default=ROOT)
    p.add_argument("--without-artifacts",action="store_true",
                   help="Check the authoritative inputs before compiling; never release ready")
    p.add_argument("--output",type=Path)
    p.add_argument("--require-release",action="store_true")
    args=p.parse_args()
    try:
        plan=make_candidate(args.root,not args.without_artifacts)
        if args.require_release:
            raise ValueError("V4 NOT APPROVED: independent signatures, real founder wallets, "
                             "live authenticated runtimes, registered Vaults, chain receipts "
                             "and source-bound Genesis authority are unavailable")
        output=json.dumps(plan,sort_keys=True,indent=2)+"\n"
        if args.output:
            target=args.output if args.output.is_absolute() else args.root/args.output
            require(not target.exists(),"refuse to overwrite retained candidate")
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(output)
        else:
            print(output,end="")
    except (ValueError,KeyError,OSError,subprocess.CalledProcessError,
            TypeError,IndexError) as exc:
        p.exit(1,"GOV-PRE-08 FAIL-CLOSED: "+str(exc)+"\n")

if __name__=="__main__":
    main()
