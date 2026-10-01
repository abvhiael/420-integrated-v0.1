// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./helpers/InvariantTarget420.sol";
import "./helpers/GenesisMocks420.sol";
import "../src/system/ValidatorRegistry.sol";
import "../src/system/RewardController.sol";
import "../src/system/CommunityValidatorReserve.sol";

interface VmStakeInvariant420 {
    function deal(address account, uint256 newBalance) external;
    function roll(uint256 newHeight) external;
}

contract StakeSecurityInvariantHandler420 {
    VmStakeInvariant420 internal constant vm =
        VmStakeInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));

    GenesisMockEnvironment420 public env;
    ValidatorRegistry public registry;
    RewardController public rewards;
    CommunityValidatorReserve public reserve;

    bytes32 public constant VALIDATOR_ID = keccak256("stake-audit-4-invariant-validator");
    bytes32 public constant FIXED_EVIDENCE = keccak256("stake-audit-4-fixed-evidence");

    uint256 public immutable initialReserve;
    uint256 public treasurySpent;
    bool public duplicateSlashAccepted;
    bool public duplicateRewardAccepted;
    bool public invalidRewardAccepted;

    mapping(bytes32 => bool) public acceptedEvidence;
    mapping(uint64 => uint256) public acceptedRewardCount;

    constructor() {
        env = new GenesisMockEnvironment420();
        registry = new ValidatorRegistry(address(this), address(env.registry()), keccak256("stake-audit-4-invariant"));
        rewards = new RewardController(address(this));
        reserve = new CommunityValidatorReserve(address(this));

        registry.bindConsensusSystemCaller(address(this));
        rewards.bindConsensusSystemCaller(address(this));
        registry.bindCommunityValidatorReserve(address(reserve));
        reserve.bindValidatorRegistry(address(registry));

        initialReserve = reserve.GENESIS_RESERVE();
    }

    receive() external payable {}

    function bootstrap() external {
        if (registry.getValidator(VALIDATOR_ID).status != ValidatorRegistry.Status.NONE) return;
        vm.deal(address(reserve), initialReserve);
        vm.deal(address(this), 1_000_000 ether);

        reserve.assignCredit(VALIDATOR_ID, address(this), 21_000 ether);
        reserve.fundCredit(VALIDATOR_ID);
        registry.register{value: 21_000 ether}(
            VALIDATOR_ID,
            _pubkey(1),
            address(this),
            keccak256("stake-audit-4-invariant-metadata")
        );
    }

    function replaceCredit(uint96 rawAmount) external {
        ValidatorRegistry.Validator memory v = registry.getValidator(VALIDATOR_ID);
        if (v.status == ValidatorRegistry.Status.NONE || v.protocolCredit == 0) return;
        uint256 amount = 1 + (uint256(rawAmount) % v.protocolCredit);
        (bool ok,) = address(registry).call{value: amount}(
            abi.encodeWithSelector(registry.replaceProtocolCredit.selector, VALIDATOR_ID)
        );
        ok;
    }

    function topUp(uint96 rawAmount) external {
        ValidatorRegistry.Validator memory v = registry.getValidator(VALIDATOR_ID);
        uint256 effective = v.ownedBond + v.protocolCredit;
        if (v.status == ValidatorRegistry.Status.NONE || effective >= registry.EFFECTIVE_BOND()) return;
        uint256 gap = registry.EFFECTIVE_BOND() - effective;
        uint256 amount = 1 + (uint256(rawAmount) % gap);
        (bool ok,) = address(registry).call{value: amount}(
            abi.encodeWithSelector(registry.topUpOwnedBond.selector, VALIDATOR_ID)
        );
        ok;
    }

    function slashEvidence(bytes32 evidence) external {
        if (evidence == bytes32(0)) evidence = FIXED_EVIDENCE;
        ValidatorRegistry.Validator memory v = registry.getValidator(VALIDATOR_ID);
        if (v.status == ValidatorRegistry.Status.NONE || v.status == ValidatorRegistry.Status.EXITED) return;

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applySlash.selector,
                VALIDATOR_ID,
                ValidatorRegistry.SlashOffense.INACTIVITY,
                uint8(0),
                uint256(0),
                uint256(0),
                evidence,
                v.status
            )
        );
        if (!ok) return;
        if (acceptedEvidence[evidence]) duplicateSlashAccepted = true;
        acceptedEvidence[evidence] = true;
    }

    function replayFixedEvidence() external {
        ValidatorRegistry.Validator memory v = registry.getValidator(VALIDATOR_ID);
        if (v.status == ValidatorRegistry.Status.NONE || v.status == ValidatorRegistry.Status.EXITED) return;

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.applySlash.selector,
                VALIDATOR_ID,
                ValidatorRegistry.SlashOffense.INACTIVITY,
                uint8(0),
                uint256(0),
                uint256(0),
                FIXED_EVIDENCE,
                v.status
            )
        );
        if (!ok) return;
        if (acceptedEvidence[FIXED_EVIDENCE]) duplicateSlashAccepted = true;
        acceptedEvidence[FIXED_EVIDENCE] = true;
    }

    function rewardAttempt(uint8 mode, uint8 countSeed) external {
        uint256 count = uint256(countSeed) % 35;
        address proposer = address(0x9001);
        address[] memory participants = new address[](count);
        for (uint256 i; i < count; ++i) participants[i] = address(uint160(0xA000 + i));

        bool malformed;
        uint8 kind = mode % 6;
        if (kind == 1) {
            proposer = address(0);
            malformed = true;
        } else if (kind == 2 && count != 0) {
            participants[0] = address(0);
            malformed = true;
        } else if (kind == 3 && count != 0) {
            participants[0] = proposer;
            malformed = true;
        } else if (kind == 4 && count > 1) {
            participants[1] = participants[0];
            malformed = true;
        } else if (kind == 5) {
            if (count <= 29) {
                count = 30;
                participants = new address[](count);
                for (uint256 i; i < count; ++i) participants[i] = address(uint160(0xB000 + i));
            }
            malformed = true;
        }
        if (participants.length > 29) malformed = true;

        uint64 rewardBlock = uint64(block.number);
        (bool ok,) = address(rewards).call(
            abi.encodeWithSelector(
                rewards.applyConsensusReward.selector,
                rewardBlock,
                proposer,
                participants,
                uint256(7 ether),
                uint256(2 ether),
                uint256(3 ether),
                uint256(4 ether)
            )
        );
        if (!ok) return;

        acceptedRewardCount[rewardBlock] += 1;
        if (acceptedRewardCount[rewardBlock] > 1) duplicateRewardAccepted = true;
        if (malformed) invalidRewardAccepted = true;
    }

    function nextBlock(uint8 delta) external {
        vm.roll(block.number + 1 + (uint256(delta) % 3));
    }

    function treasurySpend(uint96 rawAmount) external {
        uint256 available = reserve.unencumberedBalance();
        if (available == 0) return;
        uint256 amount = 1 + (uint256(rawAmount) % available);
        uint256 beforeBalance = address(reserve).balance;
        (bool ok,) = address(reserve).call(
            abi.encodeWithSelector(
                reserve.treasuryTransfer.selector,
                payable(address(0xD00D)),
                amount,
                keccak256("stake-audit-4-invariant-spend")
            )
        );
        if (ok) treasurySpent += beforeBalance - address(reserve).balance;
    }

    function _pubkey(uint256 seed) private pure returns (bytes memory out) {
        out = new bytes(48);
        bytes32 a = keccak256(abi.encode(seed, uint256(1)));
        bytes32 b = keccak256(abi.encode(seed, uint256(2)));
        for (uint256 i; i < 32; ++i) out[i] = a[i];
        for (uint256 i; i < 16; ++i) out[32 + i] = b[i];
    }
}

contract StakeSecurityInvariant420Test is InvariantTarget420 {
    StakeSecurityInvariantHandler420 internal handler;

    function setUp() public {
        handler = new StakeSecurityInvariantHandler420();
        handler.bootstrap();
        targetContract(address(handler));
    }

    function invariant_CustodyConservation() public view {
        ValidatorRegistry r = handler.registry();
        require(r.custodyInvariant(), "STAKE-INV-001 custody invariant false");
        require(
            address(r).balance == r.totalOwnedCustody() + r.totalProtocolCreditCustody(),
            "STAKE-INV-001 registry custody not conserved"
        );
        require(r.totalPendingProtocolCredit() <= r.totalProtocolCreditCustody(), "STAKE-INV-001 pending exceeds credit");
    }

    function invariant_ReserveAccountingConservation() public view {
        CommunityValidatorReserve reserve = handler.reserve();
        require(reserve.reserveInvariant(), "STAKE-INV-002 reserve invariant false");
        require(reserve.totalFunded() <= reserve.totalAssigned(), "STAKE-INV-002 funded exceeds assigned");
        require(
            address(reserve).balance + reserve.totalFunded() + handler.treasurySpent() == handler.initialReserve(),
            "STAKE-INV-002 reserve value drift"
        );
    }

    function invariant_SlashEvidenceIsUnique() public view {
        require(!handler.duplicateSlashAccepted(), "STAKE-INV-004 duplicate slash evidence accepted");
    }

    function invariant_RewardIsAtMostOncePerBlock() public view {
        require(!handler.duplicateRewardAccepted(), "STAKE-INV-005 reward applied more than once");
    }

    function invariant_MalformedOrOversizedParticipantsNeverSettle() public view {
        require(!handler.invalidRewardAccepted(), "STAKE-INV-006 invalid participant set settled");
    }
}
