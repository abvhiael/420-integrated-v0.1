package complianceauth

import (
 "context"
 "io"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "strings"
 "sync"
 "sync/atomic"
 "testing"
 "time"
)

type c074FixtureAdmission struct{ fail bool }
func(a c074FixtureAdmission)Acquire(ctx context.Context,_ string)(func(),error){
 if a.fail||ctx.Err()!=nil{return nil,ErrC074Overload};return func(){},nil
}
func TestC074HTTPOverloadAndRecovery(t *testing.T){
 entered:=make(chan struct{},16);done:=make(chan struct{});var calls atomic.Int32
 handler:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  calls.Add(1)
  if c074Recovery(r){w.WriteHeader(http.StatusForbidden);return}
  entered<-struct{}{};<-done;w.Write([]byte(`{"outcome":"DENY"}`))
 })
 h,e:=NewC074HTTP(handler,c074FixtureAdmission{});if e!=nil{t.Fatal(e)}
 var wg sync.WaitGroup
 for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();h.ServeHTTP(httptest.NewRecorder(),httptest.NewRequest("GET","/api/v1/guidance",nil))}()}
 for i:=0;i<16;i++{<-entered}
 rejected:=httptest.NewRecorder();h.ServeHTTP(rejected,httptest.NewRequest("GET","/api/v1/guidance",nil))
 if rejected.Code!=503||calls.Load()!=16||strings.Contains(rejected.Body.String(),"ALLOW"){t.Fatal("overload reached backend",rejected.Code,calls.Load())}
 reserved:=httptest.NewRecorder();h.ServeHTTP(reserved,httptest.NewRequest("POST","/api/v1/operator/halt",nil))
 if reserved.Code!=403||calls.Load()!=17{t.Fatal("recovery reserve or original authorization lost",reserved.Code)}
 spoof:=httptest.NewRequest("GET","/api/v1/operator/halt",nil);spoof.Header.Set("X-Forwarded-For","127.0.0.1");spoof.Header.Set("X-Tenant","other")
 denied:=httptest.NewRecorder();h.ServeHTTP(denied,spoof);if denied.Code!=503{t.Fatal("recovery path spoof")}
 close(done);wg.Wait();if len(h.work)!=0||len(h.recovery)!=0{t.Fatal("admission leaked")}
}
func TestC074BodyResponseTimeoutAndOutage(t *testing.T){
 var calls atomic.Int32
 backend:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){calls.Add(1);w.Write([]byte(`{"outcome":"ALLOW"}`))})
 outage,_:=NewC074HTTP(backend,c074FixtureAdmission{fail:true});w:=httptest.NewRecorder();outage.ServeHTTP(w,httptest.NewRequest("GET","/",nil));if w.Code!=503||calls.Load()!=0{t.Fatal("outage admitted")}
 h,_:=NewC074HTTP(backend,c074FixtureAdmission{})
 for _,length:=range []int64{-1,C071MaxPrivateBytes+1}{
  r:=httptest.NewRequest("POST","/api/v1/evaluate",strings.NewReader(strings.Repeat("x",C071MaxPrivateBytes+1)));r.ContentLength=length
  w=httptest.NewRecorder();h.ServeHTTP(w,r);if w.Code!=413||calls.Load()!=0{t.Fatal("oversize reached evaluator")}
 }
 oversized,_:=NewC074HTTP(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Write([]byte(strings.Repeat("x",2*C071MaxPrivateBytes+1)))}),c074FixtureAdmission{})
 w=httptest.NewRecorder();oversized.ServeHTTP(w,httptest.NewRequest("GET","/",nil));if w.Code!=503||w.Body.Len()>1000{t.Fatal("partial export escaped")}
 late,_:=NewC074HTTP(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){<-r.Context().Done();w.Write([]byte(`{"outcome":"ALLOW"}`))}),c074FixtureAdmission{})
 w=httptest.NewRecorder();late.ServeHTTP(w,httptest.NewRequest("GET","/",nil));if w.Code!=503||strings.Contains(w.Body.String(),"ALLOW")||len(late.work)!=0{t.Fatal("late authority escaped")}
 cancelled,cancel:=context.WithCancel(context.Background());cancel();w=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest("GET","/",nil).WithContext(cancelled));if w.Code!=503||calls.Load()!=0{t.Fatal("cancelled request admitted")}
 server,e:=NewC074Server(":8443",h);if e!=nil||server.ReadTimeout!=2*time.Second||server.ReadHeaderTimeout!=time.Second||server.MaxHeaderBytes!=16<<10{t.Fatal("transport limits missing")}
 if _,e=NewC074HTTP(nil,c074FixtureAdmission{});e==nil{t.Fatal("nil backend accepted")}
 if _,e=NewC074Server("",h);e==nil{t.Fatal("invalid server accepted")}
 if _,e=OpenC074Production(context.Background(),nil,nil,func(*ProductionPublicationRuntime)http.Handler{return backend});e==nil{t.Fatal("unmanaged production accepted")}
}
func TestC074DistributedRateAndCapacity(t *testing.T){
 f:=c072Setup(t);ctx:=f.ctx;f.a.Durable.DB.SetMaxOpenConns(20);f.b.Durable.DB.SetMaxOpenConns(20)
 a:=C074RateStore{DB:f.a.Durable.DB,Scope:f.initial.Scope};b:=C074RateStore{DB:f.b.Durable.DB,Scope:f.initial.Scope}
 // Freeze only fixture window at the database, never caller-supplied time.
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_capacity SET started=clock_timestamp()+interval '1 hour',used=0");e!=nil{t.Fatal(e)}
 var success atomic.Int32;var wg sync.WaitGroup
 for i:=0;i<160;i++{wg.Add(1);go func(i int){defer wg.Done();s:=a;if i%2==0{s=b};if s.Admit(ctx,"work")==nil{success.Add(1)}}(i)};wg.Wait()
 if success.Load()>120{t.Fatal("distributed burst exceeded",success.Load())}
 var used int;if f.admin.QueryRowContext(ctx,"SELECT used FROM compliance_capacity WHERE scope=$1 AND lane='work'",f.initial.Scope).Scan(&used)!=nil||int32(used)!=success.Load(){t.Fatal("rate accounting",used,success.Load())}
 // Fill any remaining window budget; no deterministic failure is rerun.
 for used<120{if a.Admit(ctx,"work")!=nil{t.Fatal("serial rate budget unexpectedly unavailable")};used++}
 if b.Admit(ctx,"work")==nil||a.Admit(ctx,"attacker-selected-lane")==nil{t.Fatal("rate or cardinality bypass")}
 if b.Admit(ctx,"recovery")!=nil{t.Fatal("work flood consumed recovery budget")}
 forged:=a;forged.Scope=controlScope("production","delivery","ON");if forged.Admit(ctx,"work")==nil{t.Fatal("cross-tenant rate authority")}
 var rows int;if f.other.Durable.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_capacity WHERE scope=$1",f.initial.Scope).Scan(&rows)!=nil||rows!=0{t.Fatal("rate tenant leak")}
 if _,e:=f.a.Durable.DB.ExecContext(ctx,"INSERT INTO compliance_capacity(scope,lane) VALUES($1,'work')", "attacker");e==nil{t.Fatal("runtime created arbitrary counters")}
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_capacity SET started=clock_timestamp()-interval '2 seconds',used=120 WHERE scope=$1 AND lane='work'",f.initial.Scope);e!=nil{t.Fatal(e)}
 if a.Admit(ctx,"work")!=nil{t.Fatal("database-clock refill")}
 var releases []func()
 for i:=0;i<16;i++{s:=a;if i%2==0{s=b};release,e:=s.Acquire(ctx,"work");if e!=nil{t.Fatal("distributed slot",i,e)};releases=append(releases,release)}
 if _,e:=b.Acquire(ctx,"work");e==nil{t.Fatal("fleet capacity exceeded")}
 recovery,e:=b.Acquire(ctx,"recovery");if e!=nil{t.Fatal("distributed recovery unavailable",e)};recovery()
 for _,release:=range releases{release()};release,e:=b.Acquire(ctx,"work");if e!=nil{t.Fatal("released slot unavailable",e)};release()
 if _,e:=f.admin.ExecContext(ctx,"DELETE FROM compliance_capacity WHERE scope=$1",f.initial.Scope);e!=nil{t.Fatal(e)}
 if a.Admit(ctx,"work")==nil{t.Fatal("missing rate state admitted")}
 cancelled,cancel:=context.WithCancel(ctx);cancel();if a.Admit(cancelled,"work")==nil{t.Fatal("cancelled rate admitted")}
 t.Logf("distributed rate race: %d admissions, zero budget overshoot; 16 shared work slots and independent recovery reserve",success.Load())
}
func TestC074QueueBackpressureAndAtomicOutbox(t *testing.T){
 f:=c072Setup(t);s:=f.a.Durable;ctx:=f.ctx;due:=time.Now().UTC().Add(-time.Second)
 if e:=s.Enqueue(ctx,"existing","COLLECTION",map[string]string{"source":"fixture"},due,2);e!=nil{t.Fatal(e)}
 if _,e:=f.admin.ExecContext(ctx,`INSERT INTO compliance_durable_jobs(scope,id,kind,payload,fingerprint,state,max_attempts,scheduled_at,due_at)
 SELECT scope,'flood-'||n,kind,payload,fingerprint,state,max_attempts,scheduled_at,due_at FROM compliance_durable_jobs CROSS JOIN generate_series(1,1023) n WHERE id='existing'`);e!=nil{t.Fatal(e)}
 if s.Enqueue(ctx,"new-risk","COLLECTION",map[string]string{"source":"fixture"},due,2)==nil{t.Fatal("full queue admitted")}
 if s.Enqueue(ctx,"existing","COLLECTION",map[string]string{"source":"fixture"},due,2)!=nil{t.Fatal("full queue blocked idempotent recovery")}
 if s.Enqueue(ctx,"existing","COLLECTION",map[string]string{"source":"forged"},due,2)==nil{t.Fatal("full queue relaxed replay identity")}
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_durable_jobs SET state='COMPLETE' WHERE id LIKE 'flood-%'");e!=nil{t.Fatal(e)}
 leader,e:=s.AcquireLeader(ctx,"ACTIVATION","worker",time.Minute);if e!=nil{t.Fatal(e)}
 activation:=f.activation(t,f.initial,"capacity-event");if s.Enqueue(ctx,"activation","ACTIVATION",activation,activation.ScheduledAt,2)!=nil{t.Fatal("activation enqueue")}
 job,e:=s.Claim(ctx,leader,"ACTIVATION",time.Minute);if e!=nil{t.Fatal(e)}
 event:=c072JSON(activation.Event)
 if _,e:=f.admin.ExecContext(ctx,`INSERT INTO compliance_impact_outbox(scope,event_id,subscriber,sequence,event)
 SELECT $1,'backlog-'||n,'subscriber-'||n,1,$2::jsonb FROM generate_series(1,2048) n`,f.initial.Scope,string(event));e!=nil{t.Fatal(e)}
 if s.Activate(ctx,leader,job,activation,f.authority,f.control,f.public)==nil{t.Fatal("outbox overload activated")}
 current,e:=s.Load(ctx,f.initial.Scope);if e!=nil||current!=f.initial{t.Fatal("overload changed canonical policy")}
 var receipts int;if f.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_activations").Scan(&receipts)!=nil||receipts!=0{t.Fatal("partial overload receipt")}
 // Halt is valid even when the work queue and outbox cannot accept new risk.
 if s.Halt(ctx,f.scope,"operator")!=nil{t.Fatal("overload blocked halt")}
 if _,e=s.Load(ctx,f.initial.Scope);e==nil{t.Fatal("overload halt ignored")}
}
func TestC074BoundedSoak(t *testing.T){
 var calls atomic.Int32;h,_:=NewC074HTTP(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){calls.Add(1);w.Write([]byte(`{"outcome":"DENY"}`))}),c074FixtureAdmission{})
 start:=time.Now();var wg sync.WaitGroup;var passed,rejected atomic.Int32
 for i:=0;i<32;i++{wg.Add(1);go func(){defer wg.Done();for j:=0;j<1000;j++{w:=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest("GET","/api/v1/evaluate",nil));if w.Code==200{passed.Add(1)}else if w.Code==503{rejected.Add(1)}else{t.Errorf("unexpected result %d",w.Code)}}}()};wg.Wait()
 if passed.Load()+rejected.Load()!=32000||calls.Load()!=passed.Load()||len(h.work)!=0{t.Fatal("soak accounting or slot leak")}
 t.Logf("bounded synthetic soak: 32000 requests, 32 producers, %d admitted, %d rejected, %s; no production SLA claim",passed.Load(),rejected.Load(),time.Since(start))
}

func TestC074NetworkPostgreSQLSoak(t *testing.T){
 f:=c072Setup(t);f.a.Durable.DB.SetMaxOpenConns(20)
 var active,peak,calls atomic.Int32
 backend:=http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  n:=active.Add(1);defer active.Add(-1);calls.Add(1)
  for {old:=peak.Load();if old>=n||peak.CompareAndSwap(old,n){break}}
  select{case <-time.After(5*time.Millisecond):w.Write([]byte(`{"outcome":"DENY"}`));case <-r.Context().Done():return}
 })
 h,e:=NewC074HTTP(backend,C074RateStore{DB:f.a.Durable.DB,Scope:f.initial.Scope});if e!=nil{t.Fatal(e)}
 server:=httptest.NewUnstartedServer(h)
 limits,_:=NewC074Server(":0",h);server.Config.ReadTimeout=limits.ReadTimeout;server.Config.ReadHeaderTimeout=limits.ReadHeaderTimeout;server.Config.WriteTimeout=limits.WriteTimeout;server.Config.MaxHeaderBytes=limits.MaxHeaderBytes
 server.StartTLS();defer server.Close()
 client:=server.Client();client.Timeout=3*time.Second
 ctx,cancel:=context.WithTimeout(f.ctx,30*time.Second);defer cancel()
 var accepted,rejected atomic.Int32;var wg sync.WaitGroup;start:=time.Now()
 for i:=0;i<8;i++{wg.Add(1);go func(){defer wg.Done();for ctx.Err()==nil{
  request,_:=http.NewRequestWithContext(ctx,"GET",server.URL+"/api/v1/guidance",nil)
  response,err:=client.Do(request);if err!=nil{if ctx.Err()==nil{t.Errorf("soak transport failure: %v",err)};return}
  body,readErr:=io.ReadAll(response.Body);response.Body.Close()
  if readErr!=nil&&ctx.Err()==nil{t.Errorf("partial soak response: %v",readErr);return}
  if strings.Contains(string(body),"ALLOW"){t.Error("soak upgraded denial");return}
  switch response.StatusCode{case 200:accepted.Add(1);case 503:rejected.Add(1);default:t.Errorf("unexpected soak status %d",response.StatusCode);return}
  select{case <-time.After(10*time.Millisecond):case <-ctx.Done():return}
 }}()};wg.Wait();server.Close();client.CloseIdleConnections()
 if peak.Load()>16||accepted.Load()<1000||rejected.Load()==0||active.Load()!=0||len(h.work)!=0{t.Fatal("soak capacity/recovery exit",peak.Load(),accepted.Load(),rejected.Load(),active.Load())}
 var counters int;if f.admin.QueryRowContext(f.ctx,"SELECT count(*) FROM compliance_capacity WHERE scope=$1",f.initial.Scope).Scan(&counters)!=nil||counters!=2{t.Fatal("soak cardinality growth")}
 t.Logf("30-second TLS/PostgreSQL bounded soak: %d responses admitted, %d rejected, peak backend concurrency %d, backend calls %d, duration %s; production capacity acceptance remains C09.8",accepted.Load(),rejected.Load(),peak.Load(),calls.Load(),time.Since(start))
}

func TestC074ManagedProductionComposition(t *testing.T){
 db:=c072Setup(t);broker:=c073Setup(t);ctx:=db.ctx
 u,_:=url.Parse(os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN"));var name,role string
 if db.a.Durable.DB.QueryRowContext(ctx,"SELECT current_database(),current_user").Scan(&name,&role)!=nil{t.Fatal("fixture role")}
 u.Path="/"+name;u.User=url.UserPassword(role,"c072-disposable-fixture");broker.mu.Lock();broker.dsn=u.String();broker.mu.Unlock()
 var calls atomic.Int32
 production,e:=OpenC074Production(ctx,broker.client,db.authority,func(rt *ProductionPublicationRuntime)http.Handler{
  return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
   calls.Add(1);if _,err:=rt.Current(r.Context(),db.initial,time.Now());err!=nil{c051Fail(w,503);return};w.Write([]byte(`{"outcome":"DENY"}`))
  })
 });if e!=nil{t.Fatal("managed capacity composition",e)};defer production.Close()
 if production.capacity==production.Runtime.Durable.DB||production.capacity.Stats().MaxOpenConnections!=20||production.Runtime.Durable.DB.Stats().MaxOpenConnections!=16{t.Fatal("admission pool coupled to storage")}
 w:=httptest.NewRecorder();production.Handler.ServeHTTP(w,httptest.NewRequest("GET","/api/v1/guidance",nil));if w.Code!=200||calls.Load()!=1{t.Fatal("managed admission",w.Code)}
 broker.mu.Lock();broker.mode="outage";broker.mu.Unlock()
 w=httptest.NewRecorder();production.Handler.ServeHTTP(w,httptest.NewRequest("GET","/api/v1/guidance",nil));if w.Code!=503||calls.Load()!=1{t.Fatal("identity outage admitted")}
 broker.mu.Lock();broker.mode="";broker.mu.Unlock()
 w=httptest.NewRecorder();production.Handler.ServeHTTP(w,httptest.NewRequest("GET","/api/v1/guidance",nil));if w.Code!=200||calls.Load()!=2{t.Fatal("managed recovery",w.Code)}
}
