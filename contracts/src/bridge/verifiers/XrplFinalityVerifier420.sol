// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IXrplFinalityVerifier420.sol";
import "../../system/SystemAccess.sol";
import "./xrpl/XrplValidation420.sol";
import "./xrpl/XrplPayment420.sol";
import "./xrpl/XrplSHAMap420.sol";

/// @notice Native XRPL full-validation quorum plus transaction+metadata SHAMap verifier.
/// The trusted mainnet UNL/manifests are explicit governance-authenticated snapshots.
/// JSON `validated` labels and validator addresses recovered from arbitrary signatures
/// cannot bootstrap this trust. No 420 validator committee supplies finality.
contract XrplFinalityVerifier420 is IXrplFinalityVerifier420,SystemAccess {
    bytes32 public constant NETWORK=keccak256("XRPL/MAINNET");
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;
    XrplSHA512Half420 public immutable hash;
    struct ProfileInput {bytes32 network;bytes32 snapshotHash;uint32 firstLedger;uint32 lastLedger;uint32 firstTime;uint32 lastTime;uint16 quorum;bytes32[] masters;bytes32[] signingKeyHashes;address[] signingAddresses;}
    struct Profile {ProfileInput config;bool disabled;}
    struct Header {uint32 sequence;bytes32 ledger;bytes32 root;uint32 closeTime;}
    struct Certificate {uint16 votes;bool accepted;}
    struct Proof {bytes32 profile;bytes header;bytes transaction;bytes metadata;bytes32[16][] nodes;}
    mapping(bytes32=>Profile) private profiles;
    mapping(bytes32=>mapping(bytes32=>Certificate)) public certificates;
    mapping(bytes32=>mapping(bytes32=>mapping(bytes32=>bool))) public voted;
    mapping(uint32=>bytes32) public canonicalLedger;
    mapping(bytes32=>bytes32) public gatewayRoutes;
    error InvalidProfile();error InvalidLedger();error Unvalidated();error InvalidDeposit();
    event ProfileInstalled(bytes32 indexed id,bytes32 snapshotHash,uint16 count,uint16 quorum);
    event ProfileDisabled(bytes32 indexed id);
    event ValidationAccepted(bytes32 indexed profile,bytes32 indexed ledger,bytes32 indexed master);
    event LedgerValidated(uint32 indexed sequence,bytes32 indexed ledger,bytes32 root);

    constructor(address governance,address router) SystemAccess(governance){
        if(router.code.length==0)revert InvalidProfile();destinationChainId=block.chainid;destinationRouter=router;hash=new XrplSHA512Half420();
    }
    /// @dev Snapshot approval authenticates mainnet publisher/list provenance, master
    /// identities, current manifest signing bindings and the effective UNL window.
    /// Quorum is at least ceil(80% of unique trusted masters); no automatic negative-UNL reduction.
    function installProfile(ProfileInput calldata c) external onlyGovernance returns(bytes32 id){
        uint256 count=c.masters.length;
        if(c.network!=NETWORK||c.snapshotHash==0||c.firstLedger==0||c.lastLedger<c.firstLedger||
            c.firstTime==0||c.lastTime<c.firstTime||count==0||count>256||c.signingKeyHashes.length!=count||c.signingAddresses.length!=count||
            c.quorum<count-(count/5)||c.quorum>count)revert InvalidProfile();
        for(uint256 i;i<count;++i){
            if(c.masters[i]==0||c.signingKeyHashes[i]==0||c.signingAddresses[i]==address(0))revert InvalidProfile();
            for(uint256 j;j<i;++j)if(c.masters[j]==c.masters[i]||c.signingKeyHashes[j]==c.signingKeyHashes[i]||c.signingAddresses[j]==c.signingAddresses[i])revert InvalidProfile();
        }
        id=keccak256(abi.encode("420/XRPL/UNL/V1",destinationChainId,address(this),c));
        if(profiles[id].config.snapshotHash!=0)revert InvalidProfile();profiles[id].config=c;
        emit ProfileInstalled(id,c.snapshotHash,uint16(count),c.quorum);
    }
    function profile(bytes32 id) external view returns(Profile memory){return profiles[id];}
    function disableProfile(bytes32 id) external onlyGovernance{if(profiles[id].config.snapshotHash==0)revert InvalidProfile();profiles[id].disabled=true;emit ProfileDisabled(id);}
    function gatewayKey(bytes20 account,bool hasTag,uint32 tag) public pure returns(bytes32){return keccak256(abi.encode(account,hasTag,tag));}
    function setGateway(bytes20 account,bool hasTag,uint32 tag,bytes32 route) external onlyGovernance{
        if(account==0||(!hasTag&&tag!=0))revert InvalidDeposit();gatewayRoutes[gatewayKey(account,hasTag,tag)]=route;
    }
    function ledgerHeader(bytes memory raw) public view returns(Header memory h){
        if(raw.length!=118)revert InvalidLedger();
        h.sequence=uint32(XrplBinary420.uintBE(raw,0,4));h.root=bytes32(XrplBinary420.uintBE(raw,44,32));h.closeTime=uint32(XrplBinary420.uintBE(raw,112,4));
        if(h.sequence==0||h.root==0||XrplBinary420.uintBE(raw,12,32)==0||XrplBinary420.uintBE(raw,76,32)==0||
            XrplBinary420.uintBE(raw,4,8)>100_000_000_000_000_000||h.closeTime<XrplBinary420.uintBE(raw,108,4)||uint8(raw[117])>1)revert InvalidLedger();
        h.ledger=hash.half(abi.encodePacked(bytes4(0x4c575200),raw));
    }
    function eligible(bytes32 id,Header memory h) private view {
        Profile storage p=profiles[id];ProfileInput storage c=p.config;
        if(block.chainid!=destinationChainId||p.disabled||c.snapshotHash==0||h.sequence<c.firstLedger||h.sequence>c.lastLedger||h.closeTime<c.firstTime||h.closeTime>c.lastTime)revert InvalidProfile();
    }
    function submitValidation(bytes32 id,bytes calldata header,bytes calldata validation,uint16 member) external{
        Header memory h=ledgerHeader(header);eligible(id,h);ProfileInput storage c=profiles[id].config;
        if(member>=c.masters.length)revert InvalidProfile();
        XrplValidation420.Validation memory v=XrplValidation420.parse(validation);
        if(v.ledger!=h.ledger||v.sequence!=h.sequence||sha256(v.signingKey)!=c.signingKeyHashes[member]||
            v.time<c.firstTime||v.time>c.lastTime||uint256(v.time)+300<h.closeTime||uint256(h.closeTime)+300<v.time)revert InvalidLedger();
        XrplValidation420.authenticate(hash.half(v.signingData),v.signature,v.flags,c.signingAddresses[member]);
        bytes32 master=c.masters[member];if(voted[id][h.ledger][master])revert InvalidLedger();
        if(canonicalLedger[h.sequence]!=0&&canonicalLedger[h.sequence]!=h.ledger)revert InvalidLedger();
        voted[id][h.ledger][master]=true;Certificate storage cert=certificates[id][h.ledger];++cert.votes;
        emit ValidationAccepted(id,h.ledger,master);
        if(!cert.accepted&&cert.votes>=c.quorum){cert.accepted=true;canonicalLedger[h.sequence]=h.ledger;emit LedgerValidated(h.sequence,h.ledger,h.root);}
    }
    function verifyPayment(Proof memory p) public view returns(XrplPayment420.Payment memory t,Header memory h,bytes32 transactionHash){
        h=ledgerHeader(p.header);eligible(p.profile,h);
        if(!certificates[p.profile][h.ledger].accepted||canonicalLedger[h.sequence]!=h.ledger)revert Unvalidated();
        transactionHash=XrplSHAMap420.verify(hash,p.transaction,p.metadata,p.nodes,h.root);t=XrplPayment420.parse(p.transaction,p.metadata);
    }
    function verifyFinalizedTransfer(bytes calldata encoded) external view returns(FinalizedTransfer memory out){
        if(encoded.length>120000)revert InvalidDeposit();Proof memory p=abi.decode(encoded,(Proof));
        if(keccak256(encoded)!=keccak256(abi.encode(p)))revert InvalidDeposit();
        (XrplPayment420.Payment memory t,Header memory h,bytes32 txid)=verifyPayment(p);
        bytes memory m=t.memo;if(m.length!=112)revert InvalidDeposit();bytes8 tag;uint256 chain;address router;bytes32 route;address recipient;
        assembly{tag:=mload(add(m,32)) chain:=mload(add(m,40)) router:=shr(96,mload(add(m,72))) route:=mload(add(m,92)) recipient:=shr(96,mload(add(m,124)))}
        if(tag!=bytes8("420XRPV1")||chain!=destinationChainId||router!=destinationRouter||recipient==address(0)||route==0||route!=gatewayRoutes[gatewayKey(t.gateway,t.hasTag,t.tag)])revert InvalidDeposit();
        bytes32 message=hash.half(abi.encode("420/XRPL/DEPOSIT/V1",NETWORK,txid,t.source,t.gateway,t.drops,t.hasTag,t.tag,chain,router,route,recipient));
        out=FinalizedTransfer(h.sequence,h.ledger,h.root,txid,message,t.gateway,t.source,recipient,t.drops,t.tag,t.hasTag,true,true,chain,router,route);
    }
}
