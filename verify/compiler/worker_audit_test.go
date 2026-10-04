package compiler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/verify/submission"
)

func writeAuditCompiler(t *testing.T, dir, output string) (string, string) {
	t.Helper()
	path := filepath.Join(dir, "solc-audit")
	body := []byte("#!/bin/sh\ncat >/dev/null\nprintf '%s' '" + output + "'\n")
	if err := os.WriteFile(path, body, 0o755); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(body)
	return filepath.Base(path), hex.EncodeToString(sum[:])
}

func auditWorker(t *testing.T, output string) *Worker {
	t.Helper()
	cache := t.TempDir()
	binary, sum := writeAuditCompiler(t, cache, output)
	catalog, err := NewCatalog(cache, []Release{{Version: "0.8.24+commit.e11b9ed9", SHA256: sum, Binary: binary}})
	if err != nil {
		t.Fatal(err)
	}
	worker, err := NewWorker(catalog, Limits{MaxInputBytes: 1 << 20, MaxOutputBytes: 1 << 20, Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	return worker
}

func TestWorkerRejectsAmbiguousMultiContractOutputWithoutTarget(t *testing.T) {
	worker := auditWorker(t, `{"contracts":{"A.sol":{"A":{"evm":{"bytecode":{"object":"6001"},"deployedBytecode":{"object":"6002"}}},"B":{"evm":{"bytecode":{"object":"6003"},"deployedBytecode":{"object":"6004"}}}}}}`)
	s := compilerSubmission(t, "0.8.24+commit.e11b9ed9")
	if _, err := worker.Compile(context.Background(), s); err == nil || !strings.Contains(err.Error(), "multiple contracts") {
		t.Fatalf("expected deterministic-target rejection, got %v", err)
	}
}

func TestWorkerUsesExplicitTargetForMultiContractOutput(t *testing.T) {
	worker := auditWorker(t, `{"contracts":{"A.sol":{"A":{"evm":{"bytecode":{"object":"6001"},"deployedBytecode":{"object":"6002"}}},"B":{"evm":{"bytecode":{"object":"6003"},"deployedBytecode":{"object":"6004","immutableReferences":{"0":[{"start":0,"length":32}]}}}}}}}`)
	s := compilerSubmission(t, "0.8.24+commit.e11b9ed9")
	s.TargetSource = "A.sol"
	s.TargetContract = "B"
	if err := s.ValidateCommitment(); err != nil {
		t.Fatal(err)
	}
	e, err := worker.Compile(context.Background(), s)
	if err != nil {
		t.Fatal(err)
	}
	if e.RuntimeBytecode != "0x6004" || e.CreationBytecode != "0x6003" || !e.HasImmutables {
		t.Fatalf("wrong target build evidence: %+v", e)
	}
}

func TestWorkerRejectsStandardJSONSettingsDrift(t *testing.T) {
	worker := auditWorker(t, `{"contracts":{"A.sol":{"A":{"evm":{"bytecode":{"object":"6001"},"deployedBytecode":{"object":"6002"}}}}}}`)
	raw := []byte(`{"language":"Solidity","sources":{"A.sol":{"content":"contract A {}"}},"settings":{"optimizer":{"enabled":false,"runs":200},"evmVersion":"cancun","viaIR":true,"metadata":{"bytecodeHash":"ipfs"},"libraries":{}}}`)
	build := submission.BuildSettings{
		CompilerVersion:      "0.8.24+commit.e11b9ed9",
		OptimizerEnabled:     true,
		OptimizerRuns:        200,
		EVMVersion:           "cancun",
		ViaIR:                true,
		MetadataHashMode:     "ipfs",
		ConstructorArgsKnown: true,
		ConstructorArguments: "0x",
	}
	s, err := submission.NewStandardJSON(raw, build)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := worker.Compile(context.Background(), s); err == nil || !strings.Contains(err.Error(), "optimizer settings") {
		t.Fatalf("expected standard-json/build-settings drift rejection, got %v", err)
	}
}


func TestWorkerRejectsNonSolidityStandardJSON(t *testing.T) {
	worker := auditWorker(t, `{"contracts":{}}`)
	raw := []byte(`{"language":"Yul","sources":{"A.yul":{"content":"object \"A\" {}"}},"settings":{"optimizer":{"enabled":true,"runs":200},"evmVersion":"cancun","viaIR":true,"metadata":{"bytecodeHash":"ipfs"},"libraries":{}}}`)
	build := submission.BuildSettings{
		CompilerVersion:      "0.8.24+commit.e11b9ed9",
		OptimizerEnabled:     true,
		OptimizerRuns:        200,
		EVMVersion:           "cancun",
		ViaIR:                true,
		MetadataHashMode:     "ipfs",
		ConstructorArgsKnown: true,
		ConstructorArguments: "0x",
	}
	s, err := submission.NewStandardJSON(raw, build)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := worker.Compile(context.Background(), s); err == nil || !strings.Contains(err.Error(), "language must be Solidity") {
		t.Fatalf("expected non-Solidity rejection, got %v", err)
	}
}
