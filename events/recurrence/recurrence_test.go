package recurrence

import (
 "testing"
 "time"
 "github.com/420integrated/420-integrated/events/model"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

func eventAt(t *testing.T,zone string,y int,m time.Month,d,h,minute int) model.Event {
 t.Helper();loc,err:=time.LoadLocation(zone);if err!=nil{t.Fatal(err)}
 start:=time.Date(y,m,d,h,minute,0,0,loc)
 return model.Event{ID:"event",Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org"},Title:"Weekly event",StartAt:start,EndAt:start.Add(time.Hour),Timezone:zone,Visibility:model.VisibilityPublic,Status:model.StatusScheduled,Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour)}
}

func TestDailyCountAndExclusions(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,10,1,18,0)
 a,b:=e.StartAt,e.StartAt.AddDate(0,0,10)
 r:=Rule{Frequency:Daily,Interval:1,Count:4,Excluded:[]time.Time{e.StartAt.AddDate(0,0,1)},Cancelled:[]time.Time{e.StartAt.AddDate(0,0,2)}}
 got,err:=Expand(e,r,a,b);if err!=nil{t.Fatal(err)}
 if len(got)!=3||!got[1].Cancelled||got[0].Cancelled||got[2].Cancelled{t.Fatalf("occurrences=%+v",got)}
}

func TestWeeklySelectedWeekdays(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,10,5,18,0) // Monday
 got,err:=Expand(e,Rule{Frequency:Weekly,Interval:1,Weekdays:[]time.Weekday{time.Monday,time.Wednesday},Count:4},e.StartAt,e.StartAt.AddDate(0,0,15))
 if err!=nil{t.Fatal(err)}
 if len(got)!=4{t.Fatalf("got=%+v",got)}
 for i,day:=range []time.Weekday{time.Monday,time.Wednesday,time.Monday,time.Wednesday}{ if got[i].StartAt.In(time.FixedZone("Regina",-6*3600)).Weekday()!=day{t.Fatalf("occurrence %d=%v",i,got[i])} }
}

func TestMonthlySkipsMissingDay(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,1,31,18,0)
 got,err:=Expand(e,Rule{Frequency:Monthly,Interval:1,Count:3},e.StartAt,e.StartAt.AddDate(0,5,0))
 if err!=nil{t.Fatal(err)}
 loc,err:=time.LoadLocation(e.Timezone);if err!=nil{t.Fatal(err)}
 if len(got)!=3{t.Fatalf("got=%+v",got)}
 for i,want:=range []time.Month{time.January,time.March,time.May}{
  local:=got[i].StartAt.In(loc)
  if local.Month()!=want || local.Day()!=31 || local.Hour()!=18 {t.Fatalf("occurrence %d local=%s; got=%+v",i,local,got)}
 }
}

func TestDSTMaintainsWallClock(t *testing.T){
 e:=eventAt(t,"America/Toronto",2026,3,7,18,0)
 got,err:=Expand(e,Rule{Frequency:Daily,Interval:1,Count:3},e.StartAt,e.StartAt.AddDate(0,0,4))
 if err!=nil{t.Fatal(err)}
 if len(got)!=3{t.Fatalf("got=%+v",got)}
 loc,_:=time.LoadLocation(e.Timezone)
 for _,v:=range got{ if v.StartAt.In(loc).Hour()!=18||v.EndAt.In(loc).Hour()!=19{t.Fatalf("wall clock shifted %+v",v)} }
 if got[1].StartAt.Sub(got[0].StartAt)!=23*time.Hour{t.Fatalf("DST boundary not preserved: %+v",got)}
}

func TestSpringForwardNonexistentLocalTimeSkipped(t *testing.T){
 e:=eventAt(t,"America/Toronto",2026,3,7,2,30)
 got,err:=Expand(e,Rule{Frequency:Daily,Interval:1,Count:3},e.StartAt,e.StartAt.AddDate(0,0,5))
 if err!=nil{t.Fatal(err)}
 if len(got)!=3 {t.Fatalf("got=%+v",got)}
 loc,_:=time.LoadLocation(e.Timezone)
 for _,v:=range got{if v.StartAt.In(loc).Hour()!=2||v.StartAt.In(loc).Minute()!=30{t.Fatalf("nonexistent wall time normalized %+v",v)}}
}

func TestInvalidOrUnboundedRuleRejected(t *testing.T){
 e:=eventAt(t,"America/Regina",2026,10,1,18,0)
 for _,rule:=range []Rule{{Frequency:Daily,Interval:1},{Frequency:Daily,Interval:0,Count:2},{Frequency:Monthly,Interval:1,Count:513},{Frequency:Daily,Interval:1,Count:3,Weekdays:[]time.Weekday{time.Monday}}}{
  if _,err:=Expand(e,rule,e.StartAt,e.StartAt.AddDate(0,0,10));err==nil{t.Fatalf("rule should fail: %+v",rule)}
 }
}
