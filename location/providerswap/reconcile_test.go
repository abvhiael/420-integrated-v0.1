package providerswap

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
	"github.com/420integrated/420-integrated/location/providers"
	"github.com/420integrated/420-integrated/location/repository"
)

func makePlace(id string, alias model.ProviderAlias) model.Place {
	now := time.Date(2026,9,19,1,0,0,0,time.UTC)
	lat, lon := 50.4452, -104.6189
	return model.Place{
		ID:id,
		Name:"Canonical Venue",
		Category:model.CategoryVenue,
		Visibility:model.VisibilityPublic,
		Precision:model.PrecisionExactPublic,
		Source:"420location",
		Owner:model.SubjectRef{Type:"ORGANIZATION",ID:"org-420"},
		OrganizationID:"org-420",
		RegistryRecordID:"registry-venue-1",
		Country:"CA",
		Region:"SK",
		City:"Regina",
		Latitude:&lat,
		Longitude:&lon,
		ProviderAliases:[]model.ProviderAlias{alias},
		Version:1,
		CreatedAt:now,
		UpdatedAt:now,
	}
}

func prov(provider,id string) providers.Provenance {
	return providers.Provenance{
		Provider:provider,
		ProviderPlaceID:id,
		ProviderRequestID:"req",
		RetrievedAt:time.Date(2026,9,19,1,5,0,0,time.UTC),
		Confidence:0.9,
	}
}

func TestProviderSwapPreservesCanonicalPlaceAndReferences(t *testing.T) {
	store,err:=repository.OpenFileStore(filepath.Join(t.TempDir(),"places.json"))
	if err!=nil { t.Fatal(err) }
	original:=makePlace("place-420-venue",model.ProviderAlias{Provider:"provider-a",ID:"a-123"})
	if _,err:=store.Create(original); err!=nil { t.Fatal(err) }

	eventRefs:=[]string{original.ID,original.ID}
	reviewRefs:=[]string{original.ID}
	refs:=CaptureReferences(original,eventRefs,reviewRefs)

	reconciler,err:=New(store,func() time.Time { return time.Date(2026,9,19,1,10,0,0,time.UTC) })
	if err!=nil { t.Fatal(err) }
	swapped,err:=reconciler.AttachProviderAlias(original.ID,prov("provider-b","b-987"))
	if err!=nil { t.Fatal(err) }

	if swapped.ID!=original.ID { t.Fatalf("canonical id changed: %s -> %s",original.ID,swapped.ID) }
	if len(swapped.ProviderAliases)!=2 { t.Fatalf("aliases=%+v",swapped.ProviderAliases) }
	if err:=refs.ValidateStable(swapped); err!=nil { t.Fatal(err) }

	a,ok:=store.FindByProviderAlias("provider-a","a-123")
	if !ok || a.ID!=original.ID { t.Fatalf("provider A alias lost: %+v ok=%v",a,ok) }
	b,ok:=store.FindByProviderAlias("provider-b","b-987")
	if !ok || b.ID!=original.ID { t.Fatalf("provider B alias did not resolve canonically: %+v ok=%v",b,ok) }
}

func TestProviderSwapIsIdempotent(t *testing.T) {
	store,err:=repository.OpenFileStore(filepath.Join(t.TempDir(),"places.json"))
	if err!=nil { t.Fatal(err) }
	original:=makePlace("place-1",model.ProviderAlias{Provider:"provider-a",ID:"a1"})
	if _,err:=store.Create(original); err!=nil { t.Fatal(err) }
	reconciler,_:=New(store,func() time.Time { return time.Date(2026,9,19,1,10,0,0,time.UTC) })

	first,err:=reconciler.AttachProviderAlias(original.ID,prov("provider-b","b1"))
	if err!=nil { t.Fatal(err) }
	second,err:=reconciler.AttachProviderAlias(original.ID,prov("PROVIDER-B","b1"))
	if err!=nil { t.Fatal(err) }

	if second.Version!=first.Version { t.Fatalf("idempotent attach changed version: %d -> %d",first.Version,second.Version) }
	if len(second.ProviderAliases)!=2 { t.Fatalf("aliases=%+v",second.ProviderAliases) }
}

func TestAliasCannotBeReassignedToDifferentCanonicalPlace(t *testing.T) {
	store,err:=repository.OpenFileStore(filepath.Join(t.TempDir(),"places.json"))
	if err!=nil { t.Fatal(err) }
	first:=makePlace("place-1",model.ProviderAlias{Provider:"provider-a",ID:"a1"})
	second:=makePlace("place-2",model.ProviderAlias{Provider:"provider-a",ID:"a2"})
	if _,err:=store.Create(first); err!=nil { t.Fatal(err) }
	if _,err:=store.Create(second); err!=nil { t.Fatal(err) }

	reconciler,_:=New(store,nil)
	if _,err:=reconciler.AttachProviderAlias(first.ID,prov("provider-b","shared")); err!=nil { t.Fatal(err) }
	_,err=reconciler.AttachProviderAlias(second.ID,prov("provider-b","shared"))
	if !errors.Is(err,ErrCanonicalMismatch) { t.Fatalf("err=%v",err) }
}

func TestProviderAliasCannotCreateCanonicalPlace(t *testing.T) {
	store,err:=repository.OpenFileStore(filepath.Join(t.TempDir(),"places.json"))
	if err!=nil { t.Fatal(err) }
	reconciler,_:=New(store,nil)
	_,err=reconciler.AttachProviderAlias("missing-place",prov("provider-b","b1"))
	if !errors.Is(err,repository.ErrNotFound) { t.Fatalf("err=%v",err) }
	if store.Count()!=0 { t.Fatalf("provider reconciliation created canonical place") }
}

func TestReferencesDetectNonCanonicalConsumerIDs(t *testing.T) {
	place:=makePlace("place-1",model.ProviderAlias{Provider:"provider-a",ID:"a1"})
	refs:=CaptureReferences(place,[]string{"provider-a:a1"},[]string{place.ID})
	if err:=refs.ValidateStable(place); err==nil {
		t.Fatal("expected provider-specific event reference rejection")
	}
}
