package model

import (
	"errors"
	"strings"
	"time"

	locationmodel "github.com/420integrated/420-integrated/location/model"
)

const (
	ServiceID  = "420/service/events/v1"
	APIVersion = "v1"
)

type Status string
const (
	StatusDraft     Status = "DRAFT"
	StatusScheduled Status = "SCHEDULED"
	StatusLive      Status = "LIVE"
	StatusEnded     Status = "ENDED"
	StatusCancelled Status = "CANCELLED"
)

type TransitionRecord struct {
	From      Status
	To        Status
	Reason    string
	OccurredAt time.Time
}

func (r TransitionRecord) Validate() error {
	if !ValidStatus(r.From) || !ValidStatus(r.To) { return errors.New("event lifecycle history status is invalid") }
	if r.OccurredAt.IsZero() { return errors.New("event lifecycle history timestamp is required") }
	return nil
}

type Visibility string
const (
	VisibilityPublic              Visibility = "PUBLIC"
	VisibilityUnlisted            Visibility = "UNLISTED"
	VisibilityFollowers           Visibility = "FOLLOWERS"
	VisibilityCommunityOnly       Visibility = "COMMUNITY_ONLY"
	VisibilityPrivate             Visibility = "PRIVATE"
	VisibilityOrganizationMembers Visibility = "ORGANIZATION_MEMBERS"
)

type Event struct {
	ID              string
	Organizer       locationmodel.SubjectRef
	Title           string
	DescriptionRef  string
	StartAt         time.Time
	EndAt           time.Time
	Timezone        string
	Visibility      Visibility
	Status          Status
	PlaceID         string
	LocationText    string
	Capacity        uint64
	TicketReference string
	Tags            []string
	AgeRestrictions []string
	MediaAssetIDs   []string
	CalendarEventID string
	MetadataURI     string
	Version         uint32
	CreatedAt       time.Time
	UpdatedAt       time.Time
	LifecycleHistory []TransitionRecord
}

func ValidStatus(v Status) bool {
	switch v {
	case StatusDraft, StatusScheduled, StatusLive, StatusEnded, StatusCancelled:
		return true
	default:
		return false
	}
}

func ValidVisibility(v Visibility) bool {
	switch v {
	case VisibilityPublic, VisibilityUnlisted, VisibilityFollowers, VisibilityCommunityOnly, VisibilityPrivate, VisibilityOrganizationMembers:
		return true
	default:
		return false
	}
}

func (e Event) Validate() error {
	if strings.TrimSpace(e.ID)=="" { return errors.New("event id is required") }
	if err:=e.Organizer.Validate(); err!=nil { return err }
	if strings.TrimSpace(e.Title)=="" { return errors.New("event title is required") }
	if e.StartAt.IsZero() || e.EndAt.IsZero() { return errors.New("event start and end are required") }
	if !e.EndAt.After(e.StartAt) { return errors.New("event end must be after start") }
	if strings.TrimSpace(e.Timezone)=="" { return errors.New("event timezone is required") }
	if _,err:=time.LoadLocation(e.Timezone); err!=nil { return errors.New("event timezone is invalid") }
	if !ValidVisibility(e.Visibility) { return errors.New("event visibility is invalid") }
	if !ValidStatus(e.Status) { return errors.New("event status is invalid") }
	if e.Version==0 { return errors.New("event version is required") }
	if e.CreatedAt.IsZero() || e.UpdatedAt.IsZero() { return errors.New("event timestamps are required") }
	if e.UpdatedAt.Before(e.CreatedAt) { return errors.New("event updated time cannot precede created time") }
	last:=e.CreatedAt
	for _,record:=range e.LifecycleHistory {
		if err:=record.Validate(); err!=nil { return err }
		if record.OccurredAt.Before(last) { return errors.New("event lifecycle history is not chronological") }
		last=record.OccurredAt
	}
	return nil
}

func CloneEvent(in Event) Event {
	out:=in
	out.Tags=append([]string(nil),in.Tags...)
	out.AgeRestrictions=append([]string(nil),in.AgeRestrictions...)
	out.MediaAssetIDs=append([]string(nil),in.MediaAssetIDs...)
	out.LifecycleHistory=append([]TransitionRecord(nil),in.LifecycleHistory...)
	return out
}

type ServiceBoundary struct {
	RegistryAuthority bool
	IdentityAuthority bool
	PaymentAuthority bool
	BookingAuthority bool
	CalendarAuthority bool
	EventLifecycleAuthority bool
	DiscoveryCanonical bool
}

func GenesisBoundary() ServiceBoundary {
	return ServiceBoundary{
		RegistryAuthority:false,
		IdentityAuthority:false,
		PaymentAuthority:false,
		BookingAuthority:false,
		CalendarAuthority:false,
		EventLifecycleAuthority:true,
		DiscoveryCanonical:false,
	}
}
