// One instance and one isolated PostgreSQL credential per first-party app.
// 420ID remains the sole confidential identity authority. This never
// authorizes wallet, tenant, moderation, payment or reward operations.
package main

import (
 "context"
 "database/sql"
 "encoding/base64"
 "errors"
 "log"
 "net/http"
 "net/url"
 "os"
 "os/signal"
 "strconv"
 "syscall"
 "time"

 gateway "github.com/420integrated/420-integrated/services/420id/app-gateway"
 _ "github.com/lib/pq"
)
func required(name string)string{
 value:=os.Getenv(name)
 if value==""{log.Fatal("Required app-gateway setting missing: "+name)}
 return value
}
func postgres(raw string)(*sql.DB,error){
 u,e:=url.Parse(raw)
 if e!=nil||u.Hostname()==""||u.User==nil||
  (u.Scheme!="postgres"&&u.Scheme!="postgresql")||
  u.RawFragment!=""||u.ForceQuery||u.Query().Get("sslmode")!="verify-full"||
  len(u.Query()["sslmode"])!=1{return nil,errors.New("unsafe PostgreSQL connection")}
 for k,v:=range u.Query(){
  if len(v)!=1||(k!="sslmode"&&k!="sslrootcert"&&k!="connect_timeout"&&k!="application_name"){
   return nil,errors.New("unsupported PostgreSQL connection option")
  }
 }
 db,e:=sql.Open("postgres",raw);if e!=nil{return nil,ErrDB}
 db.SetMaxOpenConns(12);db.SetMaxIdleConns(4);db.SetConnMaxLifetime(10*time.Minute)
 ctx,cancel:=context.WithTimeout(context.Background(),10*time.Second);defer cancel()
 if e=db.PingContext(ctx);e!=nil{db.Close();return nil,ErrDB}
 return db,nil
}
var ErrDB=errors.New("database unavailable")
func secret(name string)[]byte{
 raw:=required(name)
 data,e:=base64.RawURLEncoding.Strict().DecodeString(raw)
 if e!=nil||len(data)!=32{log.Fatal(name+" must be a random 32-byte base64url secret")}
 return data
}
func main(){
 if len(os.Args)==2&&os.Args[1]=="migrate"{
  db,e:=postgres(required("APP420_MIGRATION_DATABASE_URL"));if e!=nil{log.Fatal(e)}
  defer db.Close()
  ctx,cancel:=context.WithTimeout(context.Background(),time.Minute);defer cancel()
  if e=gateway.Migrate(ctx,db);e!=nil{log.Fatal("operator migration failed: ",e)}
  log.Print("420ID application gateway schema migrated");return
 }
 if len(os.Args)!=1||os.Getenv("APP420_MODE")!="restricted-acceptance"||
  os.Getenv("APP420_TLS_TERMINATION")!="trusted-proxy"{
  log.Fatal("420ID application gateway not explicitly authorized")
 }
 id:=required("APP420_APP_ID")
 app,e:=gateway.ApprovedApp(id);if e!=nil{log.Fatal("unapproved app ID")}
 if expected:=required("APP420_ORIGIN");expected!=app.Origin{log.Fatal("app origin does not match pinned catalogue")}
 db,e:=postgres(required("APP420_DATABASE_URL"));if e!=nil{log.Fatal(e)};defer db.Close()
 g,e:=gateway.New(gateway.Config{
  AppID:id,DB:db,ClientSecret:secret("APP420_CLIENT_SECRET"),
  SessionKey:secret("APP420_SESSION_KEY"),TrustedTLSProxy:true,
 })
 if e!=nil{log.Fatal("app gateway configuration rejected")}
 ctx,stop:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM);defer stop()
 preflight,cancel:=context.WithTimeout(ctx,10*time.Second)
 if e=g.Ready(preflight);e!=nil{cancel();log.Fatal("runtime schema/grants unsafe")}
 cancel()
 port:=os.Getenv("PORT");if port==""{port="10000"}
 number,e:=strconv.Atoi(port);if e!=nil||number<1||number>65535{log.Fatal("invalid server port")}
 server:=&http.Server{Addr:":"+port,Handler:g,ReadHeaderTimeout:5*time.Second,
  ReadTimeout:10*time.Second,WriteTimeout:20*time.Second,IdleTimeout:30*time.Second,
  MaxHeaderBytes:16*1024}
 go func(){
  ticker:=time.NewTicker(time.Minute);defer ticker.Stop()
  for{
   select{
   case <-ctx.Done():return
   case <-ticker.C:
    cleanup,done:=context.WithTimeout(ctx,6*time.Second)
    if g.Purge(cleanup)!=nil{log.Print("app session cleanup unavailable")}
    done()
   }
  }
 }()
 go func(){<-ctx.Done();finish,cancel:=context.WithTimeout(context.Background(),8*time.Second);defer cancel();_ =server.Shutdown(finish)}()
 log.Print("420ID confidential first-party application gateway enabled for ",id)
 if e=server.ListenAndServe();e!=nil&&!errors.Is(e,http.ErrServerClosed){log.Fatal("listener failed")}
}
