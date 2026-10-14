// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
// Disposable Anvil-only R05.4 fixture. NOT deployable in Genesis or production manifests.
import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { GamingAuthorization420 } from "../../../src/gaming/GamingAuthorization420.sol";
import { GameRegistry420 } from "../../../src/gaming/GameRegistry420.sol";
import { GameIdentity420 } from "../../../src/gaming/GameIdentity420.sol";
import { GameClaims420 } from "../../../src/gaming/GameClaims420.sol";
import { HighCountryGamingBridge420 } from "../../../src/highcountry/player/HighCountryGamingBridge420.sol";
import { HighCountryMigration420 } from "../../../src/highcountry/player/HighCountryMigration420.sol";
import { HighCountryGamingIds } from "../../../src/highcountry/player/HighCountryGamingIds.sol";
import { IHighCountryAuthorization } from "../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../src/highcountry/types/HighCountryTypes.sol";

contract R054MockGamingCapabilities is ICapabilityRegistry420 {
 function isAuthorized(address,bytes32,bytes32,bytes32,uint256) external pure returns(bool){return true;}
 function grant(bytes32) external pure returns(CapabilityGrant memory g){return g;}
}
contract R054ScopedReceiptAuthority is IHighCountryAuthorization {
 address public immutable operator;
 constructor(address operator_){operator=operator_;}
 function capabilityRegistry() external pure returns(address){return address(1);}
 function isAuthorized(AuthorizationRequest calldata request) external view returns(bool) {
  return request.principal==operator;
 }
 function requireAuthorized(AuthorizationRequest calldata request) external view {
  require(request.principal==operator,"receipt operator denied");
 }
}
contract R054GrowerProfiles {
 struct GrowerProfile {uint64 id;address account;uint16 homeRegionId;uint64 createdAt;bool exists;}
 mapping(uint64=>GrowerProfile) private profiles;
 address public immutable owner;
 constructor(address owner_){owner=owner_;}
 function register(uint64 id,address player) external {
  require(msg.sender==owner&&id!=0&&player!=address(0)&&!profiles[id].exists,"invalid grower");
  profiles[id]=GrowerProfile(id,player,1,uint64(block.timestamp),true);
 }
 function getProfile(uint64 id) external view returns(GrowerProfile memory){return profiles[id];}
}
contract R05MigrationDeployment {
 bytes32 public constant GAME=HighCountryGamingIds.GAME_ID;
 address public operator;
 GameRegistry420 public games;
 GameIdentity420 public identity;
 GameClaims420 public claims;
 HighCountryGamingBridge420 public bridge;
 HighCountryMigration420 public migration;
 R054GrowerProfiles public growers;
 function initialize(address operator_) external {
  require(operator==address(0)&&operator_==msg.sender,"init denied");
  operator=operator_;
  R054MockGamingCapabilities caps=new R054MockGamingCapabilities();
  GamingAuthorization420 auth=new GamingAuthorization420(address(caps));
  games=new GameRegistry420(address(auth));
  games.registerGame(GAME,operator_,keccak256("R05.4.LOCAL.TEST.ONLY"));
  identity=new GameIdentity420(address(games));
  claims=new GameClaims420(address(games),address(identity));
  growers=new R054GrowerProfiles(operator_);
  bridge=new HighCountryGamingBridge420(address(identity),address(claims),address(1),address(growers));
  R054ScopedReceiptAuthority receiptAuthority=new R054ScopedReceiptAuthority(operator_);
  migration=new HighCountryMigration420(address(receiptAuthority),address(bridge),address(claims));
 }
}
