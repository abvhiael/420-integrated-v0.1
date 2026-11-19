// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/token/TokenIds420.sol";
import "../src/token/ERC20Template420.sol";
import "../src/token/ERC721Template420.sol";
import "../src/token/ERC1155Template420.sol";

interface VmTokenCompliance420 {
    function prank(address who) external;
    function expectRevert(bytes4 selector) external;
    function chainId(uint256 chain) external;
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
}

contract TokenPermitCompliance420Test {
    VmTokenCompliance420 constant vm = VmTokenCompliance420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant KEY = 0x420420;
    uint256 constant CURVE_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
    bytes32 constant TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    address constant SPENDER = address(0xB0B);
    ERC20Template420 token;
    address holder;

    function setUp() public {
        holder = vm.addr(KEY);
        token = new ERC20Template420("Permit", "PMT", holder, 100 ether, 0, false, false, true, false, TokenIds420.ERC20_PERMIT);
    }

    function _domain(address target, uint256 chain) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Permit")),
                keccak256(bytes("1")),
                chain,
                target
            )
        );
    }

    function _sign(
        bytes32 domain,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) private returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domain, keccak256(abi.encode(TYPEHASH, holder, SPENDER, amount, nonce, deadline)))
        );
        return vm.sign(KEY, digest);
    }

    function testFuzzPermitCurrentChainAndContract(uint256 amount, uint64 nextChain) public {
        uint256 original = block.chainid;
        uint256 next = uint256(nextChain) + 1;
        if (next == original) ++next;
        uint256 deadline = block.timestamp + 100;
        bytes32 originalDomain = _domain(address(token), original);
        require(token.DOMAIN_SEPARATOR() == originalDomain, "initial domain");
        (uint8 v, bytes32 r, bytes32 s) = _sign(originalDomain, amount, 0, deadline);
        vm.chainId(next);
        bytes32 newDomain = _domain(address(token), next);
        require(token.DOMAIN_SEPARATOR() == newDomain && originalDomain != newDomain, "current chain domain");
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, SPENDER, amount, deadline, v, r, s);
        require(token.nonces(holder) == 0 && token.allowance(holder, SPENDER) == 0, "failed permit mutated state");
        (v, r, s) = _sign(newDomain, amount, 0, deadline);
        ERC20Template420 other = new ERC20Template420(
            "Permit", "PMT", holder, 100 ether, 0, false, false, true, false, TokenIds420.ERC20_PERMIT
        );
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        other.permit(holder, SPENDER, amount, deadline, v, r, s);
        require(other.nonces(holder) == 0, "cross contract nonce");
        token.permit(holder, SPENDER, amount, deadline, v, r, s);
        require(token.nonces(holder) == 1 && token.allowance(holder, SPENDER) == amount, "permit not applied");
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, SPENDER, amount, deadline, v, r, s);
        require(token.nonces(holder) == 1, "replay changed nonce");
        vm.chainId(original);
        require(token.DOMAIN_SEPARATOR() == originalDomain, "restored chain domain");
    }

    function testHighSAndZeroHolderFailWithoutNonceConsumption() public {
        uint256 deadline = block.timestamp + 100;
        (uint8 v, bytes32 r, bytes32 s) = _sign(token.DOMAIN_SEPARATOR(), 1, 0, deadline);
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(holder, SPENDER, 1, deadline, v == 27 ? 28 : 27, r, bytes32(CURVE_ORDER - uint256(s)));
        vm.expectRevert(ERC20Template420.InvalidSignature.selector);
        token.permit(address(0), SPENDER, 1, deadline, 27, bytes32(0), bytes32(0));
        require(token.nonces(holder) == 0 && token.nonces(address(0)) == 0, "invalid permit consumed nonce");
        token.permit(holder, SPENDER, 1, deadline, v, r, s);
        require(token.nonces(holder) == 1, "valid permit rejected");
    }
}

interface IERC721ApprovalQuery420 {
    function getApproved(uint256 id) external view returns (address);
}

interface IERC1155MetadataQuery420 {
    function uri(uint256 id) external view returns (string memory);
}

contract TokenReceiverCompliance420 is IERC721Receiver420, IERC1155Receiver420 {
    bool public reject;
    uint256 public calls;

    function setReject(bool value) external {
        reject = value;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        ++calls;
        return reject ? bytes4(0) : IERC721Receiver420.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        ++calls;
        return reject ? bytes4(0) : IERC1155Receiver420.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external returns (bytes4) {
        ++calls;
        return reject ? bytes4(0) : IERC1155Receiver420.onERC1155BatchReceived.selector;
    }
}

contract TokenNFTCompliance420Test {
    VmTokenCompliance420 constant vm = VmTokenCompliance420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant ATTACKER = address(0xBAD);
    ERC721Template420 nft;

    function setUp() public {
        nft = new ERC721Template420("Collection", "NFT", "ipfs://collection", address(this), TokenIds420.ERC721_COLLECTION);
    }

    function testFuzzApprovalExistenceClearingAndAuthorization(uint256 id) public {
        IERC721ApprovalQuery420 approvals = IERC721ApprovalQuery420(address(nft));
        require(nft.supportsInterface(0x80ac58cd) && nft.supportsInterface(0x5b5e139f), "ERC721 interface");
        require(!nft.supportsInterface(0xffffffff), "invalid interface");
        vm.expectRevert(ERC721Template420.NotMinted.selector);
        approvals.getApproved(id);
        vm.prank(ATTACKER);
        vm.expectRevert(ERC721Template420.Unauthorized.selector);
        nft.mint(ATTACKER, id);
        nft.mint(ALICE, id);
        require(approvals.getApproved(id) == address(0), "initial approval");
        vm.prank(ATTACKER);
        vm.expectRevert(ERC721Template420.Unauthorized.selector);
        nft.approve(ATTACKER, id);
        vm.prank(ALICE);
        nft.setApprovalForAll(BOB, true);
        vm.prank(BOB);
        nft.approve(BOB, id);
        require(approvals.getApproved(id) == BOB, "operator approval");
        vm.prank(BOB);
        nft.transferFrom(ALICE, BOB, id);
        require(nft.ownerOf(id) == BOB && approvals.getApproved(id) == address(0), "transfer approval");
        vm.prank(ALICE);
        vm.expectRevert(ERC721Template420.Unauthorized.selector);
        nft.burn(id);
        vm.prank(BOB);
        nft.burn(id);
        vm.expectRevert(ERC721Template420.NotMinted.selector);
        approvals.getApproved(id);
        nft.mint(ALICE, id);
        require(approvals.getApproved(id) == address(0) && nft.totalSupply() == 1, "remint state");
    }

    function testSafeTransferReceiverRollback() public {
        TokenReceiverCompliance420 receiver = new TokenReceiverCompliance420();
        nft.mint(ALICE, 1);
        vm.prank(ALICE);
        nft.approve(BOB, 1);
        receiver.setReject(true);
        vm.prank(BOB);
        vm.expectRevert(ERC721Template420.UnsafeRecipient.selector);
        nft.safeTransferFrom(ALICE, address(receiver), 1);
        require(nft.ownerOf(1) == ALICE && nft.getApproved(1) == BOB, "rejected transfer lost approval");
        require(receiver.calls() == 0, "receiver side effect survived revert");
        receiver.setReject(false);
        vm.prank(BOB);
        nft.safeTransferFrom(ALICE, address(receiver), 1);
        require(nft.ownerOf(1) == address(receiver) && receiver.calls() == 1, "receiver not called");
        require(nft.getApproved(1) == address(0) && nft.balanceOf(ALICE) == 0, "approval or balance not cleared");
    }
}

contract TokenMultiCompliance420Test {
    VmTokenCompliance420 constant vm = VmTokenCompliance420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant ATTACKER = address(0xBAD);
    string constant URI = "ipfs://collection/{id}.json";
    ERC1155Template420 multi;

    function setUp() public {
        multi = new ERC1155Template420(URI, address(this), TokenIds420.ERC1155_MULTI);
    }

    function testFuzzMetadataInterface(uint256 id) public view {
        require(multi.supportsInterface(0xd9b67a26) && multi.supportsInterface(0x0e89341c), "ERC1155 interface");
        require(!multi.supportsInterface(0xffffffff), "invalid interface");
        string memory metadata = IERC1155MetadataQuery420(address(multi)).uri(id);
        require(keccak256(bytes(metadata)) == keccak256(bytes(URI)), "standard metadata");
        require(keccak256(bytes(multi.uri())) == keccak256(bytes(metadata)), "legacy metadata");
    }

    function testFuzzBatchAuthorizationAndDuplicateIds(uint256 id, uint96 raw) public {
        uint256 amount = uint256(raw) + 1;
        multi.mint(ALICE, id, amount * 2, "");
        uint256[] memory ids = new uint256[](2);
        uint256[] memory values = new uint256[](2);
        ids[0] = id;
        ids[1] = id;
        values[0] = amount;
        values[1] = amount;
        vm.prank(ATTACKER);
        vm.expectRevert(ERC1155Template420.Unauthorized.selector);
        multi.safeBatchTransferFrom(ALICE, ATTACKER, ids, values, "");
        vm.prank(ATTACKER);
        vm.expectRevert(ERC1155Template420.Unauthorized.selector);
        multi.burn(ALICE, id, amount);
        vm.prank(ATTACKER);
        vm.expectRevert(ERC1155Template420.Unauthorized.selector);
        multi.mint(ATTACKER, id, amount, "");
        vm.prank(ALICE);
        multi.setApprovalForAll(BOB, true);
        TokenReceiverCompliance420 receiver = new TokenReceiverCompliance420();
        receiver.setReject(true);
        vm.prank(BOB);
        vm.expectRevert(ERC1155Template420.UnsafeRecipient.selector);
        multi.safeBatchTransferFrom(ALICE, address(receiver), ids, values, "");
        require(multi.balanceOf(ALICE, id) == amount * 2 && receiver.calls() == 0, "receiver rollback");
        values[1] = amount + 1;
        vm.prank(BOB);
        vm.expectRevert(ERC1155Template420.InsufficientBalance.selector);
        multi.safeBatchTransferFrom(ALICE, BOB, ids, values, "");
        require(multi.balanceOf(ALICE, id) == amount * 2 && multi.balanceOf(BOB, id) == 0, "partial batch");
        values[1] = amount;
        receiver.setReject(false);
        vm.prank(BOB);
        multi.safeBatchTransferFrom(ALICE, address(receiver), ids, values, "");
        require(multi.balanceOf(ALICE, id) == 0 && multi.balanceOf(address(receiver), id) == amount * 2, "batch balance");
        require(receiver.calls() == 1, "batch receiver");
    }

    function testSafeMintAndSingleTransferRollback() public {
        TokenReceiverCompliance420 receiver = new TokenReceiverCompliance420();
        receiver.setReject(true);
        vm.expectRevert(ERC1155Template420.UnsafeRecipient.selector);
        multi.mint(address(receiver), 1, 10, "");
        require(multi.balanceOf(address(receiver), 1) == 0, "mint rollback");
        multi.mint(ALICE, 1, 10, "");
        vm.prank(ALICE);
        vm.expectRevert(ERC1155Template420.UnsafeRecipient.selector);
        multi.safeTransferFrom(ALICE, address(receiver), 1, 10, "");
        require(multi.balanceOf(ALICE, 1) == 10 && receiver.calls() == 0, "transfer rollback");
        receiver.setReject(false);
        vm.prank(ALICE);
        multi.safeTransferFrom(ALICE, address(receiver), 1, 10, "");
        require(multi.balanceOf(address(receiver), 1) == 10 && receiver.calls() == 1, "receiver acceptance");
    }
}
