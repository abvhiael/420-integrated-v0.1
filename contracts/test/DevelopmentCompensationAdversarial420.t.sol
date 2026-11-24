// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/CapabilityRegistry420.sol";
import "../src/revenue/DevelopmentCompensationVault420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";
import {FounderCompensationTestToken420} from "./FounderWalletClaimsAndCompensation420.t.sol";

interface VmDevCompAdversarial420 {
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract RejectingCompensationBeneficiary420 {
    bool public reject = true;
    function allow() external { reject = false; }
    receive() external payable { require(!reject, "reject native"); }
    function isFoundingCompensationSplitter420() external pure returns (bool) { return true; }
    function recordVaultTokenCompensation(address, uint256, bytes32) external view {
        require(!reject, "reject token credit");
    }
}

contract DevelopmentCompensationAdversarial420Test {
    VmDevCompAdversarial420 private constant vm =
        VmDevCompAdversarial420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant A = keccak256("application A");
    bytes32 private constant B = keccak256("application B");
    bytes32 private constant COMPONENT = DevelopmentCompensationIds420.COMPONENT_DEVELOPMENT_COMPENSATION;
    bytes32 private constant ACTION = DevelopmentCompensationIds420.ACTION_CONTRIBUTE_REVENUE;
    address private constant ADMIN = address(0xAA11);
    address private constant ANDREW = address(0xAA22);
    address private constant JANET = address(0xAA33);
    CapabilityRegistry420 private registry;
    DevelopmentCompensationVault420 private vault;
    FoundingDeveloperCompensationSplitter420 private splitter;
    FounderCompensationTestToken420 private tokenA;
    FounderCompensationTestToken420 private tokenB;

    function setUp() public {
        registry = new CapabilityRegistry420();
        registry.registerProtocolComponent(COMPONENT, address(this));
        splitter = new FoundingDeveloperCompensationSplitter420(ADMIN, ANDREW, JANET);
        vault = new DevelopmentCompensationVault420(address(registry), address(splitter));
        splitter.bindCompensationVault(address(vault));
        tokenA = new FounderCompensationTestToken420();
        tokenB = new FounderCompensationTestToken420();
        vm.deal(address(this), 1 ether);
    }

    function grant(bytes32 id, bytes32 app, uint256 limit, uint256 periodLimit, uint64 start, uint64 end) private {
        registry.createGrant(id, address(this), COMPONENT, ACTION, DevelopmentCompensationIds420.scopeSource(app),
            limit, periodLimit, periodLimit == 0 ? 0 : 60, start, end);
    }

    function nativePayment(bytes32 app, bytes32 ref, uint256 amount) private {
        vault.contributeNative{value: amount}(app, ref, vault.policyId(), amount * 10, 1000);
    }

    function tokenPayment(FounderCompensationTestToken420 token, bytes32 app, bytes32 ref, uint256 amount) private {
        token.mint(address(this), amount);
        token.approve(address(vault), amount);
        vault.contributeToken(address(token), app, ref, vault.policyId(), amount * 10, 1000);
    }

    function rejectNative(bytes32 app, bytes32 ref, uint256 amount) private {
        uint256 beforeCredit = splitter.totalNativeCredited();
        uint256 beforeBalance = address(this).balance;
        bytes32 policy = vault.policyId();
        vm.expectRevert(DevelopmentCompensationVault420.UnauthorizedSource.selector);
        vault.contributeNative{value: amount}(app, ref, policy, amount * 10, 1000);
        require(!vault.consumedRevenueContribution(vault.contributionId(address(this), app, ref)), "rejected replay marker");
        require(splitter.totalNativeCredited() == beforeCredit && address(this).balance == beforeBalance, "rejected funds");
    }

    function testRealRegistryGrantScopeLimitsExpiryRevocation() public {
        vm.warp(120);
        bytes32 id = keccak256("grant A");
        bytes32 ref = keccak256("reusable rejected reference");
        rejectNative(A, ref, 1);
        grant(id, A, 10, 20, 121, 130);
        rejectNative(A, ref, 1);
        vm.warp(121);
        rejectNative(B, ref, 1);
        rejectNative(A, ref, 11);
        // Registry period limits include externally consumed usage. The V1 vault
        // is a view-only authorization consumer, not a metering authority.
        registry.consume(id, 10);
        registry.consume(id, 5);
        rejectNative(A, ref, 6);
        nativePayment(A, ref, 5);
        vm.warp(131);
        rejectNative(A, keccak256("expired"), 1);
        bytes32 replacement = keccak256("replacement");
        grant(replacement, A, 10, 0, 131, 0);
        nativePayment(A, keccak256("renewed"), 10);
        registry.revokeGrant(replacement);
        rejectNative(A, keccak256("revoked"), 1);
        require(splitter.totalNativeCredited() == 15 && address(vault).balance == 0, "real registry settlement");
    }

    function testBeneficiaryFailuresRollbackAndRetrySameReference() public {
        RejectingCompensationBeneficiary420 receiver = new RejectingCompensationBeneficiary420();
        vault = new DevelopmentCompensationVault420(address(registry), address(receiver));
        grant(keccak256("grant"), A, 100, 0, 0, 0);
        bytes32 n = keccak256("native rollback");
        bytes32 t = keccak256("token rollback");
        uint256 beforeNative = address(this).balance;
        bytes32 policy = vault.policyId();
        vm.expectRevert(DevelopmentCompensationVault420.TransferFailed.selector);
        vault.contributeNative{value: 10}(A, n, policy, 100, 1000);
        require(address(this).balance == beforeNative && address(receiver).balance == 0
            && !vault.consumedRevenueContribution(vault.contributionId(address(this), A, n)), "native rollback");
        tokenA.mint(address(this), 10);
        tokenA.approve(address(vault), 10);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.contributeToken,
            (address(tokenA), A, t, vault.policyId(), 100, uint16(1000))));
        require(!ok && tokenA.balanceOf(address(this)) == 10 && tokenA.balanceOf(address(receiver)) == 0
            && tokenA.allowance(address(this), address(vault)) == 10
            && !vault.consumedRevenueContribution(vault.contributionId(address(this), A, t)), "token rollback");
        receiver.allow();
        nativePayment(A, n, 10);
        vault.contributeToken(address(tokenA), A, t, vault.policyId(), 100, 1000);
        require(address(receiver).balance == 10 && tokenA.balanceOf(address(receiver)) == 10, "retry failed");
    }

    function testCrossApplicationAndAssetIsolation() public {
        grant(keccak256("A"), A, 100, 0, 0, 0);
        grant(keccak256("B"), B, 100, 0, 0, 0);
        bytes32 ref = keccak256("same reference");
        tokenPayment(tokenA, A, ref, 20);
        tokenPayment(tokenB, B, ref, 40);
        bytes32 idA = vault.contributionId(address(this), A, ref);
        bytes32 idB = vault.contributionId(address(this), B, ref);
        require(idA != idB && splitter.consumedTokenContribution(idA) && splitter.consumedTokenContribution(idB), "scope collision");
        bytes32 policy = vault.policyId();
        vm.expectRevert(DevelopmentCompensationVault420.Replay.selector);
        vault.contributeNative{value: 1}(A, ref, policy, 10, 1000);
        vm.prank(ADMIN);
        splitter.claimToken(address(tokenA));
        require(splitter.totalTokenClaimed(address(tokenA)) == 10
            && splitter.totalTokenClaimed(address(tokenB)) == 0 && splitter.totalNativeClaimed() == 0, "asset leakage");
        require(tokenA.balanceOf(address(splitter)) == 10 && tokenB.balanceOf(address(splitter)) == 40, "asset custody");
    }

    function testFuzzContributionClaimSequences(bytes32 seed) public {
        grant(keccak256("A"), A, 100, 0, 0, 0);
        grant(keccak256("B"), B, 100, 0, 0, 0);
        vm.deal(address(splitter), 7);
        tokenA.mint(address(splitter), 11);
        tokenB.mint(address(splitter), 13);
        address[3] memory founders = [ADMIN, ANDREW, JANET];
        uint256[3] memory credits;
        for (uint256 i; i < 8; ++i) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            uint256 asset = r % 3;
            uint256 amount = (r >> 8) % 100 + 1;
            bytes32 app = (r >> 16) % 2 == 0 ? A : B;
            bytes32 ref = keccak256(abi.encode(seed, i));
            if (asset == 0) nativePayment(app, ref, amount);
            else tokenPayment(asset == 1 ? tokenA : tokenB, app, ref, amount);
            credits[asset] += amount;
            address founder = founders[(r >> 24) % 3];
            claimAvailable(founder);
            assertConservation(credits);
        }
        for (uint256 i; i < 3; ++i) claimAvailable(founders[i]);
        assertConservation(credits);
        require(splitter.totalNativeClaimed() == credits[0]
            && splitter.totalTokenClaimed(address(tokenA)) == credits[1]
            && splitter.totalTokenClaimed(address(tokenB)) == credits[2], "unpaid entitlements");
    }

    function claimAvailable(address founder) private {
        if (splitter.claimableNative(founder) != 0) {
            vm.prank(founder); splitter.claimNative();
        }
        if (splitter.claimableToken(address(tokenA), founder) != 0) {
            vm.prank(founder); splitter.claimToken(address(tokenA));
        }
        if (splitter.claimableToken(address(tokenB), founder) != 0) {
            vm.prank(founder); splitter.claimToken(address(tokenB));
        }
    }

    function assertConservation(uint256[3] memory credits) private view {
        require(splitter.totalNativeCredited() == credits[0]
            && splitter.totalTokenCredited(address(tokenA)) == credits[1]
            && splitter.totalTokenCredited(address(tokenB)) == credits[2], "credit mismatch");
        require(address(splitter).balance == 7 + credits[0] - splitter.totalNativeClaimed(), "native conservation");
        require(tokenA.balanceOf(address(splitter)) == 11 + credits[1] - splitter.totalTokenClaimed(address(tokenA)), "A conservation");
        require(tokenB.balanceOf(address(splitter)) == 13 + credits[2] - splitter.totalTokenClaimed(address(tokenB)), "B conservation");
        require(address(vault).balance == 0 && tokenA.balanceOf(address(vault)) == 0
            && tokenB.balanceOf(address(vault)) == 0, "vault residue");
    }
}
