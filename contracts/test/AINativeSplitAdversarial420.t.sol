// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AINativeSplitProtocol420.t.sol";

/// @notice Test-only receiver whose runtime is installed at the actual payer address
/// after funding. The first provider claim must roll back if this second claim rejects.
contract AISplitRejectNative420 {
    receive() external payable { revert("reject second leg"); }
}

/// @notice GEN 6.4.3.7: attack the real manager/escrow/funding/Vault integration,
/// not the lightweight split or funding mocks. This inherits the production-contract
/// setup from 6.4.3.6; it does not assert testnet/operator deployment qualification.
contract AINativeSplitAdversarial420Test is AINativeSplitProtocol420Test {
    function _assertNoSettlement() internal view {
        _assertFunded();
        assertEq(PAYER.balance, 0);
        assertEq(uint256(accounting.getObligation(_original()).state), 1);
        VaultAccounting420.AssetAccounting memory a = accounting.getAccounting(VAULT_ID, address(0));
        assertEq(a.recordedBalance, TOTAL);
        assertEq(a.reserved, TOTAL);
        assertEq(a.claimable, 0);
        assertEq(a.released, 0);
        (,,,,,bytes32 settlementRef,,) = escrow.escrows(JOB);
        assertEq(uint256(settlementRef), 0);
    }

    function testSecondRecipientRejectsAndFirstClaimAndAllStateRollBack() public {
        AISplitRejectNative420 receiver = new AISplitRejectNative420();
        vm.etch(PAYER, address(receiver).code);
        vm.expectRevert(AssetVault420.TransferFailed.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertNoSettlement();
        // A failed attempt must not consume the job: remove rejection and retry.
        vm.etch(PAYER, hex"");
        settlement.settleSplit(JOB, DECISION, EARNED);
        assertEq(PROVIDER.balance, EARNED);
        assertEq(PAYER.balance, TOTAL - EARNED);
        assertEq(uint256(manager.getJob(JOB).status), uint256(AIJobManager.Status.SETTLED));
    }

    function testMissingCancelCapabilityCannotReleaseFunds() public {
        caps.setAllowed(address(settlement), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CANCEL_OBLIGATION, auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertNoSettlement();
    }

    function testMissingCreateCapabilityCannotReleaseFunds() public {
        caps.setAllowed(address(settlement), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_CREATE_OBLIGATION, auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertNoSettlement();
    }

    function testMissingReleaseCapabilityCannotReleaseFunds() public {
        caps.setAllowed(address(settlement), VaultIds420.COMPONENT_VAULT,
            VaultIds420.ACTION_RELEASE_OBLIGATION, auth.scopeForVault(VAULT_ID), false);
        vm.expectRevert(AssetVault420.Unauthorized.selector);
        settlement.settleSplit(JOB, DECISION, EARNED);
        _assertNoSettlement();
    }

    function testOnlyOneSettlementAdapterMayBindAndOutsiderCannotClose() public {
        vm.expectRevert(AIJobEscrow.AdapterAlreadyBound.selector);
        escrow.bindSettlementAdapter(address(this));
        vm.prank(OPERATOR);
        vm.expectRevert(AIJobEscrow.NotSettlementAdapter.selector);
        escrow.closeSplit(JOB, DECISION);
        _assertNoSettlement();
    }

    function testUnprivilegedCallerCannotClaimReservedOriginal() public {
        bytes32 originalObligation = _original();
        bytes32 claimOperation = keccak256("unprivileged-claim");
        vm.prank(PAYER);
        // The original funding obligation is RESERVED, not CLAIMABLE. Vault.claim
        // validates obligation state before evaluating caller authorization.
        vm.expectRevert(VaultAccounting420.InvalidObligationState.selector);
        vault.claim(claimOperation, originalObligation);
        _assertNoSettlement();
    }
}
