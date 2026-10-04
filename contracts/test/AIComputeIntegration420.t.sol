// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/ai/AIComputeAdapter420.sol";
import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/compute/ICompute420.sol";

interface VmAIComputeIntegration420 { function prank(address) external; }

contract MockCapsAI4 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address,bytes32,bytes32,bytes32,uint256) external pure returns (bool) { return false; }
}
contract MockRequestAI4 is IAIComputeRequestAuthority420 {
    mapping(bytes32=>Request) internal rs;
    function setRequest(bytes32 id, Request calldata r) external { rs[id]=r; }
    function getRequest(bytes32 id) external view returns(Request memory){return rs[id];}
}
contract MockFundingAI4 is IAIComputeFunding420 {
    mapping(bytes32=>Credit) internal cs;
    function setCredit(bytes32 id, Credit calldata c) external { cs[id]=c; }
    function credit(bytes32 id) external view returns(Credit memory){ return cs[id]; }
    function funded(bytes32 jobId,address owner,bytes32 fundingRef) external view returns(bool){
        Credit memory c=cs[jobId];
        return c.exists && !c.refunded && !c.allocated && c.owner==owner && fundingRef==jobId
            && c.deposited>0 && c.deposited<=c.maximumSpend && c.obligationId!=bytes32(0);
    }
}
contract MockJobsAI4 is IAIComputeJobRegistry420 {
    mapping(bytes32=>Job) internal js; address public override requestEvidence;
    constructor(address r){requestEvidence=r;}
    function setJob(bytes32 id, Job calldata j) external {js[id]=j;}
    function job(bytes32 id) external view returns(Job memory){return js[id];}
}
contract MockMatchesAI4 is IAIComputeAcceptedMatch420 {
    mapping(bytes32=>Match) internal ms; mapping(bytes32=>PriceReservation) internal ps; mapping(bytes32=>bytes32) public override priceReservationForJob;
    function setMatch(bytes32 id,Match calldata m) external{ms[id]=m;}
    function setPrice(bytes32 jobId,bytes32 ref,PriceReservation calldata p) external{priceReservationForJob[jobId]=ref;ps[ref]=p;}
    function getMatch(bytes32 id) external view returns(Match memory){return ms[id];}
    function priceReservation(bytes32 id) external view returns(PriceReservation memory){return ps[id];}
}
contract MockProviderAI4 is IAIComputeProviderRegistry420 {
    mapping(bytes32=>Provider) internal ps;
    function setProvider(bytes32 id,Provider calldata p) external{ps[id]=p;}
    function provider(bytes32 id) external view returns(Provider memory){return ps[id];}
}
contract MockEntitlementAI4 is IAIComputeEntitlement420 {
    mapping(bytes32=>Entitlement) internal es; mapping(bytes32=>bytes32) public override entitlementForJob;
    mapping(bytes32=>bytes32) internal settledRef; mapping(bytes32=>bytes32) internal refundRef;
    function setEntitlement(bytes32 jobId,bytes32 ref,Entitlement calldata e) external{entitlementForJob[jobId]=ref;es[ref]=e;}
    function setSettled(bytes32 jobId,bytes32 ref) external{settledRef[jobId]=ref;}
    function setRefunded(bytes32 jobId,bytes32 ref) external{refundRef[jobId]=ref;}
    function entitlement(bytes32 ref) external view returns(Entitlement memory){return es[ref];}
    function settled(bytes32 jobId,bytes32,bytes32 ref) external view returns(bool){return settledRef[jobId]==ref&&ref!=0;}
    function refunded(bytes32 jobId,bytes32 ref) external view returns(bool){return refundRef[jobId]==ref&&ref!=0;}
}
contract MockRouterAI4 is ICompute420 {
    bytes32 public immutable override componentGraphHash=keccak256("AI4/CMP/GRAPH");
    address public immutable override jobRegistry; address public immutable override matchRegistry;
    address public immutable override settlementAdapter; address public immutable override providerRegistry;
    address public immutable override fundingAdapter;
    constructor(address j,address f,address m,address e,address p){jobRegistry=j;fundingAdapter=f;matchRegistry=m;settlementAdapter=e;providerRegistry=p;}
    function workerEvidence()external pure returns(address){return address(0x13);}
    function verificationRouter()external pure returns(address){return address(0x14);}function disputeResolver()external pure returns(address){return address(0x15);}
    function nodeRegistry()external pure returns(address){return address(0x16);}function resourceRegistry()external pure returns(address){return address(0x17);}
    function offerRegistry()external pure returns(address){return address(0x18);}
}

contract AIComputeIntegration420Test {
    VmAIComputeIntegration420 constant vm=VmAIComputeIntegration420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE); address constant PAYER=address(0xBEEF); address constant BENEFICIARY=address(0xFEE1); address constant VERIFIER=address(0xC0DE);
    bytes32 constant AIP=keccak256("ai-provider"); bytes32 constant CP=keccak256("compute-provider"); bytes32 constant MODEL=keccak256("model");
    bytes32 constant VERSION=keccak256("version"); bytes32 constant DEPLOY=keccak256("deployment"); bytes32 constant OFFER=keccak256("offer");
    bytes32 constant RESOURCE=keccak256("resource"); bytes32 constant MATCH=keccak256("match"); bytes32 constant PRICE=keccak256("price");
    bytes32 constant SCHEMA=keccak256("schema"); bytes32 constant VERIFY=keccak256("verify"); bytes32 constant REQUIREMENT=keccak256("requirement");
    bytes32 constant PRIVACY=keccak256("privacy"); bytes32 constant INPUT=keccak256("input");

    MockRequestAI4 requests; MockFundingAI4 funding; MockJobsAI4 cmpJobs; MockMatchesAI4 matches; MockProviderAI4 providers; MockEntitlementAI4 entitlements;
    MockRouterAI4 router; MockCapsAI4 caps; AIAuthorization420 auth; AIProviderRegistry aiProviders; AIModelRegistry models;
    AIModelDeploymentRegistry420 deployments; AIJobManager aiJobs; AIComputeAdapter420 adapter;

    function setUp() public {
        requests=new MockRequestAI4();funding=new MockFundingAI4();cmpJobs=new MockJobsAI4(address(requests));matches=new MockMatchesAI4();providers=new MockProviderAI4();entitlements=new MockEntitlementAI4();
        router=new MockRouterAI4(address(cmpJobs),address(funding),address(matches),address(entitlements),address(providers));caps=new MockCapsAI4();auth=new AIAuthorization420(address(caps));
        aiProviders=new AIProviderRegistry(address(this));models=new AIModelRegistry(address(this));deployments=new AIModelDeploymentRegistry420(address(auth),address(aiProviders),address(models));aiJobs=new AIJobManager(address(this));
        vm.prank(ALICE);aiProviders.registerProvider(AIP,ALICE,ALICE,keccak256("meta"),keccak256("stake"),CP);vm.prank(ALICE);aiProviders.activate(AIP);
        vm.prank(ALICE);models.registerModel(MODEL,keccak256("meta"),keccak256("license"));vm.prank(ALICE);models.registerVersion(VERSION,MODEL,1,keccak256("manifest"),keccak256("weights"),keccak256("runtime"),REQUIREMENT,SCHEMA,VERIFY,keccak256("license"));
        vm.prank(ALICE);deployments.registerDeployment(DEPLOY,AIP,VERSION,OFFER,keccak256("service-price"),keccak256("endpoint"),uint64(block.timestamp+2 days),keccak256("region"),keccak256("sla"));vm.prank(ALICE);deployments.setState(DEPLOY,AIModelDeploymentRegistry420.State.ACTIVE);
        providers.setProvider(CP,IAIComputeProviderRegistry420.Provider(ALICE,ALICE,BENEFICIARY,keccak256("m"),keccak256("s"),uint64(block.timestamp),1,IAIComputeProviderRegistry420.Status.ACTIVE));
        adapter=new AIComputeAdapter420(address(aiJobs),address(auth),address(router),address(aiProviders),address(models),address(deployments));aiJobs.bindComputeAdapter(address(adapter));
    }

    function _bound(bytes32 aiId,bytes32 reqId,bytes32 cmpJobId) private {
        uint64 aiDeadline=uint64(block.timestamp+1 days);uint64 cmpDeadline=uint64(block.timestamp+12 hours);
        vm.prank(ALICE);aiJobs.createRequest(aiId,VERSION,AIIds420.WORKLOAD_TEXT,INPUT,PRIVACY,VERIFY,100,aiDeadline);
        bytes32 manifest=adapter.computeManifestHash(aiId,DEPLOY,VERSION,REQUIREMENT,PRIVACY,VERIFY,AIIds420.WORKLOAD_TEXT,INPUT,SCHEMA,80,cmpDeadline);
        requests.setRequest(reqId,IAIComputeRequestAuthority420.Request(ALICE,PAYER,reqId,manifest,AIIds420.WORKLOAD_TEXT,INPUT,SCHEMA,cmpDeadline,uint64(block.timestamp+1 days),80,1,true));
        bytes32 graph=router.componentGraphHash();vm.prank(ALICE);adapter.bindComputeRequest(aiId,reqId,DEPLOY,graph);
        IAIComputeJobRegistry420.Job memory j;
        j.owner=ALICE;j.requestId=reqId;j.requestCommitment=reqId;j.manifestHash=manifest;j.workloadType=AIIds420.WORKLOAD_TEXT;j.inputCommitment=INPUT;j.outputSchemaCommitment=SCHEMA;j.fundingRef=cmpJobId;j.deadline=cmpDeadline;j.revision=2;j.status=IAIComputeJobRegistry420.Status.FUNDED;
        funding.setCredit(cmpJobId,IAIComputeFunding420.Credit(reqId,ALICE,PAYER,80,80,cmpDeadline,keccak256(abi.encode("obligation",cmpJobId)),true,false,false,0,bytes32(0),bytes32(0),bytes32(0)));
        cmpJobs.setJob(cmpJobId,j);adapter.bindComputeJob(aiId,cmpJobId);
        j.matchId=MATCH;j.revision=4;j.status=IAIComputeJobRegistry420.Status.ACCEPTED;cmpJobs.setJob(cmpJobId,j);
        matches.setMatch(MATCH,IAIComputeAcceptedMatch420.Match(cmpJobId,reqId,manifest,OFFER,RESOURCE,CP,keccak256("node"),1,ALICE,ALICE,PRICE,keccak256("accept"),true));
        matches.setPrice(cmpJobId,PRICE,IAIComputeAcceptedMatch420.PriceReservation(cmpJobId,MATCH,OFFER,reqId,ALICE,PAYER,CP,RESOURCE,1,BENEFICIARY,keccak256("pricing"),1,60,80,80,keccak256("dispute"),1,1,1,1,1,uint64(block.timestamp),true));
        adapter.syncAcceptedMatch(aiId);
    }

    function testAIToCMPVerifiedEntitlementAndSettlementEvidence() public {
        bytes32 aiId=keccak256("ai-1");bytes32 reqId=keccak256("req-1");bytes32 cmpJobId=keccak256("job-1");_bound(aiId,reqId,cmpJobId);
        IAIComputeJobRegistry420.Job memory j=cmpJobs.job(cmpJobId);j.assignmentRef=keccak256("assignment");j.status=IAIComputeJobRegistry420.Status.RUNNING;cmpJobs.setJob(cmpJobId,j);adapter.syncExecution(aiId);
        j.resultCommitment=keccak256("result");j.status=IAIComputeJobRegistry420.Status.RESULT_COMMITTED;cmpJobs.setJob(cmpJobId,j);adapter.syncExecution(aiId);
        j.verifier=VERIFIER;j.verificationRef=keccak256("verification");j.status=IAIComputeJobRegistry420.Status.VERIFIED;cmpJobs.setJob(cmpJobId,j);
        bytes32 er=keccak256("entitlement");entitlements.setEntitlement(cmpJobId,er,IAIComputeEntitlement420.Entitlement(cmpJobId,reqId,MATCH,PRICE,j.verificationRef,j.resultCommitment,VERIFIER,PAYER,CP,RESOURCE,BENEFICIARY,keccak256("pricing"),1,60,60,80,80,uint64(block.timestamp),true));
        adapter.syncVerifiedEntitlement(aiId);
        (,,,,,,,,,,,,,,,,AIJobManager.Status st)=aiJobs.jobs(aiId);require(st==AIJobManager.Status.VERIFIED,"AI not verified");
        j.settlementRef=keccak256("settlement");j.status=IAIComputeJobRegistry420.Status.SETTLED;cmpJobs.setJob(cmpJobId,j);entitlements.setSettled(cmpJobId,j.settlementRef);adapter.observeSettlement(aiId);
        AIComputeAdapter420.Binding memory b=adapter.getBinding(aiId);require(b.entitlementRef==er&&b.settlementRef==j.settlementRef&&b.resultCommitment==j.resultCommitment,"settlement binding drift");
        (,,,,,,,,,,,,,,,,st)=aiJobs.jobs(aiId);require(st==AIJobManager.Status.SETTLED,"AI settlement not reconciled");
    }

    function testRefundEvidenceBindsToOriginalCMPJob() public {
        bytes32 aiId=keccak256("ai-refund");bytes32 reqId=keccak256("req-refund");bytes32 cmpJobId=keccak256("job-refund");_bound(aiId,reqId,cmpJobId);
        IAIComputeJobRegistry420.Job memory j=cmpJobs.job(cmpJobId);j.status=IAIComputeJobRegistry420.Status.FAILED;cmpJobs.setJob(cmpJobId,j);adapter.syncExecution(aiId);
        j.settlementRef=keccak256("refund");j.status=IAIComputeJobRegistry420.Status.REFUNDED;cmpJobs.setJob(cmpJobId,j);entitlements.setRefunded(cmpJobId,j.settlementRef);adapter.observeRefund(aiId);
        AIComputeAdapter420.Binding memory b=adapter.getBinding(aiId);require(b.refundRef==j.settlementRef,"refund evidence missing");
        (,,,,,,,,,,,,,,,,AIJobManager.Status st)=aiJobs.jobs(aiId);require(st==AIJobManager.Status.REFUNDED,"AI refund not reconciled");
    }

    function testBroadenedSpendOrManifestFailsClosed() public {
        bytes32 aiId=keccak256("ai-broad");bytes32 reqId=keccak256("req-broad");uint64 deadline=uint64(block.timestamp+12 hours);
        vm.prank(ALICE);aiJobs.createRequest(aiId,VERSION,AIIds420.WORKLOAD_TEXT,INPUT,PRIVACY,VERIFY,100,uint64(block.timestamp+1 days));
        requests.setRequest(reqId,IAIComputeRequestAuthority420.Request(ALICE,PAYER,reqId,keccak256("wrong"),AIIds420.WORKLOAD_TEXT,INPUT,SCHEMA,deadline,uint64(block.timestamp+1 days),95,1,true));
        vm.prank(ALICE);(bool ok,)=address(adapter).call(abi.encodeCall(adapter.bindComputeRequest,(aiId,reqId,DEPLOY,router.componentGraphHash())));require(!ok,"broadened request admitted");
    }

    function testWrongAcceptedProviderOrBeneficiaryFailsClosed() public {
        bytes32 aiId=keccak256("ai-bad-match");bytes32 reqId=keccak256("req-bad-match");bytes32 cmpJobId=keccak256("job-bad-match");
        uint64 aiDeadline=uint64(block.timestamp+1 days);uint64 cmpDeadline=uint64(block.timestamp+12 hours);vm.prank(ALICE);aiJobs.createRequest(aiId,VERSION,AIIds420.WORKLOAD_TEXT,INPUT,PRIVACY,VERIFY,100,aiDeadline);
        bytes32 manifest=adapter.computeManifestHash(aiId,DEPLOY,VERSION,REQUIREMENT,PRIVACY,VERIFY,AIIds420.WORKLOAD_TEXT,INPUT,SCHEMA,80,cmpDeadline);requests.setRequest(reqId,IAIComputeRequestAuthority420.Request(ALICE,PAYER,reqId,manifest,AIIds420.WORKLOAD_TEXT,INPUT,SCHEMA,cmpDeadline,uint64(block.timestamp+1 days),80,1,true));bytes32 graph=router.componentGraphHash();vm.prank(ALICE);adapter.bindComputeRequest(aiId,reqId,DEPLOY,graph);
        IAIComputeJobRegistry420.Job memory j;j.owner=ALICE;j.requestId=reqId;j.requestCommitment=reqId;j.manifestHash=manifest;j.workloadType=AIIds420.WORKLOAD_TEXT;j.inputCommitment=INPUT;j.outputSchemaCommitment=SCHEMA;j.fundingRef=cmpJobId;j.deadline=cmpDeadline;j.status=IAIComputeJobRegistry420.Status.FUNDED;funding.setCredit(cmpJobId,IAIComputeFunding420.Credit(reqId,ALICE,PAYER,80,80,cmpDeadline,keccak256(abi.encode("obligation",cmpJobId)),true,false,false,0,bytes32(0),bytes32(0),bytes32(0)));cmpJobs.setJob(cmpJobId,j);adapter.bindComputeJob(aiId,cmpJobId);j.matchId=MATCH;j.status=IAIComputeJobRegistry420.Status.ACCEPTED;cmpJobs.setJob(cmpJobId,j);
        matches.setMatch(MATCH,IAIComputeAcceptedMatch420.Match(cmpJobId,reqId,manifest,OFFER,RESOURCE,CP,keccak256("node"),1,ALICE,ALICE,PRICE,keccak256("accept"),true));matches.setPrice(cmpJobId,PRICE,IAIComputeAcceptedMatch420.PriceReservation(cmpJobId,MATCH,OFFER,reqId,ALICE,PAYER,keccak256("wrong-provider"),RESOURCE,1,address(0xBAD),keccak256("pricing"),1,60,80,80,keccak256("dispute"),1,1,1,1,1,uint64(block.timestamp),true));
        (bool ok,)=address(adapter).call(abi.encodeCall(adapter.syncAcceptedMatch,(aiId)));require(!ok,"wrong provider/beneficiary admitted");
    }
}
