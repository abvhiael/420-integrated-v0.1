package notifications

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "fmt"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/events/model"
 "github.com/420integrated/420-integrated/events/recurrence"
)

// Request is an off-chain 420Notifications integration envelope, not a feed
// item or delivery receipt. The notification service owns subscriber consent,
// recipient authorization, provenance, delivery and durable idempotency.
type Request struct {
 ID string
 EventID string
 EventVersion uint32
 Kind string
 OriginalStartAt time.Time
 StartAt time.Time
 Title string
}

type Sink interface { SubmitEventNotification(context.Context, Request) error }

// Build constructs a bounded, deterministic set of public event requests.
// Private, unlisted and audience-restricted event information is never emitted.
// A cancelled canonical event may emit a cancellation for previously visible
// occurrences; it must still retain PUBLIC visibility. No implicit recipients
// are selected and this function never sends a notification.
func Build(event model.Event, from,to time.Time) ([]Request,error) {
 if err:=event.Validate();err!=nil{return nil,err}
 if from.IsZero()||to.IsZero()||to.Before(from)||to.Sub(from)>366*24*time.Hour{return nil,errors.New("invalid notification window")}
 if event.Visibility!=model.VisibilityPublic{return nil,nil}
 if event.Status!=model.StatusScheduled&&event.Status!=model.StatusLive&&event.Status!=model.StatusCancelled{return nil,nil}
 var occurrences []recurrence.Occurrence
 if event.Recurrence!=nil {
  expanded,err:=recurrence.ExpandEvent(event,from,to);if err!=nil{return nil,err};occurrences=expanded
 }else if !event.StartAt.Before(from)&&!event.StartAt.After(to){
  occurrences=[]recurrence.Occurrence{{EventID:event.ID,StartAt:event.StartAt.UTC(),OriginalStartAt:event.StartAt.UTC(),EndAt:event.EndAt.UTC(),Timezone:event.Timezone}}
 }
 out:=make([]Request,0,len(occurrences))
 for _,o:=range occurrences {
  kind:="event_scheduled"
  if event.Status==model.StatusLive {kind="event_live"}
  if o.Cancelled||event.Status==model.StatusCancelled {kind="event_cancelled"}
  material:=fmt.Sprintf("events/v1|%s|%d|%s|%s",event.ID,event.Version,o.OriginalStartAt.UTC().Format(time.RFC3339Nano),kind)
  sum:=sha256.Sum256([]byte(material))
  out=append(out,Request{ID:"event_notice_"+hex.EncodeToString(sum[:]),EventID:event.ID,EventVersion:event.Version,Kind:kind,OriginalStartAt:o.OriginalStartAt.UTC(),StartAt:o.StartAt.UTC(),Title:event.Title})
 }
 return out,nil
}

// Dispatch does not claim delivery: it passes validated public requests to a
// subscriber-aware sink. Replays intentionally use stable request IDs so the
// downstream durable idempotency store can suppress duplicates across restarts.
func Dispatch(ctx context.Context,sink Sink,requests []Request)error{
 if sink==nil{return errors.New("notification sink is required")}
 for _,r:=range requests{
  if strings.TrimSpace(r.ID)==""||strings.TrimSpace(r.EventID)==""||r.EventVersion==0||r.OriginalStartAt.IsZero(){return errors.New("invalid event notification request")}
  if err:=ctx.Err();err!=nil{return err}
  if err:=sink.SubmitEventNotification(ctx,r);err!=nil{return err}
 }
 return nil
}
