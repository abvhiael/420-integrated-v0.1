// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/ITronFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "./tron/TronWire420.sol";

/// @notice TRON DPoS light verifier with explicit governance-authenticated, bounded
/// checkpoint/SR permission snapshots. Native producer signatures prove solidification;
/// a SolidityNode/RPC commitment label never does. It does not replay SR elections.
contract TronFinalityVerifier420 is ITronFinalityVerifier420, SystemAccess {
    bytes32 public constant MAINNET_GENESIS = 0x00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc;
    bytes32 public constant NETWORK = keccak256("TRON/MAINNET");
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;

    struct ProfileInput {
        bytes32 genesis; bytes32 snapshotHash; uint64 checkpointNumber; bytes32 checkpointHash;
        uint64 checkpointTime; uint64 lastNumber; uint64 expiresAt;
        bytes20[27] witnesses; address[27] signingKeys;
    }
    struct Profile { ProfileInput config; bool disabled; }
    struct SolidBlock { bytes32 id; bytes32 transactionRoot; uint64 timestamp; }
    struct DepositProof { bytes32 profile; uint64 number; bytes transaction; uint32 index; uint32 count; bytes32[] siblings; }
    mapping(bytes32 => Profile) private profiles;
    mapping(bytes32 => mapping(uint64 => SolidBlock)) public solidBlocks;
    mapping(uint64 => bytes32) public canonicalSolid;
    mapping(bytes32 => uint64) public solidHeight;
    mapping(bytes20 => bytes32) public gatewayRoutes;
    error InvalidProfile(); error InvalidChain(); error NotSolid(); error InvalidDeposit();
    event ProfileInstalled(bytes32 indexed id, bytes32 indexed snapshotHash, uint64 checkpoint, uint64 lastNumber, uint64 expiresAt);
    event ProfileDisabled(bytes32 indexed id);
    event Solidified(bytes32 indexed profile, uint64 indexed number, bytes32 blockId);

    constructor(address governance, address router) SystemAccess(governance) {
        if (router.code.length == 0) revert InvalidProfile();
        destinationChainId = block.chainid; destinationRouter = router;
    }

    /// @dev Governance authenticates the canonical checkpoint, exact ordered active
    /// SR set and witness-permission keys, and a validity window containing no
    /// maintenance/SR/permission/consensus change. No snapshot is inferred from RPC.
    function installProfile(ProfileInput calldata c) external onlyGovernance returns (bytes32 id) {
        if (c.genesis != MAINNET_GENESIS || c.snapshotHash == 0 || c.checkpointHash == 0 ||
            uint64(uint256(c.checkpointHash) >> 192) != c.checkpointNumber ||
            c.checkpointTime == 0 || c.lastNumber <= c.checkpointNumber ||
            c.expiresAt <= c.checkpointTime || c.expiresAt - c.checkpointTime > 21_600_000 ||
            (canonicalSolid[c.checkpointNumber] != 0 && canonicalSolid[c.checkpointNumber] != c.checkpointHash)) revert InvalidProfile();
        for (uint256 i; i < 27; ++i) {
            if (c.witnesses[i] == 0 || c.signingKeys[i] == address(0)) revert InvalidProfile();
            for (uint256 j; j < i; ++j) if (c.witnesses[i] == c.witnesses[j]) revert InvalidProfile();
        }
        id = keccak256(abi.encode("420/TRON/PROFILE/V1", destinationChainId, address(this), c));
        if (profiles[id].config.snapshotHash != 0) revert InvalidProfile();
        profiles[id].config = c;
        canonicalSolid[c.checkpointNumber] = c.checkpointHash;
        solidBlocks[id][c.checkpointNumber] = SolidBlock(c.checkpointHash, 0, c.checkpointTime);
        solidHeight[id] = c.checkpointNumber;
        emit ProfileInstalled(id, c.snapshotHash, c.checkpointNumber, c.lastNumber, c.expiresAt);
    }

    function profile(bytes32 id) external view returns (Profile memory) { return profiles[id]; }
    function disableProfile(bytes32 id) external onlyGovernance {
        if (profiles[id].config.snapshotHash == 0) revert InvalidProfile();
        profiles[id].disabled = true; emit ProfileDisabled(id);
    }
    function setGateway(bytes20 account, bytes32 route) external onlyGovernance {
        if (account == 0) revert InvalidDeposit(); gatewayRoutes[account] = route;
    }

    /// @notice Verify a consecutive signed branch from a trusted/solid anchor and
    /// certify its prefix only after 19 distinct active SRs extend the target.
    /// Competing unsolid branches are stateless: an invalid first submission cannot
    /// pin a pending head. Already-solidified heights cannot be replaced.
    function solidify(bytes32 id, uint64 anchor, bytes[] calldata rawHeaders, bytes[] calldata signatures, uint32 targetIndex) external {
        Profile storage p = profiles[id]; ProfileInput storage c = p.config;
        uint256 len = rawHeaders.length;
        if (block.chainid != destinationChainId || p.disabled || c.snapshotHash == 0 || len == 0 || len > 512 ||
            signatures.length != len || targetIndex >= len) revert InvalidChain();
        SolidBlock memory prev = solidBlocks[id][anchor];
        if (prev.id == 0 || canonicalSolid[anchor] != prev.id) revert InvalidChain();
        uint256 seen; uint256 distinct;
        SolidBlock[] memory accepted = new SolidBlock[](uint256(targetIndex) + 1);
        for (uint256 i; i < len; ++i) {
            TronWire420.Header memory h = TronWire420.header(rawHeaders[i]);
            if (h.number != uint256(anchor) + i + 1 || h.number > c.lastNumber || h.timestamp >= c.expiresAt ||
                h.timestamp / 3000 <= prev.timestamp / 3000 || h.parent != prev.id) revert InvalidChain();
            // java-tron genesis time is zero, SINGLE_REPEAT=1, 27 ordered active SRs.
            // Maintenance crossings are outside this immutable snapshot's window.
            uint256 rank = (h.timestamp / 3000) % 27;
            if (h.witness != c.witnesses[rank] ||
                TronWire420.signer(sha256(rawHeaders[i]), signatures[i]) != c.signingKeys[rank]) revert InvalidChain();
            bytes32 hash = TronWire420.blockId(rawHeaders[i], h.number);
            if (canonicalSolid[h.number] != 0 && canonicalSolid[h.number] != hash) revert InvalidChain();
            prev = SolidBlock(hash, h.root, h.timestamp);
            if (i <= targetIndex) accepted[i] = prev;
            if (i >= targetIndex && seen & (uint256(1) << rank) == 0) {
                seen |= uint256(1) << rank; ++distinct;
            }
        }
        // DposService's 70% order statistic for exactly 27 active SRs is 19.
        if (distinct < 19) revert NotSolid();
        for (uint256 i; i < accepted.length; ++i) {
            uint64 number = uint64(uint256(anchor) + i + 1);
            canonicalSolid[number] = accepted[i].id; solidBlocks[id][number] = accepted[i];
        }
        uint64 target = uint64(uint256(anchor) + uint256(targetIndex) + 1);
        if (target > solidHeight[id]) solidHeight[id] = target;
        emit Solidified(id, target, accepted[targetIndex].id);
    }

    /// @notice Authenticate a native TransferContract independently of bridge memo
    /// policy, for historical evidence and clients. Unsupported TVM/TRC assets reject.
    function verifyNativeTransfer(DepositProof memory p) public view returns (TronWire420.Transfer memory t, SolidBlock memory b) {
        Profile storage cfg = profiles[p.profile];
        if (block.chainid != destinationChainId || cfg.disabled || cfg.config.snapshotHash == 0 ||
            p.number <= cfg.config.checkpointNumber) revert NotSolid();
        b = solidBlocks[p.profile][p.number];
        if (b.id == 0 || canonicalSolid[p.number] != b.id || b.transactionRoot == 0) revert NotSolid();
        TronWire420.inclusion(sha256(p.transaction), p.index, p.count, p.siblings, b.transactionRoot);
        t = TronWire420.transfer(p.transaction);
    }

    function verifyFinalizedTransfer(bytes calldata encoded) external view returns (FinalizedTransfer memory out) {
        if (encoded.length > 70000) revert InvalidDeposit();
        DepositProof memory p = abi.decode(encoded, (DepositProof));
        if (keccak256(encoded) != keccak256(abi.encode(p))) revert InvalidDeposit();
        (TronWire420.Transfer memory t, SolidBlock memory b) = verifyNativeTransfer(p);
        // Memo: 420TRXV1 | destination chain uint256 BE | router20 | route32 | recipient20.
        bytes memory memo = t.memo;
        if (memo.length != 112) revert InvalidDeposit();
        bytes8 tag; uint256 chain; address router; bytes32 route; address recipient;
        assembly {
            tag := mload(add(memo,32)) chain := mload(add(memo,40))
            router := shr(96,mload(add(memo,72))) route := mload(add(memo,92))
            recipient := shr(96,mload(add(memo,124)))
        }
        if (tag != bytes8("420TRXV1") || chain != destinationChainId || router != destinationRouter ||
            route == 0 || route != gatewayRoutes[t.gateway] || recipient == address(0)) revert InvalidDeposit();
        bytes32 message = sha256(abi.encode("420/TRON/DEPOSIT/V1", MAINNET_GENESIS, t.id, t.owner,
            t.gateway, t.amount, chain, router, route, recipient));
        out = FinalizedTransfer(NETWORK, p.number, b.id, t.id, message, t.gateway, t.owner, recipient, t.amount, true, true, chain, router, route);
    }
}
