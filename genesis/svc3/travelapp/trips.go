package travelapp

import (
 "context"
 "errors"
 "strings"
 "sync"
 "time"
)

// TripVisibility controls discovery, not ownership. Unlisted trips require an
// explicitly authorized share capability at the eventual HTTP boundary.
type TripVisibility string
const (
 TripPrivate TripVisibility = "PRIVATE"
 TripUnlisted TripVisibility = "UNLISTED"
 TripPublic TripVisibility = "PUBLIC"
)

// Trip is planning metadata only. References are IDs, never a copy of private
// Location/Events records or an authority for booking, ticketing or payment.
type Trip struct {
 ID string `json:"id"`
 OwnerID string `json:"-"`
 Title string `json:"title"`
 Visibility TripVisibility `json:"visibility"`
 PlaceIDs []string `json:"placeIds"`
 EventIDs []string `json:"eventIds"`
 CreatedAt time.Time `json:"createdAt"`
 UpdatedAt time.Time `json:"updatedAt"`
}

var (
 ErrTripInvalid = errors.New("invalid trip collection")
 ErrTripNotFound = errors.New("trip not found")
 ErrTripConflict = errors.New("trip already exists")
 ErrTripUnauthorized = errors.New("trip owner required")
)

func copyTrip(t Trip) Trip {
 t.PlaceIDs = append([]string(nil),t.PlaceIDs...)
 t.EventIDs = append([]string(nil),t.EventIDs...)
 return t
}

func validateTrip(t Trip) error {
 if !validPlaceID(t.ID) || strings.TrimSpace(t.OwnerID)=="" || len(strings.TrimSpace(t.Title))==0 || len(t.Title)>160 { return ErrTripInvalid }
 switch t.Visibility {case TripPrivate,TripUnlisted,TripPublic: default: return ErrTripInvalid}
 if len(t.PlaceIDs)>100 || len(t.EventIDs)>100 {return ErrTripInvalid}
 for _,ids:=range [][]string{t.PlaceIDs,t.EventIDs} {
  seen:=make(map[string]struct{},len(ids))
  for _,id:=range ids {if !validPlaceID(id) {return ErrTripInvalid};if _,ok:=seen[id];ok{return ErrTripInvalid};seen[id]=struct{}{}}
 }
 return nil
}

// TripStore is an in-process development implementation. Deployment requires a
// durable tenant-scoped store, Identity authentication, permission checks and
// a separate unpredictable share-token authority for unlisted access.
type TripStore struct { mu sync.RWMutex; trips map[string]Trip }
func NewTripStore()*TripStore{return &TripStore{trips:make(map[string]Trip)}}

// Create requires an authenticated owner supplied by a trusted caller. The
// requested owner may not be supplied or overridden by arbitrary HTTP input.
func (s *TripStore) Create(_ context.Context,owner string,trip Trip)(Trip,error){
 if s==nil || strings.TrimSpace(owner)=="" {return Trip{},ErrTripUnauthorized}
 trip.OwnerID=owner
 if trip.Visibility=="" {trip.Visibility=TripPrivate}
 if err:=validateTrip(trip);err!=nil{return Trip{},err}
 s.mu.Lock();defer s.mu.Unlock()
 if _,ok:=s.trips[trip.ID];ok{return Trip{},ErrTripConflict}
 now:=time.Now().UTC();trip.CreatedAt=now;trip.UpdatedAt=now
 s.trips[trip.ID]=copyTrip(trip)
 return copyTrip(trip),nil
}

func (s *TripStore) GetOwned(_ context.Context,owner,id string)(Trip,error){
 if s==nil || strings.TrimSpace(owner)=="" {return Trip{},ErrTripUnauthorized}
 s.mu.RLock();defer s.mu.RUnlock()
 t,ok:=s.trips[id];if !ok||t.OwnerID!=owner{return Trip{},ErrTripNotFound}
 return copyTrip(t),nil
}

func (s *TripStore) ListOwned(_ context.Context,owner string)([]Trip,error){
 if s==nil||strings.TrimSpace(owner)=="" {return nil,ErrTripUnauthorized}
 s.mu.RLock();defer s.mu.RUnlock()
 out:=make([]Trip,0)
 for _,t:=range s.trips {if t.OwnerID==owner {out=append(out,copyTrip(t))}}
 return out,nil
}

// ListPublic never returns private or unlisted collections. A public trip's
// referenced place/event IDs are NOT proof those entities remain public;
// consumers must re-resolve through current authorized public projections.
func (s *TripStore) ListPublic(_ context.Context)[]Trip{
 if s==nil{return nil}
 s.mu.RLock();defer s.mu.RUnlock()
 out:=make([]Trip,0)
 for _,t:=range s.trips {if t.Visibility==TripPublic {out=append(out,copyTrip(t))}}
 return out
}

// Replace is owner-scoped and fails closed for unknown IDs, including IDs
// belonging to other users. Ownership and creation time cannot be changed.
func (s *TripStore) Replace(_ context.Context,owner string,next Trip)(Trip,error){
 if s==nil||strings.TrimSpace(owner)=="" {return Trip{},ErrTripUnauthorized}
 next.OwnerID=owner
 if err:=validateTrip(next);err!=nil{return Trip{},err}
 s.mu.Lock();defer s.mu.Unlock()
 current,ok:=s.trips[next.ID];if !ok||current.OwnerID!=owner{return Trip{},ErrTripNotFound}
 next.CreatedAt=current.CreatedAt;next.UpdatedAt=time.Now().UTC()
 s.trips[next.ID]=copyTrip(next)
 return copyTrip(next),nil
}

func (s *TripStore) Delete(_ context.Context,owner,id string)error{
 if s==nil||strings.TrimSpace(owner)=="" {return ErrTripUnauthorized}
 s.mu.Lock();defer s.mu.Unlock()
 current,ok:=s.trips[id];if !ok||current.OwnerID!=owner{return ErrTripNotFound}
 delete(s.trips,id);return nil
}
