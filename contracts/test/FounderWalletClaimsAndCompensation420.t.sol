// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/governance/FoundingWalletClaims420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";
import "../src/revenue/DevelopmentCompensationVault420.sol";

interface VmFounderWallets420 {
    function prank(address) external;
    function deal(address,uint256) external;
    function chainId(uint256) external;
}

contract FounderWalletTestReceiver420 {
    receive() external payable {}
}

contract FounderCompensationCapabilities420 {
    address public immutable approvedSource;
    constructor(address source) { approvedSource = source; }
    function isAuthorized(address principal, bytes32, bytes32, bytes32, uint256)
        external view returns (bool) { return principal == approvedSource; }
}
contract FounderCompensationTestToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function approve(address spender,uint256 amount) external returns (bool) {
        allowance[msg.sender][spender]=amount;return true;
    }
    function transferFrom(address source,address recipient,uint256 amount) external returns (bool) {
        require(allowance[source][msg.sender]>=amount && balanceOf[source]>=amount,"insufficient");
        allowance[source][msg.sender]-=amount;
        balanceOf[source]-=amount;balanceOf[recipient]+=amount;return true;
    }
    function transfer(address recipient,uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender]>=amount,"insufficient");
        balanceOf[msg.sender]-=amount;balanceOf[recipient]+=amount;return true;
    }
}
contract FounderCompensationDishonestToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function approve(address spender,uint256 amount) external returns (bool) {
        allowance[msg.sender][spender]=amount;return true;
    }
    function transferFrom(address,address,uint256) external pure returns (bool) { return true; }
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
    DevelopmentCompensationVault420 internal vault;
    FounderCompensationCapabilities420 internal capabilities;
    bytes32 internal constant APP_ID = keccak256("COMPENSATION_SOURCE_APPLICATION");
    function setUp() public {
        claims = new FoundingWalletClaims420(ADMIN, ANDREW, JANET, keccak256("signed-genesis-plan"));
        splitter = new FoundingDeveloperCompensationSplitter420(ADMIN, ANDREW, JANET);
        capabilities = new FounderCompensationCapabilities420(address(this));
        vault = new DevelopmentCompensationVault420(address(capabilities),address(splitter));
        splitter.bindCompensationVault(address(vault));
        require(vault.beneficiary()==address(splitter) && splitter.compensationVault()==address(vault),
                "immutable vault/splitter deployment handshake");
    }
    function fundNative(bytes32 revenueRef,uint256 amount) internal {
        // Vault policy BPS 1000: gross=10x net sent to the immutable splitter.
        vault.contributeNative{value:amount}(
            APP_ID,revenueRef,vault.policyId(),amount*10,1000
        );
    }
    function fundToken(FounderCompensationTestToken420 token,bytes32 revenueRef,uint256 amount) internal {
        token.mint(address(this),amount);
        token.approve(address(vault),amount);
        vault.contributeToken(address(token),APP_ID,revenueRef,vault.policyId(),amount*10,1000);
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
        vm.deal(address(this), 1_200 ether);
        fundNative(keccak256("native-revenue-1"),1001 ether);
        require(splitter.totalNativeCredited()==1001 ether, "only authenticated native Vault revenue credited");
        require(splitter.claimableNative(ADMIN)==500.5 ether, "admin 50");
        require(splitter.claimableNative(ANDREW)==250.25 ether, "andrew 25");
        require(splitter.claimableNative(JANET)==250.25 ether, "janet 25");
        vm.prank(address(0xBEEF));
        (bool outsider,)=address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(!outsider, "stranger cannot claim");
        vm.prank(ADMIN); splitter.claimNative();
        vm.prank(ANDREW); splitter.claimNative();
        vm.prank(JANET); splitter.claimNative();
        require(splitter.totalNativeClaimed()==1001 ether && address(splitter).balance==0,
                "all compensated native actually paid");
        fundNative(keccak256("native-revenue-2"),10 ether);
        require(splitter.claimableNative(ADMIN)==5 ether
            && splitter.claimableNative(ANDREW)==2.5 ether, "cumulative revenue split");
        vm.prank(ADMIN);
        (bool twice,)=address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(twice, "new earned compensation must be claimable");
        vm.prank(ADMIN);
        (bool replay,)=address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(!replay, "no repeated amount from same credited revenue");
        require(splitter.administrator()==ADMIN && splitter.andrew()==ANDREW
            && splitter.janet()==JANET, "beneficiaries immutable");
    }

    function testTokenSplitUsesExactVaultTransfersAndRejectsFakeSuccess() public {
        FounderCompensationTestToken420 token = new FounderCompensationTestToken420();
        // Arbitrary token transfers (including possible Genesis grants) do
        // NOT enter the application-revenue ledger.
        token.mint(address(splitter),777);
        require(splitter.claimableToken(address(token),ADMIN)==0, "unapproved token transfer counted");
        fundToken(token,keccak256("token-revenue-1"),101);
        require(splitter.totalTokenCredited(address(token))==101, "funded source not reconciled");
        require(splitter.claimableToken(address(token),ADMIN)==50,"admin token share");
        require(splitter.claimableToken(address(token),ANDREW)==25,"andrew token share");
        require(splitter.claimableToken(address(token),JANET)==26,"janet remainder");
        vm.prank(ADMIN); splitter.claimToken(address(token));
        vm.prank(ANDREW); splitter.claimToken(address(token));
        vm.prank(JANET); splitter.claimToken(address(token));
        require(token.balanceOf(ADMIN)==50 && token.balanceOf(ANDREW)==25
            && token.balanceOf(JANET)==26 && token.balanceOf(address(splitter))==777,
            "only genuine Vault-received token amounts paid");
        fundToken(token,keccak256("token-revenue-2"),100);
        require(splitter.claimableToken(address(token),ADMIN)==50,"incremental token entitlement");
        FounderCompensationDishonestToken420 dishonest=new FounderCompensationDishonestToken420();
        dishonest.mint(address(this),100);
        dishonest.approve(address(vault),100);
        (bool fake,)=address(vault).call(
            abi.encodeCall(vault.contributeToken,(address(dishonest),APP_ID,
                keccak256("dishonest-token"),vault.policyId(),1000,1000))
        );
        require(!fake && splitter.totalTokenCredited(address(dishonest))==0,
                "fake-success ERC20 was counted as revenue");
        vm.prank(ADMIN);
        (bool stolen,)=address(splitter).call(
            abi.encodeCall(splitter.claimToken,(address(dishonest)))
        );
        require(!stolen, "unearned dishonest-token claims");
    }

    function testVaultImmutableBindingAndDirectDepositsCannotMixGenesisGrants() public {
        require(splitter.compensationVault()==address(vault),"one-shot vault binding missing");
        require(vault.beneficiary()==address(splitter),"vault immutable beneficiary wrong");
        DevelopmentCompensationVault420 other = new DevelopmentCompensationVault420(
            address(capabilities),address(splitter));
        (bool rebound,)=address(splitter).call(
            abi.encodeCall(splitter.bindCompensationVault,(address(other)))
        );
        require(!rebound && splitter.compensationVault()==address(vault), "vault address mutable");
        vm.deal(address(this),5 ether);
        (bool direct,)=address(splitter).call{value:1 ether}("");
        require(!direct && splitter.totalNativeCredited()==0,"direct Genesis transfer credited as developer revenue");
        vm.deal(address(splitter),9 ether);
        require(splitter.claimableNative(ADMIN)==0
            && splitter.claimableNative(ANDREW)==0
            && splitter.claimableNative(JANET)==0,
            "involuntary native balance accepted as developer revenue");
        (bool forged,)=address(splitter).call(
            abi.encodeCall(splitter.recordVaultTokenCompensation,
                (address(other),uint256(100),keccak256("fake")))
        );
        require(!forged, "unapproved vault spoofed compensated token accounting");
        // Protocol itself, not beneficiaries, selects the immutable revenue
        // vault at construction. No founder-only unilateral destination changes.
        vm.prank(ADMIN);
        (bool adminRebound,)=address(splitter).call(
            abi.encodeCall(splitter.bindCompensationVault,(address(other)))
        );
        require(!adminRebound, "admin unilaterally replaced vault");
    }

    function testRevenueContributionReplaysAndTokenCallbackReplaysRevertAtomically() public {
        vm.deal(address(this),30 ether);
        bytes32 ref=keccak256("revenue-replay");
        fundNative(ref,10 ether);
        (bool replay,)=address(vault).call{value:10 ether}(
            abi.encodeCall(vault.contributeNative,(APP_ID,ref,vault.policyId(),100 ether,uint16(1000)))
        );
        require(!replay && splitter.totalNativeCredited()==10 ether
            && address(splitter).balance==10 ether,"replayed revenue contribution credited twice");
        FounderCompensationTestToken420 token=new FounderCompensationTestToken420();
        fundToken(token,keccak256("token-replay"),100);
        bytes32 contribution=vault.contributionId(address(this),APP_ID,keccak256("token-replay"));
        (bool forged,)=address(splitter).call(
            abi.encodeCall(splitter.recordVaultTokenCompensation,
                (address(token),uint256(100),contribution))
        );
        require(!forged && splitter.totalTokenCredited(address(token))==100,
                "direct or duplicate token receipt acknowledged");
        vm.prank(JANET); splitter.claimToken(address(token));
        vm.prank(JANET);
        (bool doubleClaim,)=address(splitter).call(abi.encodeCall(splitter.claimToken,(address(token))));
        require(!doubleClaim,"duplicate token payout");
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
        vm.deal(address(this), 10);
        fundNative(keccak256("1-wei-revenue"),1);
        require(splitter.claimableNative(ADMIN) == 0 && splitter.claimableNative(ANDREW) == 0, "rounding");
        require(splitter.claimableNative(JANET) == 1, "dust allocation");
        vm.prank(JANET); splitter.claimNative();
        vm.prank(JANET);
        (bool replay,) = address(splitter).call(abi.encodeCall(splitter.claimNative, ()));
        require(!replay, "double claim");
    }

    function testInterleavedDustClaimsCannotInsolvateNativeOrToken() public {
        vm.deal(address(this), 4);
        FounderCompensationTestToken420 token = new FounderCompensationTestToken420();
        for (uint256 i = 0; i < 4; i++) {
            fundNative(keccak256(abi.encode("native-dust", i)), 1);
            fundToken(token, keccak256(abi.encode("token-dust", i)), 1);
            address[3] memory founders = [ADMIN, ANDREW, JANET];
            for (uint256 j = 0; j < founders.length; j++) {
                address founder = founders[j];
                if (splitter.claimableNative(founder) != 0) {
                    vm.prank(founder);
                    splitter.claimNative();
                }
                if (splitter.claimableToken(address(token), founder) != 0) {
                    vm.prank(founder);
                    splitter.claimToken(address(token));
                }
            }
            require(splitter.totalNativeClaimed() == i + 1, "native cumulative conservation");
            require(splitter.totalTokenClaimed(address(token)) == i + 1, "token cumulative conservation");
        }
        require(splitter.nativeClaimed(ADMIN) == 2 && splitter.nativeClaimed(ANDREW) == 1
            && splitter.nativeClaimed(JANET) == 1, "native 50/25/25");
        require(token.balanceOf(ADMIN) == 2 && token.balanceOf(ANDREW) == 1
            && token.balanceOf(JANET) == 1, "token 50/25/25");
        require(address(splitter).balance == 0 && token.balanceOf(address(splitter)) == 0, "no unpaid liability");
    }
}
