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
