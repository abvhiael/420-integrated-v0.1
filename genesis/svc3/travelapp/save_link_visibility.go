package travelapp

import (
 "context"
 "net/http"
)

type saveLinksContextKey struct{}

// Public listing pages may advertise a trip picker only in an explicitly
// composed, authenticated-capable Travel deployment. The public-only binary
// does not expose save links. The picker itself independently authenticates
// and the eventual POST rechecks the live public projection and session CSRF.
func withSaveLinks(r *http.Request, users TravelUserDependencies, reader PublicReader) *http.Request {
 _, editable := users.Trips.(EditableTripRepository)
 if reader == nil || users.Identity == nil || !editable { return r }
 return r.WithContext(context.WithValue(r.Context(),saveLinksContextKey{},true))
}

func saveLinksAvailable(r *http.Request) bool {
 enabled,_ := r.Context().Value(saveLinksContextKey{}).(bool)
 return enabled
}
