// Package browserorigin validates the pinned origin of a browser mutation.
package browserorigin

import (
	"net/http"
	"strings"
)

// SameOrigin permits browsers that omit Origin only when Fetch Metadata and
// the browser-controlled Referer both attest the pinned origin.
func SameOrigin(r *http.Request, origin string) bool {
	originHeaders := r.Header.Values("Origin")
	fetchSite := r.Header.Get("Sec-Fetch-Site")
	if len(originHeaders) != 0 {
		return len(originHeaders) == 1 && originHeaders[0] == origin &&
			(fetchSite == "" || fetchSite == "same-origin")
	}
	referer := r.Header.Values("Referer")
	return len(r.Header.Values("Sec-Fetch-Site")) == 1 && fetchSite == "same-origin" &&
		len(referer) == 1 && strings.HasPrefix(referer[0], origin+"/")
}
