// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchDashboard420.sol";

contract DashboardProjectsMock420 is IComputeResearchDashboardProject420 {
    mapping(bytes32 => Project) internal current;
    mapping(bytes32 => mapping(uint64 => Project)) internal history;
    mapping(bytes32 => mapping(uint64 => bytes32)) internal commitments;

    function systemName() external pure returns (string memory) { return "ComputeResearchProjectRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 id, Project memory p, bytes32 c) external {
        current[id]=p; history[id][p.revision]=p; commitments[id][p.revision]=c;
    }
    function project(bytes32 id) external view returns (Project memory) { return current[id]; }
    function revision(bytes32 id,uint64 r) external view returns (Project memory) { return history[id][r]; }
    function commitment(bytes32 id,uint64 r) external view returns (bytes32) { return commitments[id][r]; }
    function currentCommitment(bytes32 id) external view returns (bytes32) {
        Project memory p=current[id]; return commitments[id][p.revision];
    }
}

contract DashboardResultSourceMock420 is IComputeResearchDashboardResultSource420 {
    mapping(bytes32 => ContextView) internal contexts;
    function systemName() external pure returns (string memory) { return "ComputeScientificResultSource420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 jobId, ContextView memory c) external { contexts[jobId]=c; }
    function context(bytes32 jobId) external view returns (ContextView memory) { return contexts[jobId]; }
}

contract DashboardProvenanceMock420 is IComputeResearchDashboardProvenance420 {
    address public immutable source;
    mapping(bytes32 => ProvenanceView) internal records;
    mapping(bytes32 => bool) internal canonical;
    constructor(address source_) { source=source_; }
    function systemName() external pure returns (string memory) { return "ComputeScientificResultProvenance420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 id, ProvenanceView memory p, bool ok) external { records[id]=p; canonical[id]=ok; }
    function provenance(bytes32 id) external view returns (ProvenanceView memory) { return records[id]; }
    function isCanonical(bytes32 id) external view returns (bool) { return canonical[id]; }
}

contract DashboardLineageMock420 is IComputeResearchDashboardLineage420 {
    address public immutable provenanceRegistry;
    address public immutable resultSource;
    address public immutable projectRegistry;
    mapping(bytes32 => LineageRecord) internal records;
    mapping(bytes32 => bool) internal canonical;
    mapping(bytes32 => bytes32[]) internal parents;
    constructor(address p,address r,address projects_) {
        provenanceRegistry=p; resultSource=r; projectRegistry=projects_;
    }
    function systemName() external pure returns (string memory) { return "ComputeScientificMetadataLineage420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 id, LineageRecord memory l, bool ok, bytes32[] memory ps) external {
        records[id]=l; canonical[id]=ok; parents[id]=ps;
    }
    function record(bytes32 id) external view returns (LineageRecord memory) { return records[id]; }
    function parentProvenanceIds(bytes32 id) external view returns (bytes32[] memory) { return parents[id]; }
    function isCanonical(bytes32 id) external view returns (bool) { return canonical[id]; }
}

contract DashboardPublicationMock420 is IComputeResearchDashboardPublication420 {
    address public immutable lineageRegistry;
    mapping(bytes32=>bytes32) public policyForLineage;
    mapping(bytes32=>Policy) internal policies;
    mapping(bytes32=>bytes32) internal commitments;
    mapping(bytes32=>bool) internal authorized;
    constructor(address l) { lineageRegistry=l; }
    function systemName() external pure returns (string memory) { return "ComputeScientificPublicationRetention420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function set(bytes32 lineageId,bytes32 id,Policy memory p,bytes32 c,bool auth) external {
        policyForLineage[lineageId]=id; policies[id]=p; commitments[id]=c; authorized[id]=auth;
    }
    function policy(bytes32 id) external view returns (Policy memory) { return policies[id]; }
    function currentCommitment(bytes32 id) external view returns (bytes32) { return commitments[id]; }
    function isCurrentPolicy(bytes32 id,uint64 r,bytes32 c) external view returns (bool) {
        Policy memory p=policies[id]; return p.revision==r && p.active && commitments[id]==c;
    }
    function isPublicationAuthorized(bytes32 id) external view returns (bool) { return authorized[id]; }
}

contract ComputeResearchDashboard420Test {
    DashboardProjectsMock420 projects;
    DashboardResultSourceMock420 source;
    DashboardProvenanceMock420 provenance;
    DashboardLineageMock420 lineage;
    DashboardPublicationMock420 publication;
    ComputeResearchDashboard420 dashboard;

    bytes32 constant PROJECT=keccak256("project");
    bytes32 constant PROJECT_COMMITMENT=keccak256("project-commitment");
    bytes32 constant LINEAGE=keccak256("lineage");
    bytes32 constant PROVENANCE=keccak256("provenance");
    bytes32 constant JOB=keccak256("job");
    bytes32 constant RESULT=keccak256("result");
    bytes32 constant EXECUTION=keccak256("execution");
    bytes32 constant MANIFEST=keccak256("manifest");
    bytes32 constant INPUT=keccak256("input");
    bytes32 constant OUTPUT=keccak256("output");
    bytes32 constant FUNDING=keccak256("funding");
    bytes32 constant VERIFY_POLICY=keccak256("verify-policy");
    bytes32 constant ENV=keccak256("environment");
    bytes32 constant PARAMETERS=keccak256("parameters");
    bytes32 constant RESOURCE=keccak256("resource");

    function setUp() public {
        projects=new DashboardProjectsMock420();
        source=new DashboardResultSourceMock420();
        provenance=new DashboardProvenanceMock420(address(source));
        lineage=new DashboardLineageMock420(address(provenance),address(source),address(projects));
        publication=new DashboardPublicationMock420(address(lineage));
        dashboard=new ComputeResearchDashboard420(
            address(projects),address(provenance),address(lineage),address(publication)
        );
        _seed();
    }

    function _scientific() internal view returns(bytes32) {
        return keccak256(abi.encode(
            dashboard.SCIENTIFIC_UNIT_DOMAIN_V1(),uint32(1),block.chainid,JOB,
            PROJECT_COMMITMENT,MANIFEST,ENV,INPUT,PARAMETERS,RESOURCE,OUTPUT,
            VERIFY_POLICY,uint64(1000),FUNDING
        ));
    }

    function _query() internal pure returns(ComputeResearchDashboard420.ResultQuery memory q) {
        q.lineageId=LINEAGE; q.projectId=PROJECT; q.projectRevision=1;
        q.researchProjectCommitment=PROJECT_COMMITMENT;
        q.executableContainerCommitment=ENV; q.parametersCommitment=PARAMETERS; q.resourceClass=RESOURCE;
    }

    function _seed() internal {
        projects.set(PROJECT,IComputeResearchDashboardProject420.Project({
            owner:address(this),researchDomain:keccak256("domain"),
            definitionCommitment:keccak256("definition"),predecessorCommitment:bytes32(0),
            createdAt:1,updatedAt:1,revision:1,acceptingNewWork:true,status:1
        }),PROJECT_COMMITMENT);

        source.set(JOB,IComputeResearchDashboardResultSource420.ContextView({
            unitId:JOB,attemptRef:keccak256("attempt"),attempt:1,worker:address(0xBEEF),
            resultCommitment:RESULT,executionEvidenceCommitment:EXECUTION,manifestHash:MANIFEST,
            inputCommitment:INPUT,outputSchemaCommitment:OUTPUT,fundingRef:FUNDING,
            verificationStrategyCommitment:VERIFY_POLICY,deadline:1000,verifier:address(0xCAFE),
            verificationRef:keccak256("verification"),verificationRecorded:true
        }));

        bytes32 scientific=_scientific();
        provenance.set(PROVENANCE,IComputeResearchDashboardProvenance420.ProvenanceView({
            jobId:JOB,unitId:JOB,scientificWorkUnitCommitment:scientific,attemptRef:keccak256("attempt"),
            attempt:1,worker:address(0xBEEF),resultCommitment:RESULT,
            executionEvidenceCommitment:EXECUTION,verifier:address(0xCAFE),
            verificationRef:keccak256("verification"),outputSchemaCommitment:OUTPUT,
            recordedAt:2,exists:true
        }),true);

        bytes32[] memory parents=new bytes32[](1); parents[0]=keccak256("parent-provenance");
        lineage.set(LINEAGE,IComputeResearchDashboardLineage420.LineageRecord({
            provenanceId:PROVENANCE,scientificWorkUnitCommitment:scientific,publisher:address(this),
            metadataSchemaCommitment:keccak256("metadata-schema"),metadataCommitment:keccak256("metadata"),
            relationCommitment:keccak256("derived"),parentSetCommitment:keccak256("parents"),
            parentCount:1,recordedAt:3,exists:true
        }),true,parents);
    }

    function testProjectViewsExposeCanonicalCurrentAndHistoricalState() public {
        ComputeResearchDashboard420.ProjectView memory p=dashboard.currentProject(PROJECT);
        require(p.projectId==PROJECT && p.owner==address(this),"project identity");
        require(p.projectCommitment==PROJECT_COMMITMENT && p.revision==1,"project commitment");
        require(p.acceptingNewWork && p.status==1,"project state");
        ComputeResearchDashboard420.ProjectView memory h=dashboard.projectRevision(PROJECT,1);
        require(h.projectCommitment==PROJECT_COMMITMENT,"history");
    }

    function testResearchResultComposesCanonicalScientificGraphWithoutPolicy() public {
        ComputeResearchDashboard420.ResultView memory v=dashboard.researchResult(_query());
        require(v.lineageId==LINEAGE && v.provenanceId==PROVENANCE,"ids");
        require(v.resultCommitment==RESULT && v.executionEvidenceCommitment==EXECUTION,"result");
        require(v.metadataCommitment==keccak256("metadata") && v.parentCount==1,"metadata");
        require(v.provenanceCanonical && v.lineageCanonical,"canonical");
        require(v.policyId==bytes32(0) && !v.policyCurrent && !v.publicationAuthorized,"missing policy");
    }

    function testResearchResultExposesCurrentPublicationPolicy() public {
        bytes32 policyId=keccak256("policy");
        bytes32 policyCommitment=keccak256("policy-commitment");
        publication.set(LINEAGE,policyId,IComputeResearchDashboardPublication420.Policy({
            lineageId:LINEAGE,publisher:address(this),visibility:3,
            accessPolicyCommitment:keccak256("access"),retentionPolicyCommitment:keccak256("retention"),
            publicationManifestCommitment:keccak256("manifest"),predecessorCommitment:bytes32(0),
            notBefore:0,retainUntil:0,revision:1,active:true
        }),policyCommitment,true);
        ComputeResearchDashboard420.ResultView memory v=dashboard.researchResult(_query());
        require(v.policyId==policyId && v.policyCommitment==policyCommitment,"policy");
        require(v.policyRevision==1 && v.visibility==3 && v.policyActive,"policy state");
        require(v.policyCurrent && v.publicationAuthorized,"publication");
    }

    function testProjectBindingSubstitutionFailsClosed() public {
        ComputeResearchDashboard420.ResultQuery memory q=_query();
        q.researchProjectCommitment=keccak256("wrong-project");
        (bool ok,)=address(dashboard).staticcall(abi.encodeCall(dashboard.researchResult,(q)));
        require(!ok,"project substitution");
    }

    function testScientificWitnessSubstitutionFailsClosed() public {
        ComputeResearchDashboard420.ResultQuery memory q=_query();
        q.parametersCommitment=keccak256("wrong-parameters");
        (bool ok,)=address(dashboard).staticcall(abi.encodeCall(dashboard.researchResult,(q)));
        require(!ok,"scientific substitution");
    }

    function testNonCanonicalProvenanceOrLineageFailsClosed() public {
        IComputeResearchDashboardProvenance420.ProvenanceView memory p=provenance.provenance(PROVENANCE);
        provenance.set(PROVENANCE,p,false);
        (bool ok,)=address(dashboard).staticcall(abi.encodeCall(dashboard.researchResult,(_query())));
        require(!ok,"provenance drift");
        provenance.set(PROVENANCE,p,true);
        IComputeResearchDashboardLineage420.LineageRecord memory l=lineage.record(LINEAGE);
        bytes32[] memory parents=lineage.parentProvenanceIds(LINEAGE);
        lineage.set(LINEAGE,l,false,parents);
        (ok,)=address(dashboard).staticcall(abi.encodeCall(dashboard.researchResult,(_query())));
        require(!ok,"lineage drift");
    }

    function testParentViewRequiresCanonicalLineage() public {
        bytes32[] memory parents=dashboard.parentProvenanceIds(LINEAGE);
        require(parents.length==1 && parents[0]==keccak256("parent-provenance"),"parents");
    }

    function testDashboardIsReadOnlyAndAuthorityFree() public {
        ComputeResearchDashboard420.Components memory c=dashboard.components();
        require(c.projects==address(projects) && c.provenance==address(provenance),"components");
        require(c.lineage==address(lineage) && c.publication==address(publication),"components 2");
        require(dashboard.schemaVersion()==1,"schema");
    }
}
