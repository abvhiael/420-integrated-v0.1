// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";
import { OrganizationRegistry } from "../../../../src/highcountry/organization/OrganizationRegistry.sol";
import { OrganizationAuthority } from "../../../../src/highcountry/organization/OrganizationAuthority.sol";
import {
    OrganizationTreasuryPermissions
} from "../../../../src/highcountry/organization/OrganizationTreasuryPermissions.sol";

interface VmR0410 {
    function warp(
        uint256
    ) external;
}

contract R0410Actor {
    function join(
        OrganizationRegistry r,
        bytes32 id
    ) external {
        r.join(id);
    }

    function leave(
        OrganizationRegistry r,
        bytes32 id
    ) external {
        r.requestLeave(id);
    }

    function reserve(
        OrganizationRegistry r,
        bytes32 id,
        uint32 amount
    ) external {
        r.reserveObligation(id, amount);
    }

    function ack(
        OrganizationRegistry r,
        bytes32 id,
        uint32 left
    ) external {
        r.requestObligationDischarge(id, left);
    }

    function finalize(
        OrganizationRegistry r,
        bytes32 id,
        address who
    ) external {
        r.finalizeExit(id, who);
    }

    function consume(
        OrganizationAuthority a,
        bytes32 id,
        bytes32 act,
        bytes32 scope
    ) external {
        a.consume(id, act, scope);
    }

    function revoke(
        OrganizationAuthority a,
        bytes32 id
    ) external {
        a.revoke(id);
    }

    function approveTreasury(
        OrganizationTreasuryPermissions p,
        bytes32 id
    ) external {
        p.approve(id);
    }

    function useTreasury(
        OrganizationTreasuryPermissions p,
        bytes32 id,
        address beneficiary,
        bytes32 action,
        bytes32 scope,
        uint256 amount
    ) external {
        p.consume(id, beneficiary, action, scope, amount);
    }
}

contract R0410OrganizationTest {
    VmR0410 private constant vm = VmR0410(address(uint160(uint256(keccak256("hevm cheat code")))));
    OrganizationRegistry r;
    OrganizationAuthority a;
    R0410Actor alice;
    R0410Actor bob;
    bytes32 constant ORG = keccak256("org");
    bytes32 constant ACTION = keccak256("HC.ORG.NONCUSTODIAL.CULTIVATION");
    bytes32 constant SCOPE = keccak256("field-7");

    function setUp() public {
        r = new OrganizationRegistry(retainedR04AuthorizationRoot());
        bindRetainedR04Emergency(address(r));
        a = new OrganizationAuthority(retainedR04AuthorizationRoot(), address(r));
        bindRetainedR04Emergency(address(a));
        alice = new R0410Actor();
        bob = new R0410Actor();
        r.create(ORG, keccak256("meta"));
        r.invite(ORG, address(alice), true);
        alice.join(r, ORG);
    }

    function testMembershipInvitationAndReplay() public {
        (bool denied,) = address(bob).call(abi.encodeCall(bob.join, (r, ORG)));
        require(!denied, "uninvited member entered");
        r.invite(ORG, address(bob), true);
        bob.join(r, ORG);
        (bool replay,) = address(bob).call(abi.encodeCall(bob.join, (r, ORG)));
        require(!replay, "join replay");
    }

    function testBoundedDelegationAndUseReplay() public {
        bytes32 id = a.delegate(
            ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), uint64(block.timestamp + 1 days), 1
        );
        require(a.valid(id, address(alice), ACTION, SCOPE), "valid delegate absent");
        require(!a.valid(id, address(bob), ACTION, SCOPE), "unauthorized person");
        require(!a.valid(id, address(alice), ACTION, bytes32(uint256(99))), "scope escalation");
        (bool impersonate,) = address(bob).call(abi.encodeCall(bob.consume, (a, id, ACTION, SCOPE)));
        require(!impersonate, "delegate impersonation");
        alice.consume(a, id, ACTION, SCOPE);
        require(!a.valid(id, address(alice), ACTION, SCOPE), "replay allowed");
    }

    function testNoImplicitFinancialOrRightsAuthority() public {
        for (uint256 i = 0; i < 3; i++) {
            bytes32 forbidden = i == 0 ? a.TREASURY_ACTION() : i == 1 ? a.WALLET_ACTION() : a.RIGHTS_ACTION();
            (bool ok,) = address(a)
                .call(
                    abi.encodeCall(
                        a.delegate,
                        (
                            ORG,
                            address(alice),
                            forbidden,
                            SCOPE,
                            uint64(block.timestamp),
                            uint64(block.timestamp + 1 days),
                            uint32(1)
                        )
                    )
                );
            require(!ok, "admin silently granted financial or rights authority");
        }
    }

    function testLeaveRevokesAuthorizationAndObligationsBlockExit() public {
        bytes32 id = a.delegate(
            ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), uint64(block.timestamp + 1 days), 2
        );
        alice.reserve(r, ORG, 2);
        alice.leave(r, ORG);
        require(!a.valid(id, address(alice), ACTION, SCOPE), "leaving member retained access");
        (bool premature,) = address(r).call(abi.encodeCall(r.finalizeExit, (ORG, address(alice))));
        require(!premature, "outstanding obligations silently dropped");
        alice.ack(r, ORG, 0);
        (bool unilateral,) = address(r).call(abi.encodeCall(r.finalizeExit, (ORG, address(alice))));
        require(!unilateral, "unilateral discharge accepted");
        r.confirmObligationDischarge(ORG, address(alice));
        r.finalizeExit(ORG, address(alice));
        require(!r.isActiveMember(ORG, address(alice)), "ex-member active");
    }

    function testAdminRotationRevokesOldDelegation() public {
        bytes32 id = a.delegate(
            ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), uint64(block.timestamp + 1 days), 5
        );
        r.transferAdmin(ORG, address(alice));
        require(!a.valid(id, address(alice), ACTION, SCOPE), "old admin grants survived rotation");
        (bool retained,) = address(a)
            .call(
                abi.encodeCall(
                    a.delegate,
                    (
                        ORG,
                        address(bob),
                        ACTION,
                        SCOPE,
                        uint64(block.timestamp),
                        uint64(block.timestamp + 1 days),
                        uint32(2)
                    )
                )
            );
        require(!retained, "former admin delegated");
    }

    function testUnknownActionCannotMasqueradeAsTreasuryOrWalletAuthority() public {
        (bool allowed,) = address(a)
            .call(
                abi.encodeCall(
                    a.delegate,
                    (
                        ORG,
                        address(alice),
                        keccak256("transfer-funds"),
                        SCOPE,
                        uint64(block.timestamp),
                        uint64(block.timestamp + 1 days),
                        uint32(10)
                    )
                )
            );
        require(!allowed, "arbitrary action can impersonate protected privileges");
    }

    function testTreasuryRequiresIndependentConsentAndExactBoundedConsumption() public {
        R0410Actor treasury = new R0410Actor();
        OrganizationTreasuryPermissions policy =
            new OrganizationTreasuryPermissions(retainedR04AuthorizationRoot(), address(r), address(treasury), address(bob));
        bindRetainedR04Emergency(address(policy));
        bytes32 id = policy.propose(ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp + 1 days), 500);
        require(!policy.permitted(id, address(alice), ACTION, SCOPE, 1), "admin alone authorized treasury");
        (bool preapproval,) = address(treasury)
            .call(abi.encodeCall(treasury.useTreasury, (policy, id, address(alice), ACTION, SCOPE, uint256(1))));
        require(!preapproval, "unapproved treasury spend");
        (bool forgedApprove,) = address(policy).call(abi.encodeCall(policy.approve, (id)));
        require(!forgedApprove, "admin silently approved treasury");
        bob.approveTreasury(policy, id);
        require(policy.permitted(id, address(alice), ACTION, SCOPE, 500), "two-party approval missing");
        (bool oversized,) = address(treasury)
            .call(abi.encodeCall(treasury.useTreasury, (policy, id, address(alice), ACTION, SCOPE, uint256(501))));
        require(!oversized, "overspending allowed");
        (bool forgedCaller,) =
            address(policy).call(abi.encodeCall(policy.consume, (id, address(alice), ACTION, SCOPE, uint256(1))));
        require(!forgedCaller, "wrong treasury caller");
        treasury.useTreasury(policy, id, address(alice), ACTION, SCOPE, 300);
        require(policy.permitted(id, address(alice), ACTION, SCOPE, 200), "remaining limit incorrect");
        require(!policy.permitted(id, address(alice), ACTION, SCOPE, 201), "replay exceeded amount");
        alice.leave(r, ORG);
        require(!policy.permitted(id, address(alice), ACTION, SCOPE, 1), "leaving member retained money permissions");
    }

    function testTreasuryApprovalVoidsOnAdminRotation() public {
        R0410Actor treasury = new R0410Actor();
        OrganizationTreasuryPermissions policy =
            new OrganizationTreasuryPermissions(retainedR04AuthorizationRoot(), address(r), address(treasury), address(bob));
        bindRetainedR04Emergency(address(policy));
        bytes32 id = policy.propose(ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp + 1 days), 100);
        bob.approveTreasury(policy, id);
        r.transferAdmin(ORG, address(alice));
        require(!policy.permitted(id, address(alice), ACTION, SCOPE, 1), "former admin permission survived");
    }

    function testExpiryAndReplaySafeNonceDomain() public {
        uint64 expiry = uint64(block.timestamp + 5);
        bytes32 first = a.delegate(ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), expiry, 2);
        bytes32 second = a.delegate(ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), expiry, 2);
        require(first != second, "grant nonce replay");
        vm.warp(uint256(expiry));
        require(!a.valid(first, address(alice), ACTION, SCOPE), "expired grant remained valid");
        require(!a.valid(second, address(alice), ACTION, SCOPE), "expiry boundary inclusive");
    }

    function testRemovalAndRevocation() public {
        bytes32 id = a.delegate(
            ORG, address(alice), ACTION, SCOPE, uint64(block.timestamp), uint64(block.timestamp + 1 days), 5
        );
        alice.revoke(a, id);
        require(!a.valid(id, address(alice), ACTION, SCOPE), "delegate revocation failed");
        r.remove(ORG, address(alice));
        require(!r.isActiveMember(ORG, address(alice)), "removed member active");
    }
}

