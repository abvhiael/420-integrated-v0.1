package repository

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/events/model"
	locationmodel "github.com/420integrated/420-integrated/location/model"
)

func event()model.Event{
	now:=time.Date(2026,9,19,5,0,0,0,time.UTC)
	return model.Event{
		ID:"event-1",Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org-1"},
		Title:"420 Expo",StartAt:time.Date(2026,10,1,18,0,0,0,time.UTC),EndAt:time.Date(2026,10,1,22,0,0,0,time.UTC),
		Timezone:"America/Regina",Visibility:model.VisibilityPublic,Status:model.StatusDraft,
		Tags:[]string{"expo"},Version:1,CreatedAt:now,UpdatedAt:now,
	}
}

func TestPersistenceRestartAndVersionedUpdate(t *testing.T){
	path:=filepath.Join(t.TempDir(),"events.json")
	s,err:=OpenFileStore(path);if err!=nil{t.Fatal(err)}
	e:=event()
	if _,err:=s.Create(e);err!=nil{t.Fatal(err)}
	reopened,err:=OpenFileStore(path);if err!=nil{t.Fatal(err)}
	got,err:=reopened.Get(e.ID);if err!=nil{t.Fatal(err)}
	if got.Title!=e.Title||len(got.Tags)!=1{t.Fatalf("got=%+v",got)}
	got.Title="Updated";got.Version=2;got.UpdatedAt=got.UpdatedAt.Add(time.Minute)
	updated,err:=reopened.Update(got,1);if err!=nil{t.Fatal(err)}
	if updated.Version!=2||updated.Title!="Updated"{t.Fatalf("updated=%+v",updated)}
}

func TestDuplicateAndVersionConflict(t *testing.T){
	s,err:=OpenFileStore(filepath.Join(t.TempDir(),"events.json"));if err!=nil{t.Fatal(err)}
	e:=event()
	if _,err:=s.Create(e);err!=nil{t.Fatal(err)}
	if _,err:=s.Create(e);!errors.Is(err,ErrExists){t.Fatalf("err=%v",err)}
	e.Version=3;e.UpdatedAt=e.UpdatedAt.Add(time.Minute)
	if _,err:=s.Update(e,1);!errors.Is(err,ErrVersion){t.Fatalf("err=%v",err)}
}

func TestListByOrganizer(t *testing.T){
	s,err:=OpenFileStore(filepath.Join(t.TempDir(),"events.json"));if err!=nil{t.Fatal(err)}
	e:=event()
	if _,err:=s.Create(e);err!=nil{t.Fatal(err)}
	got:=s.ListByOrganizer(e.Organizer)
	if len(got)!=1||got[0].ID!=e.ID{t.Fatalf("got=%+v",got)}
}
