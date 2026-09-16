package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/matcher"
	"github.com/420integrated/420-integrated/verify/store"
	"github.com/420integrated/420-integrated/verify/submission"
)

type processorStub struct { record store.Record; err error }
func (p processorStub) Verify(context.Context,uint64,string,submission.Submission)(store.Record,error){return p.record,p.err}

func fixture(t *testing.T) (*store.Store, store.Record, submission.Submission) {
	t.Helper()
	s, err := store.Open(t.TempDir()); if err!=nil { t.Fatal(err) }
	deployment := evidence.DeploymentEvidence{
		ChainID:420, Address:"0x1111111111111111111111111111111111111111", RuntimeBytecode:"0x60016000",
		RuntimeCodeHash:"0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		ObservedAt:evidence.BlockContext{Number:100,Hash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
		FirstCodeBlock:evidence.BlockContext{Number:90,Hash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
		Creation:&evidence.CreationContext{TransactionHash:"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",ReceiptBlockHash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",CreationBytecode:"0x6001600055"},
		Provenance:"canonical_chain_state/rpc",
	}
	settings := submission.BuildSettings{CompilerVersion:"0.8.24+commit.e11b9ed9",OptimizerEnabled:true,OptimizerRuns:200,EVMVersion:"cancun",MetadataHashMode:"ipfs",ConstructorArgsKnown:true,ConstructorArguments:"0x"}
	submitted, err := submission.NewMultiFile(map[string]string{"A.sol":"contract A {}"},settings); if err!=nil {t.Fatal(err)}
	build := compiler.BuildEvidence{CompilerVersion:settings.CompilerVersion,CompilerSHA256:"sha256:compiler",BundleHash:submitted.BundleHash,InputSHA256:"sha256:input",OutputSHA256:"sha256:output",NetworkDisabled:true,WorkingDirClean:true,RuntimeBytecode:deployment.RuntimeBytecode,CreationBytecode:deployment.Creation.CreationBytecode,CompilerOutput:json.RawMessage(`{"contracts":{}}`)}
	result := matcher.Result{Class:architecture.ResultFullMatch,BindingKey:deployment.BindingKey(),RuntimeExact:true,CreationCompared:true,CreationExact:true}
	record, err := s.Append(deployment,submitted,build,result); if err!=nil {t.Fatal(err)}
	return s,record,submitted
}

func TestLookupCarriesNonCanonicalConsumerBoundaries(t *testing.T){
	s,record,_:=fixture(t); service,_:=New(s,nil)
	path := "/v1/verify/420/"+record.Deployment.Address+"/"+record.Deployment.RuntimeCodeHash
	r:=httptest.NewRequest(http.MethodGet,path,nil); w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,r)
	if w.Code!=http.StatusOK { t.Fatalf("status=%d body=%s",w.Code,w.Body.String()) }
	var out LookupResponse; if err:=json.Unmarshal(w.Body.Bytes(),&out); err!=nil {t.Fatal(err)}
	if out.Integration.Canonical || out.Integration.RegistryAuthority || out.Integration.WalletAuthority {t.Fatal("Verify integration must remain non-canonical and non-authoritative")}
	if !out.Integration.AppStoreSecurityContext {t.Fatal("AppStore should be allowed to consume sourced security context")}
	if out.Integration.VerificationClass!=architecture.ResultFullMatch {t.Fatalf("unexpected class %s",out.Integration.VerificationClass)}
	if out.Integration.Warning=="" {t.Fatal("verification warning is required")}
}

func TestHistoryAndEvidenceLookup(t *testing.T){
	s,record,_:=fixture(t); service,_:=New(s,nil)
	base := "/v1/verify/420/"+record.Deployment.Address+"/"+record.Deployment.RuntimeCodeHash
	for _, path := range []string{base+"/history","/v1/verify/evidence/"+record.RecordHash} {
		w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil)); if w.Code!=http.StatusOK {t.Fatalf("%s status=%d body=%s",path,w.Code,w.Body.String())}
	}
}

func TestSubmissionFailsClosedWhenProcessorUnavailable(t *testing.T){
	s,_,submitted:=fixture(t); service,_:=New(s,nil)
	body,_:=json.Marshal(SubmissionRequest{ChainID:420,Address:"0x1111111111111111111111111111111111111111",Submission:submitted})
	w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/v1/verify/submissions",bytes.NewReader(body)))
	if w.Code!=http.StatusServiceUnavailable {t.Fatalf("status=%d body=%s",w.Code,w.Body.String())}
}

func TestSubmissionUsesProcessorWithoutGrantingAuthority(t *testing.T){
	s,record,submitted:=fixture(t); service,_:=New(s,processorStub{record:record})
	body,_:=json.Marshal(SubmissionRequest{ChainID:420,Address:record.Deployment.Address,Submission:submitted})
	w:=httptest.NewRecorder(); service.Handler().ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/v1/verify/submissions",bytes.NewReader(body)))
	if w.Code!=http.StatusCreated {t.Fatalf("status=%d body=%s",w.Code,w.Body.String())}
	var out LookupResponse; if err:=json.Unmarshal(w.Body.Bytes(),&out); err!=nil {t.Fatal(err)}
	if out.Integration.RegistryAuthority || out.Integration.WalletAuthority || out.Integration.Canonical {t.Fatal("submission result must not grant authority")}
}
