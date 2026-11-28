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
func postgresConnectionURL(raw string)(string,error){
 u,e:=url.Parse(raw)
 if e!=nil||u.Hostname()==""||u.User==nil||u.Fragment!=""||u.ForceQuery||
  (u.Scheme!="postgres"&&u.Scheme!="postgresql")||u.Query().Get("sslmode")!="verify-full"||
  len(u.Query()["sslmode"])!=1{return "",errors.New("untrusted PostgreSQL connection")}
 q,e:=url.ParseQuery(u.RawQuery);if e!=nil{return "",e}
 for key,values:=range q{
  if len(values)!=1||(key!="sslmode"&&key!="sslrootcert"&&key!="connect_timeout"&&key!="application_name"){return "",errors.New("unsupported PostgreSQL option")}
 }
 // lib/pq's default parameterized query path separates Parse/Describe from
 // Bind/Execute. A transaction pooler can switch server connections between
 // those round trips, losing the unnamed statement (SQLSTATE 26000).
 // Force the single-round-trip extended protocol; keep parameters bound,
 // certificate verification and the existing user-supplied option allowlist.
 q.Set("binary_parameters","yes")
 u.RawQuery=q.Encode()
 return u.String(),nil
}
func postgres(raw string)(*sql.DB,error){
 dsn,e:=postgresConnectionURL(raw);if e!=nil{return nil,e}
 db,e:=sql.Open("postgres",dsn);if e!=nil{return nil,e}
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
 if os.Getenv("SOCIAL420_CLASSIC_ROOMS")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyClassicRooms(ctx);e!=nil{done();log.Fatal("BC-0.5 room schema or least-privilege grants unavailable")}
  done()
  rooms,e:=social.NewClassicRooms(store);if e!=nil{log.Fatal(e)}
  if e=handler.EnableClassicRooms(rooms);e!=nil{log.Fatal("BC-0.5 requires the existing account-game auth service",e)}
 }else if os.Getenv("SOCIAL420_CLASSIC_ROOMS")!=""&&os.Getenv("SOCIAL420_CLASSIC_ROOMS")!="disabled"{
  log.Fatal("Unrecognized BC-0.5 room activation mode")
 }
 var classicSessionWorker *social.ClassicSessions
 if os.Getenv("SOCIAL420_CLASSIC_SESSIONS")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyClassicSessions(ctx);e!=nil{done();log.Fatal("BC-0.6 session schema or least-privilege grants unavailable")}
  done()
  // BC-0.7 adds a versioned contract; no individual Classic ruleset is registered in production.
  sessions,e:=social.NewClassicSessions(store,handler.Rooms,nil)
  if e!=nil{log.Fatal(e)}
  if e=handler.EnableClassicSessions(sessions);e!=nil{log.Fatal("BC-0.6 requires BC-0.5 room activation",e)}
  classicSessionWorker=sessions
 }else if os.Getenv("SOCIAL420_CLASSIC_SESSIONS")!=""&&os.Getenv("SOCIAL420_CLASSIC_SESSIONS")!="disabled"{
  log.Fatal("Unrecognized BC-0.6 session activation mode")
 }
 if os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")=="restricted-acceptance"{
  if handler.Rooms==nil||handler.Sessions==nil{log.Fatal("BC-0.10 requires room and session services")}
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyClassicCommunications(ctx);e!=nil{done();log.Fatal("BC-0.10 presence schema or runtime grants unavailable")}
  done()
  if e=handler.EnableClassicCommunications();e!=nil{log.Fatal(e)}
 }else if os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")!=""&&os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")!="disabled"{
  log.Fatal("Unrecognized BC-0.10 communications activation mode")
 }
 if os.Getenv("SOCIAL420_CLASSIC_RULES")=="restricted-acceptance"{
  if classicSessionWorker==nil{log.Fatal("BC-0.7 requires activated BC-0.6 sessions")}
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if e=store.ReadyClassicRules(ctx);e!=nil{done();log.Fatal("BC-0.7 replay schema or least-privilege grants unavailable")}
  done()
  // No unqualified game-specific module is enabled by this flag.
 }else if os.Getenv("SOCIAL420_CLASSIC_RULES")!=""&&os.Getenv("SOCIAL420_CLASSIC_RULES")!="disabled"{
  log.Fatal("Unrecognized BC-0.7 rules activation mode")
 }
  // The first qualified game is independently opt-in. An operator must have
 // already activated room/session/replay/presence dependencies; requests
 // cannot select arbitrary game rules or force production Play activation.
 if err:=configureCribbage(os.Getenv("SOCIAL420_CRIBBAGE_MODE"),classicSessionWorker,
  os.Getenv("SOCIAL420_CLASSIC_ROOMS")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_RULES")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")=="restricted-acceptance");err!=nil{
  log.Fatal("BC-1.5 Cribbage activation unavailable: ",err)
 }
 // BC-2.5 uses a distinct opt-in and never silently changes Cribbage.
 if err:=configureLabyrinth(os.Getenv("SOCIAL420_LABYRINTH_MODE"),classicSessionWorker,
  os.Getenv("SOCIAL420_CLASSIC_ROOMS")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_RULES")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")=="restricted-acceptance");err!=nil{
  log.Fatal("BC-2.5 Labyrinth activation unavailable: ",err)
 }
 if os.Getenv("SOCIAL420_LABYRINTH_MODE")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if err:=handler.EnableClassicLabyrinthMatchSocial(ctx);err!=nil{
   done();log.Fatal("BC-2.5 Labyrinth rematch preflight unavailable: ",err)
  }
  done()
 }
 // Chess remains disabled by default and requires the existing restricted dependencies.
 if err:=configureCheckers(os.Getenv("SOCIAL420_CHECKERS_MODE"));err!=nil{log.Fatal(err)}
 if err:=configureChess(os.Getenv("SOCIAL420_CHESS_MODE"),classicSessionWorker,
  os.Getenv("SOCIAL420_CLASSIC_ROOMS")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_RULES")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")=="restricted-acceptance");err!=nil{
  log.Fatal("BC-3.3 Chess activation unavailable: ",err)
 }
 if os.Getenv("SOCIAL420_CHESS_MODE")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  err:=store.ReadyClassicMatchRequests(ctx)
  done()
  if err!=nil{log.Fatal("BC-3.5 Chess challenge/rematch schema or grants unavailable: ",err)}
 }
 if err:=configureWordSalad(os.Getenv("SOCIAL420_WORD_SALAD_MODE"),classicSessionWorker,
  os.Getenv("SOCIAL420_CLASSIC_ROOMS")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_RULES")=="restricted-acceptance",
  os.Getenv("SOCIAL420_CLASSIC_COMMUNICATIONS")=="restricted-acceptance");err!=nil{
  log.Fatal("BC-4.2 Word Salad activation unavailable: ",err)
 }
 // BC-1.6 requires its own migration/grants and never silently enables
 // social operations in an already-qualified BC-1.5 deployment.
 if os.Getenv("SOCIAL420_CRIBBAGE_SOCIAL_MODE")=="restricted-acceptance"{
  ctx,done:=context.WithTimeout(context.Background(),10*time.Second)
  if err:=handler.EnableClassicMatchSocial(ctx);err!=nil{done();log.Fatal("BC-1.6 Cribbage social activation unavailable: ",err)}
  done()
 }else if os.Getenv("SOCIAL420_CRIBBAGE_SOCIAL_MODE")!=""&&os.Getenv("SOCIAL420_CRIBBAGE_SOCIAL_MODE")!="disabled"{
  log.Fatal("Unknown BC-1.6 Cribbage social activation mode")
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
 if os.Getenv("SOCIAL420_CHAOS_MODE")=="restricted-acceptance"{
  if e=handler.EnableChaosProxy(required("SOCIAL420_CHAOS_ORIGIN"),required("SOCIAL420_CHAOS_PROXY_KEY"));e!=nil{
   log.Fatal("CCC multiplayer trusted proxy configuration invalid")
  }
 }else if os.Getenv("SOCIAL420_CHAOS_MODE")!=""&&os.Getenv("SOCIAL420_CHAOS_MODE")!="disabled"{
  log.Fatal("Unsupported CCC multiplayer mode")
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
 if classicSessionWorker!=nil{
  go func(){ticker:=time.NewTicker(3*time.Second);defer ticker.Stop()
   for{select{case <-ctxServer.Done():return;case <-ticker.C:
    ctx,done:=context.WithTimeout(ctxServer,5*time.Second)
    if _,e:=classicSessionWorker.Sweep(ctx);e!=nil{log.Print("BC-0.6 deadline sweep unavailable")}
    done()
   }}
  }()
  go func(){ticker:=time.NewTicker(time.Second);defer ticker.Stop()
   for{select{case <-ctxServer.Done():return;case <-ticker.C:
    ctx,done:=context.WithTimeout(ctxServer,20*time.Second)
    if _,e:=classicSessionWorker.SweepBots(ctx);e!=nil{log.Print("BC-0.8 bot worker unavailable: ",e)}
    done()
   }}
  }()
 }
 go func(){<-ctxServer.Done();ctx,done:=context.WithTimeout(context.Background(),8*time.Second);defer done();_ = server.Shutdown(ctx)}()
 log.Print("Restricted wallet-independent social listener started")
 if e=server.ListenAndServe();e!=nil&&!errors.Is(e,http.ErrServerClosed){log.Fatal("Social listener failed")}
}
