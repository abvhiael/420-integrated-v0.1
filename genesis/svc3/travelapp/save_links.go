package travelapp

import (
 "context"
 "net/http"
)

type saveLinksContextKey struct{}

// saveLinksEnabled controls only display of navigation links. The save
// handler independently authenticates, checks CSRF and rechecks publication.
func saveLinksEnabled(r *http.Request) bool {
 enabled, _ := r.Context().Value(saveLinksContextKey{}).(bool)
 return enabled
}

// saveLinksAvailable is an alias for the public page templates' visibility
// contract; no authentication decision may rely on this display-only flag.
func saveLinksAvailable(r *http.Request) bool { return saveLinksEnabled(r) }

func withSaveLinks(r *http.Request, enabled bool) *http.Request {
 return r.WithContext(context.WithValue(r.Context(), saveLinksContextKey{}, enabled))
}
