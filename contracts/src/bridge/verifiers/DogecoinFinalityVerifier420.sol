// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IDogecoinFinalityVerifier420.sol";
import "./DogecoinHeaderChain420.sol";
import "./DogecoinTransaction420.sol";
import "./BridgeCrypto420.sol";

/// @notice Mainnet SPV deposit verifier. Requires a transaction-committed destination
/// and canonical best-known header ancestry. Does not establish global tip freshness.
contract DogecoinFinalityVerifier420 is IDogecoinFinalityVerifier420 {
    DogecoinHeaderChain420 public immutable chain;
    bytes32 public immutable gatewayScriptHash;
    bytes32 public immutable depositDomain;
    bytes32 public immutable routeId;
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;
    uint64 public immutable minimumDepositHeight;
    uint32 public immutable minimumConfirmations;
    error InvalidDeposit();
    error InvalidInclusion();
    error InsufficientConfirmations();

    struct Proof {
        bytes32 blockHash;
        bytes transaction;
        uint32 paymentIndex;
        uint32 commitmentIndex;
        address recipient;
        uint256 index;
        bytes32[] siblings;
        bytes32[] ancestry;
    }

    constructor(DogecoinHeaderChain420 chain_, bytes memory gatewayScript, bytes32 route, uint64 minimumHeight, address router,uint32 confirmations_) {
        if(address(chain_).code.length==0 || router.code.length==0 || route==0 || minimumHeight==0 || confirmations_==0) revert InvalidDeposit();
        minimumConfirmations=confirmations_;
        // Dogecoin mainnet supports the configured P2PKH/P2SH custody profile.
        uint256 n=gatewayScript.length;
        bool standard=(n==25 && gatewayScript[0]==0x76 && gatewayScript[1]==0xa9 && gatewayScript[2]==0x14 && gatewayScript[23]==0x88 && gatewayScript[24]==0xac)
            || (n==23 && gatewayScript[0]==0xa9 && gatewayScript[1]==0x14 && gatewayScript[22]==0x87)
;
        if(!standard) revert InvalidDeposit();
        chain=chain_;
        routeId=route;
        destinationChainId=block.chainid;
        destinationRouter=router;
        gatewayScriptHash=keccak256(gatewayScript);
        minimumDepositHeight=minimumHeight;
        depositDomain=keccak256(abi.encode("420/DOGE/DEPOSIT/V1",block.chainid,router,route,gatewayScriptHash));
    }

    /// @notice Exact OP_RETURN push of domain-bound payment commitment.
    function commitmentScript(uint32 paymentIndex,address recipient,uint64 amount) public view returns(bytes memory){
        return abi.encodePacked(hex"6a20",keccak256(abi.encode(depositDomain,paymentIndex,recipient,amount)));
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns(FinalizedTransfer memory t){
        if(block.chainid!=destinationChainId || proof.length>1_100_000) revert InvalidDeposit();
        Proof memory p=abi.decode(proof,(Proof));
        if(keccak256(proof)!=keccak256(abi.encode(p)) || p.recipient==address(0)) revert InvalidDeposit();
        DogecoinHeaderChain420.Header memory h=chain.getHeader(p.blockHash);
        if(h.height<minimumDepositHeight) revert InvalidDeposit();
        uint32 conf=chain.confirmations(p.blockHash,p.ancestry);
        if(conf<minimumConfirmations) revert InsufficientConfirmations();
        DogecoinTransaction420.Parsed memory tx_=DogecoinTransaction420.parse(p.transaction,p.paymentIndex,p.commitmentIndex);
        // Reject 64-byte stripped transactions: an internal Merkle node must never be
        // reinterpretable as a deposit transaction. Reject coinbase custody deposits.
        if(tx_.strippedSize==64 || tx_.coinbase || tx_.commitmentOutputs!=1 || tx_.payment.value==0 || tx_.payment.scriptHash!=gatewayScriptHash
            || tx_.commitment.value!=0 || tx_.commitment.scriptHash!=keccak256(commitmentScript(p.paymentIndex,p.recipient,tx_.payment.value)))
            revert InvalidDeposit();
        if(!verifyInclusion(tx_.txid,h.merkleRoot,p.index,p.siblings)) revert InvalidInclusion();
        bytes32 outpoint=keccak256(abi.encode(tx_.txid,p.paymentIndex));
        t=FinalizedTransfer({
            genesisHash:0x1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691,
            messageStart:0xc0c0c0c0,
            blockHeight:h.height,
            blockHash:p.blockHash,
            transactionHash:tx_.txid,
            messageId:keccak256(abi.encode(depositDomain,outpoint)),
            gatewayScriptHash:gatewayScriptHash,
            sourceOutput:outpoint,
            recipient:p.recipient,
            amount:tx_.payment.value,
            finalized:true
        });
    }

    /// @dev Dogecoin header does not commit to transaction count; verify a positional
    /// SHA256d path without trusting a caller's claimed count. The leaf/node ambiguity
    /// is separately excluded for accepted deposit transactions.
    function verifyInclusion(bytes32 leaf,bytes32 root,uint256 index,bytes32[] memory siblings) public pure returns(bool){
        if(siblings.length>32 || index>>siblings.length!=0) return false;
        for(uint256 i;i<siblings.length;++i){
            leaf=(index&1)==0?BridgeCrypto420.sha256d(abi.encodePacked(leaf,siblings[i])):BridgeCrypto420.sha256d(abi.encodePacked(siblings[i],leaf));
            index>>=1;
        }
        return leaf==root;
    }
}
