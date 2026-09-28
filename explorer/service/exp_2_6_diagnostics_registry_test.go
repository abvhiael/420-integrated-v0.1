package service

import (
	"context"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type exp26RegistryFake struct {
	*fakeIndexer
	services []decoder.ServiceSummary
	service  decoder.ServiceSummary
	version  decoder.ServiceVersion
}

func (f *exp26RegistryFake) Services(context.Context) ([]decoder.ServiceSummary,error){ return f.services,nil }
func (f *exp26RegistryFake) Service(context.Context,string) (decoder.ServiceSummary,error){ return f.service,nil }
func (f *exp26RegistryFake) ServiceVersion(context.Context,string,uint32) (decoder.ServiceVersion,error){ return f.version,nil }

func TestEXP26NetworkStatusPreservesRuntimeDiagnosticDetail(t *testing.T){
	now:=time.Now().UTC()
	issueAt:=now.Add(-30*time.Second)
	idx:=&fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420,IndexedHeight:100,SafeHeight:99,FinalizedHeight:98,
		State:"DEGRADED",LastIngestAt:now,RuntimeIssue:"RPC_SOURCE_STALE",RuntimeIssueAt:&issueAt,
	}}}
	svc,_:=New(idx,420,time.Minute)
	svc.now=func()time.Time{return now}
	status,err:=svc.NetworkStatus(context.Background())
	if err==nil || !strings.Contains(err.Error(),"degraded"){t.Fatalf("expected degraded error, got %v",err)}
	if status.RuntimeIssue!="RPC_SOURCE_STALE" || status.RuntimeIssueAt==nil || !status.RuntimeIssueAt.Equal(issueAt){
		t.Fatalf("runtime diagnostic provenance lost: %+v",status)
	}
}

func TestEXP26ServiceVersionRejectsIdentityAndProvenanceDrift(t *testing.T){
	base:=decoder.ServiceVersion{
		ServiceID:"420Registry",Version:2,Implementation:"0x420",ActivatedBlock:7,ActivatedHash:"0x07",
	}
	cases:=[]struct{name string; mutate func(*decoder.ServiceVersion); want string}{
		{"service",func(v *decoder.ServiceVersion){v.ServiceID="420Other"},"inconsistent with request"},
		{"version",func(v *decoder.ServiceVersion){v.Version=3},"inconsistent with request"},
		{"implementation",func(v *decoder.ServiceVersion){v.Implementation=""},"without activation provenance"},
		{"activation-hash",func(v *decoder.ServiceVersion){v.ActivatedHash=""},"without activation provenance"},
		{"deprecation-before-activation",func(v *decoder.ServiceVersion){v.DeprecatedBlock=6},"invalid deprecation provenance"},
		{"active-deprecated",func(v *decoder.ServiceVersion){v.Active=true;v.DeprecatedBlock=8},"active service version with deprecation provenance"},
	}
	for _,tc:=range cases{
		t.Run(tc.name,func(t *testing.T){
			v:=base; tc.mutate(&v)
			idx:=&exp26RegistryFake{fakeIndexer:&fakeIndexer{},version:v}
			svc,_:=New(idx,420,time.Minute)
			_,err:=svc.ServiceVersion(context.Background(),"420Registry",2)
			if err==nil || !strings.Contains(err.Error(),tc.want){t.Fatalf("err=%v want %q",err,tc.want)}
		})
	}
}

func TestEXP26ServiceVersionQualifiedRecord(t *testing.T){
	want:=decoder.ServiceVersion{
		ServiceID:"420Registry",Version:2,Implementation:"0x420",CodeHash:"0xcode",
		ActivatedBlock:7,ActivatedHash:"0x07",Active:true,
	}
	idx:=&exp26RegistryFake{fakeIndexer:&fakeIndexer{},version:want}
	svc,_:=New(idx,420,time.Minute)
	got,err:=svc.ServiceVersion(context.Background(),"420Registry",2)
	if err!=nil{t.Fatal(err)}
	if got!=want{t.Fatalf("got %+v want %+v",got,want)}
}

func TestEXP26RegistryServiceRequiresActiveHistoryConsistency(t *testing.T){
	v1:=decoder.ServiceVersion{ServiceID:"420Registry",Version:1,Implementation:"0x111",ActivatedHash:"0x01",Active:false}
	v2:=decoder.ServiceVersion{ServiceID:"420Registry",Version:2,Implementation:"0x222",ActivatedHash:"0x02",Active:true}
	base:=decoder.ServiceSummary{
		ServiceID:"420Registry",LatestVersion:2,ActiveVersion:2,Implementation:"0x222",
		Versions:[]decoder.ServiceVersion{v1,v2},
	}
	idx:=&exp26RegistryFake{fakeIndexer:&fakeIndexer{},service:base}
	svc,_:=New(idx,420,time.Minute)
	view,err:=svc.RegistryService(context.Background(),"420Registry")
	if err!=nil{t.Fatal(err)}
	if view.ActiveVersion!=2 || view.Implementation!="0x222" || view.VersionCount!=2{t.Fatalf("unexpected view: %+v",view)}

	bad:=base
	bad.Implementation="0x999"
	idx.service=bad
	if _,err:=svc.RegistryService(context.Background(),"420Registry");err==nil || !strings.Contains(err.Error(),"implementation does not match history"){
		t.Fatalf("expected active implementation mismatch, got %v",err)
	}

	bad=base
	bad.ActiveVersion=1
	idx.service=bad
	if _,err:=svc.RegistryService(context.Background(),"420Registry");err==nil || !strings.Contains(err.Error(),"not active in history"){
		t.Fatalf("expected inactive history mismatch, got %v",err)
	}
}
