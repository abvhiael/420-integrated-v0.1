package service

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/location/model"
)

type fakeReady struct{ err error }
func (f fakeReady) Ready(context.Context) error { return f.err }

func validDeps() Dependencies {
	ok:=fakeReady{}
	return Dependencies{
		Places:ok,
		Geo:ok,
		Provider:ok,
		Registry:ok,
		Verify:ok,
		Visibility:ok,
		Authorizer:ok,
	}
}

func TestNewRequiresAllDependencies(t *testing.T) {
	cases:=[]struct{
		name string
		mutate func(*Dependencies)
	}{
		{"places",func(d *Dependencies){d.Places=nil}},
		{"geo",func(d *Dependencies){d.Geo=nil}},
		{"provider",func(d *Dependencies){d.Provider=nil}},
		{"registry",func(d *Dependencies){d.Registry=nil}},
		{"verify",func(d *Dependencies){d.Verify=nil}},
		{"visibility",func(d *Dependencies){d.Visibility=nil}},
		{"authorizer",func(d *Dependencies){d.Authorizer=nil}},
	}
	for _,tc:=range cases {
		t.Run(tc.name,func(t *testing.T){
			deps:=validDeps()
			tc.mutate(&deps)
			if _,err:=New(deps); err==nil { t.Fatal("expected missing dependency rejection") }
		})
	}
}

func TestServiceIdentityAndBoundary(t *testing.T) {
	svc,err:=New(validDeps())
	if err!=nil { t.Fatal(err) }
	if svc.ServiceID()!=model.ServiceID || svc.APIVersion()!=model.APIVersion {
		t.Fatalf("unexpected service identity: %s %s",svc.ServiceID(),svc.APIVersion())
	}
	b:=svc.Boundary()
	if b.CanonicalGeographicAuthority || b.RegistryAuthority || b.IdentityAuthority || b.PaymentAuthority || b.BookingAuthority || b.ProviderOutputCanonical {
		t.Fatalf("location service gained forbidden authority: %+v",b)
	}
	if !b.GeospatialIndexRebuildable || b.PublicSearchCanIncreasePrecision || b.PrivateCoordinatesPublicByDefault {
		t.Fatalf("location privacy/index boundary invalid: %+v",b)
	}
}

func TestQueryCapabilitiesMatchGenesisBaseline(t *testing.T) {
	svc,_:=New(validDeps())
	got:=svc.QueryCapabilities()
	if len(got)!=len(model.GenesisQueryCapabilities) {
		t.Fatalf("capability count=%d want=%d",len(got),len(model.GenesisQueryCapabilities))
	}
	for _,capability:=range got {
		if !model.ValidQueryCapability(capability) {
			t.Fatalf("invalid capability %q",capability)
		}
	}
}

func TestReadyFailsClosed(t *testing.T) {
	deps:=validDeps()
	deps.Provider=fakeReady{err:errors.New("upstream unavailable")}
	svc,err:=New(deps)
	if err!=nil { t.Fatal(err) }
	if err:=svc.Ready(context.Background()); err==nil {
		t.Fatal("expected readiness failure")
	}
}

func TestReadySucceedsWhenDependenciesReady(t *testing.T) {
	svc,err:=New(validDeps())
	if err!=nil { t.Fatal(err) }
	if err:=svc.Ready(context.Background()); err!=nil { t.Fatal(err) }
}
