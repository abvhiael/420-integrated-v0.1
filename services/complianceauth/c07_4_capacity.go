package complianceauth

import (
 "bytes"
 "context"
 "database/sql"
 "errors"
 "io"
 "net/http"
 "time"
)

var ErrC074Overload = errors.New("compliance capacity unavailable")

// Fixed scope/lane counters avoid attacker-selected identity cardinality. Scope
// comes from the restricted database role, never a request or forwarded header.
const c074CapacitySQL = `
CREATE TABLE public.compliance_capacity (
 scope TEXT NOT NULL, lane TEXT NOT NULL CHECK(lane IN ('work','recovery')),
 started TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 used INTEGER NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 120),
 PRIMARY KEY(scope,lane)
);
ALTER TABLE public.compliance_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_capacity FORCE ROW LEVEL SECURITY;
CREATE POLICY c074_bound_scope ON public.compliance_capacity
 USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=scope))
 WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=scope));
REVOKE ALL ON public.compliance_capacity FROM PUBLIC;
CREATE FUNCTION public.c074_queue_capacity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE count_rows BIGINT; size_bytes BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.scope,420074));
 IF TG_TABLE_NAME='compliance_durable_jobs' THEN
  IF EXISTS(SELECT 1 FROM public.compliance_durable_jobs WHERE scope=NEW.scope AND id=NEW.id) THEN RETURN NEW; END IF;
  SELECT count(*),coalesce(sum(octet_length(payload::text)),0) INTO count_rows,size_bytes
   FROM public.compliance_durable_jobs WHERE scope=NEW.scope AND state IN ('QUEUED','LEASED');
  IF count_rows>=1024 OR size_bytes+octet_length(NEW.payload::text)>16777216 THEN RAISE EXCEPTION 'compliance work backlog full'; END IF;
 ELSE
  SELECT count(*) INTO count_rows FROM public.compliance_impact_outbox WHERE scope=NEW.scope AND NOT acknowledged;
  IF count_rows>=2048 THEN RAISE EXCEPTION 'compliance impact backlog full'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.c074_queue_capacity() FROM PUBLIC;
CREATE TRIGGER c074_job_capacity BEFORE INSERT ON public.compliance_durable_jobs FOR EACH ROW EXECUTE FUNCTION public.c074_queue_capacity();
CREATE TRIGGER c074_impact_capacity BEFORE INSERT ON public.compliance_impact_outbox FOR EACH ROW EXECUTE FUNCTION public.c074_queue_capacity();
`

// Admission is atomic across instances and uses PostgreSQL's clock. A database
// outage or contention never falls back to a positive local admission decision.
type C074RateStore struct { DB *sql.DB; Scope string; Identity C072ServiceIdentity }
func(s C074RateStore) Admit(ctx context.Context,lane string)error {
 if ctx==nil||ctx.Err()!=nil||s.DB==nil||!c051Scope(s.Scope)||(lane!="work"&&lane!="recovery"){return ErrC074Overload}
 bounded,cancel:=context.WithTimeout(ctx,250*time.Millisecond);defer cancel()
 if s.Identity!=nil&&s.Identity.VerifyServiceIdentity(bounded)!=nil{return ErrC074Overload}
 tx,e:=s.DB.BeginTx(bounded,nil);if e!=nil{return ErrC074Overload};defer tx.Rollback()
 var primary bool
 if tx.QueryRowContext(bounded,"SELECT NOT pg_is_in_recovery()").Scan(&primary)!=nil||!primary{return ErrC074Overload}
 limit:=120;if lane=="recovery"{limit=30}
 var used int
 e=tx.QueryRowContext(bounded,`UPDATE public.compliance_capacity SET
 used=CASE WHEN started+interval '1 second'<=clock_timestamp() THEN 1 ELSE used+1 END,
 started=CASE WHEN started+interval '1 second'<=clock_timestamp() THEN clock_timestamp() ELSE started END
 WHERE scope=$1 AND lane=$2 AND (started+interval '1 second'<=clock_timestamp() OR used<$3)
 RETURNING used`,s.Scope,lane,limit).Scan(&used)
 if e!=nil||bounded.Err()!=nil||tx.Commit()!=nil{return ErrC074Overload};return nil
}
func(s C074RateStore)Acquire(ctx context.Context,lane string)(func(),error){
 if s.Admit(ctx,lane)!=nil{return nil,ErrC074Overload}
 tx,e:=s.DB.BeginTx(ctx,nil);if e!=nil{return nil,ErrC074Overload}
 count:=16;if lane=="recovery"{count=2}
 for slot:=0;slot<count;slot++{
  var held bool
  if tx.QueryRowContext(ctx,"SELECT pg_try_advisory_xact_lock(hashtextextended($1,$2))",s.Scope+"/capacity/"+lane,420074+slot).Scan(&held)!=nil{tx.Rollback();return nil,ErrC074Overload}
  if held{return func(){_ =tx.Rollback()},nil}
 }
 tx.Rollback();return nil,ErrC074Overload
}
type C074Admission interface { Acquire(context.Context,string)(func(),error) }

// No goroutine-per-rejected-request or local waiting queue. The recovery reserve
// admits only canonical halt/logout paths; their original authorization remains.
type C074HTTP struct {
 next http.Handler
 admission C074Admission
 work,recovery chan struct{}
}
func NewC074HTTP(next http.Handler,admission C074Admission)(*C074HTTP,error){
 if next==nil||admission==nil{return nil,ErrC074Overload}
 return &C074HTTP{next:next,admission:admission,work:make(chan struct{},16),recovery:make(chan struct{},2)},nil
}
func c074Recovery(r *http.Request)bool {
 return r.Method==http.MethodPost&&(r.URL.Path=="/api/v1/operator/halt"||r.URL.Path=="/api/v1/review/logout"||r.URL.Path=="/api/v1/author/logout")
}
type c074Buffer struct { header http.Header; body bytes.Buffer; status int; failed bool }
func(b *c074Buffer)Header()http.Header{return b.header}
func(b *c074Buffer)WriteHeader(code int){if b.status==0{b.status=code}}
func(b *c074Buffer)Write(data []byte)(int,error){
 if b.failed||b.body.Len()+len(data)>2*C071MaxPrivateBytes{b.failed=true;return 0,ErrC074Overload}
 if b.status==0{b.status=http.StatusOK};return b.body.Write(data)
}
func(h *C074HTTP)ServeHTTP(w http.ResponseWriter,r *http.Request){
 fail:=func(){w.Header().Set("Retry-After","1");c051Fail(w,http.StatusServiceUnavailable)}
 if h==nil||h.next==nil||h.admission==nil||r==nil||r.Context().Err()!=nil{fail();return}
 lane,slots:="work",h.work;if c074Recovery(r){lane,slots="recovery",h.recovery}
 select{case slots<-struct{}{}:defer func(){<-slots}();default:fail();return}
 ctx,cancel:=context.WithTimeout(r.Context(),2*time.Second);defer cancel()
 release,e:=h.admission.Acquire(ctx,lane)
 if e!=nil||release==nil{fail();return};defer release()
 if ctx.Err()!=nil{fail();return}
 if r.ContentLength>C071MaxPrivateBytes{c051Fail(w,http.StatusRequestEntityTooLarge);return}
 // Bound chunked bodies too, before expensive authentication/source work.
 if r.Body!=nil {
  data,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,C071MaxPrivateBytes))
  if e!=nil{c051Fail(w,http.StatusRequestEntityTooLarge);return}
  r=r.Clone(ctx);r.Body=io.NopCloser(bytes.NewReader(data))
 }else{r=r.Clone(ctx)}
 output:=&c074Buffer{header:make(http.Header)}
 h.next.ServeHTTP(output,r)
 // Buffering prevents a late ALLOW or partial private export from escaping.
 if ctx.Err()!=nil||output.failed{fail();return}
 for key,values:=range output.header{w.Header()[key]=append([]string(nil),values...)}
 status:=output.status;if status==0{status=http.StatusOK};w.WriteHeader(status);_,_=w.Write(output.body.Bytes())
}

// Server transport deadlines also bound slow body/header senders. Context
// deadlines alone do not interrupt a network body's blocked Read.
func NewC074Server(address string,h *C074HTTP)(*http.Server,error){
 if address==""||h==nil{return nil,ErrC074Overload}
 return &http.Server{Addr:address,Handler:h,ReadHeaderTimeout:time.Second,ReadTimeout:2*time.Second,WriteTimeout:3*time.Second,IdleTimeout:15*time.Second,MaxHeaderBytes:16<<10},nil
}

// Admission uses a separate bounded pool: holding an admission lease must never
// consume the last connection needed by the admitted request's storage work.
type C074Production struct {
 Runtime *ProductionPublicationRuntime
 Handler *C074HTTP
 capacity *sql.DB
}
func OpenC074Production(ctx context.Context,p *C073Client,authority IndependentPublicationAuthority,build func(*ProductionPublicationRuntime)http.Handler)(*C074Production,error){
 if build==nil{return nil,ErrC074Overload}
 rt,_,e:=OpenC073ProductionRuntime(ctx,p,authority);if e!=nil{return nil,ErrC074Overload}
 credentials,e:=p.read(ctx,"database-credential");if e!=nil{rt.Close();return nil,ErrC074Overload}
 store,e:=OpenPostgreSQLPublicationStore(credentials.DatabaseDSN);if e!=nil{rt.Close();return nil,ErrC074Overload}
 store.DB.SetMaxOpenConns(20);store.DB.SetMaxIdleConns(2)
 probe,cancel:=context.WithTimeout(ctx,time.Second);defer cancel()
 var rows int
 if c071RuntimeBinding(probe,store.DB,p.config.Scope,rt.Durable.PublicationScope)!=nil||store.DB.QueryRowContext(probe,"SELECT count(*) FROM public.compliance_capacity WHERE scope=$1",rt.Durable.PublicationScope).Scan(&rows)!=nil||rows!=2{store.DB.Close();rt.Close();return nil,ErrC074Overload}
 h,e:=NewC074HTTP(build(rt),C074RateStore{DB:store.DB,Scope:rt.Durable.PublicationScope,Identity:p})
 if e!=nil{store.DB.Close();rt.Close();return nil,e}
 return &C074Production{Runtime:rt,Handler:h,capacity:store.DB},nil
}
func(p *C074Production)Close()error {
 if p==nil{return nil};var a,b error;if p.capacity!=nil{a=p.capacity.Close()};if p.Runtime!=nil{b=p.Runtime.Close()};return errors.Join(a,b)
}

// Queue admission serializes by scope before counting. Full queues preserve
// idempotent recovery of existing jobs and cannot create new risk.
func c074Queue(ctx context.Context,tx *sql.Tx,scope,id string,bytes int)error {
 if _,e:=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(hashtextextended($1,420074))",scope);e!=nil{return ErrC074Overload}
 var exists bool
 if tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM public.compliance_durable_jobs WHERE scope=$1 AND id=$2)",scope,id).Scan(&exists)!=nil{return ErrC074Overload}
 if exists{return nil}
 var count int;var size int64
 if tx.QueryRowContext(ctx,"SELECT count(*),coalesce(sum(octet_length(payload::text)),0) FROM public.compliance_durable_jobs WHERE scope=$1 AND state IN ('QUEUED','LEASED')",scope).Scan(&count,&size)!=nil||count>=1024||bytes<1||size+int64(bytes)>16<<20{return ErrC074Overload};return nil
}
