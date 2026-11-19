// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/token/TokenIds420.sol";
import "../src/token/ERC20Template420.sol";
import "../src/token/ERC721Template420.sol";
import "../src/token/ERC1155Template420.sol";
import "./helpers/InvariantTarget420.sol";

interface VmTokenInvariant420 {
    function prank(
        address who
    ) external;
}

contract TokenERC20InvariantHandler420 {
    VmTokenInvariant420 constant vm = VmTokenInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant CAP = 1_000_000 ether;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    ERC20Template420 public immutable capped;
    ERC20Template420 public immutable burnable;
    ERC20Template420 public immutable votes;
    uint256 public expectedCapped;
    uint256 public expectedBurnable;
    uint256 public constant VOTES_SUPPLY = 100 ether;

    constructor() {
        capped = new ERC20Template420(
            "Cap", "CAP", address(this), 0, CAP, true, false, false, false, TokenIds420.ERC20_CAPPED
        );
        burnable =
            new ERC20Template420("Burn", "BRN", ALICE, CAP, 0, false, true, false, false, TokenIds420.ERC20_BURNABLE);
        votes = new ERC20Template420(
            "Vote", "VOTE", ALICE, VOTES_SUPPLY, 0, false, false, true, true, TokenIds420.ERC20_VOTES
        );
        expectedBurnable = CAP;
        vm.prank(ALICE);
        votes.delegate(ALICE);
        vm.prank(BOB);
        votes.delegate(BOB);
    }

    function mintCapped(
        bool toBob,
        uint96 raw
    ) external {
        uint256 room = CAP - expectedCapped;
        uint256 amount = uint256(raw) % (room + 1);
        capped.mint(toBob ? BOB : ALICE, amount);
        expectedCapped += amount;
    }

    function move(
        bool fromBob,
        uint96 raw,
        uint8 profile
    ) external {
        address from = fromBob ? BOB : ALICE;
        address to = fromBob ? ALICE : BOB;
        ERC20Template420 token = profile % 3 == 0 ? capped : profile % 3 == 1 ? burnable : votes;
        uint256 amount = uint256(raw) % (token.balanceOf(from) + 1);
        vm.prank(from);
        token.approve(to, amount);
        vm.prank(to);
        token.transferFrom(from, to, amount);
    }

    function burn(
        bool fromBob,
        uint96 raw
    ) external {
        address from = fromBob ? BOB : ALICE;
        uint256 amount = uint256(raw) % (burnable.balanceOf(from) + 1);
        vm.prank(from);
        burnable.burn(amount);
        expectedBurnable -= amount;
    }
}

contract TokenERC20Invariant420Test is InvariantTarget420 {
    TokenERC20InvariantHandler420 internal handler;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        handler = new TokenERC20InvariantHandler420();
        targetContract(address(handler));
    }

    function invariant_SupplyAndVotesConserved() public view {
        ERC20Template420 cap = handler.capped();
        ERC20Template420 burn = handler.burnable();
        ERC20Template420 votes = handler.votes();
        require(cap.totalSupply() == handler.expectedCapped() && cap.totalSupply() <= cap.cap(), "cap supply");
        require(cap.balanceOf(ALICE) + cap.balanceOf(BOB) == cap.totalSupply(), "cap balances");
        require(burn.totalSupply() == handler.expectedBurnable(), "burn supply");
        require(burn.balanceOf(ALICE) + burn.balanceOf(BOB) == burn.totalSupply(), "burn balances");
        require(votes.totalSupply() == handler.VOTES_SUPPLY(), "fixed votes supply");
        require(votes.getVotes(ALICE) == votes.balanceOf(ALICE), "Alice votes");
        require(votes.getVotes(BOB) == votes.balanceOf(BOB), "Bob votes");
        require(votes.getVotes(ALICE) + votes.getVotes(BOB) == votes.totalSupply(), "votes conservation");
    }
}

contract TokenNFTInvariantHandler420 {
    VmTokenInvariant420 constant vm = VmTokenInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    ERC721Template420 public immutable nft;
    mapping(uint256 => address) public modelOwner;
    uint256 public modelSupply;

    constructor() {
        nft = new ERC721Template420("NFT", "NFT", "ipfs://", address(this), TokenIds420.ERC721_COLLECTION);
    }

    function step(
        uint8 rawId,
        uint8 action,
        bool toBob
    ) external {
        uint256 id = rawId % 8;
        address owner = modelOwner[id];
        address to = toBob ? BOB : ALICE;
        if (owner == address(0)) {
            nft.mint(to, id);
            modelOwner[id] = to;
            ++modelSupply;
        } else if (action % 3 == 0) {
            vm.prank(owner);
            nft.burn(id);
            delete modelOwner[id];
            --modelSupply;
        } else if (action % 3 == 1) {
            vm.prank(owner);
            nft.approve(to, id);
            vm.prank(to);
            nft.transferFrom(owner, to, id);
            modelOwner[id] = to;
        } else {
            vm.prank(owner);
            nft.transferFrom(owner, to, id);
            modelOwner[id] = to;
        }
    }
}

contract TokenNFTInvariant420Test is InvariantTarget420 {
    TokenNFTInvariantHandler420 internal handler;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        handler = new TokenNFTInvariantHandler420();
        targetContract(address(handler));
    }

    function invariant_UniqueOwnershipAndApprovalClearing() public view {
        ERC721Template420 nft = handler.nft();
        uint256 aliceCount;
        uint256 bobCount;
        for (uint256 id; id < 8; ++id) {
            address owner = handler.modelOwner(id);
            if (owner == address(0)) {
                (bool ok,) = address(nft).staticcall(abi.encodeCall(nft.getApproved, (id)));
                require(!ok, "nonexistent approval");
            } else {
                require(nft.ownerOf(id) == owner && nft.getApproved(id) == address(0), "owner or approval");
                if (owner == ALICE) ++aliceCount;
                else if (owner == BOB) ++bobCount;
                else revert("unknown holder");
            }
        }
        require(nft.balanceOf(ALICE) == aliceCount && nft.balanceOf(BOB) == bobCount, "owner balances");
        require(nft.totalSupply() == handler.modelSupply() && nft.totalSupply() == aliceCount + bobCount, "NFT supply");
    }
}

contract TokenMultiInvariantHandler420 {
    VmTokenInvariant420 constant vm = VmTokenInvariant420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    ERC1155Template420 public immutable multi;
    mapping(uint256 => uint256) public modelSupply;

    constructor() {
        multi = new ERC1155Template420("ipfs://{id}", address(this), TokenIds420.ERC1155_MULTI);
    }

    function step(
        uint8 rawId,
        uint8 action,
        uint64 rawAmount,
        bool fromBob
    ) external {
        uint256 id = rawId % 8;
        address from = fromBob ? BOB : ALICE;
        address to = fromBob ? ALICE : BOB;
        if (action % 3 == 0) {
            multi.mint(from, id, rawAmount, "");
            modelSupply[id] += rawAmount;
        } else {
            uint256 amount = uint256(rawAmount) % (multi.balanceOf(from, id) + 1);
            if (action % 3 == 1) {
                vm.prank(from);
                multi.burn(from, id, amount);
                modelSupply[id] -= amount;
            } else {
                vm.prank(from);
                multi.setApprovalForAll(to, true);
                vm.prank(to);
                multi.safeTransferFrom(from, to, id, amount, "");
            }
        }
    }
}

contract TokenMultiInvariant420Test is InvariantTarget420 {
    TokenMultiInvariantHandler420 internal handler;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        handler = new TokenMultiInvariantHandler420();
        targetContract(address(handler));
    }

    function invariant_PerIdSupplyConserved() public view {
        ERC1155Template420 multi = handler.multi();
        for (uint256 id; id < 8; ++id) {
            require(multi.balanceOf(ALICE, id) + multi.balanceOf(BOB, id) == handler.modelSupply(id), "multi supply");
        }
    }
}
