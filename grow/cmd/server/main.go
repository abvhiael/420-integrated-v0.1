package main

import (
 "context"
 "errors"
 "log"
 "net/http"
 "net/url"
 "os"
 "os/signal"
 "strings"
 "syscall"
 "time"

 growsvc "github.com/420integrated/420-integrated/grow/service"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)
func main(){
 raw:=os.Getenv("GROW_LOCATION_BASE_URL")
 endpoint,err:=url.Parse(raw)
 if err!=nil||endpoint==nil||endpoint.Scheme!="https"||endpoint.Host==""||endpoint.User!=nil||endpoint.RawQuery!=""||endpoint.Fragment!=""||endpoint.Path!=""&&endpoint.Path!="/"{
  log.Fatal("GROW_LOCATION_BASE_URL must be a clean HTTPS origin")
 }
 bind:=os.Getenv("GROW_LISTEN_ADDR")
 if bind==""{bind="127.0.0.1:8080"}
 handler:=growsvc.New(sdk.Client{BaseURL:strings.TrimRight(raw,"/"),HTTP:&http.Client{Timeout:8*time.Second,CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}}})
 server:=&http.Server{Addr:bind,Handler:handler,ReadHeaderTimeout:5*time.Second,ReadTimeout:10*time.Second,WriteTimeout:12*time.Second,IdleTimeout:30*time.Second}
 ctx,stop:=signal.NotifyContext(context.Background(),syscall.SIGTERM,syscall.SIGINT);defer stop()
 go func(){<-ctx.Done();closeCtx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel();_ =server.Shutdown(closeCtx)}()
 log.Printf("420Grow read-only service listening on %s",bind)
 if err:=server.ListenAndServe();err!=nil&&!errors.Is(err,http.ErrServerClosed){log.Fatal(err)}
}
