// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {IHighCountryAuthorization} from "../interfaces/IHighCountryAuthorization.sol";
import {AuthorizationRequest} from "../types/HighCountryTypes.sol";
interface IRegionalMembershipUtilities {function exists(uint16) external view returns(bool);}
/// @notice Scoped water (mL) and energy (Wh) balances, no native-token custody.
/// @dev Acquire requires explicit authorized provisioning; conservation is checked
///      from actual issued stock and cannot be inferred from client weather.
contract RegionalUtilities {
    error InvalidInput(); error InsufficientBalance(); error DuplicateOperation(); error IssuanceLimit();
    bytes32 public constant MODULE_ID=keccak256("HC.REGIONAL_UTILITIES.V1");
    bytes32 public constant ISSUE=keccak256("HC.UTILITIES.ISSUE.V1");
    bytes32 public constant CONSUME=keccak256("HC.UTILITIES.CONSUME.V1");
    bytes32 public constant TRANSFER=keccak256("HC.UTILITIES.TRANSFER.V1");
    uint8 public constant WATER=1;uint8 public constant ENERGY=2;
    // Hard lifetime issuance ceilings per region and asset (mL, Wh).
    uint256 public constant WATER_REGION_ISSUANCE_CAP=1_000_000_000;
    uint256 public constant ENERGY_REGION_ISSUANCE_CAP=100_000_000;
    uint256 public constant WATER_PER_OPERATION_CAP=1_000_000;
    uint256 public constant ENERGY_PER_OPERATION_CAP=100_000;
    IHighCountryAuthorization public immutable authorization;
    IRegionalMembershipUtilities public immutable regions;
    mapping(uint16=>mapping(uint8=>mapping(address=>uint256))) public balance;
    mapping(uint16=>mapping(uint8=>uint256)) public issued;
    mapping(uint16=>mapping(uint8=>uint256)) public spent;
    mapping(bytes32=>bool) public applied;
    event Movement(bytes32 indexed operation,uint16 indexed region,uint8 indexed asset,address from,address to,uint256 amount,uint8 kind);
    constructor(address auth,address membership){
        if(auth.code.length==0||membership.code.length==0)revert InvalidInput();
        authorization=IHighCountryAuthorization(auth);regions=IRegionalMembershipUtilities(membership);
    }
    function _check(bytes32 op,uint16 region,uint8 asset,uint256 amount) private {
        if(op==0||!regions.exists(region)||(asset!=WATER&&asset!=ENERGY)||amount==0)revert InvalidInput();
        if(applied[op])revert DuplicateOperation();
        applied[op]=true;
    }
    function _auth(bytes32 action,uint16 region) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender,MODULE_ID,action,bytes32(uint256(region)),0));
    }
    function provision(bytes32 op,uint16 region,uint8 asset,address beneficiary,uint256 amount) external {
        _check(op,region,asset,amount);if(beneficiary==address(0))revert InvalidInput();_auth(ISSUE,region);
        uint256 limit=asset==WATER?WATER_REGION_ISSUANCE_CAP:ENERGY_REGION_ISSUANCE_CAP;
        uint256 perCall=asset==WATER?WATER_PER_OPERATION_CAP:ENERGY_PER_OPERATION_CAP;
        if(amount>perCall||issued[region][asset]>limit-amount)revert IssuanceLimit();
        issued[region][asset]+=amount;balance[region][asset][beneficiary]+=amount;
        emit Movement(op,region,asset,address(0),beneficiary,amount,1);
    }
    function transfer(bytes32 op,uint16 region,uint8 asset,address to,uint256 amount) external {
        _check(op,region,asset,amount);if(to==address(0)||to==msg.sender)revert InvalidInput();
        uint256 available=balance[region][asset][msg.sender];if(available<amount)revert InsufficientBalance();
        balance[region][asset][msg.sender]=available-amount;balance[region][asset][to]+=amount;
        emit Movement(op,region,asset,msg.sender,to,amount,2);
    }
    function consume(bytes32 op,uint16 region,uint8 asset,address owner,uint256 amount) external {
        _check(op,region,asset,amount);if(owner==address(0))revert InvalidInput();_auth(CONSUME,region);
        uint256 available=balance[region][asset][owner];if(available<amount)revert InsufficientBalance();
        balance[region][asset][owner]=available-amount;spent[region][asset]+=amount;
        emit Movement(op,region,asset,owner,address(0),amount,3);
    }
    function outstanding(uint16 region,uint8 asset) external view returns(uint256){
        return issued[region][asset]-spent[region][asset];
    }
}
