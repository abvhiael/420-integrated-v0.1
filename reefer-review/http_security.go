package reeferreview

import "net/http"

// securityResponseHeaders protects both successful and failed API responses.
// Deployment ingress must still terminate TLS and enforce its own network policy.
func securityResponseHeaders(next http.Handler) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  h:=w.Header()
  h.Set("X-Content-Type-Options","nosniff")
  h.Set("X-Frame-Options","DENY")
  h.Set("Referrer-Policy","no-referrer")
  h.Set("Permissions-Policy","camera=(), microphone=(), geolocation=()")
  h.Set("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
  h.Set("Cache-Control","no-store")
  h.Set("Cross-Origin-Resource-Policy","same-origin")
  next.ServeHTTP(w,r)
 })
}
