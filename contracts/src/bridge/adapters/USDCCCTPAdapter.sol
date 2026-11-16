// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../interfaces/IBridgeAdapter420.sol";
import "../../interfaces/IBridgeSettlementEvidence420.sol";
import "../../interfaces/ICircleCCTPV2420.sol";
import "../../system/SystemAccess.sol";
import "../verifiers/cctp/CCTPV2Message420.sol";

/// @notice Native Circle CCTP V2 integration. No synthetic USDC, local signer
/// committee or substitute MessageTransmitter. Default inactive pending actual
/// issuer support, native deployments and governance's qualified bindings.
contract USDCCCTPAdapter is IBridgeAdapter420,IBridgeSettlementEvidence420,SystemAccess {
    bytes32 public constant ADAPTER_ID=keccak256("420/BRIDGE/USDCCCTPAdapter");
    address public immutable gatewayRouter;
    address public immutable usdc;
    bytes32 public immutable usdcAssetId;
    uint256 public immutable deploymentChainId;
    bytes32 public immutable usdcCodeHash;
    address public messageTransmitter;
    address public tokenMessenger;
    address public tokenMinter;
    bytes32 public transmitterImplementationHash;
    bytes32 public messengerImplementationHash;
    uint32 public localDomain;
    bytes32 public issuerSupportEvidence;
    bool public issuerEnabled;
    bool private entered;
    struct Peer {bytes32 route;bytes32 messenger;bytes32 transmitter;bytes32 token;uint32 minFinality;bool evmDomain;bool inbound;bool outbound;}
    mapping(uint32=>Peer) public peers;
    mapping(bytes32=>uint32) public routeDomains;
    mapping(bytes32=>bool) public configuredRoutes;
    // Circle V2 uses globally unique bytes32 nonces, NOT V1's uint64 domain key.
    // These survive issuer deployment/configuration changes and re-attestation.
    mapping(bytes32=>bool) public consumedNonces;
    uint256 public outboundNonce;
    error InvalidConfiguration();error Inactive();error OnlyRouter();error InvalidProof();error Replay();error Reentrancy();error TokenMovement();
    event IssuerConfigured(address indexed transmitter,address indexed messenger,uint32 domain,bytes32 supportEvidence);
    event IssuerEnabled(bool enabled);
    event PeerConfigured(uint32 indexed domain,bytes32 indexed route,bytes32 messenger,bytes32 transmitter,bytes32 token,uint32 minFinality,bool inbound,bool outbound);
    event CCTPInbound(bytes32 indexed nonce,bytes32 indexed messageHash,bytes32 indexed route,uint256 burned,uint256 fee,uint256 delivered);
    event CCTPOutbound(bytes32 indexed requestId,bytes32 indexed route,address indexed sender,bytes32 recipient,uint256 amount,uint256 maxFee,uint32 minFinality);

    struct Settlement {address token;address recipient;uint256 amount;bytes32 evidenceHash;}
    mapping(bytes32=>Settlement) private settlements;
    function settlementEvidence(bytes32 sourceMessageId) external view returns(address,address,uint256,bytes32){Settlement memory s=settlements[sourceMessageId];return(s.token,s.recipient,s.amount,s.evidenceHash);}
    constructor(address governance,address router,address nativeUSDC,bytes32 assetId) SystemAccess(governance) {
        if(router.code.length==0||nativeUSDC.code.length==0||assetId==0||ICCTPUSDC420(nativeUSDC).decimals()!=6)revert InvalidConfiguration();
        gatewayRouter=router;usdc=nativeUSDC;usdcAssetId=assetId;deploymentChainId=block.chainid;usdcCodeHash=nativeUSDC.codehash;
    }
    modifier onlyRouter(){if(msg.sender!=gatewayRouter)revert OnlyRouter();_;}
    modifier nonReentrant(){if(entered)revert Reentrancy();entered=true;_;entered=false;}
    function adapterId() external pure returns(bytes32){return ADAPTER_ID;}
    function implementationHash(address proxy) private view returns(bytes32){address implementation=ICircleCCTPProxy420(proxy).implementation();if(implementation.code.length==0)revert InvalidConfiguration();return implementation.codehash;}
    /// @dev evidence is a recorded issuer-support reference, NOT self-proving
    /// issuer authorization. No 420 domain/deployment/USDC mint role is invented.
    function configureIssuer(address transmitter,address messenger,uint32 domain,bytes32 evidence) external onlyGovernance {
        if(transmitter.code.length==0||messenger.code.length==0||evidence==0)revert InvalidConfiguration();
        ICircleMessageTransmitterV2420 mt=ICircleMessageTransmitterV2420(transmitter);ICircleTokenMessengerV2420 tm=ICircleTokenMessengerV2420(messenger);
        if(mt.localDomain()!=domain||mt.version()!=1||mt.signatureThreshold()==0||tm.localMessageTransmitter()!=transmitter||tm.messageBodyVersion()!=1||tm.localMinter().code.length==0)revert InvalidConfiguration();
        transmitterImplementationHash=implementationHash(transmitter);messengerImplementationHash=implementationHash(messenger);
        messageTransmitter=transmitter;tokenMessenger=messenger;tokenMinter=tm.localMinter();localDomain=domain;issuerSupportEvidence=evidence;issuerEnabled=false;
        emit IssuerConfigured(transmitter,messenger,domain,evidence);emit IssuerEnabled(false);
    }
    function setIssuerEnabled(bool enabled) external onlyGovernance {if(enabled){if(issuerSupportEvidence==0)revert InvalidConfiguration();_checkIssuer();}issuerEnabled=enabled;emit IssuerEnabled(enabled);}
    function setPeer(uint32 domain,Peer calldata peer) external onlyGovernance {
        if(domain==localDomain||peer.route==0||peer.messenger==0||peer.transmitter==0||peer.token==0||(peer.minFinality!=1000&&peer.minFinality!=2000))revert InvalidConfiguration();
        if(peer.evmDomain){CCTPV2Message420.evmAddress(peer.messenger);CCTPV2Message420.evmAddress(peer.transmitter);CCTPV2Message420.evmAddress(peer.token);}
        if(configuredRoutes[peer.route]&&routeDomains[peer.route]!=domain)revert InvalidConfiguration();
        bytes32 old=peers[domain].route;if(old!=0){delete configuredRoutes[old];delete routeDomains[old];}
        peers[domain]=peer;configuredRoutes[peer.route]=true;routeDomains[peer.route]=domain;
        emit PeerConfigured(domain,peer.route,peer.messenger,peer.transmitter,peer.token,peer.minFinality,peer.inbound,peer.outbound);
    }
    function _checkIssuer() private view {
        if(block.chainid!=deploymentChainId||messageTransmitter.code.length==0||tokenMessenger.code.length==0||usdc.codehash!=usdcCodeHash||implementationHash(messageTransmitter)!=transmitterImplementationHash||implementationHash(tokenMessenger)!=messengerImplementationHash)revert InvalidConfiguration();
        ICircleMessageTransmitterV2420 mt=ICircleMessageTransmitterV2420(messageTransmitter);ICircleTokenMessengerV2420 tm=ICircleTokenMessengerV2420(tokenMessenger);
        if(mt.localDomain()!=localDomain||mt.version()!=1||mt.signatureThreshold()==0||tm.localMessageTransmitter()!=messageTransmitter||tm.messageBodyVersion()!=1||tm.localMinter()!=tokenMinter)revert InvalidConfiguration();
    }
    function _checkPeer(uint32 domain,Peer memory p) private view {
        if(domain==localDomain||p.route==0||ICircleTokenMessengerV2420(tokenMessenger).remoteTokenMessengers(domain)!=p.messenger||ICircleTokenMinterV2420(tokenMinter).getLocalToken(domain,p.token)!=usdc)revert InvalidConfiguration();
    }
    function verifyInbound(bytes calldata proof) external onlyRouter nonReentrant returns(VerifiedTransfer memory v) {
        if(!issuerEnabled)revert Inactive();_checkIssuer();
        (bytes memory message,bytes memory attestation)=abi.decode(proof,(bytes,bytes));
        if(keccak256(proof)!=keccak256(abi.encode(message,attestation)))revert InvalidProof();
        CCTPV2Message420.Message memory m=CCTPV2Message420.decode(message);Peer memory p=peers[m.sourceDomain];_checkPeer(m.sourceDomain,p);
        if(!p.inbound||m.destinationDomain!=localDomain||m.sender!=p.messenger||m.recipient!=bytes32(uint256(uint160(tokenMessenger)))||(m.destinationCaller!=0&&m.destinationCaller!=bytes32(uint256(uint160(address(this)))))||m.burnToken!=p.token||m.executedFinality<p.minFinality||(m.expirationBlock!=0&&m.expirationBlock<=block.number))revert InvalidProof();
        address sender=p.evmDomain?CCTPV2Message420.evmAddress(m.messageSender):address(uint160(uint256(keccak256(abi.encode("420/CCTP/V2/NON-EVM-SENDER",m.sourceDomain,m.messageSender)))));
        if(sender==address(0))revert InvalidProof();
        if(consumedNonces[m.nonce])revert Replay();consumedNonces[m.nonce]=true;
        uint256 beforeBalance=ICCTPUSDC420(usdc).balanceOf(m.mintRecipient);
        // Actual issuer signature threshold, sorted distinct attesters, low-s,
        // nonce and native token mint/execution are enforced by Circle itself.
        if(!ICircleMessageTransmitterV2420(messageTransmitter).receiveMessage(message,attestation))revert InvalidProof();
        uint256 delivered=m.amount-m.fee;
        uint256 expected=delivered+(m.mintRecipient==ICircleTokenMessengerV2420(tokenMessenger).feeRecipient()?m.fee:0);
        if(ICCTPUSDC420(usdc).balanceOf(m.mintRecipient)!=beforeBalance+expected||ICircleMessageTransmitterV2420(messageTransmitter).usedNonces(m.nonce)!=1)revert TokenMovement();
        bytes32 messageHash=keccak256(message);
        bytes32 id=keccak256(abi.encode("420/CCTP/V2/NONCE",m.nonce));
        settlements[id]=Settlement(usdc,m.mintRecipient,delivered,keccak256(abi.encode("420/CCTP/NATIVE_DELIVERY/V1",messageHash,m.nonce,usdc,m.mintRecipient,delivered)));
        v=VerifiedTransfer(p.route,usdcAssetId,sender,m.mintRecipient,delivered,messageHash,id);
        emit CCTPInbound(m.nonce,messageHash,p.route,m.amount,m.fee,delivered);
    }
    function initiateOutbound(bytes32 route,bytes32 asset,address sender,bytes calldata recipient,uint256 amount,bytes calldata extra) external payable onlyRouter nonReentrant returns(bytes32 id){
        if(!issuerEnabled)revert Inactive();_checkIssuer();
        if(msg.value!=0||asset!=usdcAssetId||!configuredRoutes[route]||sender==address(0)||amount==0||recipient.length!=32)revert InvalidProof();
        bytes32 mintRecipient=abi.decode(recipient,(bytes32));if(mintRecipient==0)revert InvalidProof();
        uint32 domain=routeDomains[route];Peer memory p=peers[domain];_checkPeer(domain,p);if(!p.outbound)revert Inactive();
        (bytes32 destinationCaller,uint256 maxFee,uint32 minFinality,bytes memory hookData)=abi.decode(extra,(bytes32,uint256,uint32,bytes));
        if(p.evmDomain){CCTPV2Message420.evmAddress(mintRecipient);if(destinationCaller!=0)CCTPV2Message420.evmAddress(destinationCaller);}
        if(keccak256(extra)!=keccak256(abi.encode(destinationCaller,maxFee,minFinality,hookData))||maxFee>=amount||(minFinality<=1000?1000:2000)<p.minFinality)revert InvalidProof();
        uint256 beforeBalance=ICCTPUSDC420(usdc).balanceOf(address(this));
        if(!ICCTPUSDC420(usdc).transferFrom(sender,address(this),amount)||ICCTPUSDC420(usdc).balanceOf(address(this))!=beforeBalance+amount)revert TokenMovement();
        if(!ICCTPUSDC420(usdc).approve(tokenMessenger,0)||!ICCTPUSDC420(usdc).approve(tokenMessenger,amount))revert TokenMovement();
        if(hookData.length==0)ICircleTokenMessengerV2420(tokenMessenger).depositForBurn(amount,domain,mintRecipient,usdc,destinationCaller,maxFee,minFinality);
        else ICircleTokenMessengerV2420(tokenMessenger).depositForBurnWithHook(amount,domain,mintRecipient,usdc,destinationCaller,maxFee,minFinality,hookData);
        if(!ICCTPUSDC420(usdc).approve(tokenMessenger,0)||ICCTPUSDC420(usdc).balanceOf(address(this))!=beforeBalance||ICCTPUSDC420(usdc).allowance(address(this),tokenMessenger)!=0)revert TokenMovement();
        // V2's attested nonce is assigned OFFCHAIN after MessageSent. This is an
        // adapter request ID; never mislabel it as Circle's future nonce/tx hash.
        id=keccak256(abi.encode(ADAPTER_ID,deploymentChainId,address(this),++outboundNonce,route,sender,mintRecipient,amount,keccak256(extra)));
        emit CCTPOutbound(id,route,sender,mintRecipient,amount,maxFee,minFinality);
    }
}
