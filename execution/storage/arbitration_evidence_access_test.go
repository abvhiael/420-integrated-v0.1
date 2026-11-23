package storage

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type arbitrationSessionVerifierStub420 struct {
	scope ArbitrationEvidenceScope420
	err error
	seen int
}
func (s *arbitrationSessionVerifierStub420) VerifyArbitrationEvidenceSession(_ context.Context, _, _ string) (ArbitrationEvidenceScope420,error) {
	s.seen++
	return s.scope,s.err
}

type arbitrationCanonicalStub420 struct {
	record ArbitrationEvidenceCase420
	committed bool
	err error
	caseReads int
	proofReads int
}
func (s *arbitrationCanonicalStub420) ReadArbitrationEvidenceCase(_ context.Context,_ uint64,_,_ string) (ArbitrationEvidenceCase420,error) {
	s.caseReads++
	return s.record,s.err
}
func (s *arbitrationCanonicalStub420) VerifyArbitrationEvidenceCommitment(_ context.Context,_ uint64,_,_ string,_ uint8,_,_ string) (bool,error) {
	s.proofReads++
	return s.committed,s.err
}

func arbitrationAccessFixture420() (ArbitrationEvidenceAccess420, GatewayAccess, GatewayRequest,*arbitrationSessionVerifierStub420,*arbitrationCanonicalStub420) {
	current:=time.Unix(1800000000,0)
	wallet:="0x0000000000000000000000000000000000000064"
	caseRegistry:="0x000000000000000000000000000000000000012d"
	caseID:="0xcase-501"
	object:=DeveloperObjectRef{ObjectID:"object-1",ManifestID:"manifest-1",ShardIndex:0,
		ShardRoot:"0xshardroot",SizeBytes:450,CommitmentID:"storage-commitment-1"}
	sessions:=&arbitrationSessionVerifierStub420{scope:ArbitrationEvidenceScope420{
		Subject:"private-subject-1",WalletController:wallet,VerifiedWalletSession:true,
		ChainID:420,CaseRegistry:caseRegistry,CaseID:caseID,Round:0,
		Submitter:wallet,EvidenceCommitment:"0xevidence-commitment",
		Object:object,ExpiresAt:current.Add(4*time.Minute),
	}}
	canonical:=&arbitrationCanonicalStub420{record:ArbitrationEvidenceCase420{
		ChainID:420,CaseRegistry:caseRegistry,CaseID:caseID,CurrentRound:0,
		Claimant:wallet,Respondent:"0x0000000000000000000000000000000000000065",
		Resolver:"0x0000000000000000000000000000000000000066",
		AppealResolver:"0x0000000000000000000000000000000000000067",
	},committed:true}
	access:=GatewayAccess{Mode:GatewayAccessPrivate,Subject:"private-subject-1",
		SessionID:"verified-private-session-1",Capability:GatewayAccessRead}
	req:=GatewayRequest{CacheKey:CacheKey{ObjectID:object.ObjectID,ManifestID:object.ManifestID,
		ShardIndex:object.ShardIndex,ShardRoot:object.ShardRoot,SizeBytes:object.SizeBytes},
		CommitmentID:object.CommitmentID,Access:access}
	return ArbitrationEvidenceAccess420{Sessions:sessions,Canonical:canonical,
		Now:func()time.Time{return current}},access,req,sessions,canonical
}

func TestArbitrationEvidenceStoragePolicyAcceptsOnlyCanonicalScopedAuthorizedRead(t *testing.T) {
	policy,access,request,sessions,canonical:=arbitrationAccessFixture420()
	if err:=policy.AuthorizeGatewayAccess(context.Background(),access,request);err!=nil {
		t.Fatalf("expected authorized claimant read, got %v",err)
	}
	if sessions.seen!=1 || canonical.caseReads!=1 || canonical.proofReads!=1 {
		t.Fatalf("private policy did not independently check session and canonical chain: session=%d case=%d proof=%d",
			sessions.seen,canonical.caseReads,canonical.proofReads)
	}
}

func TestArbitrationEvidenceStoragePolicyRejectsBadSessionAndWrongObject(t *testing.T) {
	tests:=[]struct{name string; mutate func(*ArbitrationEvidenceScope420,*GatewayAccess,*GatewayRequest)}{
		{"not-wallet-verified",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.VerifiedWalletSession=false}},
		{"revoked-session",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Revoked=true}},
		{"wrong-subject",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Subject="another-subject"}},
		{"wrong-case",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.CaseID="other-case"}},
		{"wrong-chain",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.ChainID=421}},
		{"wrong-round",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Round=2}},
		{"wrong-object",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Object.ObjectID="other-object"}},
		{"wrong-manifest",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Object.ManifestID="other-manifest"}},
		{"wrong-shard-root",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Object.ShardRoot="different-root"}},
		{"wrong-storage-commitment",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Object.CommitmentID="other-commitment"}},
		{"wrong-size",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.Object.SizeBytes++}},
		{"wrong-capability",func(_ *ArbitrationEvidenceScope420,a *GatewayAccess,_ *GatewayRequest){a.Capability="write"}},
		{"public-mode",func(_ *ArbitrationEvidenceScope420,a *GatewayAccess,_ *GatewayRequest){a.Mode=GatewayAccessPublic}},
		{"expired",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.ExpiresAt=s.ExpiresAt.Add(-10*time.Minute)}},
		{"over-long-access",func(s *ArbitrationEvidenceScope420,_ *GatewayAccess,_ *GatewayRequest){s.ExpiresAt=s.ExpiresAt.Add(time.Hour)}},
	}
	for _,test:=range tests {
		t.Run(test.name,func(t *testing.T){
			policy,access,request,sessions,_:=arbitrationAccessFixture420()
			test.mutate(&sessions.scope,&access,&request)
			if err:=policy.AuthorizeGatewayAccess(context.Background(),access,request);!errors.Is(err,ErrGatewayUnauthorized){
				t.Fatalf("unexpected private authorization for %s: %v",test.name,err)
			}
		})
	}
}

func TestArbitrationEvidenceStoragePolicyDeniesWrongRolesAndUnprovenEvidence(t *testing.T) {
	for _,kind:=range []string{"observer","wrong-resolver","uncommitted","stale-case","chain-failed","session-failed","missing-backend"} {
		t.Run(kind,func(t *testing.T){
			policy,access,request,sessions,canonical:=arbitrationAccessFixture420()
			switch kind {
			case "observer":sessions.scope.WalletController="0x0000000000000000000000000000000000000999"
			case "wrong-resolver":sessions.scope.WalletController="0x0000000000000000000000000000000000000067"
			case "uncommitted":canonical.committed=false
			case "stale-case":canonical.record.CurrentRound=0;sessions.scope.Round=1
			case "chain-failed":canonical.err=errors.New("canonical RPC unavailable")
			case "session-failed":sessions.err=errors.New("session revoked")
			case "missing-backend":policy.Canonical=nil
			}
			if err:=policy.AuthorizeGatewayAccess(context.Background(),access,request);!errors.Is(err,ErrGatewayUnauthorized) {
				t.Fatalf("unexpected private access: %v",err)
			}
		})
	}
}

func TestArbitrationEvidenceStorageExistingDeveloperGatewayDenyWithoutIssuer(t *testing.T) {
	payload:=[]byte("encrypted-capsule")
	object:=developerObjectRef(payload)
	policy,_,_,_,_:=arbitrationAccessFixture420()
	policy.Sessions=nil // unavailable confidential auth issuer => fail closed
	router:=GatewayRouter{
		Cache:[]GatewaySource{developerGatewaySourceStub{payload:payload}},
		Authorizer:policy,
	}
	handler:=NewDeveloperHTTPHandler(GatewayDeveloperAPI{Router:router})
	r:=httptest.NewRequest(http.MethodGet,developerHTTPURL(object),nil)
	r.Header.Set(DeveloperHeaderAccessMode,string(DeveloperAccessPrivate))
	r.Header.Set(DeveloperHeaderSubject,"private-subject-1")
	r.Header.Set(DeveloperHeaderSessionID,"verified-private-session-1")
	r.Header.Set(DeveloperHeaderCapability,GatewayAccessRead)
	w:=httptest.NewRecorder()
	handler.ServeHTTP(w,r)
	if w.Code!=http.StatusForbidden {
		t.Fatalf("private HTTP unexpectedly accessible with missing session authority: status=%d",w.Code)
	}
	if w.Header().Get("Cache-Control")!="private, no-store"{
		t.Fatalf("denied private response must be no-store: %v",w.Header())
	}
}
