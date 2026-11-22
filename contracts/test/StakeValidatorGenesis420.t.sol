// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";
import "../src/system/CommunityValidatorReserve.sol";
import "../src/system/CommunityRewardReserve.sol";
import "../src/treasury/FoundingValidatorSponsorship420.sol";
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/apps/Stake420.sol";
import "../src/interfaces/genesis/ISystemSafety420.sol";
import "../src/interfaces/genesis/Types420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmStakeValidatorGenesis420 {
    function prank(address msgSender) external;
    function roll(uint256 newHeight) external;
    function deal(address account, uint256 newBalance) external;
    function etch(address account, bytes calldata code) external;
}

/// @dev Synthetic canonical 0x0423 owner checker for reward accounting only.
contract SponsoredOwnerProbe420 {
    function isFullyProtocolSponsoredOwner(address owner) external pure returns (bool) {
        return owner == address(0xABCD);
    }
}

/// @dev Only a test-double for the reserved canonical 0x0436 identity interface.
/// Production must query the actual governance-approved Identity420 credential issuer.
contract SponsorshipIdentity420Mock {
    mapping(bytes32 => address) public ownerOf;
    mapping(bytes32 => bytes32) public subjectOf;
    mapping(bytes32 => bytes32) public groupOf;
    mapping(bytes32 => bool) public trustOf;
    function configure(bytes32 profileId,address beneficiary,bytes32 credentialId,
                       bytes32 beneficialOwnerGroup,bool valid) external {
        ownerOf[profileId]=beneficiary;
        subjectOf[credentialId]=profileId;
        groupOf[credentialId]=beneficialOwnerGroup;
        trustOf[credentialId]=valid;
    }
    function profiles(bytes32 profileId) external view returns (
        address,address,bytes32,bytes32,uint64,uint64,bool
    ) {return (ownerOf[profileId],address(0),bytes32(0),bytes32(0),1,1,ownerOf[profileId]!=address(0));}
    function credentials(bytes32 credentialId) external view returns (
        bytes32,bytes32,bytes32,bytes32,uint64,uint64,uint64,bool
    ) {return (keccak256("governance-attested-issuer"),subjectOf[credentialId],
               keccak256("420/STAKE/FULL_SPONSOR_BENEFICIAL_OWNER/V1"),
               groupOf[credentialId],1,0,0,false);}
    function credentialMeetsTrust(bytes32 credentialId,uint8 minimum) external view returns (bool) {
        return trustOf[credentialId] && minimum==2;
    }
}

contract FoundingSponsorRetirementStatus420 {
    bool public retired;
    function setRetired(bool value) external { retired = value; }
}

contract StakeValidatorGenesis420Test {
    VmStakeValidatorGenesis420 internal constant vm = VmStakeValidatorGenesis420(address(uint160(uint256(keccak256("hevm cheat code")))));
    ValidatorRegistry internal registry;
    RewardController internal rewards;
    CommunityValidatorReserve internal reserve;
    Stake420 internal stake;
    GenesisMockEnvironment420 internal env;
    address internal constant SYSTEM_CALLER = 0x000000000000000000000000000000000000043C;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        registry = new ValidatorRegistry(address(this), address(env.registry()), keccak256("stake-test-genesis"));
        rewards = new RewardController(address(this));
        reserve = new CommunityValidatorReserve(address(this));
        registry.bindConsensusSystemCaller(SYSTEM_CALLER);
        rewards.bindConsensusSystemCaller(SYSTEM_CALLER);
        registry.bindCommunityValidatorReserve(address(reserve));
        reserve.bindValidatorRegistry(address(registry));
        vm.deal(address(reserve), reserve.GENESIS_RESERVE());
        stake = new Stake420(address(registry), address(rewards));
    }

    function testStakeGenesisInitializationIntrospection() public view {
        bytes32 expected = keccak256("stake-test-genesis");
        require(registry.genesisInitialized(), "stake genesis not initialized");
        require(registry.initializationVersion() == 1, "stake init version");
        require(registry.genesisConfigHash() == expected, "stake config hash");
        require(registry.assertGenesisConfiguration(expected), "stake config assertion");
        require(!registry.assertGenesisConfiguration(keccak256("wrong")), "wrong stake config accepted");
        require(registry.stakeProtocolRegistry() == address(env.registry()), "stake registry binding");
    }

    function testGenesisBondLifecycleAndDelegationPolicy() public view {
        require(registry.EFFECTIVE_BOND() == 42_000 ether, "effective bond");
        require(registry.MIN_OWNED_BOND() == 0, "owned floor");
        require(registry.MAX_PROTOCOL_CREDIT() == 42_000 ether, "credit cap");
        require(registry.ACTIVATION_DELAY_BLOCKS() == 17_640, "activation delay");
        require(registry.EXIT_NOTICE_ROTATIONS() == 1, "exit notice");
        require(registry.WITHDRAWAL_DELAY_BLOCKS() == 105_840, "withdrawal delay");
        require(registry.COOLDOWN_ROTATIONS() == 3, "cooldown");
        require(!stake.delegationEnabled(), "delegation disabled");
        require(!stake.stakeWeightedVotingEnabled(), "stake voting disabled");
    }

    function testSelfFundedRegistrationLocksReal420() public {
        (bytes32 id,) = _registerSelfFunded("self", 1);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 42_000 ether && v.protocolCredit == 0, "composition");
        require(address(registry).balance == 42_000 ether, "registry custody");
        require(registry.totalOwnedCustody() == 42_000 ether, "owned custody");
        _assertSolvent();
    }

    function testMatchedRegistrationMovesRealReserveCredit() public {
        (bytes32 id, address operator) = _matchedId("matched", 2);
        uint256 reserveBefore = address(reserve).balance;
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        require(address(reserve).balance == reserveBefore - 21_000 ether, "reserve funded");
        require(registry.pendingProtocolCredit(id) == 21_000 ether, "pending credit");
        _completeMatchedRegistration(id, operator, 2);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 21_000 ether && v.protocolCredit == 21_000 ether, "matched composition");
        require(address(registry).balance == 42_000 ether, "real effective bond");
        require(registry.totalPendingProtocolCredit() == 0, "pending consumed");
        _assertSolvent();
    }

    function testInitialBondCompositionCannotArbitrarilyMixProtocolCredit() public {
        (bytes32 id,address operator)=_matchedId("unapproved-credit-composition",146);
        reserve.assignCredit(id,operator,40_000 ether);
        reserve.fundCredit(id);
        vm.deal(operator,2_000 ether);
        vm.prank(operator);
        (bool bypass,) = address(registry).call{value:2_000 ether}(
            abi.encodeCall(registry.register,(id,_pubkey(146),operator,keccak256("not-21-21")))
        );
        require(!bypass,"unapproved 2K personal/40K matched credit created validator");
        require(registry.pendingProtocolCredit(id)==40_000 ether,
                "rejected registration consumed protocol-owned collateral");
        require(registry.ownerValidatorId(operator)==bytes32(0),
                "rejected composition reserved beneficiary identity");
        registry.getValidator(id); // no registration side effects
        _assertSolvent();
    }

    function testFullySponsoredRewardCreditsCommunityTenPercent() public {
        SponsoredOwnerProbe420 probe = new SponsoredOwnerProbe420();
        vm.etch(address(0x0000000000000000000000000000000000000423), address(probe).code);
        vm.roll(999);
        CommunityRewardReserve rewardReserve = new CommunityRewardReserve(address(this));
        vm.etch(rewards.COMMUNITY_REWARD_RESERVE(), address(rewardReserve).code);
        vm.deal(address(rewards), 150 ether);
        address[] memory participants = new address[](1);
        participants[0] = address(0xBEEF);
        vm.prank(SYSTEM_CALLER);
        rewards.applyConsensusReward(
            uint64(block.number), address(0xABCD), participants, 100 ether, 50 ether, 0, 0
        );
        require(rewards.validatorAccrued(address(0xABCD)) == 90 ether, "operator nets 90 pct");
        require(rewards.validatorAccrued(address(0xBEEF)) == 50 ether, "ordinary validator unaffected");
        require(rewards.communityRewardAccrued() == 10 ether, "community accrues 10 pct");
        require(rewards.validatorAccrued(rewards.COMMUNITY_REWARD_RESERVE()) == 10 ether,
            "community reward destination accrued");
        require(rewards.grossSecurityIssued() == 150 ether, "no issuance changes");
        require(address(0xABCD).balance == 90 ether && address(0xBEEF).balance == 50 ether,
                "native operator gross-to-net payout not settled");
        require(rewards.COMMUNITY_REWARD_RESERVE().balance == 10 ether,
                "native community settlement missing");
        require(rewards.communityRewardBackingReceived() == 10 ether
                && rewards.communityRewardSettled() == 10 ether
                && rewards.nativeRewardPaid() == 150 ether
                && address(rewards).balance == 0, "actual reward issuance conservation");
    }

    function testFullSponsorshipRequiresAuthenticatedOneShotBindingAndRetirement() public {
        FoundingSponsorRetirementStatus420 status = new FoundingSponsorRetirementStatus420();
        FoundingWalletClaims420 walletClaims = new FoundingWalletClaims420(
            address(this), address(0xA22), address(0xA33), keccak256("approved-genesis")
        );
        FoundingValidatorSponsorship420 sponsor = new FoundingValidatorSponsorship420(
            address(this), address(walletClaims), address(status), address(reserve), address(registry)
        );
        SponsorshipIdentity420Mock identity = new SponsorshipIdentity420Mock();
        vm.etch(sponsor.IDENTITY_420(), address(identity).code);
        SponsorshipIdentity420Mock canonical = SponsorshipIdentity420Mock(sponsor.IDENTITY_420());

        (bytes32 id,address operator) = _matchedId("approved-sponsor",97);
        bytes32 profile = keccak256("independent-beneficiary-profile");
        bytes32 credential = keccak256("issuer-verified-one-beneficial-owner");
        bytes32 group = keccak256("one-real-control-group");
        canonical.configure(profile,operator,credential,group,true);
        bytes32 purpose = sponsor.purposeFor(id,operator,profile,credential,group);

        (bool legacy,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFully, (id,operator,purpose))
        );
        require(!legacy,"unverified legacy sponsorship bypassed identity credential");
        (bool beforeBinding,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,operator,profile,credential,purpose))
        );
        require(!beforeBinding,"unbound sponsor funded validator");
        reserve.bindGenesisFoundingSponsorAuthority(address(sponsor));
        (bool unclaimed,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,operator,profile,credential,purpose))
        );
        require(!unclaimed,"unclaimed founder sponsored validator");
        walletClaims.claimFounderWallet();
        (bool rebind,) = address(reserve).call(
            abi.encodeCall(reserve.bindGenesisFoundingSponsorAuthority,(address(this)))
        );
        require(!rebind,"one-shot authority rebound");

        vm.prank(operator);
        (bool selfApproved,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,operator,profile,credential,purpose))
        );
        require(!selfApproved,"beneficiary authorized own sponsorship");

        uint256 before = address(reserve).balance;
        sponsor.sponsorFullyVerified(id,operator,profile,credential,purpose);
        require(address(reserve).balance==before-42_000 ether,"community reserve not debited");
        require(registry.pendingProtocolCredit(id)==42_000 ether,"real collateral not received");
        require(sponsor.sponsoredIdentityGroup(group) && sponsor.sponsorCount()==1,
                "independently attested control group not reserved");
        (bool duplicate,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,operator,profile,credential,purpose))
        );
        require(!duplicate,"replayed sponsored validator funding");
        vm.prank(operator);
        registry.register{value:0}(id,_pubkey(97),operator,purpose);
        require(registry.isFullyProtocolSponsoredOwner(operator),"sponsored reward-origin flag");
        require(registry.custodyInvariant() && reserve.reserveInvariant(),"collateral insolvency");

        status.setRetired(true);
        (bytes32 nextId,address other) = _matchedId("retired-sponsor",98);
        bytes32 secondProfile=keccak256("retired-profile"), secondCredential=keccak256("retired-credential");
        bytes32 secondGroup=keccak256("independent-group");
        canonical.configure(secondProfile,other,secondCredential,secondGroup,true);
        (bool retiredSponsor,) = address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(
                nextId,other,secondProfile,secondCredential,
                sponsor.purposeFor(nextId,other,secondProfile,secondCredential,secondGroup)
            ))
        );
        require(!retiredSponsor,"retired founder sponsored validator");
    }

    function testSponsorshipRejectsForgedIdentityWrongPurposeAndSharedBeneficialOwner() public {
        FoundingSponsorRetirementStatus420 status=new FoundingSponsorRetirementStatus420();
        FoundingWalletClaims420 claims=new FoundingWalletClaims420(
            address(this),address(0xA22),address(0xA33),keccak256("approved-genesis")
        );
        FoundingValidatorSponsorship420 sponsor=new FoundingValidatorSponsorship420(
            address(this),address(claims),address(status),address(reserve),address(registry)
        );
        SponsorshipIdentity420Mock identity=new SponsorshipIdentity420Mock();
        vm.etch(sponsor.IDENTITY_420(),address(identity).code);
        SponsorshipIdentity420Mock canonical=SponsorshipIdentity420Mock(sponsor.IDENTITY_420());
        claims.claimFounderWallet();
        reserve.bindGenesisFoundingSponsorAuthority(address(sponsor));

        (bytes32 id,address owner)=_matchedId("proof-one",131);
        bytes32 profile=keccak256("proof-one-profile"),cred=keccak256("proof-one-cred");
        bytes32 group=keccak256("common-owner-group");
        canonical.configure(profile,owner,cred,group,false);
        bytes32 purpose=sponsor.purposeFor(id,owner,profile,cred,group);
        (bool untrusted,) =address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,owner,profile,cred,purpose))
        );
        require(!untrusted,"untrusted identity sponsor approved");
        canonical.configure(profile,owner,cred,group,true);
        (bool forgedPurpose,) =address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id,owner,profile,cred,keccak256("fake-purpose")))
        );
        require(!forgedPurpose,"unbound purpose approved");
        sponsor.sponsorFullyVerified(id,owner,profile,cred,purpose);

        (bytes32 id2,address aliasOwner)=_matchedId("proof-alias",132);
        bytes32 profile2=keccak256("alias-profile"),cred2=keccak256("alias-cred");
        canonical.configure(profile2,aliasOwner,cred2,group,true);
        (bool sharedGroup,) =address(sponsor).call(
            abi.encodeCall(sponsor.sponsorFullyVerified,(id2,aliasOwner,profile2,cred2,
                sponsor.purposeFor(id2,aliasOwner,profile2,cred2,group)))
        );
        require(!sharedGroup,"second wallet of same beneficial owner received full sponsorship");
        require(sponsor.sponsorCount()==1 && registry.pendingProtocolCredit(id2)==0,
                "rejected identity sponsor altered reserve funds");
    }

    function testActualCommunityRewardsRequireExactNativeBackingAndCannotDoubleSettle() public {
        SponsoredOwnerProbe420 probe = new SponsoredOwnerProbe420();
        vm.etch(address(0x0000000000000000000000000000000000000423), address(probe).code);
        CommunityRewardReserve canonical = new CommunityRewardReserve(address(this));
        vm.etch(rewards.COMMUNITY_REWARD_RESERVE(), address(canonical).code);
        vm.roll(1001);
        address[] memory participants = new address[](0);
        vm.prank(SYSTEM_CALLER);
        (bool unbacked,) = address(rewards).call(
            abi.encodeCall(rewards.applyConsensusReward, (
                uint64(block.number), address(0xABCD), participants,
                uint256(100 ether), uint256(0), uint256(0), uint256(0)
            ))
        );
        require(!unbacked, "virtual accrual accepted without physical node420 backing");
        // One unsolicited native unit simulates forced ETH (SELFDESTRUCT). Geth
        // verifies that the exact 100 newly issued units are distributed and
        // the pre-existing unit remains unspent, rather than halting consensus.
        vm.deal(address(rewards), 101 ether);
        vm.prank(SYSTEM_CALLER);
        rewards.applyConsensusReward(uint64(block.number), address(0xABCD), participants,
            100 ether, 0, 0, 0);
        require(rewards.communityRewardAccrued() == 10 ether &&
                rewards.communityRewardBackingReceived() == 10 ether &&
                rewards.communityRewardSettled() == 10 ether,
                "reserve accrued/physical funds not reconciled");
        require(address(0xABCD).balance == 90 ether &&
                rewards.COMMUNITY_REWARD_RESERVE().balance == 10 ether &&
                address(rewards).balance == 1 ether && rewards.nativeRewardPaid() == 100 ether,
                "node420 backing did not atomically pay 90/10");

        vm.deal(SYSTEM_CALLER, 10 ether);
        vm.prank(SYSTEM_CALLER);
        (bool manual,) = address(rewards).call{value: 10 ether}(
            abi.encodeCall(rewards.fundCommunityRewardBacking, ())
        );
        require(!manual, "obsolete manual consensus-funding route was re-enabled");
        (bool repeated,) = address(rewards).call(
            abi.encodeCall(rewards.settleCommunityRewards, (10 ether))
        );
        require(!repeated, "second community settlement path permitted double payment");
        vm.prank(SYSTEM_CALLER);
        (bool duplicate,) = address(rewards).call(
            abi.encodeCall(rewards.applyConsensusReward, (
                uint64(block.number), address(0xABCD), participants,
                uint256(100 ether), uint256(0), uint256(0), uint256(0)
            ))
        );
        require(!duplicate, "same execution block issued native reward twice");
    }

    function testFullySponsoredValidatorPrincipalIsNeverOwnedByOperator() public {
        (bytes32 id, address operator) = _matchedId("full-sponsored", 77);
        uint256 originalReserve = address(reserve).balance;
        reserve.assignCredit(id, operator, 42_000 ether);
        reserve.fundCredit(id);
        vm.prank(operator);
        registry.register{value: 0}(id, _pubkey(77), operator, keccak256("full-sponsored"));
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.owner == operator && v.ownedBond == 0 && v.protocolCredit == 42_000 ether, "full credit");
        require(registry.isFullyProtocolSponsoredOwner(operator), "sponsor identity");
        require(address(reserve).balance == originalReserve - 42_000 ether, "actual reserve deposit");
        require(registry.totalProtocolCreditCustody() == 42_000 ether, "custody");
        require(registry.custodyInvariant(), "solvent");

        vm.deal(operator, 10_000 ether);
        vm.prank(operator);
        registry.replaceProtocolCredit{value: 10_000 ether}(id);
        v = registry.getValidator(id);
        require(v.ownedBond == 10_000 ether && v.protocolCredit == 32_000 ether, "replacement");
        require(address(reserve).balance == originalReserve - 32_000 ether, "return to community");
        require(registry.isFullyProtocolSponsoredOwner(operator), "sponsor share persists while credit remains");
        vm.deal(operator, 32_000 ether);
        vm.prank(operator);
        registry.replaceProtocolCredit{value: 32_000 ether}(id);
        require(!registry.isFullyProtocolSponsoredOwner(operator), "share ends when fully self funded");
        require(address(reserve).balance == originalReserve, "entire sponsor credit returned");
        require(registry.custodyInvariant(), "post-replacement solvency");
    }

    function testAssignedReserveCollateralCannotBeTreasurySpent() public {
        (bytes32 id, address operator) = _matchedId("encumbered", 3);
        reserve.assignCredit(id, operator, 21_000 ether);
        uint256 available = reserve.unencumberedBalance();
        (bool ok,) = address(reserve).call(abi.encodeWithSelector(reserve.treasuryTransfer.selector, payable(address(0xBEEF)), available + 1, keccak256("overspend")));
        require(!ok, "assigned collateral protected");
        _assertSolvent();
    }

    function testUnregisteredFundedCreditCanBeReclaimed() public {
        (bytes32 id, address operator) = _matchedId("reclaim", 4);
        uint256 before = address(reserve).balance;
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        reserve.reclaimUnregisteredCredit(id);
        require(address(reserve).balance == before, "reserve restored");
        require(registry.pendingProtocolCredit(id) == 0, "pending cleared");
        require(reserve.assignedCredit(id) == 0 && reserve.fundedCredit(id) == 0, "assignment cleared");
        _assertSolvent();
    }

    function testProtocolCreditReplacementReturnsValueToReserve() public {
        (bytes32 id, address operator) = _registerMatched("replace", 5);
        uint256 reserveBefore = address(reserve).balance;
        vm.deal(operator, 10_000 ether);
        vm.prank(operator);
        registry.replaceProtocolCredit{value: 10_000 ether}(id);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 31_000 ether && v.protocolCredit == 11_000 ether, "replacement composition");
        require(address(reserve).balance == reserveBefore + 10_000 ether, "credit recycled");
        require(reserve.assignedCredit(id) == 11_000 ether && reserve.fundedCredit(id) == 11_000 ether, "reserve sync");
        _assertSolvent();
    }

    function testConsensusSystemCallerIsOneTimeAndGovernanceCannotForgeOutcome() public {
        (bool rebind,) = address(registry).call(abi.encodeWithSelector(registry.bindConsensusSystemCaller.selector, address(0xBAD)));
        require(!rebind, "one-time bind");
        (bytes32 id,) = _registerSelfFunded("authority", 6);
        (bool forged,) = address(registry).call(abi.encodeWithSelector(registry.applyConsensusState.selector, id, ValidatorRegistry.Status.PROBATION, uint64(1), uint64(0), uint64(0), uint64(0)));
        require(!forged, "governance cannot forge consensus state");
    }

    function testActivationRequiresOneFullRotationAndFullBond() public {
        (bytes32 id,) = _registerSelfFunded("activation", 7);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        vm.prank(SYSTEM_CALLER);
        (bool early,) = address(registry).call(abi.encodeWithSelector(registry.applyConsensusState.selector, id, ValidatorRegistry.Status.ELIGIBLE, uint64(2), uint64(1), uint64(0), uint64(0)));
        require(!early, "activation delay");
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        require(registry.eligibleValidatorCount() == 1, "eligible");
    }

    function testSystemSafetyBlocksNewActivationOutsideNormal() public {
        (bytes32 id,) = _registerSelfFunded("safety-activation", 14);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        vm.prank(SYSTEM_CALLER);
        (bool activated,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!activated, "HALTED safety admitted activation");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "failed activation mutated status");

        env.safety().setState(ISystemSafety420.SafetyState.NORMAL);
        _state(id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ACTIVE, "normal activation failed");
    }

    function testStakeSafetyFailsClosedOnInactiveOrCodeHashMismatch() public {
        (bytes32 id,) = _registerSelfFunded("safety-registry", 15);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);

        bytes32 systemSafetyId = keccak256("420/APP/SYSTEM_SAFETY");
        env.registry().setLifecycle(systemSafetyId, Types420.Lifecycle.PAUSED);
        vm.prank(SYSTEM_CALLER);
        (bool inactiveAccepted,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!inactiveAccepted, "inactive SystemSafety accepted");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "inactive safety mutated state");

        env.registry().setLifecycle(systemSafetyId, Types420.Lifecycle.ACTIVE);
        env.registry().setCodeHash(systemSafetyId, keccak256("wrong-runtime-hash"));
        vm.prank(SYSTEM_CALLER);
        (bool hashMismatchAccepted,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applyConsensusState.selector,
                id,
                ValidatorRegistry.Status.ACTIVE,
                uint64(3),
                uint64(1),
                uint64(4),
                uint64(0)
            )
        );
        require(!hashMismatchAccepted, "code-hash mismatch accepted");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.ELIGIBLE, "hash mismatch mutated state");
    }

    function testCooldownIsBondedButNotSelectionEligible() public {
        (bytes32 id,) = _registerSelfFunded("cooldown", 12);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        _state(id, ValidatorRegistry.Status.ACTIVE, 3, 1, 4, 0);
        for (uint64 rotation = 1; rotation <= 4; ++rotation) _snapshot(rotation, 1);
        _state(id, ValidatorRegistry.Status.NORMAL_COOLDOWN, 4, 1, 4, 7);
        require(registry.eligibleValidatorCount() == 0, "cooldown selection eligibility");
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond + v.protocolCredit == 42_000 ether, "cooldown bond custody");
    }

    function testProportionalSlashMovesOwnedValueAndRecyclesCredit() public {
        (bytes32 id,) = _registerMatched("slash", 8);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        uint256 protocolReserveBefore = registry.PROTOCOL_RESERVE().balance;
        uint256 communityBefore = address(reserve).balance;
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(id, ValidatorRegistry.SlashOffense.DOUBLE_VOTE, 0, 1_000 ether, 1_000 ether, keccak256("double-vote-proof"), ValidatorRegistry.Status.SUSPENDED);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 20_000 ether && v.protocolCredit == 20_000 ether, "composition slashed");
        require(registry.PROTOCOL_RESERVE().balance == protocolReserveBefore + 1_000 ether, "owned slash routed");
        require(address(reserve).balance == communityBefore + 1_000 ether, "credit recycled");
        require(reserve.assignedCredit(id) == 20_000 ether, "reserve assignment reduced");
        _assertSolvent();
    }

    function testDuplicateSlashEvidenceCannotChargeTwice() public {
        (bytes32 id,) = _registerMatched("slash-replay", 13);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        bytes32 evidenceHash = keccak256("same-finalized-evidence");
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(
            id,
            ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
            0,
            1_000 ether,
            1_000 ether,
            evidenceHash,
            ValidatorRegistry.Status.SUSPENDED
        );

        ValidatorRegistry.Validator memory once = registry.getValidator(id);
        uint256 protocolReserveAfterFirst = registry.PROTOCOL_RESERVE().balance;
        uint256 communityAfterFirst = address(reserve).balance;

        vm.prank(SYSTEM_CALLER);
        (bool replayed,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applySlash.selector,
                id,
                ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
                uint8(0),
                uint256(1_000 ether),
                uint256(1_000 ether),
                evidenceHash,
                ValidatorRegistry.Status.SUSPENDED
            )
        );
        require(!replayed, "duplicate evidence replayed");

        ValidatorRegistry.Validator memory afterReplay = registry.getValidator(id);
        require(afterReplay.ownedBond == once.ownedBond && afterReplay.protocolCredit == once.protocolCredit, "replay changed collateral");
        require(afterReplay.totalSlashed == once.totalSlashed, "replay changed slash accounting");
        require(registry.PROTOCOL_RESERVE().balance == protocolReserveAfterFirst, "replay moved owned slash");
        require(address(reserve).balance == communityAfterFirst, "replay moved protocol credit");
        require(registry.slashEvidenceApplied(evidenceHash), "evidence not recorded");
        _assertSolvent();
    }

    function testFinalityEquivocationConsumesOwnedAndRevokesAllCredit() public {
        (bytes32 id,) = _registerMatched("finality", 9);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        vm.prank(SYSTEM_CALLER);
        registry.applySlash(id, ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION, 2, 21_000 ether, 21_000 ether, keccak256("conflicting-finality-proof"), ValidatorRegistry.Status.SUSPENDED);
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        require(v.ownedBond == 0 && v.protocolCredit == 0, "all collateral removed");
        require(reserve.assignedCredit(id) == 0 && reserve.fundedCredit(id) == 0, "all credit recycled");
        require(registry.totalOwnedCustody() == 0 && registry.totalProtocolCreditCustody() == 0, "custody cleared");
        _assertSolvent();
    }

    function testExitWithdrawalReturnsOwnedAndRecyclesCredit() public {
        (bytes32 id, address operator) = _registerMatched("exit", 10);
        address withdrawal = address(uint160(uint256(uint160(operator)) + 0x10000));
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        _rollPastActivation(id);
        _state(id, ValidatorRegistry.Status.ELIGIBLE, 2, 1, 0, 0);
        _snapshot(1, 1);
        vm.prank(SYSTEM_CALLER);
        registry.applyExitNotice(id, 1);
        _snapshot(2, 1);
        _state(id, ValidatorRegistry.Status.WITHDRAWAL_HOLD, 3, 1, 0, 0);
        ValidatorRegistry.Validator memory held = registry.getValidator(id);
        vm.roll(held.withdrawableBlock);
        _state(id, ValidatorRegistry.Status.WITHDRAWABLE, 4, 1, 0, 0);
        uint256 withdrawalBefore = withdrawal.balance;
        uint256 reserveBefore = address(reserve).balance;

        env.safety().setAllowed(false);
        vm.prank(withdrawal);
        (bool blocked,) = address(registry).call(abi.encodeWithSelector(registry.withdrawBond.selector, id));
        require(!blocked, "withdrawal ignored SystemSafety denial");
        require(registry.getValidator(id).status == ValidatorRegistry.Status.WITHDRAWABLE, "blocked withdrawal mutated status");

        env.safety().setAllowed(true);
        env.safety().setState(ISystemSafety420.SafetyState.HALTED);
        vm.prank(withdrawal);
        registry.withdrawBond(id);
        ValidatorRegistry.Validator memory exited = registry.getValidator(id);
        require(exited.status == ValidatorRegistry.Status.EXITED, "exited");
        require(withdrawal.balance == withdrawalBefore + 21_000 ether, "owned returned");
        require(address(reserve).balance == reserveBefore + 21_000 ether, "credit recycled");
        require(registry.totalOwnedCustody() == 0 && registry.totalProtocolCreditCustody() == 0, "custody empty");
        _assertSolvent();
    }

    function testStakeFacadeReportsCollateralSolvency() public {
        (bytes32 id,) = _registerMatched("facade", 11);
        (uint256 owned, uint256 credit, uint256 effective, uint256 slashed) = stake.validatorBondComposition(id);
        require(owned == 21_000 ether && credit == 21_000 ether && effective == 42_000 ether && slashed == 0, "facade composition");
        (uint256 totalOwned, uint256 totalCredit, uint256 pending, bool solvent) = stake.collateralTotals();
        require(totalOwned == 21_000 ether && totalCredit == 21_000 ether && pending == 0 && solvent, "facade custody");
    }

    function testConsensusRewardAppliesOncePerExecutionBlock() public {
        vm.roll(100);
        vm.deal(address(rewards), 21 ether);
        address proposer = address(0x5100);
        address[] memory participants = new address[](2);
        participants[0] = address(0x5101);
        participants[1] = address(0x5102);

        vm.prank(SYSTEM_CALLER);
        rewards.applyConsensusReward(100, proposer, participants, 10 ether, 2 ether, 3 ether, 4 ether);
        require(rewards.rewardApplied(100), "reward block not recorded");
        require(rewards.validatorAccrued(proposer) == 10 ether, "proposer accrual");
        require(rewards.validatorAccrued(participants[0]) == 2 ether, "participant accrual");

        uint256 securityOnce = rewards.grossSecurityIssued();
        vm.prank(SYSTEM_CALLER);
        (bool replayed,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(100),
                proposer,
                participants,
                uint256(10 ether),
                uint256(2 ether),
                uint256(3 ether),
                uint256(4 ether)
            )
        );
        require(!replayed, "reward replayed");
        require(rewards.grossSecurityIssued() == securityOnce, "replay changed issuance");
    }

    function testConsensusRewardRejectsWrongBlockAndDuplicateParticipants() public {
        vm.roll(200);
        address proposer = address(0x5200);
        address[] memory one = new address[](1);
        one[0] = address(0x5201);

        vm.prank(SYSTEM_CALLER);
        (bool wrongBlock,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(199),
                proposer,
                one,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!wrongBlock, "wrong reward block accepted");

        address[] memory duplicate = new address[](2);
        duplicate[0] = address(0x5201);
        duplicate[1] = address(0x5201);
        vm.prank(SYSTEM_CALLER);
        (bool duplicateAccepted,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(200),
                proposer,
                duplicate,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!duplicateAccepted, "duplicate participant accepted");
        require(!rewards.rewardApplied(200), "invalid reward marked applied");
    }

    function testConsensusRewardRejectsZeroProposerZeroParticipantProposerParticipantAndOversizedSet() public {
        vm.roll(201);
        address proposer = address(0x5300);

        address[] memory one = new address[](1);
        one[0] = address(0x5301);
        vm.prank(SYSTEM_CALLER);
        (bool zeroProposer,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(201),
                address(0),
                one,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!zeroProposer, "zero proposer accepted");

        address[] memory zeroParticipant = new address[](1);
        zeroParticipant[0] = address(0);
        vm.prank(SYSTEM_CALLER);
        (bool zeroParticipantAccepted,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(201),
                proposer,
                zeroParticipant,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!zeroParticipantAccepted, "zero participant accepted");

        address[] memory proposerParticipant = new address[](1);
        proposerParticipant[0] = proposer;
        vm.prank(SYSTEM_CALLER);
        (bool proposerParticipantAccepted,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(201),
                proposer,
                proposerParticipant,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!proposerParticipantAccepted, "proposer duplicated as participant");

        address[] memory oversized = new address[](30);
        for (uint256 i; i < oversized.length; ++i) {
            oversized[i] = address(uint160(0x5400 + i));
        }
        vm.prank(SYSTEM_CALLER);
        (bool oversizedAccepted,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                uint64(201),
                proposer,
                oversized,
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether),
                uint256(1 ether)
            )
        );
        require(!oversizedAccepted, "oversized participant set accepted");
        require(!rewards.rewardApplied(201), "invalid reward marked applied");
        require(rewards.grossSecurityIssued() == 0, "invalid reward changed security issuance");
        require(rewards.grossAttentionIssued() == 0, "invalid reward changed attention issuance");
        require(rewards.grossDevelopmentIssued() == 0, "invalid reward changed development issuance");
    }

    function testZeroSlashEvidenceRejectedWithoutMutation() public {
        (bytes32 id,) = _registerMatched("slash-zero-evidence", 14);
        _state(id, ValidatorRegistry.Status.PROBATION, 1, 0, 0, 0);
        ValidatorRegistry.Validator memory beforeSlash = registry.getValidator(id);
        uint256 protocolReserveBefore = registry.PROTOCOL_RESERVE().balance;
        uint256 communityBefore = address(reserve).balance;

        vm.prank(SYSTEM_CALLER);
        (bool accepted,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applySlash.selector,
                id,
                ValidatorRegistry.SlashOffense.DOUBLE_VOTE,
                uint8(0),
                uint256(1_000 ether),
                uint256(1_000 ether),
                bytes32(0),
                ValidatorRegistry.Status.SUSPENDED
            )
        );
        require(!accepted, "zero slash evidence accepted");

        ValidatorRegistry.Validator memory afterSlash = registry.getValidator(id);
        require(afterSlash.ownedBond == beforeSlash.ownedBond, "zero evidence changed owned bond");
        require(afterSlash.protocolCredit == beforeSlash.protocolCredit, "zero evidence changed protocol credit");
        require(afterSlash.totalSlashed == beforeSlash.totalSlashed, "zero evidence changed slash accounting");
        require(registry.PROTOCOL_RESERVE().balance == protocolReserveBefore, "zero evidence moved owned slash");
        require(address(reserve).balance == communityBefore, "zero evidence moved protocol credit");
        _assertSolvent();
    }

    function testDynamicCommitteeTiersAndRewardAllocation() public view {
        require(registry.targetActiveCount(59) == 0, "below handoff");
        require(registry.targetActiveCount(60) == 15, "60 tier");
        require(registry.targetActiveCount(120) == 30, "120 tier");
        require(registry.rotationTurnover(15) == 5 && registry.rotationTurnover(30) == 10, "turnover");
        (uint256 s15, uint256 a15, uint256 d15) = registry.rewardAllocation(15);
        require(s15 + a15 + d15 == registry.ALLOCATION_SCALE(), "15 conservation");
        (uint256 s30, uint256 a30, uint256 d30) = registry.rewardAllocation(30);
        require(s30 == 500_000_000_000 && a30 == 250_000_000_000 && d30 == 250_000_000_000, "mature split");
    }

    function _registerSelfFunded(string memory label, uint256 seed) internal returns (bytes32 id, address operator) {
        id = keccak256(bytes(label));
        operator = address(uint160(0x10000 + seed));
        address withdrawal = address(uint160(0x20000 + seed));
        vm.deal(operator, 42_000 ether);
        vm.prank(operator);
        registry.register{value: 42_000 ether}(id, _pubkey(seed), withdrawal, keccak256(abi.encode(label)));
    }

    function _matchedId(string memory label, uint256 seed) internal pure returns (bytes32 id, address operator) {
        id = keccak256(bytes(label));
        operator = address(uint160(0x30000 + seed));
    }

    function _registerMatched(string memory label, uint256 seed) internal returns (bytes32 id, address operator) {
        (id, operator) = _matchedId(label, seed);
        reserve.assignCredit(id, operator, 21_000 ether);
        reserve.fundCredit(id);
        _completeMatchedRegistration(id, operator, seed);
    }

    function _completeMatchedRegistration(bytes32 id, address operator, uint256 seed) internal {
        address withdrawal = address(uint160(uint256(uint160(operator)) + 0x10000));
        vm.deal(operator, 21_000 ether);
        vm.prank(operator);
        registry.register{value: 21_000 ether}(id, _pubkey(seed), withdrawal, keccak256(abi.encode(id)));
    }

    function _state(bytes32 id, ValidatorRegistry.Status status, uint64 slot, uint64 activationRotation, uint64 exitRotation, uint64 cooldownUntil) internal {
        vm.prank(SYSTEM_CALLER);
        registry.applyConsensusState(id, status, slot, activationRotation, exitRotation, cooldownUntil);
    }

    function _snapshot(uint64 rotation, uint256 eligible) internal {
        vm.prank(SYSTEM_CALLER);
        registry.applyRotationSnapshot(rotation, eligible);
    }

    function _rollPastActivation(bytes32 id) internal {
        ValidatorRegistry.Validator memory v = registry.getValidator(id);
        vm.roll(uint256(v.registrationBlock) + registry.ACTIVATION_DELAY_BLOCKS());
    }

    function _assertSolvent() internal view {
        require(registry.custodyInvariant(), "registry insolvent");
        require(reserve.reserveInvariant(), "reserve insolvent");
    }

    function _pubkey(uint256 seed) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(seed), bytes16(uint128(seed + 1)));
    }
}
