package processor

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/store"
	"github.com/420integrated/420-integrated/verify/submission"
)

type fakeSource struct {
	deployment evidence.DeploymentEvidence
	err        error
}

func (f fakeSource) Acquire(context.Context, string, uint64) (evidence.DeploymentEvidence, error) {
	return f.deployment, f.err
}

type fakeBuilder struct {
	build compiler.BuildEvidence
	err   error
}

func (f fakeBuilder) Compile(context.Context, submission.Submission) (compiler.BuildEvidence, error) {
	return f.build, f.err
}

func TestProcessorRunsCanonicalEvidenceBuildClassificationAndPersistence(t *testing.T) {
	deployment := evidence.DeploymentEvidence{
		ChainID:         420,
		Address:         "0x1111111111111111111111111111111111111111",
		RuntimeBytecode: "0x60016000",
		RuntimeCodeHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ObservedAt:      evidence.BlockContext{Number: 100, Hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
		FirstCodeBlock:  evidence.BlockContext{Number: 90, Hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
		Creation: &evidence.CreationContext{
			TransactionHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
			ReceiptBlockHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
			CreationBytecode: "0x60021234",
		},
		Provenance: "canonical_chain_state/rpc",
	}
	settings := submission.BuildSettings{
		CompilerVersion:      "0.8.24+commit.e11b9ed9",
		OptimizerEnabled:     true,
		OptimizerRuns:        200,
		EVMVersion:           "cancun",
		ViaIR:                false,
		MetadataHashMode:     "ipfs",
		ConstructorArgsKnown: true,
		ConstructorArguments: "0x1234",
	}
	submitted, err := submission.NewMultiFile(map[string]string{"A.sol": "contract A {}"}, settings)
	if err != nil {
		t.Fatal(err)
	}
	build := compiler.BuildEvidence{
		CompilerVersion:  settings.CompilerVersion,
		CompilerSHA256:   "sha256:compiler",
		BundleHash:       submitted.BundleHash,
		InputSHA256:      "sha256:input",
		OutputSHA256:     "sha256:output",
		NetworkDisabled:  true,
		WorkingDirClean:  true,
		RuntimeBytecode:  "0x60016000",
		CreationBytecode: "0x6002",
	}

	evidenceStore, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc, err := New(fakeSource{deployment: deployment}, fakeBuilder{build: build}, evidenceStore)
	if err != nil {
		t.Fatal(err)
	}
	record, err := svc.Verify(context.Background(), 420, deployment.Address, submitted)
	if err != nil {
		t.Fatal(err)
	}
	if record.Classification.Class != architecture.ResultFullMatch {
		t.Fatalf("unexpected classification: %+v", record.Classification)
	}
	if record.BindingKey != deployment.BindingKey() || record.RecordHash == "" {
		t.Fatalf("verification evidence was not durably bound: %+v", record)
	}
}

func TestProcessorFailsClosedOnCanonicalEvidenceFailure(t *testing.T) {
	evidenceStore, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc, err := New(fakeSource{err: errors.New("rpc unavailable")}, fakeBuilder{}, evidenceStore)
	if err != nil {
		t.Fatal(err)
	}
	submitted, err := submission.NewMultiFile(map[string]string{"A.sol": "contract A {}"}, submission.BuildSettings{
		CompilerVersion:      "0.8.24",
		OptimizerEnabled:     false,
		OptimizerRuns:        200,
		EVMVersion:           "cancun",
		MetadataHashMode:     "ipfs",
		ConstructorArgsKnown: true,
		ConstructorArguments: "0x",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Verify(context.Background(), 420, "0x1111111111111111111111111111111111111111", submitted); err == nil {
		t.Fatal("canonical evidence failure must stop verification")
	}
}
