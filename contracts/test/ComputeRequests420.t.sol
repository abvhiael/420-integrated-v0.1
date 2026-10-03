// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/compute/ComputeRequestRegistry420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmRequests420 {
    function addr(uint256 key) external returns (address);
    function sign(uint256 key, bytes32 digest) external returns (uint8, bytes32, bytes32);
    function prank(address actor) external;
    function warp(uint256 time) external;
}
contract ComputeRequests420Test {
    VmRequests420 constant vm = VmRequests420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant OWNER_KEY = 0xA11CE;
    uint256 constant PAYER_KEY = 0xBEEF;
    address owner;
    address payer;
    address constant DELEGATE = address(0xD311);
    ComputeJobSignedRequestAuthority420 signedRequests;
    ComputeAuthorization420 auth;
    CapabilityRegistry420 caps;
    ComputeRequestRegistry420 requests;
    bytes32 signedId;
    function setUp() public {
        owner = vm.addr(OWNER_KEY); payer = vm.addr(PAYER_KEY);
        signedRequests = new ComputeJobSignedRequestAuthority420();
        caps = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(caps));
        caps.registerProtocolComponent(auth.COMPONENT_COMPUTE(), address(this));
        requests = new ComputeRequestRegistry420(address(signedRequests), address(auth));
        ComputeJobSignedRequestAuthority420.Authorization memory a =
            ComputeJobSignedRequestAuthority420.Authorization(owner, payer, bytes32(uint256(1)),
                bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4)),
                uint64(block.timestamp + 2 days), uint64(block.timestamp + 3 days), 42 ether, 7);
        bytes32 digest = signedRequests.authorizationDigest(a);
        bytes memory os = _sign(OWNER_KEY, digest); bytes memory ps = _sign(PAYER_KEY, digest);
        vm.prank(owner); signedId = signedRequests.registerSignedRequest(a, os, ps);
    }
    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest); return abi.encodePacked(r,s,v);
    }
    function _terms() private view returns (ComputeRequestRegistry420.Terms memory t) {
        ComputeRequestRegistry420.PolicyRef memory p = ComputeRequestRegistry420.PolicyRef(bytes32(uint256(5)),1,bytes32(uint256(6)));
        t = ComputeRequestRegistry420.Terms(bytes32(uint256(7)),bytes32(uint256(8)),bytes32(uint256(9)),
            p,p,bytes32(uint256(10)),bytes32(uint256(11)),bytes32(uint256(12)),2,3,4,p,p,
            uint64(block.timestamp+1 days),uint64(block.timestamp+12 hours),10 ether,bytes32(0));
    }
    function _create() private returns (bytes32 id) {
        ComputeRequestRegistry420.Terms memory t = _terms(); vm.prank(owner);
        id = requests.createRequest(signedId,t);
    }
    function _attempt(address actor, bytes memory call_) private returns (bool ok) {
        vm.prank(actor); (ok,) = address(requests).call(call_);
    }
    function testCanonicalRequestIdentityAndConstraintsAreReconstructable() public {
        bytes32 id = _create(); ComputeRequestRegistry420.Request memory r = requests.request(id);
        require(id == keccak256(abi.encode(requests.REQUEST_DOMAIN(),block.chainid,address(requests),owner,uint64(1))),"id encoding");
        require(r.owner == owner && r.payer == payer && r.signedRequestId == signedId && r.manifestHash == bytes32(uint256(1)),"signed identity");
        require(r.terms.resourceClass == bytes32(uint256(7)) && r.terms.runtimeHash == bytes32(uint256(8)),"resource runtime");
        require(r.terms.verification.version == 1 && r.terms.privacy.commitment == bytes32(uint256(6)),"policy");
        require(r.terms.partitionCount == 2 && r.terms.replicationFactor == 3 && r.terms.maximumPrice == 10 ether,"plan price");
        require(r.terms.fundingReference == 0 && requests.isEffective(id),"unfunded demand");
        require(requests.commitment(id,1) == keccak256(abi.encode(requests.COMMITMENT_DOMAIN(),block.chainid,address(requests),id,r)),"commitment encoding");
    }
    function testDelegatedCreationRequiresExactOwnerApprovedTermsAndScopedGrant() public {
        ComputeRequestRegistry420.Terms memory t = _terms();
        _grant(signedId, auth.ACTION_CREATE_REQUEST(), 10 ether);
        require(!_attempt(DELEGATE,abi.encodeCall(requests.createRequest,(signedId,t))), "grant alone create");
        vm.prank(owner); requests.approveCreation(signedId, DELEGATE, keccak256(abi.encode(t)));
        t.runtimeHash = bytes32(uint256(55));
        require(!_attempt(DELEGATE,abi.encodeCall(requests.createRequest,(signedId,t))), "changed approved terms");
        t = _terms(); vm.prank(DELEGATE); bytes32 id = requests.createRequest(signedId,t);
        require(requests.request(id).owner == owner && requests.request(id).payer == payer, "delegate substituted identities");
        require(!_attempt(DELEGATE,abi.encodeCall(requests.createRequest,(signedId,t))), "delegate replay");
    }
    function testRevisionHistoryAndStaleUpdates() public {
        bytes32 id = _create(); bytes32 original = requests.commitment(id,1);
        ComputeRequestRegistry420.Terms memory t = _terms(); t.runtimeHash = bytes32(uint256(99)); t.maximumPrice = 9 ether;
        vm.prank(owner); requests.updateRequest(id,1,t);
        require(requests.commitment(id,1) == original && requests.revision(id,1).terms.maximumPrice == 10 ether,"immutable history");
        require(requests.request(id).revision == 2 && requests.request(id).predecessorCommitment == original,"revision link");
        require(!_attempt(owner,abi.encodeCall(requests.updateRequest,(id,1,t))),"stale update");
    }
    function testOutsiderAndSignedAuthorizationReuseFailAtomically() public {
        ComputeRequestRegistry420.Terms memory t = _terms();
        require(!_attempt(DELEGATE,abi.encodeCall(requests.createRequest,(signedId,t))),"outsider create");
        require(requests.nextRequestNonce() == 0 && !requests.signedRequestUsed(signedId),"failed creation consumed id");
        bytes32 id = _create();
        require(!_attempt(owner,abi.encodeCall(requests.createRequest,(signedId,t))),"reused signed request");
        require(!_attempt(DELEGATE,abi.encodeCall(requests.updateRequest,(id,1,t))),"outsider update");
        require(!_attempt(DELEGATE,abi.encodeCall(requests.cancelRequest,(id,1))),"outsider cancel");
        require(requests.nextRequestNonce() == 1 && requests.request(id).revision == 1,"failure atomicity");
    }
    function testMalformedPolicyPlanWindowBudgetAndOverflowRejectWithoutAllocation() public {
        for (uint256 i; i < 13; i++) {
            ComputeRequestRegistry420.Terms memory t = _terms();
            if(i==0) t.resourceClass=0; if(i==1) t.runtimeHash=0; if(i==2) t.verification.version=0;
            if(i==3) t.privacy.commitment=0; if(i==4) t.replicationFactor=0; if(i==5) t.partitionCount=0;
            if(i==6) t.maximumPrice=43 ether; if(i==7) t.maximumPrice=0;
            if(i==8) t.deadline=uint64(block.timestamp+4 days); if(i==9) t.expiresAt=t.deadline+1;
            if(i==10) t.expiresAt=uint64(block.timestamp); if(i==11) t.jurisdictionHash=0;
            if(i==12) t.capacityUnits=type(uint256).max;
            require(!_attempt(owner,abi.encodeCall(requests.createRequest,(signedId,t))),"invalid terms accepted");
            require(requests.nextRequestNonce()==0 && !requests.signedRequestUsed(signedId),"failed terms consumed authorization");
        }
    }
    function testBudgetCannotIncreaseEvenInsidePayerSignedCeiling() public {
        bytes32 id=_create(); ComputeRequestRegistry420.Terms memory t=_terms(); t.maximumPrice=11 ether;
        require(!_attempt(owner,abi.encodeCall(requests.updateRequest,(id,1,t))),"budget escalation");
        require(requests.request(id).terms.maximumPrice==10 ether && requests.request(id).revision==1,"budget mutated");
    }
    function testDelegationNeedsOwnerConsentExactScopeActionAndPriceAndExpiresOnRevision() public {
        bytes32 id=_create(); ComputeRequestRegistry420.Terms memory t=_terms();
        _grant(id,auth.ACTION_UPDATE_REQUEST(),9 ether);
        require(!_attempt(DELEGATE,abi.encodeCall(requests.updateRequest,(id,1,t))),"capability alone");
        vm.prank(owner); requests.approveDelegate(id,1,DELEGATE,true,true,10 ether);
        require(!_attempt(DELEGATE,abi.encodeCall(requests.updateRequest,(id,1,t))),"grant price bound");
        t.maximumPrice=9 ether; vm.prank(DELEGATE); requests.updateRequest(id,1,t);
        require(!_attempt(DELEGATE,abi.encodeCall(requests.cancelRequest,(id,2))),"stale owner delegation");
        vm.prank(owner); requests.approveDelegate(id,2,DELEGATE,false,true,0);
        _grant(bytes32(uint256(123)),auth.ACTION_CANCEL_REQUEST(),0);
        require(!_attempt(DELEGATE,abi.encodeCall(requests.cancelRequest,(id,2))),"wrong scope");
        _grant(id,auth.ACTION_CANCEL_REQUEST(),0);
        vm.prank(DELEGATE); requests.cancelRequest(id,2);
        require(requests.request(id).status==ComputeRequestRegistry420.Status.CANCELLED,"delegate cancel");
    }
    function testCancellationTerminalAndStillAvailableAfterExpiry() public {
        bytes32 id=_create(); bytes32 original=requests.commitment(id,1);
        vm.warp(block.timestamp+2 days);
        require(!requests.isEffective(id),"expired effective");
        vm.prank(owner); requests.cancelRequest(id,1);
        require(requests.request(id).predecessorCommitment==original,"cancellation predecessor");
        ComputeRequestRegistry420.Terms memory t=_terms();
        require(!_attempt(owner,abi.encodeCall(requests.updateRequest,(id,2,t))),"terminal resurrection");
        require(!_attempt(owner,abi.encodeCall(requests.createRequest,(signedId,t))),"terminal authorization reuse");
    }
    function testPermissionlessExpiryBoundaryAndTerminalHistory() public {
        bytes32 id=_create(); uint64 until=requests.request(id).terms.expiresAt;
        require(!_attempt(DELEGATE,abi.encodeCall(requests.expireRequest,(id,1))),"early expiry");
        vm.warp(until); require(!requests.isEffective(id),"exclusive expiry boundary");
        requests.expireRequest(id,1);
        require(requests.request(id).status==ComputeRequestRegistry420.Status.EXPIRED && requests.revision(id,1).status==ComputeRequestRegistry420.Status.OPEN,"expiry history");
        require(!_attempt(owner,abi.encodeCall(requests.expireRequest,(id,2))),"duplicate expiry");
    }
    function testIndependentStaticAbiEncodingVector() public view {
        require(requests.REQUEST_DOMAIN() == 0x4cfcec6f45f28035bbb566ed287de10bf8d7ac1a2be1ceeefed14563f993e64b, "request domain vector");
        require(requests.COMMITMENT_DOMAIN() == 0x255e74559cfd74e3f6b60e5530248d52ca9e9ab812674f0e764a50df7ab5c74f, "commitment domain vector");
        bytes32 id = keccak256(abi.encode(requests.REQUEST_DOMAIN(),uint256(420),address(0x42),address(0x11),uint64(1)));
        require(id == 0x16f6a8b07fc2e7bd2fc1e57fad84f67ce2a01c69b4cfe601d310c57ef35f9fa1, "id vector");
        ComputeRequestRegistry420.Terms memory t = _terms();
        t.deadline=1000; t.expiresAt=900; t.maximumPrice=10000;
        ComputeRequestRegistry420.Request memory r = ComputeRequestRegistry420.Request(address(0x11),address(0x12),bytes32(uint256(13)),
            bytes32(uint256(1)),bytes32(uint256(2)),bytes32(uint256(3)),bytes32(uint256(4)),t,100,1,bytes32(0),ComputeRequestRegistry420.Status.OPEN);
        require(keccak256(abi.encode(requests.COMMITMENT_DOMAIN(),uint256(420),address(0x42),id,r)) == 0x5c9004333ebdef360834369300766c34bb8e659050410a96cd8efe3e731ee8c4, "commitment vector");
    }
    function _grant(bytes32 id,bytes32 action,uint256 limit) private {
        caps.createGrant(keccak256(abi.encode(id,action,limit)),DELEGATE,auth.COMPONENT_COMPUTE(),action,
            auth.scopeRequest(id),limit,0,0,0,0);
    }
}
