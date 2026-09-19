package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/events/model"
	locationmodel "github.com/420integrated/420-integrated/location/model"
)

type memRepo struct{ event model.Event; ready error }
func (m *memRepo) Ready(context.Context)error{return m.ready}
func (m *memRepo) Create(e model.Event)(model.Event,error){m.event=model.CloneEvent(e); return model.CloneEvent(e),nil}
func (m *memRepo) Get(id string)(model.Event,error){if m.event.ID!=id{return model.Event{},errors.New("missing")}; return model.CloneEvent(m.event),nil}
func (m *memRepo) Update(e model.Event,_ uint32)(model.Event,error){m.event=model.CloneEvent(e); return model.CloneEvent(e),nil}
func (m *memRepo) ListByOrganizer(o locationmodel.SubjectRef)[]model.Event{if m.event.Organizer==o{return []model.Event{model.CloneEvent(m.event)}};return nil}

type readyDep struct{err error}
func (r *readyDep) Ready(context.Context)error{return r.err}

type auth struct{err error; calls int}
func (a *auth) Ready(context.Context)error{return a.err}
func (a *auth) AuthorizeOrganizer(context.Context,locationmodel.SubjectRef)error{a.calls++;return a.err}

func baseEvent()model.Event{
	return model.Event{
		ID:"event-1",
		Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org-1"},
		Title:"420 Expo",
		StartAt:time.Date(2026,10,1,18,0,0,0,time.UTC),
		EndAt:time.Date(2026,10,1,22,0,0,0,time.UTC),
		Timezone:"America/Regina",
		Visibility:model.VisibilityPublic,
		Status:model.StatusDraft,
	}
}

func newService(t *testing.T)(*Service,*memRepo,*auth){
	t.Helper()
	repo:=&memRepo{}
	a:=&auth{}
	s,err:=New(Dependencies{Events:repo,Places:&readyDep{},Authorizer:a})
	if err!=nil{t.Fatal(err)}
	s.now=func()time.Time{return time.Date(2026,9,19,5,0,0,0,time.UTC)}
	return s,repo,a
}

func TestIdentityAndBoundary(t *testing.T){
	s,_,_:=newService(t)
	if s.ServiceID()!="420/service/events/v1"||s.APIVersion()!="v1"{t.Fatalf("identity %s %s",s.ServiceID(),s.APIVersion())}
	b:=s.Boundary()
	if !b.EventLifecycleAuthority||b.RegistryAuthority||b.IdentityAuthority||b.PaymentAuthority||b.BookingAuthority||b.CalendarAuthority||b.DiscoveryCanonical{
		t.Fatalf("boundary=%+v",b)
	}
}

func TestCreateDefaultsDraftVersionAndTimestamps(t *testing.T){
	s,_,a:=newService(t)
	e:=baseEvent(); e.Status=""; e.Version=0
	got,err:=s.Create(context.Background(),e)
	if err!=nil{t.Fatal(err)}
	if got.Status!=model.StatusDraft||got.Version!=1||got.CreatedAt.IsZero()||got.UpdatedAt.IsZero(){t.Fatalf("event=%+v",got)}
	if a.calls!=1{t.Fatalf("auth calls=%d",a.calls)}
}

func TestUpdateCannotBypassLifecycleEngine(t *testing.T){
	s,repo,_:=newService(t)
	e:=baseEvent(); e.Version=1; e.CreatedAt=s.now(); e.UpdatedAt=e.CreatedAt
	repo.event=e
	changed:=e
	changed.Status=model.StatusScheduled
	_,err:=s.Update(context.Background(),changed,1)
	if err==nil{t.Fatal("expected lifecycle transition rejection")}
}

func TestUpdatePreservesOrganizerAndCreationIdentity(t *testing.T){
	s,repo,_:=newService(t)
	e:=baseEvent(); e.Version=1; e.CreatedAt=s.now(); e.UpdatedAt=e.CreatedAt
	repo.event=e
	changed:=e
	changed.Title="Updated title"
	changed.Organizer=locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"other"}
	changed.CreatedAt=time.Time{}
	got,err:=s.Update(context.Background(),changed,1)
	if err!=nil{t.Fatal(err)}
	if got.Organizer!=e.Organizer||!got.CreatedAt.Equal(e.CreatedAt)||got.Version!=2{t.Fatalf("event=%+v",got)}
}

func TestReadyFailsClosed(t *testing.T){
	repo:=&memRepo{ready:errors.New("down")}
	s,err:=New(Dependencies{Events:repo,Places:&readyDep{},Authorizer:&auth{}})
	if err!=nil{t.Fatal(err)}
	if err:=s.Ready(context.Background());err==nil{t.Fatal("expected readiness failure")}
}


func TestLifecycleHappyPathAndHistory(t *testing.T){
	s,repo,_:=newService(t)
	e:=baseEvent(); e.Version=1; e.CreatedAt=s.now(); e.UpdatedAt=e.CreatedAt
	repo.event=e
	s.now=func()time.Time{return e.UpdatedAt.Add(time.Minute)}
	scheduled,err:=s.Transition(context.Background(),e.ID,model.StatusScheduled,1,"publish")
	if err!=nil{t.Fatal(err)}
	if scheduled.Status!=model.StatusScheduled||scheduled.Version!=2||len(scheduled.LifecycleHistory)!=1{t.Fatalf("scheduled=%+v",scheduled)}
	if scheduled.LifecycleHistory[0].From!=model.StatusDraft||scheduled.LifecycleHistory[0].To!=model.StatusScheduled||scheduled.LifecycleHistory[0].Reason!="publish"{t.Fatalf("history=%+v",scheduled.LifecycleHistory)}
	s.now=func()time.Time{return scheduled.UpdatedAt.Add(time.Minute)}
	live,err:=s.Transition(context.Background(),e.ID,model.StatusLive,2,"doors open")
	if err!=nil{t.Fatal(err)}
	s.now=func()time.Time{return live.UpdatedAt.Add(time.Minute)}
	ended,err:=s.Transition(context.Background(),e.ID,model.StatusEnded,3,"complete")
	if err!=nil{t.Fatal(err)}
	if ended.Status!=model.StatusEnded||len(ended.LifecycleHistory)!=3{t.Fatalf("ended=%+v",ended)}
}

func TestCancellationPreservesEventAndHistory(t *testing.T){
	s,repo,_:=newService(t)
	e:=baseEvent(); e.Status=model.StatusScheduled; e.Version=4; e.CreatedAt=s.now(); e.UpdatedAt=e.CreatedAt
	repo.event=e
	s.now=func()time.Time{return e.UpdatedAt.Add(time.Minute)}
	cancelled,err:=s.Transition(context.Background(),e.ID,model.StatusCancelled,4,"weather")
	if err!=nil{t.Fatal(err)}
	if cancelled.ID!=e.ID||cancelled.Title!=e.Title||cancelled.Status!=model.StatusCancelled{t.Fatalf("cancelled=%+v",cancelled)}
	if len(cancelled.LifecycleHistory)!=1||cancelled.LifecycleHistory[0].Reason!="weather"{t.Fatalf("history=%+v",cancelled.LifecycleHistory)}
	got,err:=s.Get(context.Background(),e.ID);if err!=nil{t.Fatal(err)}
	if got.Status!=model.StatusCancelled{t.Fatalf("got=%+v",got)}
}

func TestInvalidLifecycleJumpsFailClosed(t *testing.T){
	cases:=[]struct{from,to model.Status}{
		{model.StatusDraft,model.StatusLive},
		{model.StatusDraft,model.StatusEnded},
		{model.StatusScheduled,model.StatusEnded},
		{model.StatusLive,model.StatusScheduled},
	}
	for _,tc:=range cases{
		t.Run(string(tc.from)+"_to_"+string(tc.to),func(t *testing.T){
			s,repo,_:=newService(t)
			e:=baseEvent();e.Status=tc.from;e.Version=1;e.CreatedAt=s.now();e.UpdatedAt=e.CreatedAt;repo.event=e
			_,err:=s.Transition(context.Background(),e.ID,tc.to,1,"")
			if !errors.Is(err,ErrInvalidTransition){t.Fatalf("err=%v",err)}
		})
	}
}

func TestTerminalStatesCannotTransition(t *testing.T){
	for _,status:=range []model.Status{model.StatusEnded,model.StatusCancelled}{
		t.Run(string(status),func(t *testing.T){
			s,repo,_:=newService(t)
			e:=baseEvent();e.Status=status;e.Version=1;e.CreatedAt=s.now();e.UpdatedAt=e.CreatedAt;repo.event=e
			_,err:=s.Transition(context.Background(),e.ID,model.StatusCancelled,1,"")
			if !errors.Is(err,ErrTerminalStatus){t.Fatalf("err=%v",err)}
		})
	}
}

func TestTransitionRequiresCanonicalOrganizerAuthorization(t *testing.T){
	s,repo,a:=newService(t)
	e:=baseEvent();e.Version=1;e.CreatedAt=s.now();e.UpdatedAt=e.CreatedAt;repo.event=e
	a.err=errors.New("denied")
	_,err:=s.Transition(context.Background(),e.ID,model.StatusScheduled,1,"")
	if err==nil{t.Fatal("expected authorization error")}
	if a.calls!=1{t.Fatalf("auth calls=%d",a.calls)}
}

func TestTransitionRejectsStaleVersion(t *testing.T){
	s,repo,_:=newService(t)
	e:=baseEvent();e.Version=5;e.CreatedAt=s.now();e.UpdatedAt=e.CreatedAt;repo.event=e
	_,err:=s.Transition(context.Background(),e.ID,model.StatusScheduled,4,"")
	if err==nil{t.Fatal("expected version conflict")}
}
