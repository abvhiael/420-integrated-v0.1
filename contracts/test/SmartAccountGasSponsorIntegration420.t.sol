// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SmartAccount420.sol";
import "../src/pay/GasSponsor420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmSponsor420 { function deal(address account, uint256 newBalance) external; }
contract SponsorEntryPointMock420 { function getNonce(address, uint192) external pure returns (uint256) { return 0; } }

contract SmartAccountGasSponsorIntegration420Test {
    VmSponsor420 internal constant vm = VmSponsor420(address(uint160(uint256(keccak256("hevm cheat code")))));

    GenesisMockEnvironment420 internal env;
    SponsorEntryPointMock420 internal entryPoint;
    CapabilityRegistry420 internal capabilities;
    SmartAccount420 internal account;
    GasSponsor420 internal sponsor;

    constructor() {
        env = new GenesisMockEnvironment420();
        entryPoint = new SponsorEntryPointMock420();
        capabilities = new CapabilityRegistry420();
        account = new SmartAccount420(address(entryPoint), address(capabilities), address(this), address(0));
        sponsor = new GasSponsor420(address(this), address(env.registry()), keccak256("smart-account-sponsor-test"));
        env.registerResident(address(sponsor), sponsor.componentId());
    }

    function testAccountCanGrantCanonicalGasSponsorCapability() public {
        bytes32 operation = keccak256("420/SMART_ACCOUNT/USER_OP");
        bytes32 grantId = account.createGasSponsorGrant(address(sponsor), operation, 0.042 ether, 0.084 ether, 1 days, 0, 0);
        require(grantId != bytes32(0), "grant");
        require(account.isGasSponsorAuthorized(address(sponsor), operation, 0.01 ether), "sponsor authorized");
        require(!account.isGasSponsorAuthorized(address(sponsor), operation, 0.043 ether), "per-call cap");
    }

    function testSponsoredSmartAccountOperationIsAccountedToAccountAddress() public {
        bytes32 operation = keccak256("420/SMART_ACCOUNT/USER_OP");
        sponsor.setOperation(operation, true);
        vm.deal(address(this), 2 ether);
        (bool funded,) = address(sponsor).call{value: 1 ether}("");
        require(funded, "fund sponsor");
        sponsor.recordSponsored(address(account), keccak256("merchant-420"), operation, 210_000, 0.01 ether, true, false);
        (uint64 dayIndex, uint256 spend, uint32 ops, uint16 successes, uint16 failures) = sponsor.walletUsage(address(account));
        require(dayIndex == uint64(block.timestamp / 1 days), "day");
        require(spend == 0.01 ether && ops == 1, "usage");
        require(successes == 1 && failures == 0, "outcome");
    }

    function testSponsorCapsRemainEnforcedForSmartAccount() public {
        bytes32 operation = keccak256("420/SMART_ACCOUNT/CAPPED_USER_OP");
        sponsor.setOperation(operation, true);
        vm.deal(address(this), 2 ether);
        (bool funded,) = address(sponsor).call{value: 1 ether}("");
        require(funded, "fund sponsor");
        (bool ok,) = address(sponsor).call(abi.encodeWithSelector(
            GasSponsor420.recordSponsored.selector,
            address(account), keccak256("merchant-420"), operation,
            sponsor.MAX_GAS_PER_OPERATION() + 1, 0.01 ether, true, false
        ));
        require(!ok, "gas cap must apply");
    }

    function testSponsorCannotChangeUserEconomicCall() public view {
        require(address(account) != address(sponsor), "separate authority");
        require(account.entryPoint() == address(entryPoint), "entry point authority unchanged");
        require(sponsor.MAX_COST_PER_OPERATION() == 0.042 ether, "cost cap");
        require(sponsor.MAX_GAS_PER_OPERATION() == 420_000, "gas cap");
    }
}
