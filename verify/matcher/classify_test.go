package matcher

import (
	"testing"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/submission"
)

func canonical(withCreation bool) evidence.DeploymentEvidence {
	e := evidence.DeploymentEvidence{
		ChainID:420,
		Address:"0x1111111111111111111111111111111111111111",
		RuntimeBytecode:"0x6001600055",
		RuntimeCodeHash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ObservedAt:evidence.BlockContext{Number:100,Hash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
		FirstCodeBlock:evidence.BlockContext{Number:10,Hash:"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
		Provenance:"canonical_chain_state/rpc",
	}
	if withCreation {
		e.Creation=&evidence.CreationContext{TransactionHash:"0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",ReceiptBlockHash:e.FirstCodeBlock.Hash,CreationBytecode:"0x60606001600055"}
	} else {
		e.MissingContextReason=evidence.MissingCreationTxUnresolved
	}
	return e
}

func build(runtime, creation string) compiler.BuildEvidence {
	return compiler.BuildEvidence{CompilerVersion:"0.8.24+commit.e11b9ed9",BundleHash:"sha256:bundle",InputSHA256:"sha256:input",OutputSHA256:"sha256:output",RuntimeBytecode:runtime,CreationBytecode:creation}
}

func submissionModel() submission.Submission {
	return submission.Submission{Build:submission.BuildSettings{MetadataHashMode:"ipfs",Libraries:[]submission.LibraryLink{{Source:"lib/Math.sol",Library:"Math",Address:"0x2222222222222222222222222222222222222222"}}}}
}

func TestFullMatchRequiresExactRuntimeAndCreationWhenRecoverable(t *testing.T) {
	r := Classify(canonical(true),build("0x6001600055","0x60606001600055"),submissionModel(),true)
	if r.Class!=architecture.ResultFullMatch || !r.RuntimeExact || !r.CreationCompared || !r.CreationExact { t.Fatalf("unexpected full match result: %+v",r) }
}

func TestExactRuntimeWithoutCreationContextIsPartial(t *testing.T) {
	r := Classify(canonical(false),build("0x6001600055","0x60606001600055"),submissionModel(),false)
	if r.Class!=architecture.ResultPartialMatch || !r.RuntimeExact || r.CreationCompared { t.Fatalf("expected partial runtime-only match: %+v",r) }
}

func TestRuntimeMismatchIsMismatchAndPreservesDifferenceContext(t *testing.T) {
	r := Classify(canonical(true),build("0x6002600055","0x60606001600055"),submissionModel(),true)
	if r.Class!=architecture.ResultMismatch || r.RuntimeExact { t.Fatalf("expected runtime mismatch: %+v",r) }
	want:=map[Reason]bool{ReasonRuntimeMismatch:false,ReasonMetadataRelevant:false,ReasonLibraryLinksRelevant:false,ReasonImmutablesRelevant:false}
	for _,d:=range r.Diagnostics { if _,ok:=want[d.Reason];ok{want[d.Reason]=true} }
	for reason,seen:=range want { if !seen { t.Fatalf("missing diagnostic %s: %+v",reason,r.Diagnostics) } }
}

func TestCreationMismatchIsMismatchAfterRuntimeMatch(t *testing.T) {
	r := Classify(canonical(true),build("0x6001600055","0x60606002600055"),submissionModel(),false)
	if r.Class!=architecture.ResultMismatch || !r.RuntimeExact || !r.CreationCompared || r.CreationExact { t.Fatalf("expected creation mismatch: %+v",r) }
}

func TestMissingCompiledRuntimeIsUnverifiable(t *testing.T) {
	r := Classify(canonical(true),build("","0x60606001600055"),submissionModel(),false)
	if r.Class!=architecture.ResultUnverifiable { t.Fatalf("expected unverifiable: %+v",r) }
}

func TestMalformedCanonicalEvidenceIsUnverifiable(t *testing.T) {
	e:=canonical(true); e.RuntimeCodeHash="0x1234"
	r:=Classify(e,build("0x6001600055","0x60606001600055"),submissionModel(),false)
	if r.Class!=architecture.ResultUnverifiable { t.Fatalf("expected invalid canonical evidence to be unverifiable: %+v",r) }
}
