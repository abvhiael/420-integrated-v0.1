package main

import (
 "log"
 "net/http"
 "os"
 "strings"
 "time"

 reeferreview "github.com/420integrated/420-integrated/reefer-review"
)

func main(){
 mode:=strings.TrimSpace(os.Getenv("REEFER_REVIEW_DEPLOYMENT_MODE"));if mode==""{mode="development"}
 if mode!="development"{log.Fatal("Reefer Review live adapters are not configured; staging/production fail closed")}
 addr:=strings.TrimSpace(os.Getenv("REEFER_REVIEW_LISTEN_ADDR"));if addr==""{addr="127.0.0.1:8096"}
 mem:=reeferreview.NewMemory()
 svc:=reeferreview.Service{Identity:reeferreview.AllowIdentity{},Auth:reeferreview.DevAuthorizer{},Rights:reeferreview.DevRights{},Blobs:reeferreview.MemoryBlob{M:mem},Store:mem,Search:reeferreview.NoopSearch{},Notifications:reeferreview.NoopNotifications{},Mail:reeferreview.NoopMail{}}
 server:=&http.Server{Addr:addr,Handler:reeferreview.HTTP{Service:svc}.Handler(),ReadHeaderTimeout:5*time.Second,ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,IdleTimeout:30*time.Second}
 log.Printf("Reefer Review development service listening on %s; production modes intentionally blocked",addr);log.Fatal(server.ListenAndServe())
}
