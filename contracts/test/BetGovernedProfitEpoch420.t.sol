// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bet/BetGovernedProfitEpoch420.sol";
import {BetFantasyProfitEpochSource420} from "../src/bet/BetFantasyProfitEpochSource420.sol";
import {DevelopmentCompensationVault420} from "../src/revenue/DevelopmentCompensationVault420.sol";
import {FoundingDeveloperCompensationSplitter420} from "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";
import {CapabilityRegistry420} from "../src/system/CapabilityRegistry420.sol";
import {DevelopmentCompensationIds420} from "../src/revenue/DevelopmentCompensationIds420.sol";

interface VmProfitEpoch420 {
    function warp(uint256 timestamp) external;
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
}

contract ProfitEpochSourceFixture420 is IBetProfitEpochSource420 {
    Totals private totals = Totals(0, 0, 0, 0, 0, true);

    function asset() external pure returns (address) { return address(0); }
    function custody() external view returns (address) { return address(this); }
    function profitTotals() external view returns (Totals memory) { return totals; }
    function set(Totals calldata next) external { totals = next; }
}

contract BetGovernedProfitEpoch420Test {
    VmProfitEpoch420 private constant vm = VmProfitEpoch420(address(uint160(uint256(keccak256("hevm cheat code")))));
    BetGovernedProfitEpoch420 private epoch;
    ProfitEpochSourceFixture420[7] private fixtures;

    function setUp() public {
        BetGovernedProfitEpoch420.Source[] memory inventory = new BetGovernedProfitEpoch420.Source[](7);
        for (uint256 i; i < inventory.length; ++i) {
            fixtures[i] = new ProfitEpochSourceFixture420();
            inventory[i] = BetGovernedProfitEpoch420.Source(BetGovernedProfitEpoch420.Kind(i), fixtures[i]);
        }
        epoch = new BetGovernedProfitEpoch420(address(this), address(0), 1 days, inventory);
    }

    function testNettingExcludesFantasyAndDoesNotReuseReceipts() public {
        fixtures[0].set(IBetProfitEpochSource420.Totals(100, 0, 0, 0, 100, true));
        fixtures[2].set(IBetProfitEpochSource420.Totals(20, 0, 0, 0, 20, true));
        fixtures[4].set(IBetProfitEpochSource420.Totals(0, 30, 0, 0, 0, true));
        fixtures[5].set(IBetProfitEpochSource420.Totals(200, 0, 0, 200, 0, true));
        fixtures[uint256(BetGovernedProfitEpoch420.Kind.Expenses)].set(IBetProfitEpochSource420.Totals(0, 0, 10, 0, 0, true));
        vm.warp(epoch.nextClose());
        (, BetGovernedProfitEpoch420.Epoch memory first) = epoch.finalize();
        require(first.eligibleRevenue == 80 && first.developerReserve == 8, "net retained basis");
        vm.warp(epoch.nextClose());
        (, BetGovernedProfitEpoch420.Epoch memory second) = epoch.finalize();
        require(second.eligibleRevenue == 0 && epoch.accountedRevenue() == 80, "reused receipts");
    }

    function testActualFantasyVaultForwardIsExcludedExactlyOnce() public {
        CapabilityRegistry420 capabilities = new CapabilityRegistry420();
        FoundingDeveloperCompensationSplitter420 splitter =
            new FoundingDeveloperCompensationSplitter420(address(this), address(0xA), address(0xB));
        DevelopmentCompensationVault420 vault = new DevelopmentCompensationVault420(
            address(capabilities), payable(address(splitter))
        );
        splitter.bindCompensationVault(address(vault));
        bytes32 component = DevelopmentCompensationIds420.COMPONENT_DEVELOPMENT_COMPENSATION;
        capabilities.registerProtocolComponent(component, address(this));
        capabilities.createGrant(
            keccak256("fantasy"), address(this), component, vault.fantasyContributionAction(),
            DevelopmentCompensationIds420.scopeSource(vault.fantasyApplicationId()), 0, 0, 0, 0, 0
        );

        BetGovernedProfitEpoch420.Source[] memory inventory = new BetGovernedProfitEpoch420.Source[](7);
        for (uint256 i; i < inventory.length; ++i) {
            inventory[i] = BetGovernedProfitEpoch420.Source(BetGovernedProfitEpoch420.Kind(i), fixtures[i]);
        }
        BetFantasyProfitEpochSource420 source =
            new BetFantasyProfitEpochSource420(address(0), vault, address(vault).codehash);
        inventory[uint256(BetGovernedProfitEpoch420.Kind.Fantasy)].adapter = source;
        BetGovernedProfitEpoch420 realEpoch =
            new BetGovernedProfitEpoch420(address(this), address(0), 1 days, inventory);

        vm.deal(address(this), 6);
        bytes32 pool = keccak256("final-pool");
        vault.contributeFantasy{value: 3}(address(0), pool, 101);
        vault.contributeFantasy{value: 3}(address(0), pool, 200);
        require(vault.fantasyForwardedAmount(address(0)) == 6, "forwarded compensation");
        require(splitter.totalNativeCredited() == 6, "splitter credit");
        IBetProfitEpochSource420.Totals memory totals = source.profitTotals();
        require(totals.retainedReceipts == 200 && totals.separatelyRoutedBasis == 200, "vault basis");
        require(totals.freeProtocolCash == 0, "splitter funds cannot back another reserve");

        fixtures[0].set(IBetProfitEpochSource420.Totals(50, 0, 0, 0, 50, true));
        vm.warp(realEpoch.nextClose());
        (, BetGovernedProfitEpoch420.Epoch memory first) = realEpoch.finalize();
        require(first.eligibleRevenue == 50 && first.developerReserve == 5, "Fantasy charged twice");
        vm.warp(realEpoch.nextClose());
        (, BetGovernedProfitEpoch420.Epoch memory second) = realEpoch.finalize();
        require(second.eligibleRevenue == 0 && realEpoch.accountedRevenue() == 50, "counter reused");
    }

    function testLossCarryAndRollbackWhenCashIsUnavailable() public {
        fixtures[uint256(BetGovernedProfitEpoch420.Kind.Expenses)].set(IBetProfitEpochSource420.Totals(0, 0, 20, 0, 0, true));
        vm.warp(epoch.nextClose());
        epoch.finalize();
        require(epoch.carriedLoss() == 20, "loss carry");
        fixtures[0].set(IBetProfitEpochSource420.Totals(50, 0, 0, 0, 29, true));
        vm.warp(epoch.nextClose());
        vm.expectRevert(BetGovernedProfitEpoch420.UnreconciledSource.selector);
        epoch.finalize();
        require(epoch.epochCount() == 1 && epoch.carriedLoss() == 20, "partial close");
        fixtures[0].set(IBetProfitEpochSource420.Totals(50, 0, 0, 0, 30, true));
        (, BetGovernedProfitEpoch420.Epoch memory second) = epoch.finalize();
        require(second.eligibleRevenue == 30 && second.carriedLoss == 0, "loss offset");
    }

    function testRejectsEarlyUnauthorizedAndUnreconciledClose() public {
        vm.expectRevert(BetGovernedProfitEpoch420.EpochNotReady.selector);
        epoch.finalize();
        vm.warp(epoch.nextClose());
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        vm.prank(address(0x1234));
        epoch.finalize();
        fixtures[uint256(BetGovernedProfitEpoch420.Kind.Sportsbook)].set(IBetProfitEpochSource420.Totals(0, 0, 0, 0, 0, false));
        vm.expectRevert(BetGovernedProfitEpoch420.UnreconciledSource.selector);
        epoch.finalize();
    }

    function testRejectsIncompleteInventory() public {
        BetGovernedProfitEpoch420.Source[] memory inventory = new BetGovernedProfitEpoch420.Source[](0);
        vm.expectRevert(BetGovernedProfitEpoch420.InvalidInventory.selector);
        new BetGovernedProfitEpoch420(address(this), address(0), 1 days, inventory);
    }
}
