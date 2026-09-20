package travelapp

import (
 "context"
 "net/http"
)

type saveLinksContextKey struct{}

// saveLinksEnabled controls only the display of navigation links. The save
// handler independently authenticates, checks CSRF and rechecks publication.
func saveLinksEnabled(r *http.Request) bool {
 enabled, _ := r.Context().Value(saveLinksContextKey{}).(bool)
 return enabled
}

func withSaveLinks(r *http.Request, enabled bool) *http.Request {
 return r.WithContext(context.WithValue(r.Context(), saveLinksContextKey{}, enabled))
}
