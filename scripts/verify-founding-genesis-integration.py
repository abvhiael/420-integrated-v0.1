#!/usr/bin/env python3
"""Founding Genesis release gate.

Structure mode is useful during development; --require-release MUST fail closed
until actual founder claims, Genesis wallets, native reward economics, custody
transfers and source-derived runtime/code identities have been qualified.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
PATH=ROOT/"contracts/config/founding-genesis-integration-v1.json"
WALLET=ROOT/"contracts/config/founder-wallet-reservations.json"
POLICY=ROOT/"contracts/config/treasury/founding-financial-policy-provisional.json"
SYSTEM=ROOT/"contracts/config/system-addresses.json"


def enforce(value, msg):
    if not value:
        raise ValueError(msg)


def qualify(strict=False):
    m=json.loads(PATH.read_text())
    wallets=json.loads(WALLET.read_text())
    p=json.loads(POLICY.read_text())
    system=json.loads(SYSTEM.read_text())
    enforce(m["schema"]=="420-founding-genesis-integration-v1","wrong schema")
    g=m["genesis"]
    enforce(g["modeledTotalSupply"]=="42000000","unexpected total supply")
    b=m["budget"]
    enforce(b["operationsTokens"]=="4200000" and b["contingencyTokens"]=="840000",
            "founding allocations are not the adopted provisional values")
    enforce(p["operations"]["allocation"]==b["operationsTokens"],"Operations budget disagreement")
    enforce(b["fundingSourceAllocationId"]=="protocol-reserve" and
            b["fundingSourcePredeploy"]=="0x0000000000000000000000000000000000000424" and
            b["unearmarkedProtocolReserveTokens"]=="3560000" and
            b["ledgerEarmarksReconciled"] is True,
            "founding Genesis earmark source not reconciled")
    enforce(p["contingency"]["allocation"]==b["contingencyTokens"],"contingency budget disagreement")
    enforce(int(b["operationsTokens"])+int(b["contingencyTokens"])<=int(g["modeledTotalSupply"]),
            "genesis money overallocated")
    subprocess.run([sys.executable,str(ROOT/"scripts/verify-founder-vesting-three.py")],check=True)
    vest=m["founderVesting"]
    enforce(vest["founderCount"]==3 and vest["genesisFounderTotal420"]=="1000000"
            and vest["lockedPredeploy420"]=="500000"
            and vest["liquidDirectToFounders420"]=="500000"
            and vest["vestingPredeploy"]=="0x0000000000000000000000000000000000000427"
            and vest["founderSharesBps"]==[5000,2500,2500]
            and [vest["releaseCount"],vest["releaseIntervalDays"],vest["vestingCompletesAfterDays"]]==[13,14,182],
            "three-founder Genesis vesting policy disagrees with Ledger")
    enforce(m["founderWallets"]["manifest"]=="contracts/config/founder-wallet-reservations.json",
            "wallet enrollment source mismatch")
    enforce([x["developer_compensation_bps"] for x in wallets["founders"]]==[5000,2500,2500],
            "wallet compensation split changed")
    c=m["developmentCompensation"]
    enforce([c["adminBps"],c["andrewBps"],c["janetBps"]]==[5000,2500,2500],
            "immutable compensation split mismatch")
    bindings={x["name"]:x["address"].lower() for x in system["assignments"]}
    enforce(m["founderFunding"]["sponsorBondPrincipalReserve"].lower()==bindings["CommunityValidatorReserve"],
            "protocol principal destination mismatch")
    enforce(m["founderFunding"]["sponsorRewardsDestination"].lower()==bindings["CommunityRewardReserve"],
            "10% community reward destination mismatch")
    enforce(m["founderFunding"]["fullySponsoredRewardBasisPoints"]==1000,"unexpected sponsor fee")
    t=m["retirement"]
    enforce([t["validatorEligibleOwnerMinimum"],t["committeeMemberMinimum"],t["continuousDays"]]==[60,15,30],
            "retirement constitutional thresholds drift")

    if strict:
        subprocess.run([sys.executable,str(ROOT/"scripts/verify-founder-vesting-three.py"),
                        "--require-release"],check=True)
        enforce(vest["predeployActuallyFunded"]
                and vest["liquidAllocationsActuallyFunded"]
                and vest["newFrozenGenesisCommitmentApproved"],
                "three-founder Genesis liquid/locked funding and new signed freeze unverified")
        subprocess.run([sys.executable,str(ROOT/"scripts/verify-founder-wallet-reservations.py"),
                        "--require-deployment"],check=True)
        enforce(g["network"] in ("mainnet","testnet") and g["chainId"]>0,"target network or chain missing")
        enforce(g["approvedGenesisHash"] and g["exactRuntimeManifestHash"],
                "unapproved chain genesis or runtime manifest")
        enforce(wallets["planned_genesis_hash"].lower()==g["approvedGenesisHash"].lower(),
                "founder wallet signatures not bound to approved Genesis")
        enforce(all([b["supplyReconciled"],b["allThreeFunded"],
            b["operationsVaultId"],b["contingencyVaultId"],b["communityVaultId"]]),
            "founding/contingency/community vaults not reconciled and funded")
        # Validate actual finalized on-chain ownership, not an untrusted JSON boolean.
        import os
        rpc_url=os.environ.get("FOUNDER_CLAIM_RPC_URL")
        enforce(bool(rpc_url),"FOUNDER_CLAIM_RPC_URL required for authenticated on-chain founder claims")
        subprocess.run([sys.executable,str(ROOT/"scripts/verify-founder-wallet-reservations.py"),
                        "--require-claims","--rpc-url",rpc_url],check=True)
        enforce(m["founderWallets"]["allThreeOwnershipProofsVerified"]
                and m["founderWallets"]["claimRegistryAddress"]
                and m["founderWallets"]["allThreeOnChainClaimsVerified"],
                "actual founder claims unavailable")
        f=m["founderFunding"]
        enforce(all(f[k] for k in ["treasuryAuthorityAddress","communityCommitteeAddress",
                                  "retirementVerifierAddress","communitySweepAddress","sponsorAuthorityAddress"]),
                "required on-chain founding module not deployed")
        enforce(c["splitterAddress"] and c["developmentCompensationVaultAddress"]
                and c["immutableDevelopmentCompensationBeneficiaryIsSplitter"],
                "50/25/25 development routing not immutable in live deployment")
        enforce(t["witnessProofsVerified"] and t["communityVaultRouteGrantRegistered"]
                and t["unspentCustodyActuallyTransferred"] and t["retirementOperationalEvidence"],
                "retirement custody and witnesses incomplete")
        rewards=m["rewards"]
        enforce(not rewards["consensusGatewaySupportsPayableRewardFunding"]
                and rewards["communityBackingMethod"] == "GETH_CONSENSUS_STATE_CREDIT_EXACT_REALIZED_BEFORE_ZERO_VALUE_SYSTEM_CALL"
                and rewards["nativeIssuerPatchVerified"]
                and rewards["nativeRewardPayoutsVerifiedOnTestnet"]
                and rewards["actualCommunitySettlementVerified"]
                and rewards["predeployRuntimeRequalified"]
                and rewards["consensusIndexerReconciliationRequalified"],
                "10% reward payout is not fully supported by canonical consensus and accounting")
        enforce(m["governance"]["postGenesisInitialElectorateEnrollmentOperational"]
                and m["governance"]["genesisGraphCommitmentFrozen"],
                "postGenesis electorate enrollment not onchain-qualified")
        z=m["signoff"]
        enforce(z["signedGenesisPlanHash"] and z["exactHeadQualificationHash"]
                and z["independentSecurityReview"],"Genesis governance/security release signoff missing")
    return "release-ready" if strict else "candidate structure only"


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--require-release",action="store_true")
    args=parser.parse_args()
    try:
        status=qualify(args.require_release)
    except (ValueError,KeyError,TypeError,AssertionError,subprocess.CalledProcessError) as e:
        print(f"founding genesis integration: FAIL-CLOSED: {e}",file=sys.stderr)
        raise SystemExit(1)
    print(f"founding genesis integration: {status}; no unstated Genesis allocation or live release approval")
