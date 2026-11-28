// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./helpers/ResourceCollateralFixture420.sol";

import "../src/system/CapabilityRegistry420.sol";
import "../src/resource/ResourceIds420.sol";
import "../src/resource/ResourceAuthorization420.sol";
import "../src/resource/ResourcePolicyRegistry420.sol";
import "../src/resource/ResourceProviderRegistry420.sol";
import "../src/resource/ResourceNodeRegistry420.sol";
import "../src/resource/ResourceOfferRegistry420.sol";
import "../src/resource/ResourceSessionRegistry420.sol";
import "../src/resource/ResourceReceiptRegistry420.sol";
import "../src/resource/ResourceRouter420.sol";

interface VmResource420 { function prank(address) external; function warp(uint256) external; function deal(address,uint256) external; }
// Shared legacy fixture retained for collateral custody tests; lifecycle tests use the real registry.
contract MockResourceCaps420 is ICapabilityRegistry420 {
    mapping(bytes32=>bool) internal ok;
    function key(address p,bytes32 c,bytes32 a,bytes32 s) public pure returns(bytes32){return keccak256(abi.encode(p,c,a,s));}
    function set(address p,bytes32 c,bytes32 a,bytes32 s,bool v) external {ok[key(p,c,a,s)]=v;}
    function grant(bytes32) external pure returns(CapabilityGrant memory g){return g;}
    function isAuthorized(address p,bytes32 c,bytes32 a,bytes32 s,uint256) external view returns(bool){return ok[key(p,c,a,s)];}
}
contract ResourceGenesis420Test {
    VmResource420 constant vm=VmResource420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE); address constant BOB=address(0xB0B); address constant SETTLER=address(0x420); address constant DELEGATE=address(0xD311);
    struct Env { CapabilityRegistry420 caps; ResourceAuthorization420 auth; ResourcePolicyRegistry420 policy; ResourceProviderRegistry420 providers; ResourceNodeRegistry420 nodes; ResourceOfferRegistry420 offers; ResourceSessionRegistry420 sessions; ResourceReceiptRegistry420 receipts; ResourceRouter420 router; }
    function setup() internal returns(Env memory e){e.caps=new CapabilityRegistry420();e.caps.registerProtocolComponent(ResourceIds420.COMPONENT_RESOURCE,address(this));e.caps.registerProtocolComponent(VaultIds420.COMPONENT_VAULT,address(this));e.auth=new ResourceAuthorization420(address(e.caps));e.policy=new ResourcePolicyRegistry420(address(this));e.providers=new ResourceProviderRegistry420(address(e.auth),address(this));ResourceCollateralFixture420.deployWithRegistry(e.providers,e.caps);e.nodes=new ResourceNodeRegistry420(address(e.auth),address(e.providers));e.offers=new ResourceOfferRegistry420(address(e.nodes),address(e.providers),address(e.policy),address(e.auth));e.sessions=new ResourceSessionRegistry420(address(e.offers),address(e.auth));ResourceCollateralFixture420.enable(e.providers,address(e.sessions));e.receipts=new ResourceReceiptRegistry420(address(e.sessions),address(e.offers),address(e.nodes));e.router=new ResourceRouter420(address(e.policy),address(e.nodes),address(e.offers));e.policy.setPolicy(ResourceIds420.SERVICE_RELAY,keccak256("relay-policy"),3600,1_000_000,true);e.policy.setPolicy(ResourceIds420.SERVICE_STORE,keccak256("store-policy"),86400,1_000_000,true);}
    function registerRelayNode(Env memory e) internal returns(bytes32 providerId,bytes32 nodeId){providerId=e.providers.canonicalProviderId(ALICE,1);nodeId=e.nodes.canonicalNodeId(providerId,ResourceIds420.SERVICE_RELAY,ALICE,keccak256("endpoint"),keccak256("capacity"));vm.prank(ALICE);e.providers.registerProvider(providerId,ALICE,keccak256("meta"),keccak256("stake"));ResourceCollateralFixture420.fund(e.providers,providerId,ALICE);vm.prank(ALICE);e.providers.setState(providerId,ResourceProviderRegistry420.State.ACTIVE);vm.prank(ALICE);e.nodes.registerNode(nodeId,providerId,ResourceIds420.SERVICE_RELAY,ALICE,keccak256("endpoint"),keccak256("capacity"));}
    function activateRelay(Env memory e) internal returns(bytes32 providerId,bytes32 nodeId,bytes32 offerId){(providerId,nodeId)=registerRelayNode(e);offerId=keccak256("offer");vm.prank(ALICE);e.nodes.setState(nodeId,ResourceNodeRegistry420.State.ACTIVE);vm.prank(ALICE);e.offers.publishOffer(offerId,nodeId,2,1000,keccak256("terms"),uint64(block.timestamp+1000));}
    function testProviderNeedsStakeAndDefaultDeny() public {Env memory e=setup();bytes32 p=e.providers.canonicalProviderId(ALICE,1);vm.prank(BOB);(bool bad,)=address(e.providers).call(abi.encodeWithSelector(e.providers.registerProvider.selector,p,ALICE,bytes32(0),bytes32(0)));require(!bad,"third party register");vm.prank(ALICE);e.providers.registerProvider(p,ALICE,bytes32(0),bytes32(0));vm.prank(ALICE);(bool active,)=address(e.providers).call(abi.encodeWithSelector(e.providers.setState.selector,p,ResourceProviderRegistry420.State.ACTIVE));require(!active,"stake bypass");}
    function testFourServiceClassesAreDistinct() public {require(ResourceIds420.SERVICE_RELAY!=ResourceIds420.SERVICE_STORE&&ResourceIds420.SERVICE_STORE!=ResourceIds420.SERVICE_CACHE&&ResourceIds420.SERVICE_CACHE!=ResourceIds420.SERVICE_GATEWAY,"service collision");}
    function testOfferSessionReceiptReplayAndBounds() public {Env memory e=setup();(,bytes32 nodeId,bytes32 offerId)=activateRelay(e);require(e.router.canRoute(nodeId,ResourceIds420.SERVICE_RELAY),"relay route");require(!e.router.canRoute(nodeId,ResourceIds420.SERVICE_STORE),"service confusion");bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,1);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,100,uint64(block.timestamp+500),1);vm.prank(BOB);(bool replay,)=address(e.sessions).call(abi.encodeWithSelector(e.sessions.openCanonicalSession.selector,offerId,uint128(100),uint64(block.timestamp+500),uint256(1)));require(!replay,"session replay");bytes32 receiptId=e.receipts.canonicalReceiptId(sessionId,50,keccak256("usage"));vm.prank(ALICE);e.receipts.submitReceipt(receiptId,sessionId,50,keccak256("usage"));vm.prank(ALICE);(bool rr,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,receiptId,sessionId,uint128(50),keccak256("usage")));require(!rr,"receipt replay");vm.prank(ALICE);(bool over,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,e.receipts.canonicalReceiptId(sessionId,101,keccak256("over")),sessionId,uint128(101),keccak256("over")));require(!over,"unit cap bypass");}
    function testSettlementIsCapabilityScoped() public {Env memory e=setup();(,,bytes32 offerId)=activateRelay(e);bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,2);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),2);vm.prank(BOB);e.sessions.closeSession(sessionId);vm.prank(ALICE);(bool bad,)=address(e.sessions).call(abi.encodeWithSelector(e.sessions.markSettled.selector,sessionId,uint256(20)));require(!bad,"arbitrary settlement");e.caps.createGrant(keccak256(abi.encode(SETTLER,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SETTLE,e.auth.scopeSession(sessionId))),SETTLER,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SETTLE,e.auth.scopeSession(sessionId),0,0,0,0,0);vm.prank(SETTLER);e.sessions.markSettled(sessionId,20);require(e.sessions.getSession(sessionId).state==ResourceSessionRegistry420.State.SETTLED,"not settled");}
    function testExpiredSessionCannotReceiveUsage() public {Env memory e=setup();(,,bytes32 offerId)=activateRelay(e);bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,3);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+10),3);vm.warp(block.timestamp+11);vm.prank(ALICE);(bool ok,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,e.receipts.canonicalReceiptId(sessionId,1,keccak256("late")),sessionId,uint128(1),keccak256("late")));require(!ok,"expired receipt");}
    function testServicePolicyCapsOfferAndSessionDuration() public {Env memory e=setup();e.policy.setPolicy(ResourceIds420.SERVICE_RELAY,keccak256("bounded"),60,100,true);(,bytes32 nodeId)=registerRelayNode(e);vm.prank(ALICE);e.nodes.setState(nodeId,ResourceNodeRegistry420.State.ACTIVE);vm.prank(ALICE);(bool oversizedOffer,)=address(e.offers).call(abi.encodeWithSelector(e.offers.publishOffer.selector,keccak256("too-big"),nodeId,uint128(1),uint128(101),keccak256("terms"),uint64(block.timestamp+100)));require(!oversizedOffer,"policy unit ceiling bypass");bytes32 offerId=keccak256("bounded-offer");vm.prank(ALICE);e.offers.publishOffer(offerId,nodeId,1,100,keccak256("terms"),uint64(block.timestamp+100));bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,9);vm.prank(BOB);(bool tooLong,)=address(e.sessions).call(abi.encodeWithSelector(e.sessions.openCanonicalSession.selector,offerId,uint128(10),uint64(block.timestamp+61),uint256(9)));require(!tooLong,"policy duration bypass");}
    function testNodeUpdateUsesDeclaredCapabilityAndRequiresInactiveState() public {Env memory e=setup();(bytes32 providerId,bytes32 nodeId)=registerRelayNode(e);e.caps.createGrant(keccak256(abi.encode(DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_UPDATE_NODE,e.auth.scopeNode(providerId,nodeId))),DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_UPDATE_NODE,e.auth.scopeNode(providerId,nodeId),0,0,0,0,0);vm.prank(DELEGATE);e.nodes.updateNode(nodeId,keccak256("endpoint-2"),keccak256("capacity-2"));ResourceNodeRegistry420.Node memory n=e.nodes.getNode(nodeId);require(n.revision==2&&n.endpointHash==keccak256("endpoint-2")&&n.capacityHash==keccak256("capacity-2"),"node update not recorded");vm.prank(ALICE);e.nodes.setState(nodeId,ResourceNodeRegistry420.State.ACTIVE);vm.prank(DELEGATE);(bool activeUpdate,)=address(e.nodes).call(abi.encodeWithSelector(e.nodes.updateNode.selector,nodeId,keccak256("endpoint-3"),keccak256("capacity-3")));require(!activeUpdate,"active node mutated");}
    function testReceiptSubmissionSupportsScopedDelegateOnly() public {Env memory e=setup();(bytes32 providerId,bytes32 nodeId,bytes32 offerId)=activateRelay(e);bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,10);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),10);bytes32 usage=keccak256("delegated-usage");bytes32 receiptId=e.receipts.canonicalReceiptId(sessionId,1,usage);vm.prank(DELEGATE);(bool denied,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,receiptId,sessionId,uint128(1),usage));require(!denied,"ungranted delegate accepted");e.caps.createGrant(keccak256(abi.encode(DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SUBMIT_RECEIPT,e.auth.scopeNode(providerId,nodeId))),DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SUBMIT_RECEIPT,e.auth.scopeNode(providerId,nodeId),0,0,0,0,0);vm.prank(DELEGATE);e.receipts.submitReceipt(receiptId,sessionId,1,usage);require(e.receipts.getReceipt(receiptId).nodeId==nodeId,"delegated receipt missing");}
    function testReceiptsMustAdvanceAndBeNonzero() public {Env memory e=setup();(,,bytes32 offerId)=activateRelay(e);bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,11);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),11);bytes32 zeroUsage=keccak256("zero");bytes32 zeroReceiptId=e.receipts.canonicalReceiptId(sessionId,0,zeroUsage);vm.prank(ALICE);(bool zeroOk,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,zeroReceiptId,sessionId,uint128(0),zeroUsage));require(!zeroOk,"zero receipt accepted");bytes32 firstUsage=keccak256("first");bytes32 firstReceiptId=e.receipts.canonicalReceiptId(sessionId,2,firstUsage);vm.prank(ALICE);e.receipts.submitReceipt(firstReceiptId,sessionId,2,firstUsage);bytes32 equalUsage=keccak256("equal");bytes32 equalReceiptId=e.receipts.canonicalReceiptId(sessionId,2,equalUsage);vm.prank(ALICE);(bool equalOk,)=address(e.receipts).call(abi.encodeWithSelector(e.receipts.submitReceipt.selector,equalReceiptId,sessionId,uint128(2),equalUsage));require(!equalOk,"non-advancing receipt accepted");}
    function testConsumerCanCancelOpenSessionOnly() public {Env memory e=setup();(,,bytes32 offerId)=activateRelay(e);bytes32 sessionId=e.sessions.canonicalSessionId(BOB,offerId,12);vm.prank(BOB);e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),12);vm.prank(ALICE);(bool unauthorized,)=address(e.sessions).call(abi.encodeWithSelector(e.sessions.cancelSession.selector,sessionId));require(!unauthorized,"third-party cancellation");vm.prank(BOB);e.sessions.cancelSession(sessionId);require(e.sessions.getSession(sessionId).state==ResourceSessionRegistry420.State.CANCELLED,"session not cancelled");}

    function testForgedNonzeroStakeCannotActivateProvider() public {
        Env memory e = setup();
        bytes32 id = e.providers.canonicalProviderId(ALICE, 1);
        vm.prank(ALICE);
        e.providers.registerProvider(id, ALICE, keccak256("meta"), keccak256("fabricated-collateral"));
        vm.prank(ALICE);
        (bool accepted,) = address(e.providers).call(abi.encodeWithSelector(
            e.providers.setState.selector, id, ResourceProviderRegistry420.State.ACTIVE
        ));
        require(!accepted, "arbitrary nonzero referenceId activated provider");
        require(!e.providers.isActive(id), "forged collateral is economically eligible");
    }

    function testFuzzArbitraryNonzeroStakeReferenceCannotActivate(bytes32 referenceId) public {
        if (referenceId == bytes32(0)) return;
        Env memory e = setup();
        bytes32 id = e.providers.canonicalProviderId(ALICE, 1);
        vm.prank(ALICE);
        e.providers.registerProvider(id, ALICE, keccak256("meta"), referenceId);
        vm.prank(ALICE);
        (bool accepted,) = address(e.providers).call(abi.encodeWithSelector(
            e.providers.setState.selector, id, ResourceProviderRegistry420.State.ACTIVE
        ));
        require(!accepted, "unfunded referenceId accepted");
    }

    function testUnauthorizedProviderActivationCannotUseForgedReference() public {
        Env memory e = setup();
        bytes32 id = e.providers.canonicalProviderId(ALICE, 1);
        vm.prank(ALICE);
        e.providers.registerProvider(id, ALICE, keccak256("meta"), keccak256("fabricated"));
        vm.prank(BOB);
        (bool accepted,) = address(e.providers).call(abi.encodeWithSelector(
            e.providers.setState.selector, id, ResourceProviderRegistry420.State.ACTIVE
        ));
        require(!accepted, "unauthorized activation");
        require(!e.providers.isActive(id), "unexpected active provider");
    }

    function testActiveAndClosedSessionBlockCollateralWithdrawalUntilDischarge() public {
        Env memory e=setup();
        (bytes32 providerId,,bytes32 offerId)=activateRelay(e);
        ResourceProviderCollateral420 c=ResourceProviderCollateral420(address(e.providers.collateral()));
        bytes32 id=c.positionId(providerId);
        bytes32 session=e.sessions.canonicalSessionId(BOB,offerId,99);
        vm.prank(BOB);
        e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),99);
        e.sessions.bindEconomicSettlementController(address(this));
        vm.prank(ALICE);
        c.requestExit(id);
        vm.warp(c.withdrawableAt(id));
        vm.prank(ALICE);
        (bool ok,)=address(c).call(abi.encodeCall(c.withdraw,(id)));
        require(!ok && c.outstandingReservations(id)==1,"active session withdrawal");
        vm.prank(BOB);
        e.sessions.closeSession(session);
        (ok,)=address(e.sessions).call(abi.encodeCall(e.sessions.releaseDischargedSession,(session)));
        require(!ok,"closed session premature discharge");
        e.caps.createGrant(keccak256(abi.encode(SETTLER,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SETTLE,e.auth.scopeSession(session))),SETTLER,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SETTLE,e.auth.scopeSession(session),0,0,0,0,0);
        vm.prank(SETTLER);
        e.sessions.markSettled(session,20);
        vm.prank(ALICE);
        (ok,)=address(c).call(abi.encodeCall(c.withdraw,(id)));
        require(!ok,"legacy settled marker released collateral");
        e.sessions.releaseDischargedSession(session);
        (ok,)=address(e.sessions).call(abi.encodeCall(e.sessions.releaseDischargedSession,(session)));
        require(!ok && c.outstandingReservations(id)==0,"session discharge replay");
        vm.prank(ALICE);
        c.withdraw(id);
        require(c.getPosition(id).slashable==0 && c.custodyInvariant(),"discharged session exit");
    }

    function testRealSettlementGrantLifecycleAndLimits() public {
        Env memory e = setup();
        (,,bytes32 offerId) = activateRelay(e);
        vm.prank(BOB);
        bytes32 sessionId = e.sessions.openCanonicalSession(offerId,10,uint64(block.timestamp+100),101);
        vm.prank(BOB);
        e.sessions.closeSession(sessionId);
        bytes32 scope = e.auth.scopeSession(sessionId);
        bytes32 action = ResourceIds420.ACTION_SETTLE;
        bytes32 component = ResourceIds420.COMPONENT_RESOURCE;
        bytes32 id = keccak256("future settlement");
        e.caps.createGrant(id,SETTLER,component,action,scope,20,0,0,uint64(block.timestamp+10),uint64(block.timestamp+20));
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"future grant");
        vm.warp(block.timestamp+10);
        require(e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"valid exact limit");
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,action,21),"over limit");
        require(!e.auth.isSessionAuthorized(ALICE,sessionId,action,20),"wrong principal");
        require(!e.auth.isSessionAuthorized(SETTLER,bytes32(uint256(123)),action,20),"wrong scope");
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,ResourceIds420.ACTION_UPDATE_PROVIDER,20),"wrong action");
        vm.warp(block.timestamp+10);
        require(e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"exact expiration boundary");
        vm.warp(block.timestamp+1);
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"expired");
        bytes32 metered = keccak256("metered settlement");
        e.caps.createGrant(metered,SETTLER,component,action,scope,20,20,60,0,0);
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"unconsumed period allowance");
        require(e.caps.grant(id).revoked,"old grant not replaced");
        bytes32 valid = keccak256("valid settlement");
        e.caps.createGrant(valid,SETTLER,component,action,scope,20,0,0,0,0);
        e.caps.revokeGrant(valid);
        require(!e.auth.isSessionAuthorized(SETTLER,sessionId,action,20),"revoked");
        bytes32 finalGrant = keccak256("final settlement");
        e.caps.createGrant(finalGrant,SETTLER,component,action,scope,20,0,0,0,0);
        vm.prank(SETTLER);
        e.sessions.markSettled(sessionId,20);
        vm.prank(SETTLER);
        (bool replay,) = address(e.sessions).call(abi.encodeCall(e.sessions.markSettled,(sessionId,20)));
        require(!replay,"settlement replay");
    }

    function testProviderRegistrationIdentityAndConsent() public {
        Env memory e = setup();
        bytes32 id = e.providers.canonicalProviderId(ALICE, 1);
        bytes32 meta = keccak256("meta");
        bytes32 stake = keccak256("stake");
        require(id != e.providers.canonicalProviderId(BOB, 1), "operator collision");
        vm.prank(BOB);
        (bool ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,BOB,meta,stake)));
        require(!ok,"preemption");
        vm.prank(BOB);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setRegistrationConsent,(id,BOB,meta,stake)));
        require(!ok,"unrelated consent");
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(bytes32(0),ALICE,meta,stake)));
        require(!ok,"zero id");
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(bytes32(uint256(uint160(ALICE))<<96),ALICE,meta,stake)));
        require(!ok,"zero serial");
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,address(0),meta,stake)));
        require(!ok,"zero operator");
        bytes32 grantId = keccak256("provider-registration");
        e.caps.createGrant(grantId,DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_REGISTER_PROVIDER,e.auth.scopeProvider(id),0,0,0,0,0);
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,meta,stake)));
        require(!ok,"grant without consent");
        vm.prank(ALICE);
        e.providers.setRegistrationConsent(id,DELEGATE,meta,stake);
        vm.prank(BOB);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,meta,stake)));
        require(!ok,"copied payload");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,bytes32(0),stake)));
        require(!ok,"metadata substitution");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,meta,bytes32(0))));
        require(!ok,"stake substitution");
        vm.prank(ALICE);
        e.providers.setRegistrationConsent(id,address(0),0,0);
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,meta,stake)));
        require(!ok,"revoked consent");
        vm.prank(ALICE);
        e.providers.setRegistrationConsent(id,DELEGATE,meta,stake);
        vm.prank(DELEGATE);
        e.providers.registerProvider(id,ALICE,meta,stake);
        require(e.providers.getProvider(id).operatorAccount==ALICE,"wrong operator");
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,ALICE,meta,stake)));
        require(!ok,"duplicate");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.registerProvider,(id,DELEGATE,meta,stake)));
        require(!ok,"operator substitution");
        bytes32 second = e.providers.canonicalProviderId(ALICE,2);
        vm.prank(ALICE);
        e.providers.registerProvider(second,ALICE,meta,stake);
        require(e.providers.getProvider(second).operatorAccount==ALICE,"second provider");
    }

    function testProviderAdministrationAuthorityIsolation() public {
        Env memory e = setup();
        bytes32 id = e.providers.canonicalProviderId(ALICE, 1);
        bytes32 original = keccak256("original");
        bytes32 changed = keccak256("changed");
        bytes32 stake = keccak256("stake");
        vm.prank(ALICE);
        e.providers.registerProvider(id, ALICE, original, stake);
        bytes32 grantId = keccak256("metadata-only");
        e.caps.createGrant(grantId,DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_UPDATE_PROVIDER,e.auth.scopeProvider(id),0,0,0,0,0);
        vm.prank(DELEGATE);
        e.providers.updateProvider(id,changed,stake);
        require(e.providers.getProvider(id).metadataHash==changed,"metadata delegate denied");
        vm.prank(DELEGATE);
        (bool ok,) = address(e.providers).call(abi.encodeCall(e.providers.updateProvider,(id,original,bytes32(0))));
        require(!ok,"metadata grant cleared collateral");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.updateProvider,(id,original,changed)));
        require(!ok,"metadata grant replaced collateral");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setCollateralSponsor,(id,DELEGATE)));
        require(!ok,"metadata grant changed sponsor");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.RETIRED)));
        require(!ok,"metadata grant retired provider");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok,"metadata grant activated provider");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.reinstateProvider,(id,changed)));
        require(!ok,"metadata grant reinstated provider");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setDisciplinarySuspension,(id,true,changed)));
        require(!ok,"metadata grant disciplined provider");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.disqualifyProvider,(id,changed)));
        require(!ok,"metadata grant disqualified provider");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setAdmissionSuspended,(true)));
        require(!ok,"metadata grant suspended admission");
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.publishCollateralPolicy,(1,1,1,10000,true,changed)));
        require(!ok,"metadata grant changed policy");
        require(e.providers.getProvider(id).stakeRef==stake && e.providers.getProvider(id).revision==2 && e.providers.collateralSponsor(id)==address(0),"unauthorized mutation");
        e.caps.revokeGrant(grantId);
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.updateProvider,(id,original,stake)));
        require(!ok,"revoked grant");
        vm.prank(ALICE);
        e.providers.updateProvider(id,original,bytes32(0));
        vm.prank(ALICE);
        e.providers.setCollateralSponsor(id,BOB);
        require(e.providers.collateralSponsor(id)==BOB,"operator sponsor denied");
    }

    function testProviderStateDelegateCannotRetireOrReinstateDiscipline() public {
        Env memory e = setup();
        (bytes32 id,) = registerRelayNode(e);
        e.caps.createGrant(keccak256("state-only"),DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_SET_PROVIDER_STATE,e.auth.scopeProvider(id),0,0,0,0,0);
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.SUSPENDED);
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(DELEGATE);
        (bool ok,) = address(e.providers).call(abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.RETIRED)));
        require(!ok,"state grant retired provider");
        e.providers.setDisciplinarySuspension(id,true,keccak256("discipline"));
        vm.prank(DELEGATE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)));
        require(!ok,"state grant bypassed discipline");
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.reinstateProvider,(id,keccak256("remediation"))));
        require(!ok,"operator reinstated discipline");
        e.providers.reinstateProvider(id,keccak256("remediation"));
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        vm.prank(ALICE);
        e.providers.setState(id,ResourceProviderRegistry420.State.RETIRED);
        vm.prank(ALICE);
        (ok,) = address(e.providers).call(abi.encodeCall(e.providers.setCollateralSponsor,(id,BOB)));
        require(!ok,"retired sponsor mutation");
        require(!e.providers.isActive(id),"retired active");
    }

    function _grantCollateralIdentityDelegate(Env memory e, bytes32 id) internal {
        bytes32[3] memory actions = [ResourceIds420.ACTION_REGISTER_PROVIDER, ResourceIds420.ACTION_UPDATE_PROVIDER, ResourceIds420.ACTION_SET_PROVIDER_STATE];
        for (uint256 i; i < actions.length; ++i) {
            e.caps.createGrant(keccak256(abi.encode("A4.3",id,actions[i])),DELEGATE,ResourceIds420.COMPONENT_RESOURCE,actions[i],e.auth.scopeProvider(id),0,0,0,0,0);
        }
    }

    function _denyCollateralIdentity(address caller, address target, bytes memory data, bytes4 expected) internal {
        vm.prank(caller);
        (bool ok, bytes memory result) = target.call(data);
        require(!ok && result.length >= 4 && bytes4(result) == expected,"unexpected denial");
    }

    function testCollateralIdentityDelegatedForeignReferenceAndEconomicBoundary() public {
        Env memory e = setup();
        (bytes32 foreignId,) = registerRelayNode(e);
        ResourceProviderCollateral420 c = ResourceProviderCollateral420(address(e.providers.collateral()));
        bytes32 foreignPosition = c.positionId(foreignId);
        bytes32 id = e.providers.canonicalProviderId(BOB,1);
        _grantCollateralIdentityDelegate(e,id);
        vm.prank(BOB);
        e.providers.setRegistrationConsent(id,DELEGATE,0,foreignPosition);
        vm.prank(DELEGATE);
        e.providers.registerProvider(id,BOB,0,foreignPosition);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.updateProvider,(id,bytes32(0),c.positionId(id))),ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setCollateralSponsor,(id,DELEGATE)),ResourceProviderRegistry420.Unauthorized.selector);
        vm.deal(DELEGATE,1 ether);
        vm.prank(DELEGATE);
        (bool funded, bytes memory result) = address(c).call{value:1 ether}(abi.encodeCall(c.deposit,(id,keccak256("unauthorized sponsorship"))));
        require(!funded && bytes4(result)==ResourceProviderCollateral420.Unauthorized.selector,"unauthorized sponsor funding");
        vm.deal(BOB,1 ether);
        vm.prank(BOB);
        bytes32 own = c.deposit{value:1 ether-1}(id,keccak256("partial"));
        vm.prank(BOB);
        e.providers.updateProvider(id,0,own);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        vm.prank(BOB);
        c.deposit{value:1}(id,keccak256("boundary"));
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        require(e.providers.isActive(id) && e.providers.isActive(foreignId),"valid delegation denied");
        require(c.getPosition(foreignPosition).owner==ALICE && c.getPosition(own).owner==BOB && c.getPosition(own).slashable==1 ether && c.custodyInvariant(),"identity or custody corrupted");
    }

    function testCollateralIdentityDelegatedExitCannotReopenAdmissionOrStealSponsor() public {
        Env memory e = setup();
        ResourceProviderCollateral420 c = ResourceProviderCollateral420(address(e.providers.collateral()));
        bytes32 id = e.providers.canonicalProviderId(ALICE,1);
        vm.prank(ALICE);
        e.providers.registerProvider(id,ALICE,0,0);
        vm.prank(ALICE);
        e.providers.setCollateralSponsor(id,BOB);
        vm.deal(BOB,2 ether);
        vm.prank(BOB);
        bytes32 position = c.deposit{value:2 ether}(id,keccak256("sponsor bond"));
        vm.prank(ALICE);
        e.providers.updateProvider(id,0,position);
        _grantCollateralIdentityDelegate(e,id);
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        bytes32 node = e.nodes.canonicalNodeId(id,ResourceIds420.SERVICE_RELAY,ALICE,keccak256("endpoint"),keccak256("capacity"));
        vm.prank(ALICE);
        e.nodes.registerNode(node,id,ResourceIds420.SERVICE_RELAY,ALICE,keccak256("endpoint"),keccak256("capacity"));
        vm.prank(ALICE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        bytes32 offer = keccak256("sponsored offer");
        vm.prank(ALICE);
        e.offers.publishOffer(offer,node,2,1000,keccak256("terms"),uint64(block.timestamp+1000));
        vm.prank(DELEGATE);
        bytes32 session = e.sessions.openCanonicalSession(offer,10,uint64(block.timestamp+100),1);
        require(c.outstandingReservations(position)==1,"missing exposure");
        _denyCollateralIdentity(DELEGATE,address(c),abi.encodeCall(c.requestExit,(position)),ResourceProviderCollateral420.Unauthorized.selector);
        vm.prank(BOB);
        c.requestExit(position);
        uint64 maturity = c.withdrawableAt(position);
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.SUSPENDED);
        vm.prank(DELEGATE);
        e.providers.updateProvider(id,keccak256("new metadata"),position);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        require(!e.providers.isActive(id) && !e.offers.isEffective(offer) && !e.router.canRoute(node,ResourceIds420.SERVICE_RELAY),"exit bypassed service admission");
        _denyCollateralIdentity(DELEGATE,address(e.sessions),abi.encodeCall(e.sessions.openCanonicalSession,(offer,uint128(10),uint64(block.timestamp+100),uint256(2))),ResourceSessionRegistry420.InvalidSession.selector);
        vm.prank(ALICE);
        e.providers.setCollateralSponsor(id,DELEGATE);
        require(c.getPosition(position).owner==BOB && c.withdrawableAt(position)==maturity,"sponsor reassignment changed ownership or maturity");
        vm.warp(maturity);
        _denyCollateralIdentity(BOB,address(c),abi.encodeCall(c.withdraw,(position)),ResourceProviderCollateral420.Unauthorized.selector);
        vm.prank(DELEGATE);
        e.sessions.cancelSession(session);
        require(c.outstandingReservations(position)==1,"cancellation released collateral without discharge");
        _denyCollateralIdentity(BOB,address(c),abi.encodeCall(c.withdraw,(position)),ResourceProviderCollateral420.Unauthorized.selector);
        e.sessions.bindEconomicSettlementController(address(this));
        _denyCollateralIdentity(DELEGATE,address(e.sessions),abi.encodeCall(e.sessions.releaseDischargedSession,(session)),ResourceSessionRegistry420.Unauthorized.selector);
        e.sessions.releaseDischargedSession(session);
        require(c.outstandingReservations(position)==0,"authorized discharge did not release reservation");
        _denyCollateralIdentity(address(this),address(e.sessions),abi.encodeCall(e.sessions.releaseDischargedSession,(session)),ResourceSessionRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(DELEGATE,address(c),abi.encodeCall(c.withdraw,(position)),ResourceProviderCollateral420.Unauthorized.selector);
        _denyCollateralIdentity(ALICE,address(c),abi.encodeCall(c.withdraw,(position)),ResourceProviderCollateral420.Unauthorized.selector);
        uint256 beforeBalance = BOB.balance;
        vm.prank(BOB);
        c.withdraw(position);
        require(BOB.balance==beforeBalance+2 ether && c.getPosition(position).state==ResourceProviderCollateral420.State.WITHDRAWN && c.custodyInvariant(),"owner payout");
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
    }

    function testCollateralIdentityDelegatedDisciplineAndPermanentDisqualification() public {
        Env memory e = setup();
        (bytes32 id,bytes32 node,bytes32 offer) = activateRelay(e);
        ResourceProviderCollateral420 c = ResourceProviderCollateral420(address(e.providers.collateral()));
        bytes32 position = c.positionId(id);
        _grantCollateralIdentityDelegate(e,id);
        e.providers.setDisciplinarySuspension(id,true,keccak256("discipline"));
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.reinstateProvider,(id,keccak256("forged"))),ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        require(!e.router.canRoute(node,ResourceIds420.SERVICE_RELAY) && !e.offers.isEffective(offer),"disciplinary admission");
        e.providers.reinstateProvider(id,keccak256("remediated"));
        vm.prank(DELEGATE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        require(e.providers.isActive(id),"legitimate reinstatement");
        e.providers.disqualifyProvider(id,keccak256("permanent"));
        uint64 revision = e.providers.disciplineRevision(id);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.reinstateProvider,(id,keccak256("forged"))),ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(address(this),address(e.providers),abi.encodeCall(e.providers.reinstateProvider,(id,keccak256("retry"))),ResourceProviderRegistry420.InvalidState.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        require(e.providers.permanentlyDisqualified(id) && e.providers.disciplineRevision(id)==revision && !e.providers.isActive(id) && !e.offers.isEffective(offer),"permanent disqualification bypass");
        require(c.getPosition(position).owner==ALICE && c.custodyInvariant(),"discipline changed custody");
    }

    // A4.4: independent acceptance cases, with real scoped grants and funded providers.
    function _a44Provider(Env memory e, address operator, uint96 serial) internal returns (bytes32 id) {
        id = e.providers.canonicalProviderId(operator,serial);
        vm.prank(operator);
        e.providers.registerProvider(id,operator,keccak256(abi.encode(operator,serial)),0);
        ResourceCollateralFixture420.fund(e.providers,id,operator);
    }

    function _a44Grant(Env memory e, bytes32 id, bytes32 action) internal returns (bytes32 grantId) {
        grantId = keccak256(abi.encode("A4.4",id,action));
        e.caps.createGrant(grantId,DELEGATE,ResourceIds420.COMPONENT_RESOURCE,action,e.auth.scopeProvider(id),0,0,0,0,0);
        require(e.auth.isProviderAuthorized(DELEGATE,id,action),"grant not effective");
    }

    function _a44Snapshot(Env memory e, bytes32 id) internal view returns (bytes32) {
        return keccak256(abi.encode(e.providers.getProvider(id),e.providers.collateralSponsor(id),e.providers.disciplinarySuspension(id),e.providers.permanentlyDisqualified(id),e.providers.disciplineEvidence(id),e.providers.disciplineRevision(id)));
    }

    function _a44RejectUpdate(Env memory e, address caller, bytes32 id) internal {
        bytes32 beforeState = _a44Snapshot(e,id);
        bytes32 stake = e.providers.getProvider(id).stakeRef;
        _denyCollateralIdentity(caller,address(e.providers),abi.encodeCall(e.providers.updateProvider,(id,keccak256("unauthorized"),stake)),ResourceProviderRegistry420.Unauthorized.selector);
        require(_a44Snapshot(e,id)==beforeState,"rejected update mutated provider");
    }

    function testA44ProviderACannotModifyProviderB() public {
        Env memory e = setup();
        bytes32 a = _a44Provider(e,ALICE,1);
        bytes32 b = _a44Provider(e,BOB,1);
        bytes32 beforeA = _a44Snapshot(e,a);
        _a44RejectUpdate(e,ALICE,b);
        _a44RejectUpdate(e,BOB,a);
        require(_a44Snapshot(e,a)==beforeA,"foreign update changed caller provider");
        bytes32 beforeB = _a44Snapshot(e,b);
        _denyCollateralIdentity(ALICE,address(e.providers),abi.encodeCall(e.providers.setState,(b,ResourceProviderRegistry420.State.RETIRED)),ResourceProviderRegistry420.Unauthorized.selector);
        require(_a44Snapshot(e,b)==beforeB,"foreign retirement mutated provider");
    }

    function testA44DelegateUpdatesAuthorizedProvider() public {
        Env memory e = setup();
        bytes32 id = _a44Provider(e,ALICE,1);
        _a44Grant(e,id,ResourceIds420.ACTION_UPDATE_PROVIDER);
        ResourceProviderRegistry420.Provider memory beforeP = e.providers.getProvider(id);
        bytes32 metadata = keccak256("authorized metadata");
        vm.prank(DELEGATE);
        e.providers.updateProvider(id,metadata,beforeP.stakeRef);
        ResourceProviderRegistry420.Provider memory afterP = e.providers.getProvider(id);
        require(afterP.metadataHash==metadata && afterP.revision==beforeP.revision+1,"authorized update missing");
        require(afterP.operatorAccount==beforeP.operatorAccount && afterP.stakeRef==beforeP.stakeRef && afterP.state==beforeP.state && afterP.exists,"metadata changed protected fields");
    }

    function testA44DelegateCannotModifyAnotherProvider() public {
        Env memory e = setup();
        bytes32 a = _a44Provider(e,ALICE,1);
        bytes32 b = _a44Provider(e,BOB,1);
        bytes32 sibling = _a44Provider(e,ALICE,2);
        _a44Grant(e,a,ResourceIds420.ACTION_UPDATE_PROVIDER);
        require(!e.auth.isProviderAuthorized(DELEGATE,b,ResourceIds420.ACTION_UPDATE_PROVIDER),"foreign scope effective");
        _a44RejectUpdate(e,DELEGATE,b);
        _a44RejectUpdate(e,DELEGATE,sibling);
        bytes32 stake = e.providers.getProvider(a).stakeRef;
        vm.prank(DELEGATE);
        e.providers.updateProvider(a,keccak256("correct scope"),stake);
        require(e.providers.getProvider(a).metadataHash==keccak256("correct scope"),"positive scope control");
    }

    function testA44MetadataGrantCannotRetireProvider() public {
        Env memory e = setup();
        bytes32 id = _a44Provider(e,ALICE,1);
        _a44Grant(e,id,ResourceIds420.ACTION_UPDATE_PROVIDER);
        bytes32 beforeState = _a44Snapshot(e,id);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.RETIRED)),ResourceProviderRegistry420.Unauthorized.selector);
        require(_a44Snapshot(e,id)==beforeState,"retirement mutated provider");
        vm.prank(ALICE);
        e.providers.setState(id,ResourceProviderRegistry420.State.RETIRED);
        require(e.providers.getProvider(id).state==ResourceProviderRegistry420.State.RETIRED,"operator retirement denied");
    }

    function testA44UnauthorizedCollateralSponsorRejected() public {
        Env memory e = setup();
        bytes32 id = _a44Provider(e,ALICE,1);
        _grantCollateralIdentityDelegate(e,id);
        bytes32 beforeState = _a44Snapshot(e,id);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setCollateralSponsor,(id,DELEGATE)),ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(BOB,address(e.providers),abi.encodeCall(e.providers.setCollateralSponsor,(id,BOB)),ResourceProviderRegistry420.Unauthorized.selector);
        require(_a44Snapshot(e,id)==beforeState,"sponsor mutation");
        ResourceProviderCollateral420 c = ResourceProviderCollateral420(address(e.providers.collateral()));
        vm.deal(DELEGATE,1 ether);
        vm.prank(DELEGATE);
        (bool ok,bytes memory result) = address(c).call{value:1 ether}(abi.encodeCall(c.deposit,(id,keccak256("A4.4 unauthorized sponsor"))));
        require(!ok && result.length>=4 && bytes4(result)==ResourceProviderCollateral420.Unauthorized.selector,"sponsor deposit accepted");
        require(c.getPosition(c.positionId(id)).owner==ALICE && c.custodyInvariant(),"custody mutated");
    }

    function testA44DisciplinarySuspendedProviderCannotActivate() public {
        Env memory e = setup();
        (bytes32 id,) = registerRelayNode(e);
        _a44Grant(e,id,ResourceIds420.ACTION_SET_PROVIDER_STATE);
        e.providers.setDisciplinarySuspension(id,true,keccak256("A4.4 discipline"));
        bytes32 beforeState = _a44Snapshot(e,id);
        _denyCollateralIdentity(ALICE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),abi.encodeCall(e.providers.setState,(id,ResourceProviderRegistry420.State.ACTIVE)),ResourceProviderRegistry420.StakeRequired.selector);
        require(_a44Snapshot(e,id)==beforeState && !e.providers.isActive(id),"disciplinary bypass");
        e.providers.reinstateProvider(id,keccak256("A4.4 remediation"));
        vm.prank(ALICE);
        e.providers.setState(id,ResourceProviderRegistry420.State.ACTIVE);
        require(e.providers.isActive(id),"legitimate reinstatement denied");
    }

    function testA44DisqualifiedProviderCannotReinstate() public {
        Env memory e = setup();
        (bytes32 id,) = registerRelayNode(e);
        _grantCollateralIdentityDelegate(e,id);
        e.providers.disqualifyProvider(id,keccak256("A4.4 permanent"));
        bytes32 beforeState = _a44Snapshot(e,id);
        bytes memory callData = abi.encodeCall(e.providers.reinstateProvider,(id,keccak256("A4.4 attempted reinstatement")));
        _denyCollateralIdentity(ALICE,address(e.providers),callData,ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(DELEGATE,address(e.providers),callData,ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(address(this),address(e.providers),callData,ResourceProviderRegistry420.InvalidState.selector);
        require(_a44Snapshot(e,id)==beforeState && !e.providers.isActive(id),"permanent disqualification mutated");
    }

    function testA44RevokedDelegateCannotUpdateProvider() public {
        Env memory e = setup();
        bytes32 id = _a44Provider(e,ALICE,1);
        bytes32 grantId = _a44Grant(e,id,ResourceIds420.ACTION_UPDATE_PROVIDER);
        bytes32 stake = e.providers.getProvider(id).stakeRef;
        vm.prank(DELEGATE);
        e.providers.updateProvider(id,keccak256("before revocation"),stake);
        e.caps.revokeGrant(grantId);
        require(!e.auth.isProviderAuthorized(DELEGATE,id,ResourceIds420.ACTION_UPDATE_PROVIDER),"revoked grant effective");
        _a44RejectUpdate(e,DELEGATE,id);
        vm.prank(ALICE);
        e.providers.updateProvider(id,keccak256("owner after revocation"),stake);
        require(e.providers.getProvider(id).metadataHash==keccak256("owner after revocation"),"owner update denied");
    }

    function testA51NodeIdentityPreemptionAndSubstitution() public {
        Env memory e = setup();
        (bytes32 a,) = registerRelayNode(e);
        bytes32 b = _a44Provider(e,BOB,1);
        vm.prank(BOB);
        e.providers.setState(b,ResourceProviderRegistry420.State.ACTIVE);
        bytes32 endpoint = keccak256("A5.1 endpoint");
        bytes32 capacity = keccak256("A5.1 capacity");
        bytes32 id = e.nodes.canonicalNodeId(a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,capacity);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,b,ResourceIds420.SERVICE_STORE,BOB,endpoint,capacity)),ResourceNodeRegistry420.InvalidNode.selector);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,capacity)),ResourceNodeRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_RELAY,ALICE,endpoint,capacity)),ResourceNodeRegistry420.InvalidNode.selector);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,BOB,endpoint,capacity)),ResourceNodeRegistry420.InvalidNode.selector);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,ALICE,capacity,capacity)),ResourceNodeRegistry420.InvalidNode.selector);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,endpoint)),ResourceNodeRegistry420.InvalidNode.selector);
        vm.prank(ALICE);
        e.nodes.registerNode(id,a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,capacity);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,capacity)),ResourceNodeRegistry420.NodeExists.selector);
        vm.prank(ALICE);
        e.nodes.updateNode(id,capacity,endpoint);
        vm.prank(ALICE);
        e.nodes.setState(id,ResourceNodeRegistry420.State.ACTIVE);
        ResourceNodeRegistry420.Node memory n = e.nodes.getNode(id);
        require(n.providerId==a && n.serviceId==ResourceIds420.SERVICE_STORE && n.operatorAccount==ALICE && n.endpointHash==capacity && n.capacityHash==endpoint,"identity changed");
        require(e.nodes.isActiveFor(id,ResourceIds420.SERVICE_STORE) && !e.nodes.isActiveFor(id,ResourceIds420.SERVICE_RELAY),"service substitution");
        vm.prank(ALICE);
        e.nodes.setState(id,ResourceNodeRegistry420.State.RETIRED);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,ALICE,endpoint,capacity)),ResourceNodeRegistry420.NodeExists.selector);
    }

    function testA51DelegatedRegistrationRequiresExactConsentAndGrant() public {
        Env memory e = setup();
        (bytes32 a,) = registerRelayNode(e);
        bytes32 endpoint = keccak256("delegate endpoint");
        bytes32 capacity = keccak256("delegate capacity");
        bytes32 id = e.nodes.canonicalNodeId(a,ResourceIds420.SERVICE_STORE,BOB,endpoint,capacity);
        bytes memory data = abi.encodeCall(e.nodes.registerNode,(id,a,ResourceIds420.SERVICE_STORE,BOB,endpoint,capacity));
        bytes32 grantId = keccak256("A5.1 registration grant");
        e.caps.createGrant(grantId,DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_REGISTER_NODE,e.auth.scopeNode(a,id),0,0,0,0,0);
        _denyCollateralIdentity(DELEGATE,address(e.nodes),data,ResourceNodeRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(DELEGATE,address(e.nodes),abi.encodeCall(e.nodes.setNodeRegistrationConsent,(a,id,DELEGATE)),ResourceNodeRegistry420.Unauthorized.selector);
        vm.prank(ALICE);
        e.nodes.setNodeRegistrationConsent(a,id,DELEGATE);
        vm.prank(ALICE);
        e.nodes.setNodeRegistrationConsent(a,id,address(0));
        _denyCollateralIdentity(DELEGATE,address(e.nodes),data,ResourceNodeRegistry420.Unauthorized.selector);
        vm.prank(ALICE);
        e.nodes.setNodeRegistrationConsent(a,id,DELEGATE);
        e.caps.revokeGrant(grantId);
        _denyCollateralIdentity(DELEGATE,address(e.nodes),data,ResourceNodeRegistry420.Unauthorized.selector);
        e.caps.createGrant(keccak256("A5.1 replacement grant"),DELEGATE,ResourceIds420.COMPONENT_RESOURCE,ResourceIds420.ACTION_REGISTER_NODE,e.auth.scopeNode(a,id),0,0,0,0,0);
        vm.prank(DELEGATE);
        e.nodes.registerNode(id,a,ResourceIds420.SERVICE_STORE,BOB,endpoint,capacity);
        ResourceNodeRegistry420.Node memory n = e.nodes.getNode(id);
        require(n.providerId==a && n.operatorAccount==BOB && n.serviceId==ResourceIds420.SERVICE_STORE && n.endpointHash==endpoint && n.capacityHash==capacity,"delegated payload mismatch");
        vm.prank(BOB);
        e.nodes.setState(id,ResourceNodeRegistry420.State.ACTIVE);
        require(e.nodes.isActiveFor(id,ResourceIds420.SERVICE_STORE),"appointed operator denied");
        _denyCollateralIdentity(DELEGATE,address(e.nodes),data,ResourceNodeRegistry420.NodeExists.selector);
    }

    // A5.2: independent provider, node and delegated principals.
    function _a52Node(Env memory e, bytes32 provider, address owner, address operator, uint256 serial) internal returns (bytes32 id) {
        bytes32 endpoint = keccak256(abi.encode("A5.2 endpoint",serial));
        bytes32 capacity = keccak256(abi.encode("A5.2 capacity",serial));
        id = e.nodes.canonicalNodeId(provider,ResourceIds420.SERVICE_RELAY,operator,endpoint,capacity);
        vm.prank(owner);
        e.nodes.registerNode(id,provider,ResourceIds420.SERVICE_RELAY,operator,endpoint,capacity);
    }

    function _a52Grant(Env memory e, bytes32 provider, bytes32 node, bytes32 action, address principal) internal returns (bytes32 id) {
        id = keccak256(abi.encode("A5.2",provider,node,action,principal));
        e.caps.createGrant(id,principal,ResourceIds420.COMPONENT_RESOURCE,action,e.auth.scopeNode(provider,node),0,0,0,0,0);
        require(e.auth.isNodeAuthorized(principal,provider,node,action),"node grant missing");
    }

    function _a52Snapshot(Env memory e, bytes32 node) internal view returns (bytes32) {
        return keccak256(abi.encode(e.nodes.getNode(node)));
    }

    function _a52RejectUpdate(Env memory e, bytes32 node, address actor) internal {
        bytes32 beforeNode = _a52Snapshot(e,node);
        _denyCollateralIdentity(actor,address(e.nodes),abi.encodeCall(e.nodes.updateNode,(node,keccak256("bad endpoint"),keccak256("bad capacity"))),ResourceNodeRegistry420.Unauthorized.selector);
        require(_a52Snapshot(e,node)==beforeNode,"denied update mutated node");
    }

    function _a52RejectState(Env memory e, bytes32 node, address actor, ResourceNodeRegistry420.State next) internal {
        bytes32 beforeNode = _a52Snapshot(e,node);
        _denyCollateralIdentity(actor,address(e.nodes),abi.encodeCall(e.nodes.setState,(node,next)),ResourceNodeRegistry420.Unauthorized.selector);
        require(_a52Snapshot(e,node)==beforeNode,"denied transition mutated node");
    }

    function testA52NodeOperatorCannotAdministerProviderOrRegisterSibling() public {
        Env memory e = setup();
        (bytes32 provider,) = registerRelayNode(e);
        bytes32 node = _a52Node(e,provider,ALICE,BOB,1);
        bytes32 sibling = _a52Node(e,provider,ALICE,ALICE,2);
        bytes32 beforeProvider = _a44Snapshot(e,provider);
        _a44RejectUpdate(e,BOB,provider);
        _denyCollateralIdentity(BOB,address(e.providers),abi.encodeCall(e.providers.setState,(provider,ResourceProviderRegistry420.State.SUSPENDED)),ResourceProviderRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(BOB,address(e.providers),abi.encodeCall(e.providers.setCollateralSponsor,(provider,BOB)),ResourceProviderRegistry420.Unauthorized.selector);
        bytes32 endpoint = keccak256("unapproved endpoint");
        bytes32 capacity = keccak256("unapproved capacity");
        bytes32 newId = e.nodes.canonicalNodeId(provider,ResourceIds420.SERVICE_RELAY,BOB,endpoint,capacity);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.registerNode,(newId,provider,ResourceIds420.SERVICE_RELAY,BOB,endpoint,capacity)),ResourceNodeRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.setNodeRegistrationConsent,(provider,newId,BOB)),ResourceNodeRegistry420.Unauthorized.selector);
        _a52RejectUpdate(e,sibling,BOB);
        _a52RejectState(e,sibling,BOB,ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(BOB);
        e.nodes.updateNode(node,endpoint,capacity);
        require(e.nodes.getNode(node).endpointHash==endpoint && e.nodes.getNode(node).capacityHash==capacity,"own update denied");
        require(_a44Snapshot(e,provider)==beforeProvider,"provider mutated");
    }

    function testA52DistinctOperatorsAndLifecycle() public {
        Env memory e = setup();
        (bytes32 provider,) = registerRelayNode(e);
        bytes32 node = _a52Node(e,provider,ALICE,BOB,1);
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.updateNode,(node,keccak256("endpoint"),keccak256("capacity"))),ResourceNodeRegistry420.InvalidState.selector);
        vm.prank(ALICE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.SUSPENDED);
        vm.prank(ALICE);
        e.nodes.updateNode(node,keccak256("provider endpoint"),keccak256("provider capacity"));
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.SUSPENDED);
        vm.prank(ALICE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.RETIRED);
        bytes32 beforeNode = _a52Snapshot(e,node);
        _denyCollateralIdentity(ALICE,address(e.nodes),abi.encodeCall(e.nodes.setState,(node,ResourceNodeRegistry420.State.ACTIVE)),ResourceNodeRegistry420.InvalidState.selector);
        _denyCollateralIdentity(BOB,address(e.nodes),abi.encodeCall(e.nodes.updateNode,(node,keccak256("endpoint"),keccak256("capacity"))),ResourceNodeRegistry420.InvalidState.selector);
        require(_a52Snapshot(e,node)==beforeNode && e.providers.isActive(provider),"retirement affected provider or node");
    }

    function testA52DelegateScopeActionAndRevocation() public {
        Env memory e = setup();
        (bytes32 provider,) = registerRelayNode(e);
        bytes32 node = _a52Node(e,provider,ALICE,BOB,1);
        bytes32 sibling = _a52Node(e,provider,ALICE,BOB,2);
        bytes32 foreignProvider = _a44Provider(e,SETTLER,1);
        vm.prank(SETTLER);
        e.providers.setState(foreignProvider,ResourceProviderRegistry420.State.ACTIVE);
        bytes32 foreignNode = _a52Node(e,foreignProvider,SETTLER,SETTLER,3);
        bytes32 updateGrant = _a52Grant(e,provider,node,ResourceIds420.ACTION_UPDATE_NODE,DELEGATE);
        _a52RejectUpdate(e,sibling,DELEGATE);
        _a52RejectUpdate(e,foreignNode,DELEGATE);
        _a52RejectState(e,node,DELEGATE,ResourceNodeRegistry420.State.ACTIVE);
        _a44RejectUpdate(e,DELEGATE,provider);
        vm.prank(DELEGATE);
        e.nodes.updateNode(node,keccak256("delegate endpoint"),keccak256("delegate capacity"));
        require(e.nodes.getNode(node).revision==2,"delegate update denied");
        e.caps.revokeGrant(updateGrant);
        _a52RejectUpdate(e,node,DELEGATE);
        bytes32 stateGrant = _a52Grant(e,provider,node,ResourceIds420.ACTION_SET_NODE_STATE,DELEGATE);
        _a52RejectUpdate(e,node,DELEGATE);
        _a52RejectState(e,sibling,DELEGATE,ResourceNodeRegistry420.State.ACTIVE);
        _a52RejectState(e,foreignNode,DELEGATE,ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(DELEGATE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        vm.prank(DELEGATE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.SUSPENDED);
        e.caps.revokeGrant(stateGrant);
        _a52RejectState(e,node,DELEGATE,ResourceNodeRegistry420.State.RETIRED);
        vm.prank(ALICE);
        e.nodes.setState(node,ResourceNodeRegistry420.State.RETIRED);
        require(e.nodes.getNode(node).state==ResourceNodeRegistry420.State.RETIRED,"owner retirement denied");
    }

    function testA52OfferPublicationDoesNotFollowNodeOwnership() public {
        Env memory e = setup();
        (bytes32 provider,) = registerRelayNode(e);
        bytes32 node = _a52Node(e,provider,ALICE,BOB,1);
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        bytes32 offer = keccak256("A5.2 offer");
        bytes memory data = abi.encodeCall(e.offers.publishOffer,(offer,node,uint128(2),uint128(100),keccak256("terms"),uint64(block.timestamp+100)));
        _denyCollateralIdentity(BOB,address(e.offers),data,ResourceOfferRegistry420.Unauthorized.selector);
        _a52Grant(e,provider,node,ResourceIds420.ACTION_UPDATE_NODE,DELEGATE);
        _denyCollateralIdentity(DELEGATE,address(e.offers),data,ResourceOfferRegistry420.Unauthorized.selector);
        bytes32 grant = _a52Grant(e,provider,node,ResourceIds420.ACTION_PUBLISH_OFFER,BOB);
        vm.prank(BOB);
        e.offers.publishOffer(offer,node,2,100,keccak256("terms"),uint64(block.timestamp+100));
        require(e.offers.isEffective(offer),"explicit publication grant denied");
        e.caps.revokeGrant(grant);
        bytes32 second = keccak256("A5.2 second offer");
        bytes memory secondData = abi.encodeCall(e.offers.publishOffer,(second,node,uint128(2),uint128(100),keccak256("terms"),uint64(block.timestamp+100)));
        _denyCollateralIdentity(BOB,address(e.offers),secondData,ResourceOfferRegistry420.Unauthorized.selector);
        vm.prank(ALICE);
        e.offers.publishOffer(second,node,2,100,keccak256("terms"),uint64(block.timestamp+100));
        require(e.offers.isEffective(second),"provider publication denied");
    }

    function testA52ReceiptAuthorityDoesNotFollowProviderOwnership() public {
        Env memory e = setup();
        (bytes32 provider,) = registerRelayNode(e);
        bytes32 node = _a52Node(e,provider,ALICE,BOB,1);
        vm.prank(BOB);
        e.nodes.setState(node,ResourceNodeRegistry420.State.ACTIVE);
        bytes32 offer = keccak256("A5.2 receipt offer");
        vm.prank(ALICE);
        e.offers.publishOffer(offer,node,2,100,keccak256("terms"),uint64(block.timestamp+100));
        vm.prank(SETTLER);
        bytes32 session = e.sessions.openCanonicalSession(offer,10,uint64(block.timestamp+90),1);
        bytes32 usage = keccak256("A5.2 usage");
        bytes32 receipt = e.receipts.canonicalReceiptId(session,1,usage);
        bytes memory data = abi.encodeCall(e.receipts.submitReceipt,(receipt,session,uint128(1),usage));
        _denyCollateralIdentity(ALICE,address(e.receipts),data,ResourceReceiptRegistry420.Unauthorized.selector);
        _denyCollateralIdentity(SETTLER,address(e.receipts),data,ResourceReceiptRegistry420.Unauthorized.selector);
        _a52Grant(e,provider,node,ResourceIds420.ACTION_PUBLISH_OFFER,DELEGATE);
        _denyCollateralIdentity(DELEGATE,address(e.receipts),data,ResourceReceiptRegistry420.Unauthorized.selector);
        require(e.receipts.lastUnits(session)==0,"denied receipt advanced accounting");
        vm.prank(BOB);
        e.receipts.submitReceipt(receipt,session,1,usage);
        require(e.receipts.lastUnits(session)==1 && e.receipts.getReceipt(receipt).nodeId==node,"node receipt denied");
        bytes32 grant = _a52Grant(e,provider,node,ResourceIds420.ACTION_SUBMIT_RECEIPT,DELEGATE);
        vm.prank(DELEGATE);
        e.receipts.submitReceipt(e.receipts.canonicalReceiptId(session,2,usage),session,2,usage);
        e.caps.revokeGrant(grant);
        _denyCollateralIdentity(DELEGATE,address(e.receipts),abi.encodeCall(e.receipts.submitReceipt,(e.receipts.canonicalReceiptId(session,3,usage),session,uint128(3),usage)),ResourceReceiptRegistry420.Unauthorized.selector);
        require(e.receipts.lastUnits(session)==2,"revoked receipt advanced accounting");
    }
}
