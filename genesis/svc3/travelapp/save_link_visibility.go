package travelapp

import (
 "context"
 "net/http"
)

type saveLinksContextKey struct{}

// Public listing pages advertise the trip picker only when a qualified Travel
// composition has a public reader, independently verified Identity and an
// editable owner-scoped trip repository. The picker itself authenticates and
// the eventual POST checks live publication and session CSRF independently.
func withSaveLinks(r *http.Request, enabled bool) *http.Request {
 if !enabled { return r }
 return r.WithContext(context.WithValue(r.Context(),saveLinksContextKey{},true))
}

func saveLinksAvailable(r *http.Request) bool {
 enabled,_ := r.Context().Value(saveLinksContextKey{}).(bool)
 return enabled
}
