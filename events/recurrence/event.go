package recurrence

import (
 "errors"
 "time"
 "github.com/420integrated/420-integrated/events/model"
)

// ExpandEvent uses only the schedule stored on the canonical Event. Callers
// cannot silently substitute a different rule for persisted event discovery.
func ExpandEvent(event model.Event,from,to time.Time)([]Occurrence,error){
 if event.Recurrence==nil{return nil,errors.New("event has no recurrence schedule")}
 r:=event.Recurrence
 return Expand(event,Rule{Frequency:Frequency(r.Frequency),Interval:r.Interval,Weekdays:append([]time.Weekday(nil),r.Weekdays...),Count:r.Count,Until:r.Until,Excluded:append([]time.Time(nil),r.Excluded...),Cancelled:append([]time.Time(nil),r.Cancelled...)},from,to)
}
