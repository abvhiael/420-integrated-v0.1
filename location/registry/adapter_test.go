package registry

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

type fakeReader struct {
	record Record
	err    error
	reads  int
}

func (f *fakeReader) Ready(context.Context) error { return f.err }
func (f *fakeReader) Record(context.Context, string) (Record, error) {
	f.reads++
	return f.record, f.err
}

func registryPlace() model.Place {
	now := time.Date(2026,9,19,3,0,0,0,time.UTC)
	lat,lon := 50.4452,-104.6189
	return model.Place{
		ID:"place-420",
		Name:"Registry Venue",
		Category:model.CategoryVenue,
		Visibility:model.VisibilityPublic,
		Precision:model.PrecisionExactPublic,
		Source:"420location",
		Owner:model.SubjectRef{Type:"ORGANIZATION",ID:"org-420"},
		OrganizationID:"org-420",
		RegistryRecordID:"registry-record-1",
		Country:"CA",Region:"SK",City:"Regina",
		Latitude:&lat,Longitude:&lon,
		Version:1,CreatedAt:now,UpdatedAt:now,
	}
}

func TestResolvePreservesCanonicalPlaceAndProjectsRegistryState(t *testing.T) {
	reader:=&fakeReader{record:Record{
		ID:"registry-record-1",
		Kind:"ORGANIZATION",
		OrganizationID:"org-420",
		Active:true,
		MetadataURI:"ipfs://registry-metadata",
		Source:"420Registry",
		Version:7,
		ObservedAt:time.Date(2026,9,19,3,5,0,0,time.UTC),
	}}
	adapter,err:=New(reader)
	if err!=nil { t.Fatal(err) }
	original:=registryPlace()
	got,err:=adapter.Resolve(context.Background(),original)
	if err!=nil { t.Fatal(err) }

	if got.Place.ID!=original.ID { t.Fatalf("canonical place id changed: %s",got.Place.ID) }
	if got.Place.RegistryRecordID!=original.RegistryRecordID { t.Fatal("place registry link changed") }
	if got.Registry.RegistryRecordID!="registry-record-1" || !got.Registry.Active || got.Registry.Version!=7 {
		t.Fatalf("binding=%+v",got.Registry)
	}
	if got.Registry.Source!="420Registry" || got.Registry.MetadataURI!="ipfs://registry-metadata" {
		t.Fatalf("provenance=%+v",got.Registry)
	}
	if reader.reads!=1 { t.Fatalf("reads=%d",reader.reads) }
}

func TestRequireActiveFailsClosedForInactiveRegistryRecord(t *testing.T) {
	reader:=&fakeReader{record:Record{
		ID:"registry-record-1",OrganizationID:"org-420",Active:false,
		ObservedAt:time.Date(2026,9,19,3,5,0,0,time.UTC),
	}}
	adapter,_:=New(reader)
	_,err:=adapter.RequireActive(context.Background(),registryPlace())
	if !errors.Is(err,ErrRegistryInactive) { t.Fatalf("err=%v",err) }
}

func TestResolveRejectsRecordIDMismatch(t *testing.T) {
	reader:=&fakeReader{record:Record{ID:"different-record",OrganizationID:"org-420",Active:true}}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),registryPlace())
	if !errors.Is(err,ErrRegistryRecordMismatch) { t.Fatalf("err=%v",err) }
}

func TestResolveRejectsOrganizationMismatch(t *testing.T) {
	reader:=&fakeReader{record:Record{ID:"registry-record-1",OrganizationID:"other-org",Active:true}}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),registryPlace())
	if !errors.Is(err,ErrRegistryRecordMismatch) { t.Fatalf("err=%v",err) }
}

func TestResolveRequiresExplicitRegistryLink(t *testing.T) {
	p:=registryPlace()
	p.RegistryRecordID=""
	reader:=&fakeReader{}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),p)
	if !errors.Is(err,ErrRegistryRecordRequired) { t.Fatalf("err=%v",err) }
	if reader.reads!=0 { t.Fatalf("registry read occurred without record link") }
}

func TestResolveNeverMutatesPlaceFromRegistryMetadata(t *testing.T) {
	p:=registryPlace()
	reader:=&fakeReader{record:Record{
		ID:p.RegistryRecordID,
		OrganizationID:p.OrganizationID,
		Active:true,
		MetadataURI:"ipfs://different",
		Source:"420Registry",
		Version:99,
	}}
	adapter,_:=New(reader)
	got,err:=adapter.Resolve(context.Background(),p)
	if err!=nil { t.Fatal(err) }
	if got.Place.MetadataURI!=p.MetadataURI || got.Place.Version!=p.Version || got.Place.ID!=p.ID {
		t.Fatalf("Registry read mutated Location-owned Place: before=%+v after=%+v",p,got.Place)
	}
}

func TestReaderInterfaceHasNoWriteAuthority(t *testing.T) {
	// Compile-time shape is the authority boundary: the adapter receives only
	// Ready + Record. No create/update/deprecate Registry operation is exposed.
	var _ Reader = (*fakeReader)(nil)
}
