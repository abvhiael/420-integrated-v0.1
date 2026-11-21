// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";

interface VmFounderWallets420 {
    function prank(address) external;
    function deal(address,uint256) external;
}

contract FounderWalletTestReceiver420 {
    receive() external payable {}
}

contract FounderWalletClaimsAndCompensation420Test {
    VmFounderWallets420 private constant vm = VmFounderWallets420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ADMIN = address(0xAA11);
    address internal constant ANDREW = address(0xAA22);
    address internal constant JANET = address(0xAA33);

    FoundingWalletClaims420 internal claims;
    FoundingDeveloperCompensationSplitter420 internal splitter;
    function setUp() public {
        claims = new FoundingWalletClaims420(ADMIN, ANDREW, JANET, keccak256("signed-genesis-plan"));
        splitter = new FoundingDeveloperCompensationSplitter420(ADMIN, ANDREW, JANET);
    }

    function testThreeFoundersClaimIndividuallyNoImpersonationOrDuplicate() public {
        vm.prank(address(0xBAD));
        (bool impostor,) = address(claims).call(abi.encodeCall(claims.claimFounderWallet, ()));
        require(!impostor, "unknown wallet claimed founder role");
        vm.prank(ADMIN); claims.claimFounderWallet();
        vm.prank(ADMIN);
        (bool duplicate,) = address(claims).call(abi.encodeCall(claims.claimFounderWallet, ()));
        require(!duplicate, "duplicate claim");
        vm.prank(ANDREW); claims.claimFounderWallet();
        require(!claims.allFoundersClaimed(), "two cannot activate three");
        vm.prank(JANET); claims.claimFounderWallet();
        require(claims.allFoundersClaimed() && claims.claimedCount() == 3, "three claimed");
        require(claims.roleFor(ADMIN) == 1 && claims.roleFor(ANDREW) == 2
            && claims.roleFor(JANET) == 3, "wrong roles");
    }

    function testRejectReservedAndDuplicatedFounderWallets() public {
        (bool same,) = address(this).call(abi.encodePacked(type(FoundingWalletClaims420).creationCode,
            abi.encode(ADMIN, ADMIN, JANET, bytes32(uint256(1)))));
        require(!same, "duplicate identities");
        (bool reserved,) = address(this).call(abi.encodePacked(type(FoundingWalletClaims420).creationCode,
            abi.encode(address(0x0423), ANDREW, JANET, bytes32(uint256(1)))));
        require(!reserved, "protocol identity claimed as founder");
    }

    function testNativeSplitIsAccumulativeAndWithdrawableOnlyByEachPayee() public {
        vm.deal(address(this), 1001 ether);
        (bool ok,) = address(splitter).call{value: 1001 ether}("");
        require(ok, "funding");
        require(splitter.claimableNative(ADMIN) == 500.5 ether, "admin 50");
        require(splitter.claimableNative(ANDREW) == 250.25 ether, "andrew 25");
        require(splitter.claimableNative(JANET) == 250.25 ether, "janet 25");
        vm.prank(address(0xBEEF));
        (bool outsider,) = address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(!outsider, "outsider withdrew");

        vm.prank(ADMIN); splitter.claimNative();
        vm.prank(ANDREW); splitter.claimNative();
        vm.prank(JANET); splitter.claimNative();
        require(address(splitter).balance == 0, "fully distributed");
        vm.deal(address(this), 10 ether);
        (ok,) = address(splitter).call{value: 10 ether}("");
        require(ok, "second contribution");
        require(splitter.claimableNative(ADMIN) == 5 ether, "admin subsequent accrual");
        require(splitter.claimableNative(ANDREW) == 2.5 ether, "andrew subsequent accrual");
    }

    function testOneWeiRemainderGoesToJanetAndCannotBeReclaimed() public {
        vm.deal(address(this), 1);
        (bool ok,) = address(splitter).call{value: 1}("");
        require(ok, "dust");
        require(splitter.claimableNative(ADMIN) == 0 && splitter.claimableNative(ANDREW) == 0, "rounding");
        require(splitter.claimableNative(JANET) == 1, "dust allocation");
        vm.prank(JANET); splitter.claimNative();
        vm.prank(JANET);
        (bool replay,) = address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(!replay, "double claim");
    }
}
