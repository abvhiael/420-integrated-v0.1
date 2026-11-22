// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";

interface VmFounderWallets420 {
    function prank(address) external;
    function deal(address,uint256) external;
    function chainId(uint256) external;
}

contract FounderWalletTestReceiver420 {
    receive() external payable {}
}

contract FounderCompensationTestToken420 {
    mapping(address => uint256) public balanceOf;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function transfer(address recipient,uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender]>=amount,"insufficient");
        balanceOf[msg.sender]-=amount;
        balanceOf[recipient]+=amount;
        return true;
    }
}

contract FounderCompensationDishonestToken420 {
    mapping(address => uint256) public balanceOf;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function transfer(address,uint256) external pure returns (bool) { return true; }
}

/// @dev A claimant smart account must originate the on-chain call itself;
/// an EOA signature is never misrepresented as this contract's own public address.
contract FounderOwnerRoutedSmartAccount420 {
    address public immutable owner;
    constructor(address owner_) { owner = owner_; }
    function claim(address registry) external {
        require(msg.sender == owner, "not smart account owner");
        FoundingWalletClaims420(registry).claimFounderWallet();
    }
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
        bool duplicateConstructed;
        try new FoundingWalletClaims420(ADMIN, ADMIN, JANET, bytes32(uint256(1))) {
            duplicateConstructed = true;
        } catch {}
        require(!duplicateConstructed, "duplicate founder identities were deployable");
        bool systemConstructed;
        try new FoundingWalletClaims420(address(0x0423), ANDREW, JANET, bytes32(uint256(1))) {
            systemConstructed = true;
        } catch {}
        require(!systemConstructed, "reserved predeploy wallet was deployable");
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

    function testTokenSplitUsesExactAssetTransfersAndRejectsFakeSuccess() public {
        FounderCompensationTestToken420 token = new FounderCompensationTestToken420();
        token.mint(address(splitter),101);
        require(splitter.claimableToken(address(token),ADMIN)==50,"admin token share");
        require(splitter.claimableToken(address(token),ANDREW)==25,"andrew token share");
        require(splitter.claimableToken(address(token),JANET)==26,"janet rounding share");
        vm.prank(ADMIN); splitter.claimToken(address(token));
        vm.prank(ANDREW); splitter.claimToken(address(token));
        vm.prank(JANET); splitter.claimToken(address(token));
        require(token.balanceOf(ADMIN)==50 && token.balanceOf(ANDREW)==25
            && token.balanceOf(JANET)==26 && token.balanceOf(address(splitter))==0,
            "three real token deliveries");
        token.mint(address(splitter),100);
        require(splitter.claimableToken(address(token),ADMIN)==50,"follow-on accrual");
        FounderCompensationDishonestToken420 dishonest=new FounderCompensationDishonestToken420();
        dishonest.mint(address(splitter),100);
        vm.prank(ADMIN);
        (bool faked,) = address(splitter).call(
            abi.encodeCall(splitter.claimToken,(address(dishonest)))
        );
        require(!faked,"fake-success token stole developer payout accounting");
        require(splitter.totalTokenClaimed(address(dishonest))==0,"failed transfer recorded as paid");
    }

    function testWrongChainRejectedAndNoPrematureClaimState() public {
        uint256 deployedOn = block.chainid;
        require(claims.deploymentChainId() == deployedOn, "deployment chain invariant");
        vm.chainId(deployedOn + 1000);
        vm.prank(ADMIN);
        (bool alternateChain,) = address(claims).call(
            abi.encodeCall(claims.claimFounderWallet, ())
        );
        require(!alternateChain, "foreign chain ID accepted founder claim");
        require(claims.claimedCount() == 0 && !claims.claimed(ADMIN),
                "foreign chain altered founder claim state");
        // Read the immutable via an external call: Solidity may re-read block.chainid
        // after the vm.chainId cheatcode when optimizing local expressions.
        vm.chainId(claims.deploymentChainId());
        vm.prank(ADMIN);
        claims.claimFounderWallet();
        require(claims.claimedCount() == 1, "authorized chain not restored");
    }

    function testLostFounderKeyCannotBeReplacedOrClaimedByUnrelatedWallet() public {
        // The administrator is an original beneficiary but does not sign anything.
        // Another account cannot claim their seat or invoke a beneficiary change.
        address outsider = address(0x0F1234);
        vm.prank(outsider);
        (bool forgedClaim,) = address(claims).call(
            abi.encodeCall(claims.claimFounderWallet, ())
        );
        require(!forgedClaim, "third party claimed lost-key founder slot");
        vm.prank(outsider);
        (bool seized,) = address(claims).call(
            abi.encodeWithSignature("replaceFounder(address,address)", ADMIN, outsider)
        );
        require(!seized, "foreign wallet rotated immutable founder slot");
        require(claims.administrator() == ADMIN && !claims.claimed(ADMIN)
                && claims.claimedCount() == 0, "lost-key seat modified");
    }

    function testSmartAccountOwnerCallsFromOwnContractAndCannotBeImpersonated() public {
        address owner = address(0xA55);
        FounderOwnerRoutedSmartAccount420 smart = new FounderOwnerRoutedSmartAccount420(owner);
        FoundingWalletClaims420 smartClaims = new FoundingWalletClaims420(
            address(smart), ANDREW, JANET, keccak256("smart-verified-plan")
        );
        vm.prank(owner);
        (bool eoaImpersonation,) = address(smartClaims).call(
            abi.encodeCall(smartClaims.claimFounderWallet, ())
        );
        require(!eoaImpersonation, "EOA owner claimed in place of smart account");
        vm.prank(address(0xBAD));
        (bool outsider,) = address(smart).call(
            abi.encodeCall(smart.claim, (address(smartClaims)))
        );
        require(!outsider, "unrelated address directed smart account claim");
        require(!smartClaims.claimed(address(smart)), "early smart claim");
        vm.prank(owner);
        smart.claim(address(smartClaims));
        require(smartClaims.claimed(address(smart)), "smart account did not claim own seat");
        require(smartClaims.claimedCount() == 1 && smartClaims.roleFor(address(smart)) == 1,
                "smart account founder role inconsistent");
        vm.prank(owner);
        (bool duplicate,) = address(smart).call(
            abi.encodeCall(smart.claim, (address(smartClaims)))
        );
        require(!duplicate, "smart account double claim");
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
