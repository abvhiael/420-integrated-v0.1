// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/revenue/DevelopmentCompensationVault420.sol";
import "../src/revenue/DevelopmentCompensationIds420.sol";

contract MockCapabilityRegistryDevelopmentComp420 is ICapabilityRegistry420 {
    address public allowedPrincipal;
    bool public enabled = true;

    function setAllowedPrincipal(address principal) external { allowedPrincipal = principal; }
    function setEnabled(bool enabled_) external { enabled = enabled_; }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32,
        uint256
    ) external view returns (bool) {
        return enabled && principal == allowedPrincipal
            && componentId == DevelopmentCompensationIds420.COMPONENT_DEVELOPMENT_COMPENSATION
            && capabilityId == DevelopmentCompensationIds420.ACTION_CONTRIBUTE_REVENUE;
    }
}

contract MockRevenueToken420 {
    string public constant name = "Revenue Token";
    string public constant symbol = "R420";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a < amount || balanceOf[from] < amount) return false;
        allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RevenueSourceHarness420 {
    DevelopmentCompensationVault420 public immutable vault;
    constructor(address vault_) { vault = DevelopmentCompensationVault420(payable(vault_)); }

    receive() external payable {}

    function approveToken(address token, uint256 amount) external {
        MockRevenueToken420(token).approve(address(vault), amount);
    }

    function sendNative(bytes32 appId, bytes32 revenueRef, bytes32 policyRef, uint256 gross, uint16 bps) external payable {
        vault.contributeNative{value: msg.value}(appId, revenueRef, policyRef, gross, bps);
    }

    function sendToken(address token, bytes32 appId, bytes32 revenueRef, bytes32 policyRef, uint256 gross, uint16 bps) external {
        vault.contributeToken(token, appId, revenueRef, policyRef, gross, bps);
    }
}

contract DevelopmentCompensationVault420Test {
    bytes32 private constant APP_ID = keccak256("420/app/test-revenue-source/v1");
    bytes32 private constant POLICY_REF = keccak256("policy/ref/v1");

    MockCapabilityRegistryDevelopmentComp420 private caps;
    DevelopmentCompensationVault420 private vault;
    RevenueSourceHarness420 private source;
    MockRevenueToken420 private token;
    address private beneficiary;

    constructor() {
        beneficiary = address(0x420420);
        caps = new MockCapabilityRegistryDevelopmentComp420();
        vault = new DevelopmentCompensationVault420(address(caps), beneficiary);
        source = new RevenueSourceHarness420(address(vault));
        caps.setAllowedPrincipal(address(source));
        token = new MockRevenueToken420();
    }

    function testDefaultTenPercentMath() public view {
        require(vault.expectedCompensation(1_000 ether, 1_000) == 100 ether, "10 percent math");
        require(vault.MAX_COMPENSATION_BPS() == 1_000, "policy ceiling");
        require(vault.beneficiary() == beneficiary, "beneficiary");
        require(vault.beneficiaryId() == DevelopmentCompensationIds420.BENEFICIARY_420_INTEGRATED_LABS, "beneficiary id");
    }

    function testRejectsAboveTenPercent() public {
        (bool ok,) = address(vault).call(
            abi.encodeWithSelector(vault.expectedCompensation.selector, 1_000 ether, uint16(1_001))
        );
        require(!ok, "must reject >10 percent");
    }

    function testTokenContributionForwardsWithoutCustody() public {
        uint256 gross = 1_000 ether;
        uint256 share = 100 ether;
        token.mint(address(source), share);
        source.approveToken(address(token), share);
        bytes32 revenueRef = keccak256("token-revenue-1");
        source.sendToken(address(token), APP_ID, revenueRef, POLICY_REF, gross, 1_000);
        require(token.balanceOf(beneficiary) == share, "beneficiary token amount");
        require(token.balanceOf(address(vault)) == 0, "vault token custody");
        require(vault.consumedRevenueContribution(vault.contributionId(address(source), APP_ID, revenueRef)), "consumed ref");
    }

    function testRejectsUnauthorizedSource() public {
        caps.setEnabled(false);
        uint256 gross = 100 ether;
        uint256 share = 10 ether;
        token.mint(address(source), share);
        source.approveToken(address(token), share);
        (bool ok,) = address(source).call(
            abi.encodeWithSelector(source.sendToken.selector, address(token), APP_ID, keccak256("unauthorized"), POLICY_REF, gross, uint16(1_000))
        );
        require(!ok, "unauthorized source accepted");
    }

    function testRejectsReplay() public {
        uint256 gross = 100 ether;
        uint256 share = 10 ether;
        bytes32 revenueRef = keccak256("replay-ref");
        token.mint(address(source), share * 2);
        source.approveToken(address(token), share * 2);
        source.sendToken(address(token), APP_ID, revenueRef, POLICY_REF, gross, 1_000);
        (bool ok,) = address(source).call(
            abi.encodeWithSelector(source.sendToken.selector, address(token), APP_ID, revenueRef, POLICY_REF, gross, uint16(1_000))
        );
        require(!ok, "replay accepted");
        require(token.balanceOf(beneficiary) == share, "replay changed beneficiary balance");
    }

    function testDirectNativeDepositDisabled() public {
        (bool ok,) = address(vault).call{value: 1}("");
        require(!ok, "direct deposit accepted");
    }

    function testNativeContributionForwardsWithoutCustody() public {
        uint256 gross = 100 ether;
        uint256 share = 10 ether;
        uint256 beforeBeneficiary = beneficiary.balance;
        source.sendNative{value: share}(APP_ID, keccak256("native-revenue-1"), POLICY_REF, gross, 1_000);
        require(beneficiary.balance == beforeBeneficiary + share, "beneficiary native amount");
        require(address(vault).balance == 0, "vault native custody");
    }
}
