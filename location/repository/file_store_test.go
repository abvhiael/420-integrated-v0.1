package repository

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

func coords(lat, lon float64) (*float64, *float64) { return &lat, &lon }

func place(id string) model.Place {
	lat, lon := coords(50.4452, -104.6189)
	now := time.Date(2026, 9, 18, 23, 0, 0, 0, time.UTC)
	return model.Place{
		ID: id,
		Name: "Prairie Venue",
		Category: model.CategoryVenue,
		Visibility: model.VisibilityPublic,
		Precision: model.PrecisionExactPublic,
		Source: "420Location",
		Owner: model.SubjectRef{Type: "ORGANIZATION", ID: "org-1"},
		Country: "CA",
		Region: "SK",
		City: "Regina",
		Latitude: lat,
		Longitude: lon,
		ProviderAliases: []model.ProviderAlias{{Provider: "osm", ID: "node/123"}},
		Version: 1,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func TestFileStoreCreateGetAndRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "places.json")
	store, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	if err := store.Ready(context.Background()); err != nil { t.Fatal(err) }

	want := place("place-1")
	if _, err := store.Create(want); err != nil { t.Fatal(err) }

	got, err := store.Get("place-1")
	if err != nil { t.Fatal(err) }
	if got.ID != want.ID || got.Latitude == nil || *got.Latitude != *want.Latitude {
		t.Fatalf("got=%+v", got)
	}

	reopened, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	got, err = reopened.Get("place-1")
	if err != nil { t.Fatal(err) }
	if len(got.ProviderAliases) != 1 || got.ProviderAliases[0].ID != "node/123" {
		t.Fatalf("aliases=%+v", got.ProviderAliases)
	}
	info, err := os.Stat(path)
	if err != nil { t.Fatal(err) }
	if info.Mode().Perm() != 0o600 { t.Fatalf("mode=%v", info.Mode().Perm()) }
}

func TestFileStoreVersionedUpdate(t *testing.T) {
	store, err := OpenFileStore(filepath.Join(t.TempDir(), "places.json"))
	if err != nil { t.Fatal(err) }
	created, err := store.Create(place("place-1"))
	if err != nil { t.Fatal(err) }

	created.Name = "Updated Venue"
	created.Version = 2
	created.UpdatedAt = created.UpdatedAt.Add(time.Minute)
	if _, err := store.Update(created, 1); err != nil { t.Fatal(err) }

	created.Version = 3
	created.UpdatedAt = created.UpdatedAt.Add(time.Minute)
	if _, err := store.Update(created, 1); !errors.Is(err, ErrVersion) {
		t.Fatalf("err=%v", err)
	}
}

func TestProviderAliasCollisionRejected(t *testing.T) {
	store, _ := OpenFileStore(filepath.Join(t.TempDir(), "places.json"))
	if _, err := store.Create(place("place-1")); err != nil { t.Fatal(err) }
	second := place("place-2")
	if _, err := store.Create(second); !errors.Is(err, ErrAliasCollision) {
		t.Fatalf("err=%v", err)
	}
}

func TestFindByProviderAliasIsCaseInsensitiveForProvider(t *testing.T) {
	store, _ := OpenFileStore(filepath.Join(t.TempDir(), "places.json"))
	if _, err := store.Create(place("place-1")); err != nil { t.Fatal(err) }
	got, ok := store.FindByProviderAlias("OSM", "node/123")
	if !ok || got.ID != "place-1" {
		t.Fatalf("got=%+v ok=%v", got, ok)
	}
}

func TestPlacePrecisionAndVisibilityRules(t *testing.T) {
	p := place("place-1")
	p.Visibility = model.VisibilityPrivate
	if err := p.Validate(); err == nil {
		t.Fatal("expected exact public/private visibility rejection")
	}

	p = place("place-2")
	p.Precision = model.PrecisionPrivate
	if err := p.Validate(); err == nil {
		t.Fatal("expected private precision/public visibility rejection")
	}

	p = place("place-3")
	p.Latitude = nil
	p.Longitude = nil
	if err := p.Validate(); err == nil {
		t.Fatal("expected exact public coordinates requirement")
	}
}

func TestCorruptAndWrongSchemaSnapshotsFailClosed(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "places.json")
	if err := os.WriteFile(path, []byte("{broken"), 0o600); err != nil { t.Fatal(err) }
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("expected corrupt snapshot rejection")
	}

	if err := os.WriteFile(path, []byte("{\"schema\":\"wrong\",\"places\":[]}"), 0o600); err != nil { t.Fatal(err) }
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("expected schema rejection")
	}
}

func TestOwnerIsImmutable(t *testing.T) {
	store, _ := OpenFileStore(filepath.Join(t.TempDir(), "places.json"))
	p, _ := store.Create(place("place-1"))
	p.Owner = model.SubjectRef{Type: "ORGANIZATION", ID: "attacker"}
	p.Version = 2
	p.UpdatedAt = p.UpdatedAt.Add(time.Minute)
	if _, err := store.Update(p, 1); err == nil {
		t.Fatal("expected owner mutation rejection")
	}
}

func TestListByOwnerAndListAllAreStable(t *testing.T) {
	store, _ := OpenFileStore(filepath.Join(t.TempDir(), "places.json"))
	p1 := place("b")
	p1.ProviderAliases = []model.ProviderAlias{{Provider: "osm", ID: "b"}}
	p2 := place("a")
	p2.ProviderAliases = []model.ProviderAlias{{Provider: "osm", ID: "a"}}
	if _, err := store.Create(p1); err != nil { t.Fatal(err) }
	if _, err := store.Create(p2); err != nil { t.Fatal(err) }

	all := store.ListAll()
	if len(all) != 2 || all[0].ID != "a" || all[1].ID != "b" {
		t.Fatalf("all=%+v", all)
	}
	owned := store.ListByOwner(model.SubjectRef{Type: "ORGANIZATION", ID: "org-1"})
	if len(owned) != 2 {
		t.Fatalf("owned=%d", len(owned))
	}
}
