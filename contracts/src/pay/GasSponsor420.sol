// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./PayIds420.sol";

contract GasSponsor420 is GenesisResidentAccess420 {
    uint256 public constant MAX_GAS_PER_OPERATION = 420_000;
    uint256 public constant MAX_COST_PER_OPERATION = 0.042 ether;
    uint256 public constant WALLET_DAILY_SPEND_CAP = 0.084 ether;
    uint256 public constant MERCHANT_DAILY_SPEND_CAP = 17.64 ether;
    uint256 public constant GLOBAL_DAILY_SPEND_CAP = 176.4 ether;
    uint16 public constant WALLET_SUCCESS_CAP = 2;
    uint16 public constant WALLET_FAILURE_CAP = 2;
    uint16 public constant MERCHANT_OPERATION_CAP = 420;
    uint32 public constant GLOBAL_OPERATION_CAP = 4_200;
    uint16 public constant RESERVE_FLOOR_BPS = 1_000;

    struct Usage {
        uint64 dayIndex;
        uint256 spend;
        uint32 ops;
        uint16 successes;
        uint16 failures;
    }

    mapping(address => Usage) public walletUsage;
    mapping(bytes32 => Usage) public merchantUsage;
    Usage public globalUsage;
    mapping(address => uint16) public lifetimeProtocolSuccesses;
    mapping(bytes32 => bool) public operationAllowlist;
    uint256 public fundedPrincipal;

    event Sponsored(
        address indexed wallet,
        bytes32 indexed merchantId,
        bytes32 indexed operation,
        uint256 actualCost,
        bool success
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return PayIds420.GAS_SPONSOR; }

    receive() external payable { fundedPrincipal += msg.value; }

    function setOperation(bytes32 operation, bool allowed) external {
        _requireGenesisGovernance(PayIds420.ACTION_CONFIGURE);
        operationAllowlist[operation] = allowed;
    }

    function _roll(Usage storage u) internal {
        uint64 d = uint64(block.timestamp / 1 days);
        if (u.dayIndex != d) {
            u.dayIndex = d;
            u.spend = 0;
            u.ops = 0;
            u.successes = 0;
            u.failures = 0;
        }
    }

    function reserveFloor() public view returns (uint256) { return fundedPrincipal * RESERVE_FLOOR_BPS / 10_000; }

    function recordSponsored(
        address wallet,
        bytes32 merchantId,
        bytes32 operation,
        uint256 gasUsed,
        uint256 actualCost,
        bool success,
        bool protocolFunded
    ) external {
        _requireGenesisGovernance(PayIds420.ACTION_SPONSOR);
        _requireOperational(
            PayIds420.ACTION_SPONSOR,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        require(wallet != address(0) && merchantId != bytes32(0), "identity");
        require(operationAllowlist[operation], "operation");
        require(gasUsed <= MAX_GAS_PER_OPERATION, "gas cap");
        require(actualCost <= MAX_COST_PER_OPERATION, "cost cap");
        require(address(this).balance >= reserveFloor() + actualCost, "reserve floor");

        Usage storage w = walletUsage[wallet];
        Usage storage m = merchantUsage[merchantId];
        Usage storage g = globalUsage;
        _roll(w);
        _roll(m);
        _roll(g);

        require(w.spend + actualCost <= WALLET_DAILY_SPEND_CAP, "wallet spend");
        require(m.spend + actualCost <= MERCHANT_DAILY_SPEND_CAP, "merchant spend");
        require(g.spend + actualCost <= GLOBAL_DAILY_SPEND_CAP, "global spend");
        require(m.ops + 1 <= MERCHANT_OPERATION_CAP, "merchant ops");
        require(g.ops + 1 <= GLOBAL_OPERATION_CAP, "global ops");

        if (success) {
            require(w.successes + 1 <= WALLET_SUCCESS_CAP, "wallet successes");
            if (protocolFunded) {
                require(lifetimeProtocolSuccesses[wallet] + 1 <= 2, "lifetime onboarding");
                lifetimeProtocolSuccesses[wallet] += 1;
            }
            w.successes += 1;
        } else {
            require(w.failures + 1 <= WALLET_FAILURE_CAP, "wallet failures");
            w.failures += 1;
        }

        w.spend += actualCost;
        w.ops += 1;
        m.spend += actualCost;
        m.ops += 1;
        g.spend += actualCost;
        g.ops += 1;
        emit Sponsored(wallet, merchantId, operation, actualCost, success);
    }
}
