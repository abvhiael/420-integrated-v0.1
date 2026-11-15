// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/bridge/ILayerZeroCADC420.sol";
import "../../system/SystemAccess.sol";

/// @notice Admission of native issuer OFT deliveries, never an independent CADC minter.
/// @dev Commit and execution are atomic: an RPC assertion or an earlier endpoint commitment
/// cannot establish which DVN configuration authenticated a packet. Already delivered packets
/// cannot be retrospectively credited. Source transaction hashes are not present in OFT packets.
contract CADCLayerZeroAdapter is IBridgeAdapter420, SystemAccess {
    struct Peer {
        bytes32 routeId;
        bytes32 remote;
        address receiveLib;
        address sendLib;
        bytes32 receiveConfig;
        bytes32 sendConfig;
        bool inbound;
        bool outbound;
    }
    address public immutable router;
    address public immutable integration;
    bytes32 public immutable assetId;
    mapping(uint32 => Peer) public peers;
    mapping(bytes32 => bool) public consumed;
    mapping(bytes32 => bool) public consumedChannelNonces;
    bool private entered;
    bytes32 public peerConfigHash;
    bytes32 public securityConfigHash;
    event PeerConfigured(uint32 indexed eid, bytes32 indexed routeId, bytes32 configuration);
    error InvalidConfiguration();
    error InvalidProof();
    error Replay();
    error OnlyRouter();
    error Inactive();
    error Reentrancy();

    constructor(address governance, address router_, address integration_, bytes32 asset_) SystemAccess(governance) {
        if (router_ == address(0) || integration_.code.length == 0 || asset_ == bytes32(0)) {
            revert InvalidConfiguration();
        }
        router = router_;
        integration = integration_;
        assetId = asset_;
    }
    modifier guarded() {
        if (msg.sender != router) revert OnlyRouter();
        if (entered) revert Reentrancy();
        entered = true;
        _;
        entered = false;
    }

    function adapterId() external pure returns (bytes32) {
        return keccak256(bytes("420/BRIDGE/CADCLayerZeroAdapter"));
    }

    function setPeer(uint32 eid, Peer calldata p) external onlyGovernance {
        ICADCIntegration420 i = ICADCIntegration420(integration);
        if (i.active()) revert InvalidConfiguration();
        if (eid == 0 || eid == ICADCEndpoint420(i.layerZeroEndpoint()).eid() || p.routeId == 0 || p.remote == 0) {
            revert InvalidConfiguration();
        }
        if (
            (p.inbound && (p.receiveLib.code.length == 0 || p.receiveConfig == 0))
                || (p.outbound && (p.sendLib.code.length == 0 || p.sendConfig == 0))
        ) revert InvalidConfiguration();
        Peer memory old = peers[eid];
        if (old.routeId != 0) {
            peerConfigHash ^= keccak256(abi.encode(eid, old));
            securityConfigHash ^= keccak256(
                abi.encode(eid, old.receiveLib, old.sendLib, old.receiveConfig, old.sendConfig)
            );
        }
        peerConfigHash ^= keccak256(abi.encode(eid, p));
        securityConfigHash ^= keccak256(abi.encode(eid, p.receiveLib, p.sendLib, p.receiveConfig, p.sendConfig));
        peers[eid] = p;
        emit PeerConfigured(eid, p.routeId, keccak256(abi.encode(p)));
    }

    /// @notice Per-peer audit leaf; configure integration with aggregate peerConfigHash/securityConfigHash.
    function peerCommitment(uint32 eid) public view returns (bytes32) {
        return keccak256(abi.encode(eid, peers[eid]));
    }

    function securityCommitment(uint32 eid) public view returns (bytes32) {
        Peer memory p = peers[eid];
        return keccak256(abi.encode(p.receiveLib, p.sendLib, p.receiveConfig, p.sendConfig));
    }

    function _configuration(uint32 eid, bool inbound)
        internal
        view
        returns (ICADCIntegration420 i, Peer memory p, address oft, address endpoint)
    {
        i = ICADCIntegration420(integration);
        if (!i.active()) revert Inactive();
        p = peers[eid];
        oft = i.issuerOFT();
        endpoint = i.layerZeroEndpoint();
        if (
            (inbound ? !p.inbound : !p.outbound) || i.peerConfigHash() != peerConfigHash
                || i.securityConfigHash() != securityConfigHash
        ) revert InvalidConfiguration();
        if (
            ICADCOFT420(oft).endpoint() != endpoint || ICADCOFT420(oft).token() != i.cadc()
                || ICADCOFT420(oft).peers(eid) != p.remote
        ) revert InvalidConfiguration();
        address lib;
        if (inbound) (lib,) = ICADCEndpoint420(endpoint).getReceiveLibrary(oft, eid);
        else lib = ICADCEndpoint420(endpoint).getSendLibrary(oft, eid);
        if (lib != (inbound ? p.receiveLib : p.sendLib)) revert InvalidConfiguration();
        CADCUln420 memory c = ICADCUln420(lib).getUlnConfig(oft, eid);
        if (keccak256(abi.encode(c)) != (inbound ? p.receiveConfig : p.sendConfig)) revert InvalidConfiguration();
        _validateSecurity(c);
    }

    function _validateSecurity(CADCUln420 memory c) internal view {
        // Preserve the locked project requirement: at least two required independent DVNs.
        // Provider independence is established in deployment qualification, not inferred from addresses.
        if (
            c.confirmations == 0 || c.confirmations == type(uint64).max || c.requiredDVNCount < 2
                || c.requiredDVNCount == 255 || c.optionalDVNCount == 255 || c.requiredDVNs.length != c.requiredDVNCount
                || c.optionalDVNs.length != c.optionalDVNCount || c.optionalDVNThreshold > c.optionalDVNCount
                || (c.optionalDVNCount > 0 && c.optionalDVNThreshold == 0)
        ) revert InvalidConfiguration();
        for (uint256 a; a < c.requiredDVNs.length; a++) {
            if (c.requiredDVNs[a].code.length == 0 || (a > 0 && c.requiredDVNs[a] <= c.requiredDVNs[a - 1])) {
                revert InvalidConfiguration();
            }
            for (uint256 b; b < c.optionalDVNs.length; b++) {
                if (c.requiredDVNs[a] == c.optionalDVNs[b]) revert InvalidConfiguration();
            }
        }
        for (uint256 a; a < c.optionalDVNs.length; a++) {
            if (c.optionalDVNs[a].code.length == 0 || (a > 0 && c.optionalDVNs[a] <= c.optionalDVNs[a - 1])) {
                revert InvalidConfiguration();
            }
        }
    }

    /// @dev Proof ABI: (uint32 sourceEid,uint64 nonce,bytes message). GUID/header are reconstructed.
    function verifyInbound(bytes calldata proof) external guarded returns (VerifiedTransfer memory v) {
        (uint32 eid, uint64 nonce, bytes memory message) = abi.decode(proof, (uint32, uint64, bytes));
        (ICADCIntegration420 i, Peer memory p, address oft, address endpoint) = _configuration(eid, true);
        if (nonce == 0 || message.length != 40) revert InvalidProof(); // Simple OFT transfers; compose needs a separately qualified consumer.
        bytes32 recipientWord;
        uint64 sharedAmount;
        assembly {
            recipientWord := mload(add(message, 32))
            sharedAmount := shr(192, mload(add(message, 64)))
        }
        if (uint256(recipientWord) >> 160 != 0 || recipientWord == 0 || sharedAmount == 0) revert InvalidProof();
        address recipient = address(uint160(uint256(recipientWord)));
        uint32 localEid = ICADCEndpoint420(endpoint).eid();
        bytes32 receiver = bytes32(uint256(uint160(oft)));
        bytes32 guid = keccak256(abi.encodePacked(nonce, eid, p.remote, localEid, receiver));
        bytes32 channel = keccak256(abi.encode(eid, p.remote, localEid, nonce));
        if (consumed[guid] || consumedChannelNonces[channel]) revert Replay();
        consumed[guid] = true;
        consumedChannelNonces[channel] = true;
        uint256 rate = ICADCOFT420(oft).decimalConversionRate();
        if (rate == 0) revert InvalidConfiguration();
        uint256 amount = uint256(sharedAmount) * rate;
        uint256 beforeBalance = ICADCToken420(i.cadc()).balanceOf(recipient);
        ICADCUln420(p.receiveLib)
            .commitVerification(
                abi.encodePacked(uint8(1), nonce, eid, p.remote, localEid, receiver),
                keccak256(abi.encodePacked(guid, message))
            );
        ICADCEndpoint420(endpoint).lzReceive(CADCOrigin420(eid, p.remote, nonce), oft, guid, message, bytes(""));
        if (ICADCToken420(i.cadc()).balanceOf(recipient) != beforeBalance + amount) revert InvalidProof();
        // No originating EOA or transaction hash is authenticated by a simple OFT packet.
        v = VerifiedTransfer(
            p.routeId,
            assetId,
            address(uint160(uint256(keccak256(abi.encode("420/CADC/OFT/CHANNEL", eid, p.remote))))),
            recipient,
            amount,
            keccak256(abi.encodePacked(guid, message)),
            guid
        );
    }

    /// @dev Extra ABI: (uint32 destinationEid, bytes executorOptions). Native fees only; no compose.
    function initiateOutbound(
        bytes32 route,
        bytes32 asset,
        address sender,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata extra
    ) external payable guarded returns (bytes32) {
        (uint32 eid, bytes memory options) = abi.decode(extra, (uint32, bytes));
        (ICADCIntegration420 i, Peer memory p, address oft, address endpoint) = _configuration(eid, false);
        if (route != p.routeId || asset != assetId || sender == address(0) || recipient.length != 32 || amount == 0) {
            revert InvalidProof();
        }
        bytes32 to = abi.decode(recipient, (bytes32));
        if (to == 0) revert InvalidProof();
        uint256 rate = ICADCOFT420(oft).decimalConversionRate();
        if (rate == 0 || amount % rate != 0 || amount / rate > type(uint64).max) revert InvalidProof();
        ICADCToken420 token = ICADCToken420(i.cadc());
        uint256 beforeBalance = token.balanceOf(address(this));
        if (
            !token.transferFrom(sender, address(this), amount)
                || token.balanceOf(address(this)) != beforeBalance + amount
        ) {
            revert InvalidProof();
        }
        bool approval = ICADCOFT420(oft).approvalRequired();
        if (approval && !token.approve(oft, amount)) revert InvalidProof();
        (CADCReceipt420 memory receipt, CADCAmounts420 memory sent) = ICADCOFT420(oft).send{value: msg.value}(
            CADCSend420(eid, to, amount, amount, options, bytes(""), bytes("")), CADCFee420(msg.value, 0), sender
        );
        if (approval && !token.approve(oft, 0)) revert InvalidProof();
        if (
            receipt.guid
                    != keccak256(
                        abi.encodePacked(
                            receipt.nonce,
                            ICADCEndpoint420(endpoint).eid(),
                            bytes32(uint256(uint160(oft))),
                            eid,
                            p.remote
                        )
                    ) || receipt.nonce == 0 || sent.amountSentLD != amount || sent.amountReceivedLD != amount
                || token.balanceOf(address(this)) != beforeBalance || consumed[receipt.guid]
        ) revert InvalidProof();
        consumed[receipt.guid] = true;
        return receipt.guid;
    }
}
