// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Deterministic bounded-step ordering, exact tie entitlements and residual allocation.
/// @dev Engine authenticates each score. Insertions use checked neighboring hints, never a
/// trusted externally supplied ranking or an unbounded on-chain sort.
contract FantasyRankingBook420 {
    address public immutable engine;
    bytes32 public constant DOMAIN = keccak256("420.FANTASY.RANKING.V1");

    struct Node {
        int256 score;
        uint64 next;
        uint64 group;
        bool inserted;
    }

    struct Group {
        uint64 size;
        uint32 weight;
        uint256 base;
        bool fractional;
    }

    struct Work {
        uint64 count;
        uint64 inserted;
        uint64 head;
        uint64 cursor;
        uint64 walked;
        uint64 groupCount;
        uint64 allocated;
        uint64 fractionalCount;
        uint256 prize;
        uint256 floorSum;
        uint256 residual;
        uint256 allocatedSum;
        bytes32 rankingHash;
        bytes32 payoutHash;
        bool walkedAll;
        bool ready;
    }
    mapping(bytes32 => Work) private work;
    mapping(bytes32 => mapping(uint64 => Node)) private nodes;
    mapping(bytes32 => mapping(uint64 => Group)) private groups;
    mapping(bytes32 => mapping(uint64 => uint256)) private payouts;
    mapping(bytes32 => uint16[]) private weights;
    error Unauthorized();
    error InvalidInput();
    error InvalidState();

    constructor(address engine_) {
        if (engine_ == address(0)) revert InvalidInput();
        engine = engine_;
    }
    modifier onlyEngine() {
        if (msg.sender != engine) revert Unauthorized();
        _;
    }

    function key(bytes32 pool, uint64 revision) public pure returns (bytes32) {
        return keccak256(abi.encode(pool, revision));
    }

    function workOf(bytes32 pool, uint64 revision) external view returns (Work memory) {
        return work[key(pool, revision)];
    }

    function nodeOf(bytes32 pool, uint64 revision, uint64 entry) external view returns (Node memory) {
        return nodes[key(pool, revision)][entry];
    }

    function payoutOf(bytes32 pool, uint64 revision, uint64 entry) external view returns (uint256) {
        return payouts[key(pool, revision)][entry];
    }

    function initialize(bytes32 pool, uint64 revision, uint64 count, uint256 prize, uint16[] calldata rankWeights)
        external
        onlyEngine
    {
        bytes32 id = key(pool, revision);
        Work storage w = work[id];
        if (revision == 0 || count < 2 || rankWeights.length == 0 || rankWeights.length > count || w.count != 0) {
            revert InvalidInput();
        }
        uint256 sum = 0;
        for (uint256 i; i < rankWeights.length; i++) {
            sum += rankWeights[i];
            weights[id].push(rankWeights[i]);
        }
        if (sum != 10000) revert InvalidInput();
        w.count = count;
        w.prize = prize;
        w.rankingHash = keccak256(abi.encode(DOMAIN, pool, revision, count));
        w.payoutHash = keccak256(abi.encode(DOMAIN, pool, revision, prize, rankWeights));
    }

    function _before(int256 a, uint64 ai, int256 b, uint64 bi) private pure returns (bool) {
        return a > b || (a == b && ai < bi);
    }

    function insert(bytes32 pool, uint64 revision, uint64 entry, int256 score, uint64 previous, uint64 next)
        external
        onlyEngine
    {
        bytes32 id = key(pool, revision);
        Work storage w = work[id];
        if (
            w.count == 0 || w.inserted == w.count || w.walked != 0 || entry == 0 || entry > w.count
                || nodes[id][entry].inserted || previous == entry || next == entry
        ) revert InvalidState();
        if (previous == 0) {
            if (w.head != next) revert InvalidInput();
        } else {
            Node storage p = nodes[id][previous];
            if (!p.inserted || p.next != next || !_before(p.score, previous, score, entry)) revert InvalidInput();
        }
        if (next != 0 && (!nodes[id][next].inserted || !_before(score, entry, nodes[id][next].score, next))) {
            revert InvalidInput();
        }
        nodes[id][entry] = Node(score, next, 0, true);
        if (previous == 0) w.head = entry;
        else nodes[id][previous].next = entry;
        w.inserted++;
    }

    function _close(bytes32 id) private {
        Work storage w = work[id];
        Group storage g = groups[id][w.groupCount];
        uint256 denominator = uint256(g.size) * 10000;
        // Since g.weight<=10000, the quotient multiplication cannot exceed prize.
        uint256 remainderProduct = (w.prize % denominator) * g.weight;
        g.base = (w.prize / denominator) * g.weight + remainderProduct / denominator;
        g.fractional = remainderProduct % denominator != 0;
        w.floorSum += g.base * g.size;
        if (g.fractional) w.fractionalCount += g.size;
    }

    function walk(bytes32 pool, uint64 revision, uint8 limit) external {
        bytes32 id = key(pool, revision);
        Work storage w = work[id];
        if (limit == 0 || limit > 64 || w.count == 0 || w.inserted != w.count || w.walkedAll) revert InvalidState();
        uint64 cursor = w.walked == 0 ? w.head : nodes[id][w.cursor].next;
        for (uint256 i; i < limit && cursor != 0; i++) {
            Node storage n = nodes[id][cursor];
            if (w.walked == 0) {
                w.groupCount = 1;
            } else if (n.score != nodes[id][w.cursor].score) {
                _close(id);
                w.groupCount++;
            }
            Group storage g = groups[id][w.groupCount];
            g.size++;
            if (w.walked < weights[id].length) g.weight += weights[id][w.walked];
            n.group = w.groupCount;
            w.rankingHash = keccak256(abi.encode(w.rankingHash, cursor, n.score));
            w.walked++;
            w.cursor = cursor;
            cursor = n.next;
        }
        // cursor must retain the previous node for tie comparison across batches;
        // its successor is the next unvisited node.
        if (cursor == 0) {
            if (w.walked != w.count) revert InvalidState();
            _close(id);
            w.walkedAll = true;
            w.residual = w.prize - w.floorSum;
            if (w.residual != 0 && w.residual >= w.fractionalCount) revert InvalidState();
        }
    }

    function allocate(bytes32 pool, uint64 revision, uint8 limit) external {
        bytes32 id = key(pool, revision);
        Work storage w = work[id];
        if (!w.walkedAll || w.ready || limit == 0 || limit > 64) revert InvalidState();
        for (uint256 i; i < limit && w.allocated < w.count; i++) {
            uint64 entry = ++w.allocated;
            Group storage g = groups[id][nodes[id][entry].group];
            uint256 amount = g.base;
            if (g.fractional && w.residual != 0) {
                amount++;
                w.residual--;
            }
            payouts[id][entry] = amount;
            w.allocatedSum += amount;
            w.payoutHash = keccak256(abi.encode(w.payoutHash, entry, amount));
        }
        if (w.allocated == w.count) {
            if (w.residual != 0 || w.allocatedSum != w.prize) revert InvalidState();
            w.ready = true;
        }
    }

    function rootOf(bytes32 pool, uint64 revision) external view returns (bytes32) {
        Work storage w = work[key(pool, revision)];
        if (!w.ready) revert InvalidState();
        return keccak256(abi.encode(DOMAIN, pool, revision, w.count, w.prize, w.rankingHash, w.payoutHash));
    }
}
