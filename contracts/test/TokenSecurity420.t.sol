// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/token/TokenIds420.sol";
import "../src/token/TokenTemplateRegistry420.sol";
import "../src/token/TokenFactory420.sol";
import "../src/token/ERC20Template420.sol";
import "../src/token/ERC721Template420.sol";
import "../src/token/ERC1155Template420.sol";

interface VmTokenSecurity420 {
    function deal(address, uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function warp(uint256) external;
}

contract TokenSecurityTreasury420 {
    bytes32 public immutable vaultId;
    uint256 public totalDeposited;
    bool public failDeposits;

    constructor(bytes32 id) { vaultId = id; }
    function setFail(bool value) external { failDeposits = value; }
    function depositNative() external payable {
        if (failDeposits) revert("treasury down");
        totalDeposited += msg.value;
    }
}

contract TokenUnsafeRecipient420 {}

contract TokenSecurity420Test {
    VmTokenSecurity420 constant vm =
        VmTokenSecurity420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    TokenTemplateRegistry420 registry;
    TokenSecurityTreasury420 treasury;
    TokenFactory420 factory;

    function setUp() public {
        registry = new TokenTemplateRegistry420(address(this));
        treasury = new TokenSecurityTreasury420(TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT);
        factory = new TokenFactory420(address(registry), address(treasury));
        vm.deal(ALICE, 1000 ether);
        vm.deal(BOB, 1000 ether);
    }

    function _create(bytes32 id, bytes32 salt) private returns (ERC20Template420 token) {
        vm.prank(ALICE);
        token = ERC20Template420(
            factory.createERC20{value: 42 ether}(id, "Token", "TOK", 100 ether, 0, salt)
        );
    }

    function testExactFeeRejectsUnderAndOverPayment() public {
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.IncorrectFee.selector);
        factory.createERC20{value: 41 ether}(TokenIds420.ERC20_FIXED, "A", "A", 1 ether, 0, bytes32("under"));

        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.IncorrectFee.selector);
        factory.createERC20{value: 43 ether}(TokenIds420.ERC20_FIXED, "A", "A", 1 ether, 0, bytes32("over"));
    }

    function testTreasuryFailureRevertsDeploymentAndNonceAtomically() public {
        treasury.setFail(true);
        uint256 nonceBefore = factory.creatorNonce(ALICE);
        uint256 countBefore = factory.deploymentCount();

        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TreasuryDepositFailed.selector);
        factory.createERC20{value: 42 ether}(TokenIds420.ERC20_FIXED, "A", "A", 1 ether, 0, bytes32("fail"));

        require(factory.creatorNonce(ALICE) == nonceBefore, "nonce survived reverted deployment");
        require(factory.deploymentCount() == countBefore, "provenance survived reverted deployment");
        require(address(factory).balance == 0, "factory retained fee");
    }

    function testGovernanceMayDisableTemplateButUserCannot() public {
        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        registry.setEnabled(TokenIds420.ERC20_FIXED, false);

        registry.setEnabled(TokenIds420.ERC20_FIXED, false);
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TemplateDisabled.selector);
        factory.createERC20{value: 42 ether}(TokenIds420.ERC20_FIXED, "A", "A", 1 ether, 0, bytes32("disabled"));
    }

    function testUnknownTemplateCannotDeploy() public {
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TemplateDisabled.selector);
        factory.createERC20{value: 42 ether}(keccak256("unknown"), "A", "A", 1 ether, 0, bytes32("unknown"));
    }

    function testCreatorNonceSeparatesRepeatedUserSaltAndProvenanceIsRecorded() public {
        vm.prank(ALICE);
        address first = factory.createERC20{value: 42 ether}(
            TokenIds420.ERC20_FIXED, "One", "ONE", 1 ether, 0, bytes32("same")
        );
        vm.prank(ALICE);
        address second = factory.createERC20{value: 42 ether}(
            TokenIds420.ERC20_FIXED, "Two", "TWO", 2 ether, 0, bytes32("same")
        );

        require(first != second, "creator nonce did not separate CREATE2 salt");
        require(factory.creatorNonce(ALICE) == 2, "creator nonce mismatch");
        TokenFactory420.Deployment memory a = factory.deployment(0);
        TokenFactory420.Deployment memory b = factory.deployment(1);
        require(a.creator == ALICE && b.creator == ALICE, "creator provenance");
        require(a.templateId == TokenIds420.ERC20_FIXED, "template provenance");
        require(a.templateVersion == 1 && b.templateVersion == 1, "version provenance");
        require(a.configHash != bytes32(0) && b.configHash != bytes32(0) && a.configHash != b.configHash, "config provenance");
    }

    function testFactoryRetainsNoTokenAuthorityOrCustody() public {
        ERC20Template420 token = _create(TokenIds420.ERC20_MINTABLE, bytes32("authority"));
        require(token.owner() == ALICE, "creator not owner");
        require(token.balanceOf(address(factory)) == 0, "factory token custody");

        vm.expectRevert(ERC20Template420.Unauthorized.selector);
        token.mint(address(this), 1 ether);
    }

    function testBurnableAllowanceAndBalanceBoundaries() public {
        ERC20Template420 token = _create(TokenIds420.ERC20_BURNABLE, bytes32("burn"));
        vm.prank(ALICE);
        token.approve(BOB, 10 ether);
        vm.prank(BOB);
        token.burnFrom(ALICE, 10 ether);
        require(token.totalSupply() == 90 ether, "burn supply");
        vm.prank(BOB);
        vm.expectRevert(ERC20Template420.InsufficientAllowance.selector);
        token.burnFrom(ALICE, 1);
    }

    function testPermitConsumesNonceAndRejectsReplayAndExpiry() public {
        uint256 key = 0x420;
        address holder = vm.addr(key);
        vm.deal(holder, 100 ether);
        vm.prank(holder);
        ERC20Template420 token = ERC20Template420(
            factory.createERC20{value: 42 ether}(TokenIds420.ERC20_PERMIT, "Permit", "PMT", 5 ether, 0, bytes32("permit"))
        );

        uint256 deadline = block.timestamp + 1000;
        bytes32 typehash = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(typehash, holder, BOB, 3 ether, uint256(0), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);

        token.permit(holder, BOB, 3 ether, deadline, v, r, s);
        require(token.nonces(holder) == 1, "nonce not consumed");
        require(token.allowance(holder, BOB) == 3 ether, "permit allowance");

        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, BOB, 3 ether, deadline, v, r, s);

        vm.warp(deadline + 1);
        vm.expectRevert(ERC20Template420.Expired.selector);
        token.permit(holder, BOB, 1, deadline, v, r, s);
    }

    function testVotesTrackDelegatedBalances() public {
        ERC20Template420 token = _create(TokenIds420.ERC20_VOTES, bytes32("votes"));
        vm.prank(ALICE);
        token.delegate(ALICE);
        require(token.getVotes(ALICE) == 100 ether, "initial delegated votes");

        vm.prank(ALICE);
        token.transfer(BOB, 25 ether);
        require(token.getVotes(ALICE) == 75 ether, "sender delegated votes");
        require(token.getVotes(BOB) == 0, "undelegated receiver gained votes");

        vm.prank(BOB);
        token.delegate(BOB);
        require(token.getVotes(BOB) == 25 ether, "receiver delegation");
    }

    function testERC721SafeTransferRejectsIncompatibleContract() public {
        vm.prank(ALICE);
        ERC721Template420 token = ERC721Template420(
            factory.createERC721{value: 42 ether}("NFT", "NFT", "ipfs://", bytes32("721"))
        );
        vm.prank(ALICE);
        token.mint(ALICE, 1);
        vm.prank(ALICE);
        vm.expectRevert(ERC721Template420.UnsafeRecipient.selector);
        token.safeTransferFrom(ALICE, address(new TokenUnsafeRecipient420()), 1);
        require(token.ownerOf(1) == ALICE, "unsafe transfer was not atomic");
    }

    function testERC1155SafeTransferRejectsIncompatibleContract() public {
        vm.prank(ALICE);
        ERC1155Template420 token = ERC1155Template420(
            factory.createERC1155{value: 42 ether}("ipfs://{id}", bytes32("1155"))
        );
        vm.prank(ALICE);
        token.mint(ALICE, 1, 10, "");
        TokenUnsafeRecipient420 bad = new TokenUnsafeRecipient420();
        vm.prank(ALICE);
        vm.expectRevert(ERC1155Template420.UnsafeRecipient.selector);
        token.safeTransferFrom(ALICE, address(bad), 1, 1, "");
        require(token.balanceOf(ALICE, 1) == 10, "unsafe 1155 transfer was not atomic");
    }
}
