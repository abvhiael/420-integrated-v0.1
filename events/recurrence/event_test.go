package recurrence

import (
 "path/filepath"
 "testing"
 "time"
 "github.com/420integrated/420-integrated/events/model"
 "github.com/420integrated/420-integrated/events/repository"
)

func TestCanonicalRecurrenceSurvivesRepositoryRestart(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,10,1,18,0)
 cancelled:=e.StartAt.AddDate(0,0,1)
 e.Recurrence=&model.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:3,Cancelled:[]time.Time{cancelled}}
 file:=filepath.Join(t.TempDir(),"events.json")
 store,err:=repository.OpenFileStore(file);if err!=nil{t.Fatal(err)}
 if _,err:=store.Create(e);err!=nil{t.Fatal(err)}
 reopened,err:=repository.OpenFileStore(file);if err!=nil{t.Fatal(err)}
 saved,err:=reopened.Get(e.ID);if err!=nil{t.Fatal(err)}
 got,err:=ExpandEvent(saved,e.StartAt,e.StartAt.AddDate(0,0,5));if err!=nil{t.Fatal(err)}
 if len(got)!=3||!got[1].Cancelled||got[0].Cancelled||got[2].Cancelled{t.Fatalf("expanded=%+v",got)}
 got[1].Cancelled=false
 if saved.Recurrence.Cancelled[0]!=cancelled{t.Fatal("expansion mutated canonical schedule")}
}

func TestRecurrenceDeepCloneAndInvalidRules(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,10,1,18,0)
 e.Recurrence=&model.RecurrenceSpec{Frequency:"WEEKLY",Interval:1,Count:4,Weekdays:[]time.Weekday{time.Thursday},Excluded:[]time.Time{e.StartAt}}
 clone:=model.CloneEvent(e)
 clone.Recurrence.Weekdays[0]=time.Friday
 clone.Recurrence.Excluded[0]=time.Time{}
 if e.Recurrence.Weekdays[0]!=time.Thursday||e.Recurrence.Excluded[0].IsZero(){t.Fatal("canonical recurrence aliased")}
 e.Recurrence.Interval=0
 if err:=e.Validate();err==nil{t.Fatal("invalid recurrence accepted")}
}
