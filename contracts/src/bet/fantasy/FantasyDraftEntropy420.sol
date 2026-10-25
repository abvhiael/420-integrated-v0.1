// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IRandomnessVerifier420.sol";
import "../../interfaces/IRandomnessRouter420.sol";
/// @notice Real two-provider commit/reveal verifier for a canonical 420Random route.
/// @dev Provider independence/operational approval is external. Withholding voids the draft.
contract FantasyDraftEntropy420 is IRandomnessVerifier420{
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.DRAFT.ENTROPY.V1");
    IRandomnessRouter420 public immutable router;
    address[2] public providers;
    struct Commit{bytes32 value;uint64 at;}
    mapping(bytes32=>mapping(address=>Commit)) public commits;
    error Invalid();
    constructor(address router_,address a,address b){if(router_.code.length==0||a==address(0)||b==address(0)||a==b)revert Invalid();router=IRandomnessRouter420(router_);providers=[a,b];}
    function commitment(bytes32 purpose,address provider,bytes32 secret) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),purpose,provider,secret));}
    function commit(bytes32 purpose,bytes32 value) external{
        if((msg.sender!=providers[0]&&msg.sender!=providers[1])||purpose==0||value==0||commits[purpose][msg.sender].value!=0)revert Invalid();
        commits[purpose][msg.sender]=Commit(value,uint64(block.timestamp));
    }
    function verifyRandomness(bytes32 requestId,bytes32 domain,bytes32 purpose,bytes32 entropy,bytes calldata proof) external view returns(bool){
        if(proof.length!=64||domain!=keccak256("420.RANDOM.DOMAIN.BET.V1"))return false;
        (bytes32 a,bytes32 b)=abi.decode(proof,(bytes32,bytes32));IRandomnessRouter420.Request memory r=router.request(requestId);
        if(r.purpose!=purpose||r.domain!=domain||r.primaryVerifier!=address(this))return false;
        Commit memory ca=commits[purpose][providers[0]];Commit memory cb=commits[purpose][providers[1]];
        return ca.at!=0&&cb.at!=0&&ca.at<r.requestedAt&&cb.at<r.requestedAt&&ca.value==commitment(purpose,providers[0],a)&&cb.value==commitment(purpose,providers[1],b)&&entropy==keccak256(abi.encode(DOMAIN,purpose,a,b));
    }
}
