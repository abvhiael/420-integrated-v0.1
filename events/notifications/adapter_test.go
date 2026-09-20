package notifications

import (
 "context"
 "errors"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/events/model"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

func fixture()model.Event{
 start:=time.Date(2026,10,1,18,0,0,0,time.FixedZone("Regina",-6*3600))
 return model.Event{ID:"event",Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org"},Title:"Public event",StartAt:start,EndAt:start.Add(time.Hour),Timezone:"America/Regina",Visibility:model.VisibilityPublic,Status:model.StatusScheduled,Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour)}
}

func TestPublicNoticeStableReplayAndVersion(t *testing.T){
 e:=fixture(); from,to:=e.StartAt,e.StartAt.AddDate(0,0,2)
 one,err:=Build(e,from,to);if err!=nil{t.Fatal(err)}
 two,err:=Build(e,from,to);if err!=nil{t.Fatal(err)}
 if len(one)!=1||len(two)!=1||one[0].ID!=two[0].ID||one[0].Kind!="event_scheduled"{t.Fatalf("unstable notice %+v %+v",one,two)}
 e.Version++;later,err:=Build(e,from,to);if err!=nil{t.Fatal(err)}
 if len(later)!=1||later[0].ID==one[0].ID{t.Fatal("version change must change notification identity")}
 e.Status=model.StatusCancelled;cancelled,err:=Build(e,from,to);if err!=nil{t.Fatal(err)}
 if len(cancelled)!=1||cancelled[0].Kind!="event_cancelled"{t.Fatalf("canonical cancellation %+v",cancelled)}
}

func TestRestrictedVisibilityCannotProduceNotice(t *testing.T){
 e:=fixture();from,to:=e.StartAt,e.StartAt.AddDate(0,0,2)
 for _,v:=range []model.Visibility{model.VisibilityPrivate,model.VisibilityUnlisted,model.VisibilityFollowers,model.VisibilityCommunityOnly,model.VisibilityOrganizationMembers}{
  e.Visibility=v;notices,err:=Build(e,from,to);if err!=nil||len(notices)!=0{t.Fatalf("visibility %s leaked: %+v %v",v,notices,err)}
 }
 e.Visibility=model.VisibilityPublic;e.Status=model.StatusDraft
 notices,err:=Build(e,from,to);if err!=nil||len(notices)!=0{t.Fatalf("draft emitted %+v %v",notices,err)}
}

func TestRecurringCancellationExclusionAndOriginalIdentity(t *testing.T){
 e:=fixture();e.Recurrence=&model.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:4,Excluded:[]time.Time{e.StartAt.AddDate(0,0,1)},Cancelled:[]time.Time{e.StartAt.AddDate(0,0,2)}}
 notices,err:=Build(e,e.StartAt,e.StartAt.AddDate(0,0,5));if err!=nil{t.Fatal(err)}
 if len(notices)!=3||notices[0].Kind!="event_scheduled"||notices[1].Kind!="event_cancelled"||notices[2].Kind!="event_scheduled"{t.Fatalf("recurring notices %+v",notices)}
 if !notices[1].OriginalStartAt.Equal(e.StartAt.AddDate(0,0,2)){t.Fatal("exception lost original occurrence identity")}
}

type sinkMock struct{received []Request;fail bool}
func(s *sinkMock)SubmitEventNotification(_ context.Context,r Request)error{if s.fail{return errors.New("sink unavailable")};s.received=append(s.received,r);return nil}
func TestDispatchHandoffAndFailures(t *testing.T){
 e:=fixture();n,err:=Build(e,e.StartAt,e.EndAt);if err!=nil{t.Fatal(err)}
 s:=&sinkMock{};if err:=Dispatch(context.Background(),s,n);err!=nil||len(s.received)!=1{t.Fatalf("handoff failed %v %+v",err,s.received)}
 if err:=Dispatch(context.Background(),nil,n);err==nil{t.Fatal("nil sink allowed")}
 s.fail=true;if err:=Dispatch(context.Background(),s,n);err==nil{t.Fatal("sink failure suppressed")}
 ctx,cancel:=context.WithCancel(context.Background());cancel();if err:=Dispatch(ctx,s,n);!errors.Is(err,context.Canceled){t.Fatalf("cancelled context: %v",err)}
}
