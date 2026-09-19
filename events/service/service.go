package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/events/model"
)

type EventRepository interface {
	Ready(context.Context) error
	Create(model.Event)(model.Event,error)
	Get(string)(model.Event,error)
	Update(model.Event,uint32)(model.Event,error)
	ListByOrganizer(model.SubjectRef)[]model.Event
}

type PlaceReader interface { Ready(context.Context) error }
type OrganizerAuthorizer interface {
	Ready(context.Context) error
	AuthorizeOrganizer(context.Context,model.SubjectRef) error
}

type Dependencies struct {
	Events EventRepository
	Places PlaceReader
	Authorizer OrganizerAuthorizer
}

type Service struct {
	events EventRepository
	places PlaceReader
	authorizer OrganizerAuthorizer
	now func() time.Time
}

func New(deps Dependencies)(*Service,error){
	switch {
	case deps.Events==nil: return nil,errors.New("420Events requires event repository")
	case deps.Places==nil: return nil,errors.New("420Events requires place reader")
	case deps.Authorizer==nil: return nil,errors.New("420Events requires organizer authorizer")
	}
	return &Service{events:deps.Events,places:deps.Places,authorizer:deps.Authorizer,now:time.Now},nil
}

func (s *Service) ServiceID()string{return model.ServiceID}
func (s *Service) APIVersion()string{return model.APIVersion}
func (s *Service) Boundary()model.ServiceBoundary{return model.GenesisBoundary()}

func (s *Service) Ready(ctx context.Context) error {
	checks:=[]struct{name string; fn func(context.Context)error}{
		{"event repository",s.events.Ready},
		{"place reader",s.places.Ready},
		{"organizer authorizer",s.authorizer.Ready},
	}
	for _,check:=range checks {
		if err:=check.fn(ctx); err!=nil { return errors.New("420Events dependency not ready: "+check.name+": "+err.Error()) }
	}
	return nil
}

func (s *Service) Create(ctx context.Context,event model.Event)(model.Event,error){
	if err:=s.authorizer.AuthorizeOrganizer(ctx,event.Organizer); err!=nil { return model.Event{},err }
	now:=s.now().UTC()
	if event.Version==0 { event.Version=1 }
	if event.CreatedAt.IsZero(){ event.CreatedAt=now }
	if event.UpdatedAt.IsZero(){ event.UpdatedAt=event.CreatedAt }
	if event.Status=="" { event.Status=model.StatusDraft }
	event.Timezone=strings.TrimSpace(event.Timezone)
	return s.events.Create(event)
}

func (s *Service) Get(_ context.Context,id string)(model.Event,error){
	return s.events.Get(id)
}

func (s *Service) Update(ctx context.Context,event model.Event,expectedVersion uint32)(model.Event,error){
	current,err:=s.events.Get(event.ID)
	if err!=nil { return model.Event{},err }
	if err:=s.authorizer.AuthorizeOrganizer(ctx,current.Organizer); err!=nil { return model.Event{},err }

	// GEN-SVC-2.11 does not own lifecycle transitions yet; 2.12 will.
	if event.Status!=current.Status {
		return model.Event{},errors.New("event status transitions require lifecycle engine")
	}
	event.Organizer=current.Organizer
	event.CreatedAt=current.CreatedAt
	event.Version=expectedVersion+1
	now:=s.now().UTC()
	if !now.After(current.UpdatedAt){ now=current.UpdatedAt.Add(time.Nanosecond) }
	event.UpdatedAt=now
	return s.events.Update(event,expectedVersion)
}

func (s *Service) ListByOrganizer(_ context.Context,organizer model.SubjectRef)[]model.Event {
	return s.events.ListByOrganizer(organizer)
}
