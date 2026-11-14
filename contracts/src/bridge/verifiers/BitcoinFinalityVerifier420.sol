// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IBitcoinFinalityVerifier420.sol";
import "./BitcoinHeaderChain420.sol";
import "./BitcoinTransaction420.sol";
import "./BridgeCrypto420.sol";

/// @notice Mainnet SPV deposit verifier. Requires a transaction-committed destination
/// and canonical best-known header ancestry. Does not establish global tip freshness.
contract BitcoinFinalityVerifier420 is IBitcoinFinalityVerifier420 {
    BitcoinHeaderChain420 public immutable chain;
    bytes32 public immutable gatewayScriptHash;
    bytes32 public immutable depositDomain;
    bytes32 public immutable routeId;
    uint256 public immutable destinationChainId;
    address public immutable destinationRouter;
    uint64 public immutable minimumDepositHeight;
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

    constructor(BitcoinHeaderChain420 chain_, bytes memory gatewayScript, bytes32 route, uint64 minimumHeight, address router) {
        if(address(chain_).code.length==0 || router.code.length==0 || route==0 || minimumHeight==0) revert InvalidDeposit();
        // Require a standard spendable gateway locking script.
        uint256 n=gatewayScript.length;
        bool standard=(n==25 && gatewayScript[0]==0x76 && gatewayScript[1]==0xa9 && gatewayScript[2]==0x14 && gatewayScript[23]==0x88 && gatewayScript[24]==0xac)
            || (n==23 && gatewayScript[0]==0xa9 && gatewayScript[1]==0x14 && gatewayScript[22]==0x87)
            || (n==22 && gatewayScript[0]==0 && gatewayScript[1]==0x14)
            || (n==34 && (gatewayScript[0]==0 || gatewayScript[0]==0x51) && gatewayScript[1]==0x20);
        if(!standard) revert InvalidDeposit();
        chain=chain_;
        routeId=route;
        destinationChainId=block.chainid;
        destinationRouter=router;
        gatewayScriptHash=keccak256(gatewayScript);
        minimumDepositHeight=minimumHeight;
        depositDomain=keccak256(abi.encode("420/BTC/DEPOSIT/V1",block.chainid,router,route,gatewayScriptHash));
    }

    /// @notice Exact OP_RETURN push of domain-bound payment commitment.
    function commitmentScript(uint32 paymentIndex,address recipient,uint64 amount) public view returns(bytes memory){
        return abi.encodePacked(hex"6a20",keccak256(abi.encode(depositDomain,paymentIndex,recipient,amount)));
    }

    function verifyFinalizedTransfer(bytes calldata proof) external view returns(FinalizedTransfer memory t){
        if(block.chainid!=destinationChainId || proof.length>1_100_000) revert InvalidDeposit();
        Proof memory p=abi.decode(proof,(Proof));
        if(keccak256(proof)!=keccak256(abi.encode(p)) || p.recipient==address(0)) revert InvalidDeposit();
        BitcoinHeaderChain420.Header memory h=chain.getHeader(p.blockHash);
        if(h.height<minimumDepositHeight) revert InvalidDeposit();
        uint32 conf=chain.confirmations(p.blockHash,p.ancestry);
        if(conf<6) revert InsufficientConfirmations();
        BitcoinTransaction420.Parsed memory tx_=BitcoinTransaction420.parse(p.transaction,p.paymentIndex,p.commitmentIndex);
        // Reject 64-byte stripped transactions: an internal Merkle node must never be
        // reinterpretable as a deposit transaction. Reject coinbase custody deposits.
        if(tx_.strippedSize==64 || tx_.coinbase || tx_.commitmentOutputs!=1 || tx_.payment.value==0 || tx_.payment.scriptHash!=gatewayScriptHash
            || tx_.commitment.value!=0 || tx_.commitment.scriptHash!=keccak256(commitmentScript(p.paymentIndex,p.recipient,tx_.payment.value)))
            revert InvalidDeposit();
        if(!verifyInclusion(tx_.txid,h.merkleRoot,p.index,p.siblings)) revert InvalidInclusion();
        bytes32 outpoint=keccak256(abi.encode(tx_.txid,p.paymentIndex));
        t=FinalizedTransfer({
            genesisHash:0x000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f,
            messageStart:0xf9beb4d9,
            blockHeight:h.height,
            blockHash:p.blockHash,
            transactionHash:tx_.txid,
            messageId:keccak256(abi.encode(depositDomain,outpoint)),
            sourceOutput:outpoint,
            recipient:p.recipient,
            amountSatoshis:tx_.payment.value,
            confirmations:conf,
            sha256dPowValidated:true,
            chainWorkValidated:true,
            finalized:true
        });
    }

    /// @dev Bitcoin header does not commit to transaction count; verify a positional
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
