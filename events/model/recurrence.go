package model

import (
 "errors"
 "time"
)

// RecurrenceSpec is the canonical, persisted event schedule. Exception keys
// identify an occurrence by its original UTC start instant.
type RecurrenceSpec struct {
 Frequency string
 Interval int
 Weekdays []time.Weekday
 Count int
 Until time.Time
 Excluded []time.Time
 Cancelled []time.Time
}

func (r RecurrenceSpec) Validate() error {
 if r.Frequency!="DAILY" && r.Frequency!="WEEKLY" && r.Frequency!="MONTHLY" {return errors.New("unsupported recurrence frequency")}
 if r.Interval<1 || r.Interval>366 {return errors.New("recurrence interval outside allowed range")}
 if r.Count<0 || r.Count>512 || (r.Count==0 && r.Until.IsZero()) {return errors.New("recurrence must have bounded count or until")}
 if r.Frequency!="WEEKLY" && len(r.Weekdays)>0 {return errors.New("weekday selection only supported for weekly recurrence")}
 days:=map[time.Weekday]bool{}
 for _,d:=range r.Weekdays {if d<time.Sunday || d>time.Saturday || days[d] {return errors.New("invalid or duplicated recurrence weekday")};days[d]=true}
 for _,group:=range [][]time.Time{r.Excluded,r.Cancelled} {
  if len(group)>512 {return errors.New("too many recurrence exceptions")}
  seen:=map[int64]bool{}
  for _,v:=range group {if v.IsZero()||seen[v.UnixNano()]{return errors.New("invalid or duplicate recurrence exception")};seen[v.UnixNano()]=true}
 }
 return nil
}

func CloneRecurrence(in *RecurrenceSpec)*RecurrenceSpec{
 if in==nil{return nil}
 out:=*in
 out.Weekdays=append([]time.Weekday(nil),in.Weekdays...)
 out.Excluded=append([]time.Time(nil),in.Excluded...)
 out.Cancelled=append([]time.Time(nil),in.Cancelled...)
 return &out
}
