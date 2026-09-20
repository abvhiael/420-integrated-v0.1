package recurrence

import (
 "errors"
 "fmt"
 "sort"
 "time"

 "github.com/420integrated/420-integrated/events/model"
)

// Recurrence describes a bounded expansion of a canonical event. All exception
// keys are the original occurrence's UTC start, never the shifted local date.
type Frequency string
const (
 Daily Frequency = "DAILY"
 Weekly Frequency = "WEEKLY"
 Monthly Frequency = "MONTHLY"
)

const MaxOccurrences = 512
const MaxScanDays = 3660

type Rule struct {
 Frequency Frequency
 Interval int
 Weekdays []time.Weekday
 Count int
 Until time.Time
 // Excluded and Cancelled contain exact original UTC start instants.
 Excluded []time.Time
 Cancelled []time.Time
}

type Occurrence struct {
 EventID string
 StartAt time.Time
 EndAt time.Time
 OriginalStartAt time.Time
 Timezone string
 Cancelled bool
}

func (r Rule) Validate() error {
 if r.Frequency!=Daily && r.Frequency!=Weekly && r.Frequency!=Monthly { return errors.New("unsupported recurrence frequency") }
 if r.Interval<1 || r.Interval>366 { return errors.New("recurrence interval must be between 1 and 366") }
 if r.Count<0 || r.Count>MaxOccurrences { return errors.New("recurrence count outside bounded range") }
 if r.Count==0 && r.Until.IsZero() { return errors.New("recurrence requires a count or until bound") }
 if r.Frequency!=Weekly && len(r.Weekdays)>0 { return errors.New("weekdays apply only to weekly recurrence") }
 seen:=map[time.Weekday]bool{}
 for _,d:=range r.Weekdays { if d<time.Sunday || d>time.Saturday || seen[d] { return errors.New("invalid or duplicate weekday") }; seen[d]=true }
 for _,group:=range [][]time.Time{r.Excluded,r.Cancelled} {
  if len(group)>MaxOccurrences { return errors.New("too many occurrence exceptions") }
  seenTimes:=map[int64]bool{}
  for _,t:=range group { if t.IsZero() || seenTimes[t.UnixNano()] { return errors.New("invalid or duplicate occurrence exception") }; seenTimes[t.UnixNano()]=true }
 }
 return nil
}

// Expand generates occurrences in the inclusive UTC interval [from,to]. It
// applies COUNT to the original sequence before exclusions/cancellations, and
// never scans more than ten years or emits more than MaxOccurrences results.
// A cancelled occurrence stays addressable with Cancelled=true; an excluded
// occurrence is removed from the expansion.
func Expand(event model.Event,rule Rule,from,to time.Time)([]Occurrence,error){
 if err:=event.Validate(); err!=nil { return nil,err }
 if err:=rule.Validate(); err!=nil { return nil,err }
 if from.IsZero() || to.IsZero() || to.Before(from) { return nil,errors.New("invalid recurrence window") }
 loc,err:=time.LoadLocation(event.Timezone);if err!=nil{return nil,err}
 base:=event.StartAt.In(loc)
 baseDay:=time.Date(base.Year(),base.Month(),base.Day(),0,0,0,0,loc)
 baseWeekStart:=baseDay.AddDate(0,0,-int(baseDay.Weekday()))
 wallHour,wallMin,wallSec:=base.Clock(); wallNsec:=base.Nanosecond()
 excluded:=map[int64]bool{};cancelled:=map[int64]bool{}
 for _,v:=range rule.Excluded {excluded[v.UTC().UnixNano()]=true}
 for _,v:=range rule.Cancelled {cancelled[v.UTC().UnixNano()]=true}
 // Retain wall-clock duration through DST transitions; elapsed duration is
 // deliberately not the representation of a recurring local event's end.
 endLocal:=event.EndAt.In(loc)
 endDay:=time.Date(endLocal.Year(),endLocal.Month(),endLocal.Day(),0,0,0,0,loc)
 durationDays:=int(endDay.Sub(baseDay).Hours()/24)
 // Local civil day difference, avoiding the 23/25-hour DST day problem.
 durationDays=civilDays(endLocal.Year(),endLocal.Month(),endLocal.Day())-civilDays(base.Year(),base.Month(),base.Day())
 endHour,endMin,endSec:=endLocal.Clock(); endNsec:=endLocal.Nanosecond()
 sequence:=0; out:=make([]Occurrence,0)
 for offset:=0;offset<=MaxScanDays;offset++ {
  day:=baseDay.AddDate(0,0,offset)
  if day.After(rule.Until.In(loc).AddDate(0,0,1)) && !rule.Until.IsZero() {break}
  valid:=false
  switch rule.Frequency {
  case Daily: valid=offset%rule.Interval==0
  case Weekly:
   week:=int(day.Sub(baseWeekStart).Hours()/24/7)
   week=(civilDays(day.Year(),day.Month(),day.Day())-civilDays(baseWeekStart.Year(),baseWeekStart.Month(),baseWeekStart.Day()))/7
   if week%rule.Interval==0 {
    if len(rule.Weekdays)==0 {valid=day.Weekday()==base.Weekday()} else { for _,d:=range rule.Weekdays {if d==day.Weekday(){valid=true;break}} }
   }
  case Monthly:
   months:=(day.Year()-base.Year())*12+int(day.Month()-base.Month())
   valid=months%rule.Interval==0 && day.Day()==base.Day()
  }
  if !valid {continue}
  start:=time.Date(day.Year(),day.Month(),day.Day(),wallHour,wallMin,wallSec,wallNsec,loc)
  // Reject nonexistent local times, rather than silently moving a 02:30
  // occurrence to a different hour on spring-forward dates.
  y,m,d:=start.In(loc).Date();h,min,sec:=start.In(loc).Clock()
  if y!=day.Year()||m!=day.Month()||d!=day.Day()||h!=wallHour||min!=wallMin||sec!=wallSec {continue}
  if start.Before(event.StartAt){continue}
  if !rule.Until.IsZero() && start.After(rule.Until) {break}
  sequence++
  if rule.Count>0 && sequence>rule.Count {break}
  endingDay:=day.AddDate(0,0,durationDays)
  end:=time.Date(endingDay.Year(),endingDay.Month(),endingDay.Day(),endHour,endMin,endSec,endNsec,loc)
  if !end.After(start){ return nil,fmt.Errorf("invalid local recurrence end at %s",start.Format(time.RFC3339)) }
  if !start.Before(from) && !start.After(to) && !excluded[start.UTC().UnixNano()] {
   out=append(out,Occurrence{EventID:event.ID,StartAt:start.UTC(),EndAt:end.UTC(),OriginalStartAt:start.UTC(),Timezone:event.Timezone,Cancelled:cancelled[start.UTC().UnixNano()]})
   if len(out)>=MaxOccurrences {break}
  }
  if start.After(to){break}
 }
 sort.Slice(out,func(i,j int)bool{return out[i].StartAt.Before(out[j].StartAt)})
 return out,nil
}

// Days since a civil epoch; valid for the supported Go time range.
func civilDays(y int,m time.Month,d int) int {
 if m<=2 {y--}
 era:=y/400; yoe:=y-era*400
 mm:=int(m);if mm>2 {mm-=3}else{mm+=9}
 doy:=(153*mm+2)/5+d-1
 return era*146097+yoe*365+yoe/4-yoe/100+doy
}
