// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/SystemAccess.sol";

import "../src/token/TokenIds420.sol";
import "../src/token/TokenTemplateRegistry420.sol";
import "../src/token/TokenFactory420.sol";
import "../src/token/ERC20Template420.sol";
import "../src/token/ERC721Template420.sol";
import "../src/token/ERC1155Template420.sol";

interface VmTokenAudit420 {
    function deal(address who, uint256 amount) external;
    function prank(address who) external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
    function roll(uint256 blockNumber) external;
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract TokenAuditTreasury420 {
    bytes32 public immutable vaultId;
    uint256 public totalDeposited;
    bool public rejectDeposits;
    constructor(bytes32 vaultId_) { vaultId = vaultId_; }
    function setRejectDeposits(bool reject_) external { rejectDeposits = reject_; }
    function depositNative() external payable {
        if (rejectDeposits) revert("rejected");
        totalDeposited += msg.value;
    }
}

contract RejectERC721Receiver420 {}
contract RejectERC1155Receiver420 {}

contract TokenAudit420Test {
    VmTokenAudit420 constant vm = VmTokenAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    uint256 constant HOLDER_PK = 0x420420;

    TokenTemplateRegistry420 registry;
    TokenAuditTreasury420 treasury;
    TokenFactory420 factory;

    function setUp() public {
        registry = new TokenTemplateRegistry420(address(this));
        treasury = new TokenAuditTreasury420(TokenIds420.COMMUNITY_TOKEN_REVENUE_VAULT);
        factory = new TokenFactory420(address(registry), address(treasury));
        vm.deal(ALICE, 1000 ether);
    }

    function _create(bytes32 id, uint256 supply, uint256 cap_, bytes32 salt) private returns (ERC20Template420 t) {
        vm.prank(ALICE);
        t = ERC20Template420(factory.createERC20{value: 42 ether}(id, "Audit", "AUD", supply, cap_, salt));
    }

    function testTemplateCatalogFrozenAndGovernanceOnlyDisable() public {
        bytes32[8] memory ids = [
            TokenIds420.ERC20_FIXED,
            TokenIds420.ERC20_MINTABLE,
            TokenIds420.ERC20_CAPPED,
            TokenIds420.ERC20_BURNABLE,
            TokenIds420.ERC20_PERMIT,
            TokenIds420.ERC20_VOTES,
            TokenIds420.ERC721_COLLECTION,
            TokenIds420.ERC1155_MULTI
        ];
        for (uint256 i; i < ids.length; i++) {
            TokenTemplateRegistry420.Template memory t = registry.template(ids[i]);
            require(t.exists && t.enabled && t.version == 1, "template drift");
        }
        vm.prank(ALICE);
        vm.expectRevert(SystemAccess.Unauthorized.selector);
        registry.setEnabled(TokenIds420.ERC20_FIXED, false);
        registry.setEnabled(TokenIds420.ERC20_FIXED, false);
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TemplateDisabled.selector);
        factory.createERC20{value: 42 ether}(TokenIds420.ERC20_FIXED, "x", "x", 1, 0, bytes32("disabled"));
    }

    function testUnknownAndCrossStandardTemplateIdsFailClosed() public {
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TemplateDisabled.selector);
        factory.createERC20{value: 42 ether}(keccak256("unknown"), "x", "x", 1, 0, bytes32("unknown"));
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.InvalidTemplate.selector);
        factory.createERC20{value: 42 ether}(TokenIds420.ERC721_COLLECTION, "x", "x", 1, 0, bytes32("wrong-standard"));
    }

    function testTreasuryFailureRollsBackNonceAndDeploymentRecord() public {
        treasury.setRejectDeposits(true);
        vm.prank(ALICE);
        vm.expectRevert(TokenFactory420.TreasuryDepositFailed.selector);
        factory.createERC20{value: 42 ether}(TokenIds420.ERC20_FIXED, "x", "x", 1, 0, bytes32("rollback"));
        require(factory.creatorNonce(ALICE) == 0, "nonce survived revert");
        require(factory.deploymentCount() == 0, "deployment survived revert");
        require(address(factory).balance == 0, "fee stranded");
    }

    function testProvenanceAndCreatorNonceIsolation() public {
        ERC20Template420 first = _create(TokenIds420.ERC20_FIXED, 7 ether, 0, bytes32("same"));
        ERC20Template420 second = _create(TokenIds420.ERC20_FIXED, 7 ether, 0, bytes32("same"));
        require(address(first) != address(second), "nonce did not isolate deployment");
        TokenFactory420.Deployment memory d = factory.deployment(0);
        require(d.token == address(first) && d.creator == ALICE, "creator provenance");
        require(d.templateId == TokenIds420.ERC20_FIXED && d.templateVersion == 1, "template provenance");
        require(d.configHash == keccak256(abi.encode("Audit", "AUD", uint256(7 ether), uint256(0))), "config provenance");
        require(factory.isFactoryDeployment(address(first)), "factory provenance");
        require(address(factory).balance == 0 && treasury.totalDeposited() == 84 ether, "fee routing");
    }

    function testPermitDomainNonceReplayExpiryAndCanonicalSignature() public {
        address holder = vm.addr(HOLDER_PK);
        vm.deal(holder, 100 ether);
        vm.prank(holder);
        ERC20Template420 token = ERC20Template420(factory.createERC20{value: 42 ether}(
            TokenIds420.ERC20_PERMIT, "Permit", "PMT", 100 ether, 0, bytes32("permit")
        ));
        uint256 deadline = block.timestamp + 1000;
        bytes32 typehash = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01", token.DOMAIN_SEPARATOR(),
            keccak256(abi.encode(typehash, holder, BOB, uint256(5 ether), uint256(0), deadline))
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(HOLDER_PK, digest);
        token.permit(holder, BOB, 5 ether, deadline, v, r, s);
        require(token.allowance(holder, BOB) == 5 ether && token.nonces(holder) == 1, "permit failed");
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, BOB, 5 ether, deadline, v, r, s);
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, BOB, 1, deadline, 29, r, s);
        vm.warp(deadline + 1);
        vm.expectRevert(ERC20Template420.Expired.selector);
        token.permit(holder, BOB, 1, deadline, v, r, s);
    }

    function testVotesTrackDelegatedBalancesAndHistoricalBlock() public {
        ERC20Template420 token = _create(TokenIds420.ERC20_VOTES, 100 ether, 0, bytes32("votes"));
        vm.prank(ALICE);
        token.delegate(ALICE);
        uint256 snapshotBlock = block.number;
        require(token.getVotes(ALICE) == 100 ether, "initial votes");
        vm.roll(snapshotBlock + 1);
        vm.prank(BOB);
        token.delegate(BOB);
        vm.prank(ALICE);
        token.transfer(BOB, 40 ether);
        require(token.getVotes(ALICE) == 60 ether, "sender votes");
        require(token.getVotes(BOB) == 40 ether, "receiver votes");
        require(token.getPastVotes(ALICE, snapshotBlock) == 100 ether, "historical votes");
    }

    function testBurnAndCapSemantics() public {
        ERC20Template420 burnable = _create(TokenIds420.ERC20_BURNABLE, 10 ether, 0, bytes32("burn"));
        vm.prank(ALICE);
        burnable.burn(3 ether);
        require(burnable.totalSupply() == 7 ether, "burn supply");
        ERC20Template420 capped = _create(TokenIds420.ERC20_CAPPED, 9 ether, 10 ether, bytes32("cap"));
        vm.prank(ALICE);
        capped.mint(ALICE, 1 ether);
        vm.prank(ALICE);
        vm.expectRevert(ERC20Template420.CapExceeded.selector);
        capped.mint(ALICE, 1);
    }

    function testSafeNFTAndMultiTokenTransfersRejectIncompatibleContracts() public {
        vm.prank(ALICE);
        ERC721Template420 nft = ERC721Template420(factory.createERC721{value: 42 ether}("NFT", "NFT", "ipfs://", bytes32("721")));
        vm.prank(ALICE);
        nft.mint(ALICE, 1);
        RejectERC721Receiver420 bad721 = new RejectERC721Receiver420();
        vm.prank(ALICE);
        vm.expectRevert(ERC721Template420.UnsafeRecipient.selector);
        nft.safeTransferFrom(ALICE, address(bad721), 1);

        vm.prank(ALICE);
        ERC1155Template420 multi = ERC1155Template420(factory.createERC1155{value: 42 ether}("ipfs://{id}", bytes32("1155")));
        vm.prank(ALICE);
        multi.mint(ALICE, 1, 2, "");
        RejectERC1155Receiver420 bad1155 = new RejectERC1155Receiver420();
        vm.prank(ALICE);
        vm.expectRevert(ERC1155Template420.UnsafeRecipient.selector);
        multi.safeTransferFrom(ALICE, address(bad1155), 1, 1, "");
    }

    function testFactoryNeverOwnsCreatedTokens() public {
        ERC20Template420 token = _create(TokenIds420.ERC20_MINTABLE, 1 ether, 0, bytes32("owner"));
        require(token.owner() == ALICE && token.balanceOf(address(factory)) == 0, "factory authority");
        vm.prank(address(factory));
        vm.expectRevert(ERC20Template420.Unauthorized.selector);
        token.mint(address(factory), 1 ether);
    }
}
