// 420ID restricted AUTH-2 / AUTH-3 acceptance service. No public SSO or wallet rights.
package main

import (
 "context"
 "database/sql"
 "encoding/json"
 "bytes"
 "io"
 "encoding/base64"
 "errors"
 "log"
 "net/http"
 "net/url"
 "os"
 "os/signal"
 "strconv"
 "strings"
 "syscall"
 "time"

 account "github.com/420integrated/420-integrated/services/420id"
 _ "github.com/lib/pq"
)
func database(key string)(*sql.DB,error){
 raw:=os.Getenv(key)
 u,e:=url.Parse(raw)
 // Require an explicit certificate-verified PostgreSQL URL, no insecure
 // sslmode or untrusted query fallback. lib/pq verifies the configured CA.
 if e!=nil||u.Hostname()==""||u.User==nil||u.Fragment!=""||u.ForceQuery||u.Scheme!="postgres"&&u.Scheme!="postgresql"||u.Query().Get("sslmode")!="verify-full"||len(u.Query()["sslmode"])!=1{return nil,errors.New("missing or unsafe PostgreSQL configuration")}
 q,e:=url.ParseQuery(u.RawQuery);if e!=nil{return nil,errors.New("invalid PostgreSQL query")}
 for k,values:=range q{if len(values)!=1||k!="sslmode"&&k!="sslrootcert"&&k!="connect_timeout"&&k!="application_name"{return nil,errors.New("unsupported PostgreSQL option")}}
 db,e:=sql.Open("postgres",raw);if e!=nil{return nil,errors.New("database configuration rejected")}
 db.SetMaxOpenConns(12);db.SetMaxIdleConns(4);db.SetConnMaxLifetime(10*time.Minute)
 ctx,cancel:=context.WithTimeout(context.Background(),10*time.Second);defer cancel()
 if e=db.PingContext(ctx);e!=nil{db.Close();return nil,errors.New("database connection failed")}
 return db,nil
}
func required(name string)string{v:=os.Getenv(name);if v==""{log.Fatal("Required setting missing: "+name)};return v}
func main(){
 // Migrations use a distinct operator credential; serving never runs DDL.
 if len(os.Args)==2&&os.Args[1]=="migrate"{
  db,e:=database("AUTH420_MIGRATION_DATABASE_URL");if e!=nil{log.Fatal(e)};defer db.Close()
  ctx,cancel:=context.WithTimeout(context.Background(),time.Minute);defer cancel()
  if account.Migrate(ctx,db)!=nil{log.Fatal("420ID database migration failed")}
  log.Print("420ID migration complete");return
 }
 if len(os.Args)!=1{log.Fatal("Unsupported operation")}
 mode:=os.Getenv("AUTH420_MODE")
 if mode!="acceptance"&&mode!="session-acceptance"&&mode!="profile-acceptance"&&mode!="wallet-acceptance"&&mode!="identity-acceptance"&&mode!="sso-acceptance"&&mode!="monetization-acceptance"{log.Fatal("420ID acceptance is not enabled")}
 sessionApp:="";if mode=="session-acceptance"||mode=="profile-acceptance"||mode=="wallet-acceptance"||mode=="identity-acceptance"{sessionApp="bong-goggles"}
 if mode=="sso-acceptance"||mode=="monetization-acceptance"{sessionApp="420id"}
 origin,rp:=required("AUTH420_ORIGIN"),required("AUTH420_RP_ID")
 mail,e:=configuredMailer(os.Getenv)
 if e!=nil{log.Fatal(e)}
 rate,e:=base64.RawURLEncoding.Strict().DecodeString(required("AUTH420_RATE_KEY"));if e!=nil||len(rate)!=32{log.Fatal("AUTH420_RATE_KEY must be a random 32-byte base64url key")}
 if os.Getenv("AUTH420_TLS_TERMINATION")!="trusted-proxy"{log.Fatal("Trusted TLS ingress must be configured explicitly")}
 db,e:=database("AUTH420_DATABASE_URL");if e!=nil{log.Fatal(e)};defer db.Close()
 var ssoClients []account.SSOClient
 approvedApps:=[]string{"bong-goggles"}
 if mode=="sso-acceptance"||mode=="monetization-acceptance"{approvedApps=[]string{"420id"}}
 if mode=="sso-acceptance"||mode=="monetization-acceptance"{
  raw:=required("AUTH420_SSO_CLIENTS")
  if len(raw)>16384{log.Fatal("SSO client manifest too large")}
  parser:=json.NewDecoder(bytes.NewReader([]byte(raw)));parser.DisallowUnknownFields()
  if parser.Decode(&ssoClients)!=nil||len(ssoClients)==0||len(ssoClients)>20{log.Fatal("SSO client manifest invalid")}
  if parser.Decode(&struct{}{})!=io.EOF{log.Fatal("SSO client manifest contains trailing data")}
  for _,c:=range ssoClients{approvedApps=append(approvedApps,c.App)}
 }
 store,e:=account.NewStore(db,approvedApps);if e!=nil{log.Fatal("Account store configuration rejected")}
 auth,e:=account.NewAuth(store,mail,origin,rp);if e!=nil{log.Fatal("HTTPS origin/RP configuration rejected")}
 var chain int64
 var contract account.ContractSignatureVerifier
 if mode=="wallet-acceptance"||mode=="identity-acceptance"||mode=="monetization-acceptance"{
  chain,e=strconv.ParseInt(required("AUTH420_WALLET_CHAIN_ID"),10,64)
  if e!=nil||chain<=0{log.Fatal("Invalid explicit wallet chain ID")}
  if rpcURL:=os.Getenv("AUTH420_WALLET_RPC_URL");rpcURL!=""{
   contract,e=account.NewWallet1271RPC(rpcURL,chain,nil);if e!=nil{log.Fatal("Unsafe contract verifier RPC configuration")}
  }
 }
 var identity account.IdentityNamesReader
 if mode=="identity-acceptance"{
  identity,e=account.NewIdentityNamesRPC(required("AUTH420_IDENTITY_NAMES_RPC_URL"),chain,
   required("AUTH420_IDENTITY_ADDRESS"),required("AUTH420_IDENTITY_CODE_HASH"),
   required("AUTH420_NAMES_ADDRESS"),required("AUTH420_NAMES_CODE_HASH"),nil)
  if e!=nil{log.Fatal("Invalid pinned Identity420/Names420 configuration")}
 }
 h,e:=account.NewAcceptanceHandler(auth,account.AcceptanceConfig{Emails:strings.Split(required("AUTH420_ACCEPTANCE_EMAILS"),","),RateKey:rate,TrustedTLSProxy:true,SessionApp:sessionApp,ProfileMode:mode=="profile-acceptance"||mode=="wallet-acceptance"||mode=="identity-acceptance"||mode=="monetization-acceptance",WalletMode:mode=="wallet-acceptance"||mode=="identity-acceptance"||mode=="monetization-acceptance",WalletChainID:chain,ContractVerifier:contract,IdentityMode:mode=="identity-acceptance",IdentityReader:identity,SSOClients:ssoClients,MonetizationMode:mode=="monetization-acceptance"})
 if e!=nil{log.Fatal("Acceptance configuration rejected")}
 ctx,cancel:=signal.NotifyContext(context.Background(),os.Interrupt,syscall.SIGTERM);defer cancel()
 preflight,stop:=context.WithTimeout(ctx,10*time.Second)
 if h.Purge(preflight)!=nil{stop();log.Fatal("Acceptance schema or runtime grants unavailable")};stop()
 go func(){ticker:=time.NewTicker(time.Minute);defer ticker.Stop();for{select{case <-ctx.Done():return;case <-ticker.C:
  cleanup,done:=context.WithTimeout(ctx,10*time.Second);if h.Purge(cleanup)!=nil{log.Print("Acceptance cleanup failed")};done()
 }}}()
 listen:=os.Getenv("PORT");if listen==""{listen="10000"};n,e:=strconv.Atoi(listen);if e!=nil||n<1||n>65535{log.Fatal("Invalid listen port")}
 srv:=&http.Server{Addr:":"+listen,Handler:h,ReadHeaderTimeout:5*time.Second,ReadTimeout:10*time.Second,WriteTimeout:20*time.Second,IdleTimeout:30*time.Second,MaxHeaderBytes:16*1024}
 go func(){<-ctx.Done();stopCtx,stop:=context.WithTimeout(context.Background(),10*time.Second);defer stop();_ = srv.Shutdown(stopCtx)}()
 log.Print("420ID restricted acceptance listener started")
 if e=srv.ListenAndServe();e!=nil&&!errors.Is(e,http.ErrServerClosed){log.Fatal("Acceptance listener failed")}
}
