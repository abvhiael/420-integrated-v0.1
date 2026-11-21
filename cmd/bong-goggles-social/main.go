// BongGoggles wallet-independent social backend. Operator-only migrations;
// all user activity requires freshly introspected 420ID app SSO authority.
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

 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
 _ "github.com/lib/pq"
)
func required(name string)string{
 v:=os.Getenv(name);if v==""{log.Fatal("Missing required configuration: "+name)}
 return v
}
func postgres(raw string)(*sql.DB,error){
 u,e:=url.Parse(raw)
 if e!=nil||u.Hostname()==""||u.User==nil||u.Fragment!=""||u.ForceQuery||
  (u.Scheme!="postgres"&&u.Scheme!="postgresql")||u.Query().Get("sslmode")!="verify-full"||
  len(u.Query()["sslmode"])!=1{return nil,errors.New("untrusted PostgreSQL connection")}
 q,e:=url.ParseQuery(u.RawQuery);if e!=nil{return nil,e}
 for key,values:=range q{
  if len(values)!=1||(key!="sslmode"&&key!="sslrootcert"&&key!="connect_timeout"&&key!="application_name"){return nil,errors.New("unsupported PostgreSQL option")}
 }
 db,e:=sql.Open("postgres",raw);if e!=nil{return nil,e}
 db.SetMaxOpenConns(12);db.SetMaxIdleConns(4);db.SetConnMaxLifetime(10*time.Minute)
 ctx,done:=context.WithTimeout(context.Background(),10*time.Second);defer done()
 if e=db.PingContext(ctx);e!=nil{db.Close();return nil,errors.New("database unavailable")}
 return db,nil
}
func main(){
 if len(os.Args)==2&&os.Args[1]=="migrate"{
  db,e:=postgres(required("SOCIAL420_MIGRATION_DATABASE_URL"));if e!=nil{log.Fatal(e)};defer db.Close()
  ctx,done:=context.WithTimeout(context.Background(),time.Minute);defer done()
  if e=social.Migrate(ctx,db);e!=nil{log.Fatal("operator migration failed")}
  log.Print("BongGoggles social schema migrated");return
 }
 if len(os.Args)==5&&os.Args[1]=="moderate"{
  db,e:=postgres(required("SOCIAL420_MIGRATION_DATABASE_URL"));if e!=nil{log.Fatal(e)};defer db.Close()
  store,e:=social.NewStore(db);if e!=nil{log.Fatal(e)}
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second);defer done()
  if os.Getenv("SOCIAL420_XP_MODE")=="restricted-acceptance"{
   xp,e:=social.NewContributions(store);if e!=nil{log.Fatal(e)}
   if e=store.ReadyXP(ctx);e!=nil{log.Fatal("AUTH-10 schema/grants unavailable")}
   e=xp.Moderate(ctx,os.Args[2],os.Args[3],os.Args[4],required("SOCIAL420_OPERATOR_REF"))
   if e!=nil{log.Fatal("Moderation / XP reversal denied")}
  }else{
   if e=store.Moderate(ctx,os.Args[2],os.Args[3],os.Args[4],required("SOCIAL420_OPERATOR_REF"));e!=nil{log.Fatal("Moderation operation denied")}
  }
  log.Print("Off-chain moderation decision recorded");return
 }
 if len(os.Args)!=1||os.Getenv("SOCIAL420_MODE")!="restricted-acceptance"{
  log.Fatal("Wallet-independent social service not explicitly enabled")
 }
 if os.Getenv("SOCIAL420_TLS_TERMINATION")!="trusted-proxy"{
  log.Fatal("Trusted HTTPS edge required")
 }
 db,e:=postgres(required("SOCIAL420_DATABASE_URL"));if e!=nil{log.Fatal(e)};defer db.Close()
 store,e:=social.NewStore(db);if e!=nil{log.Fatal(e)}
 ctx,stop:=context.WithTimeout(context.Background(),10*time.Second)
 if e=store.ReadyRuntime(ctx);e!=nil{stop();log.Fatal("AUTH-12 runtime grants or moderation separation unsafe")}
 stop()
 key,e:=base64.RawURLEncoding.Strict().DecodeString(required("SOCIAL420_SESSION_KEY"))
 if e!=nil||len(key)!=32{log.Fatal("SOCIAL420_SESSION_KEY must be random 32-byte base64url")}
 broker,e:=social.NewHTTPBroker(required("SOCIAL420_AUTH_ORIGIN"),
  required("SOCIAL420_CALLBACK_URI"),"bong-goggles",required("SOCIAL420_CLIENT_SECRET"),nil)
 if e!=nil{log.Fatal("Unsafe central 420ID client configuration")}
 sso,e:=social.NewSignOn(store,broker,key);if e!=nil{log.Fatal(e)}
 handler,e:=social.NewHandler(store,sso,required("SOCIAL420_ORIGIN"));if e!=nil{log.Fatal(e)}
 // Optional independent Cloudflare Worker proxy credential. Without it,
 // direct requests addressed to the Render hostname remain forbidden.
 if edgeKey:=os.Getenv("SOCIAL420_EDGE_SECRET");edgeKey!=""{
  if e=handler.ConfigureTrustedWorker(edgeKey);e!=nil{log.Fatal("Invalid SOCIAL420_EDGE_SECRET")}
 }
 if os.Getenv("SOCIAL420_ACCOUNT_EXTRAS")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyAccountExtras(ctx);e!=nil{done();log.Fatal("AUTH-9 messaging/game schema or grants unavailable")}
  done()
  messageKey,e:=base64.RawURLEncoding.Strict().DecodeString(required("SOCIAL420_MESSAGE_KEY"))
  if e!=nil||len(messageKey)!=32{log.Fatal("SOCIAL420_MESSAGE_KEY must be an independent 32-byte base64url secret")}
  if string(messageKey)==string(key){log.Fatal("Message key and session key must be independent")}
  messages,e:=social.NewMessageService(store,messageKey);if e!=nil{log.Fatal(e)}
  games,e:=social.NewAccountGames(store);if e!=nil{log.Fatal(e)}
  if e=handler.EnableAccountExtras(messages,games);e!=nil{log.Fatal(e)}
 }else if os.Getenv("SOCIAL420_ACCOUNT_EXTRAS")!=""&&os.Getenv("SOCIAL420_ACCOUNT_EXTRAS")!="disabled"{
  log.Fatal("Unrecognized account messaging/game activation mode")
 }
 if os.Getenv("SOCIAL420_XP_MODE")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyXPRuntime(ctx);e!=nil{done();log.Fatal("AUTH-10 XP schema/grants or runtime role unsafe")}
  done()
  xp,e:=social.NewContributions(store);if e!=nil{log.Fatal(e)}
  if e=handler.EnableXP(xp);e!=nil{log.Fatal(e)}
 }else if os.Getenv("SOCIAL420_XP_MODE")!=""&&os.Getenv("SOCIAL420_XP_MODE")!="disabled"{
  log.Fatal("Unrecognized XP activation mode")
 }
 // AUTH-11 is an independent opt-in. The 420ID server must support
 // confidential, consent-scoped monetization introspection; no local
 // entitlements, payouts, invoices or 420Token entries can be created.
 if os.Getenv("SOCIAL420_MONETIZATION_MODE")=="restricted-acceptance"{
  if e=handler.EnableMonetization();e!=nil{log.Fatal("AUTH-11 confidential programme unavailable")}
 }else if os.Getenv("SOCIAL420_MONETIZATION_MODE")!=""&&os.Getenv("SOCIAL420_MONETIZATION_MODE")!="disabled"{
  log.Fatal("Unrecognized AUTH-11 activation mode")
 }
 mux:=http.NewServeMux()
 mux.Handle("/social-api/",http.StripPrefix("/social-api",handler))
 port:=os.Getenv("PORT");if port==""{port="10000"}
 p,e:=strconv.Atoi(port);if e!=nil||p<1||p>65535{log.Fatal("Invalid PORT")}
 server:=&http.Server{Addr:":"+port,Handler:mux,ReadHeaderTimeout:5*time.Second,
  ReadTimeout:10*time.Second,WriteTimeout:20*time.Second,IdleTimeout:30*time.Second,MaxHeaderBytes:16*1024}
 ctxServer,cancel:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM);defer cancel()
 go func(){ticker:=time.NewTicker(time.Minute);defer ticker.Stop();for{
  select{case <-ctxServer.Done():return;case <-ticker.C:
   ctx,done:=context.WithTimeout(ctxServer,5*time.Second)
   if store.Purge(ctx)!=nil{log.Print("Social cleanup unavailable")}
   done()
  }
 }}()
 go func(){<-ctxServer.Done();ctx,done:=context.WithTimeout(context.Background(),8*time.Second);defer done();_ = server.Shutdown(ctx)}()
 log.Print("Restricted wallet-independent social listener started")
 if e=server.ListenAndServe();e!=nil&&!errors.Is(e,http.ErrServerClosed){log.Fatal("Social listener failed")}
}
