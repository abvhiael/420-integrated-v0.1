package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/matcher"
	"github.com/420integrated/420-integrated/verify/submission"
)

func fixture(t *testing.T, runtimeHash string) (evidence.DeploymentEvidence, submission.Submission, compiler.BuildEvidence, matcher.Result) {
	t.Helper()
	deployment := evidence.DeploymentEvidence{
		ChainID: 420,
		Address: "0x1111111111111111111111111111111111111111",
		RuntimeBytecode: "0x60016000",
		RuntimeCodeHash: runtimeHash,
		ObservedAt: evidence.BlockContext{Number: 100, Hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
		FirstCodeBlock: evidence.BlockContext{Number: 90, Hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
		Creation: &evidence.CreationContext{TransactionHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", ReceiptBlockHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", CreationBytecode: "0x6001600055"},
		Provenance: "canonical_chain_state/rpc",
	}
	buildSettings := submission.BuildSettings{CompilerVersion: "0.8.24+commit.e11b9ed9", OptimizerEnabled: true, OptimizerRuns: 200, EVMVersion: "cancun", ViaIR: false, MetadataHashMode: "ipfs", ConstructorArgsKnown: true, ConstructorArguments: "0x"}
	submitted, err := submission.NewMultiFile(map[string]string{"A.sol": "contract A {}"}, buildSettings)
	if err != nil { t.Fatal(err) }
	build := compiler.BuildEvidence{CompilerVersion: buildSettings.CompilerVersion, CompilerSHA256: "sha256:compiler", BundleHash: submitted.BundleHash, InputSHA256: "sha256:input", OutputSHA256: "sha256:output", NetworkDisabled: true, WorkingDirClean: true, RuntimeBytecode: deployment.RuntimeBytecode, CreationBytecode: deployment.Creation.CreationBytecode, CompilerOutput: json.RawMessage(`{"contracts":{}}`)}
	build.CompilerOutput = json.RawMessage("{\"contracts\":{}}")
	result := matcher.Result{Class: architecture.ResultFullMatch, BindingKey: deployment.BindingKey(), RuntimeExact: true, CreationCompared: true, CreationExact: true, Diagnostics: []matcher.Diagnostic{{Reason: matcher.ReasonExactRuntimeMatch, Message: "runtime exact"}, {Reason: matcher.ReasonExactCreationMatch, Message: "creation exact"}}}
	return deployment, submitted, build, result
}

func TestAppendHistoryAndRestartRebuild(t *testing.T) {
	root := t.TempDir()
	store, err := Open(root)
	if err != nil { t.Fatal(err) }
	deployment, submitted, build, result := fixture(t, "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	first, err := store.Append(deployment, submitted, build, result)
	if err != nil { t.Fatal(err) }
	second, err := store.Append(deployment, submitted, build, result)
	if err != nil { t.Fatal(err) }
	if first.Sequence != 1 || second.Sequence != 2 { t.Fatalf("unexpected sequences: %d %d", first.Sequence, second.Sequence) }
	if first.RecordHash == second.RecordHash { t.Fatal("distinct history entries must have distinct record hashes") }

	reopened, err := Open(root)
	if err != nil { t.Fatal(err) }
	history := reopened.History(deployment.BindingKey())
	if len(history) != 2 { t.Fatalf("expected 2 records after restart, got %d", len(history)) }
	latest, ok := reopened.Latest(deployment.BindingKey())
	if !ok || latest.Sequence != 2 { t.Fatal("latest record was not rebuilt from persisted history") }
	if got := reopened.Bindings(); len(got) != 1 || got[0] != deployment.BindingKey() { t.Fatalf("unexpected bindings: %#v", got) }
}

func TestStoreSeparatesRuntimeCodeHashBindings(t *testing.T) {
	store, err := Open(t.TempDir())
	if err != nil { t.Fatal(err) }
	d1, s1, b1, r1 := fixture(t, "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	if _, err := store.Append(d1, s1, b1, r1); err != nil { t.Fatal(err) }
	d2, s2, b2, r2 := fixture(t, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
	r2.BindingKey = d2.BindingKey()
	if _, err := store.Append(d2, s2, b2, r2); err != nil { t.Fatal(err) }
	if len(store.Bindings()) != 2 { t.Fatal("different runtime code hashes must have separate evidence histories") }
}

func TestAppendRejectsClassificationFromDifferentBinding(t *testing.T) {
	store, err := Open(t.TempDir())
	if err != nil { t.Fatal(err) }
	deployment, submitted, build, result := fixture(t, "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	result.BindingKey = "420:0x2222222222222222222222222222222222222222:0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	if _, err := store.Append(deployment, submitted, build, result); err == nil { t.Fatal("mismatched classification binding must be rejected") }
}

func TestRestartFailsClosedOnTamperedRecord(t *testing.T) {
	root := t.TempDir()
	store, err := Open(root)
	if err != nil { t.Fatal(err) }
	deployment, submitted, build, result := fixture(t, "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	if _, err := store.Append(deployment, submitted, build, result); err != nil { t.Fatal(err) }

	var recordPath string
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil { return err }
		if !d.IsDir() && filepath.Ext(path) == ".json" { recordPath = path }
		return nil
	})
	if err != nil { t.Fatal(err) }
	if recordPath == "" { t.Fatal("persisted record not found") }
	data, err := os.ReadFile(recordPath)
	if err != nil { t.Fatal(err) }
	var record Record
	if err := json.Unmarshal(data, &record); err != nil { t.Fatal(err) }
	record.Classification.RuntimeExact = false
	data, _ = json.MarshalIndent(record, "", "  ")
	if err := os.WriteFile(recordPath, data, 0o640); err != nil { t.Fatal(err) }
	if _, err := Open(root); err == nil { t.Fatal("tampered evidence history must fail closed on restart") }
}

func TestHistoryReturnsDefensiveCopies(t *testing.T) {
	store, err := Open(t.TempDir())
	if err != nil { t.Fatal(err) }
	deployment, submitted, build, result := fixture(t, "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
	if _, err := store.Append(deployment, submitted, build, result); err != nil { t.Fatal(err) }
	h := store.History(deployment.BindingKey())
	h[0].Classification.BindingKey = "mutated"
	again := store.History(deployment.BindingKey())
	if again[0].Classification.BindingKey != deployment.BindingKey() { t.Fatal("caller mutation leaked into store state") }
}
