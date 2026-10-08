package reeferreview

import (
 "log"
 "net/http"
 "sync/atomic"
 "time"
)

// HTTPMetrics records bounded, non-sensitive request statistics. Do not include
// query parameters, Authorization headers, user identities or article contents.
type HTTPMetrics struct {
 Requests atomic.Uint64
 Errors atomic.Uint64
 Limited atomic.Uint64
 TotalLatencyNS atomic.Uint64
}

type statusObserver struct {
 http.ResponseWriter
 status int
}
func (w *statusObserver) WriteHeader(code int) {
 if w.status != 0 { return }
 w.status = code
 w.ResponseWriter.WriteHeader(code)
}
func (w *statusObserver) Write(b []byte)(int,error){
 if w.status==0 { w.WriteHeader(http.StatusOK) }
 return w.ResponseWriter.Write(b)
}

func (m *HTTPMetrics) Middleware(next http.Handler) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  start:=time.Now()
  observed:=&statusObserver{ResponseWriter:w}
  next.ServeHTTP(observed,r)
  status:=observed.status
  if status==0 {status=http.StatusOK}
  m.Requests.Add(1)
  if status>=400 {m.Errors.Add(1)}
  if status==http.StatusTooManyRequests {m.Limited.Add(1)}
  duration:=time.Since(start)
  m.TotalLatencyNS.Add(uint64(duration.Nanoseconds()))
  log.Printf("reefer_http method=%s status=%d duration_ms=%d",r.Method,status,duration.Milliseconds())
 })
}
