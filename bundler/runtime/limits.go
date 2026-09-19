package runtime

import (
 "errors"
 "net/http"
)

// LimitConcurrent rejects excess work immediately rather than accumulating
// waiting goroutines that can exhaust the bundler under hostile traffic.
func LimitConcurrent(next http.Handler,limit int)(http.Handler,error){
 if next==nil||limit<=0||limit>4096{return nil,errors.New("valid handler and concurrency limit are required")}
 slots:=make(chan struct{},limit)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  select{
  case slots<-struct{}{}:
   defer func(){<-slots}()
   next.ServeHTTP(w,r)
  default:
   w.Header().Set("Retry-After","1")
   http.Error(w,"bundler request capacity exceeded",http.StatusServiceUnavailable)
  }
 }),nil
}
