package compiler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeHardeningCompiler(t *testing.T, dir, body string) (string,string) {
	t.Helper()
	path:=filepath.Join(dir,"solc-hardening")
	data:=[]byte("#!/bin/sh\n"+body+"\n")
	if err:=os.WriteFile(path,data,0o755); err!=nil{t.Fatal(err)}
	sum:=sha256.Sum256(data)
	return filepath.Base(path),hex.EncodeToString(sum[:])
}

func TestWorkerEnforcesCompilerTimeout(t *testing.T) {
	cache:=t.TempDir(); binary,sum:=writeHardeningCompiler(t,cache,"while :; do :; done")
	catalog,_:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:sum,Binary:binary}})
	worker,_:=NewWorker(catalog,Limits{MaxInputBytes:1<<20,MaxOutputBytes:1<<20,Timeout:20*time.Millisecond})
	if _,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.24+commit.e11b9ed9")); err==nil { t.Fatal("compiler timeout must fail closed") }
}

func TestWorkerEnforcesOutputLimit(t *testing.T) {
	cache:=t.TempDir(); binary,sum:=writeHardeningCompiler(t,cache,"i=0; while [ $i -lt 100 ]; do printf 'xxxxxxxxxxxxxxxx'; i=$((i+1)); done")
	catalog,_:=NewCatalog(cache,[]Release{{Version:"0.8.24+commit.e11b9ed9",SHA256:sum,Binary:binary}})
	worker,_:=NewWorker(catalog,Limits{MaxInputBytes:1<<20,MaxOutputBytes:64,Timeout:time.Second})
	if _,err:=worker.Compile(context.Background(),compilerSubmission(t,"0.8.24+commit.e11b9ed9")); err==nil { t.Fatal("oversized compiler output must fail closed") }
}
