package compiler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/verify/submission"
)

func compilerSubmission(t *testing.T, version string) submission.Submission {
	t.Helper()
	s, err := submission.NewMultiFile(map[string]string{"A.sol":"contract A {}"}, submission.BuildSettings{
		CompilerVersion:version, OptimizerEnabled:true, OptimizerRuns:200,
		EVMVersion:"cancun", ViaIR:true, MetadataHashMode:"ipfs",
		ConstructorArgsKnown:true, ConstructorArguments:"0x",
	})
	if err != nil { t.Fatal(err) }
	return s
}

func writeFakeCompiler(t *testing.T, dir string) (string,string) {
	t.Helper()
	path:=filepath.Join(dir,"solc-0.8.24")
	body:=[]byte("#!/bin/sh\ncat >/dev/null\nprintf '%s' '{\"contracts\":{\"A.sol\":{\"A\":{\"evm\":{\"bytecode\":{\"object\":\"6001\"},\"deployedBytecode\":{\"object\":\"6002\"}}}}}}'\n")
	if err:=os.WriteFile(path,body,0o755); err!=nil{t.Fatal(err)}
	sum:=sha256.Sum256(body)
	return filepath.Base(path),hex.EncodeToString(sum[:])
}

func TestWorkerUsesPinnedCompilerAndProducesReproductionEvidence(t *testing.T) {
	cache:=t.TempDir(); binary,sum:=writeFakeCompiler(t,cache)
	catalog,err:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:sum,Binary:binary}}); if err!=nil{t.Fatal(err)}
	worker,err:=NewWorker(catalog,Limits{MaxInputBytes:1<<20,MaxOutputBytes:1<<20,Timeout:2*time.Second}); if err!=nil{t.Fatal(err)}
	e,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.24+commit.e11b9ed9")); if err!=nil{t.Fatal(err)}
	if e.CompilerVersion!="0.8.24+commit.e11b9ed9" || e.CompilerSHA256!=sum { t.Fatalf("compiler identity not preserved: %+v",e) }
	if !e.NetworkDisabled || !e.WorkingDirClean { t.Fatal("hermetic build evidence not recorded") }
	if e.RuntimeBytecode!="0x6002" || e.CreationBytecode!="0x6001" { t.Fatalf("unexpected bytecode evidence: %+v",e) }
	if e.BundleHash=="" || e.InputSHA256=="" || e.OutputSHA256=="" { t.Fatal("reproduction hashes are required") }
}

func TestWorkerRejectsUnallowlistedCompiler(t *testing.T) {
	cache:=t.TempDir(); binary,sum:=writeFakeCompiler(t,cache)
	catalog,_:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:sum,Binary:binary}})
	worker,_:=NewWorker(catalog,Limits{MaxInputBytes:1<<20,MaxOutputBytes:1<<20,Timeout:time.Second})
	if _,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.25+commit.b61c2a91")); err==nil { t.Fatal("unallowlisted compiler must be rejected") }
}

func TestWorkerRejectsCompilerChecksumMismatch(t *testing.T) {
	cache:=t.TempDir(); binary,_:=writeFakeCompiler(t,cache)
	catalog,_:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:"deadbeef",Binary:binary}})
	worker,_:=NewWorker(catalog,Limits{MaxInputBytes:1<<20,MaxOutputBytes:1<<20,Timeout:time.Second})
	if _,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.24+commit.e11b9ed9")); err==nil { t.Fatal("compiler checksum mismatch must fail closed") }
}

func TestWorkerEnforcesInputLimitBeforeCompilerExecution(t *testing.T) {
	cache:=t.TempDir(); binary,sum:=writeFakeCompiler(t,cache)
	catalog,_:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:sum,Binary:binary}})
	worker,_:=NewWorker(catalog,Limits{MaxInputBytes:8,MaxOutputBytes:1<<20,Timeout:time.Second})
	if _,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.24+commit.e11b9ed9")); err==nil { t.Fatal("oversized compiler input must be rejected") }
}
