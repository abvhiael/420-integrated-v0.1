// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ICompute420.sol";

/// @notice Immutable, read-only discovery anchor for the qualified ComputeMarket component graph.
/// @dev ProtocolRegistry may publish this contract as the COMPUTE_MARKET service implementation.
/// It deliberately cannot move funds, mutate jobs, grant capabilities, select verifiers,
/// resolve disputes, or proxy arbitrary calls. Consumers resolve the underlying components and
/// interact with them directly under each component's own authorization and lifecycle rules.
contract ComputeRouter420 is I420System, ICompute420 {
    address public immutable override jobRegistry;
    address public immutable override fundingAdapter;
    address public immutable override matchRegistry;
    address public immutable override workerEvidence;
    address public immutable override verificationRouter;
    address public immutable override disputeResolver;
    address public immutable override settlementAdapter;
    address public immutable override providerRegistry;
    address public immutable override nodeRegistry;
    address public immutable override resourceRegistry;
    address public immutable override offerRegistry;

    bytes32 public immutable override componentGraphHash;

    error InvalidComponent();

    constructor(
        address jobRegistry_,
        address fundingAdapter_,
        address matchRegistry_,
        address workerEvidence_,
        address verificationRouter_,
        address disputeResolver_,
        address settlementAdapter_,
        address providerRegistry_,
        address nodeRegistry_,
        address resourceRegistry_,
        address offerRegistry_
    ) {
        address[11] memory components = [
            jobRegistry_, fundingAdapter_, matchRegistry_, workerEvidence_,
            verificationRouter_, disputeResolver_, settlementAdapter_,
            providerRegistry_, nodeRegistry_, resourceRegistry_, offerRegistry_
        ];
        for (uint256 i; i < components.length; ++i) {
            if (components[i] == address(0) || components[i].code.length == 0) revert InvalidComponent();
        }

        jobRegistry = jobRegistry_;
        fundingAdapter = fundingAdapter_;
        matchRegistry = matchRegistry_;
        workerEvidence = workerEvidence_;
        verificationRouter = verificationRouter_;
        disputeResolver = disputeResolver_;
        settlementAdapter = settlementAdapter_;
        providerRegistry = providerRegistry_;
        nodeRegistry = nodeRegistry_;
        resourceRegistry = resourceRegistry_;
        offerRegistry = offerRegistry_;

        componentGraphHash = keccak256(abi.encode(
            uint256(block.chainid),
            address(this),
            jobRegistry_,
            fundingAdapter_,
            matchRegistry_,
            workerEvidence_,
            verificationRouter_,
            disputeResolver_,
            settlementAdapter_,
            providerRegistry_,
            nodeRegistry_,
            resourceRegistry_,
            offerRegistry_
        ));
    }

    function systemName() external pure returns (string memory) { return "ComputeRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    receive() external payable { revert InvalidComponent(); }
    fallback() external payable { revert InvalidComponent(); }
}
