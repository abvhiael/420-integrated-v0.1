package complianceauth

import (
 "context"
 "crypto/ed25519"
 "database/sql"
 "encoding/json"
 "errors"
 "time"
)

const c072DurableSQL = `
CREATE TABLE public.compliance_job_leaders (
 scope TEXT NOT NULL, name TEXT NOT NULL CHECK(char_length(name) BETWEEN 1 AND 128), owner TEXT NOT NULL,
 token BIGINT NOT NULL CHECK(token>0), expires_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(scope,name)
);
CREATE TABLE public.compliance_durable_jobs (
 scope TEXT NOT NULL, id TEXT NOT NULL CHECK(char_length(id) BETWEEN 1 AND 128), kind TEXT NOT NULL CHECK(kind IN ('COLLECTION','ACTIVATION')),
 payload JSONB NOT NULL CHECK(payload ? 'v' AND payload ? 'kid' AND payload ? 'nonce' AND payload ? 'ciphertext' AND payload->>'v'='1' AND octet_length(payload::text)<=262144), fingerprint TEXT NOT NULL CHECK(char_length(fingerprint)=64),
 state TEXT NOT NULL CHECK(state IN ('QUEUED','LEASED','COMPLETE','DEAD')), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
 max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 100), scheduled_at TIMESTAMPTZ NOT NULL, due_at TIMESTAMPTZ NOT NULL,
 owner TEXT NOT NULL DEFAULT '', token BIGINT NOT NULL DEFAULT 0 CHECK(token>=0), lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
 PRIMARY KEY(scope,id)
);
CREATE TABLE public.compliance_durable_halts (
 scope TEXT PRIMARY KEY, halted BOOLEAN NOT NULL DEFAULT TRUE CHECK(halted), actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.compliance_activations (
 scope TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL CHECK(char_length(fingerprint)=64),
 sequence BIGINT NOT NULL CHECK(sequence>0), created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(scope,id), UNIQUE(scope,sequence)
);
CREATE TABLE public.compliance_impact_outbox (
 scope TEXT NOT NULL, event_id TEXT NOT NULL, subscriber TEXT NOT NULL, sequence BIGINT NOT NULL CHECK(sequence>0),
 event JSONB NOT NULL CHECK(octet_length(event::text)<=16384), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
 acknowledged BOOLEAN NOT NULL DEFAULT FALSE, dead_letter BOOLEAN NOT NULL DEFAULT FALSE,
 due_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), owner TEXT NOT NULL DEFAULT '', token BIGINT NOT NULL DEFAULT 0,
 lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity', PRIMARY KEY(scope,event_id,subscriber), UNIQUE(scope,sequence,subscriber)
);
CREATE INDEX c072_jobs_due ON public.compliance_durable_jobs(scope,kind,state,due_at,id);
CREATE INDEX c072_outbox_order ON public.compliance_impact_outbox(scope,subscriber,sequence) WHERE NOT acknowledged;
CREATE FUNCTION public.c072_bound_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b public.compliance_database_bindings; delta BIGINT;
BEGIN
 IF char_length(NEW.scope)>256 OR octet_length(to_jsonb(NEW)::text)>262144 THEN RAISE EXCEPTION 'durable row bound'; END IF;
 SELECT * INTO b FROM public.compliance_database_bindings WHERE publication_scope=NEW.scope LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'unbound durable scope'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.scope<>OLD.scope THEN RAISE EXCEPTION 'immutable scope'; END IF;
  IF TG_TABLE_NAME='compliance_durable_jobs' THEN IF (NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW.payload<>OLD.payload OR NEW.fingerprint<>OLD.fingerprint OR NEW.max_attempts<>OLD.max_attempts OR NEW.scheduled_at<>OLD.scheduled_at) THEN RAISE EXCEPTION 'immutable job'; END IF; END IF;
  IF TG_TABLE_NAME='compliance_impact_outbox' THEN IF (NEW.event_id<>OLD.event_id OR NEW.subscriber<>OLD.subscriber OR NEW.sequence<>OLD.sequence OR NEW.event<>OLD.event) THEN RAISE EXCEPTION 'immutable impact'; END IF; END IF;
  delta:=octet_length(to_jsonb(NEW)::text)-octet_length(to_jsonb(OLD)::text);
  UPDATE public.compliance_storage_usage SET stored_bytes=stored_bytes+delta WHERE tenant=b.tenant AND domain=b.domain AND jurisdiction=b.jurisdiction;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing storage accounting'; END IF;
 ELSE
  INSERT INTO public.compliance_storage_usage AS u(tenant,domain,jurisdiction,stored_bytes,stored_rows)
  VALUES(b.tenant,b.domain,b.jurisdiction,octet_length(to_jsonb(NEW)::text),1)
  ON CONFLICT(tenant,domain,jurisdiction) DO UPDATE SET stored_bytes=u.stored_bytes+EXCLUDED.stored_bytes,stored_rows=u.stored_rows+1;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.c072_bound_row() FROM PUBLIC;
ALTER TABLE public.compliance_job_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_job_leaders FORCE ROW LEVEL SECURITY;
CREATE POLICY c072_bound_scope ON public.compliance_job_leaders USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_job_leaders.scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_job_leaders.scope));
CREATE TRIGGER c072_quota AFTER INSERT OR UPDATE ON public.compliance_job_leaders FOR EACH ROW EXECUTE FUNCTION public.c072_bound_row();
ALTER TABLE public.compliance_durable_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_durable_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY c072_bound_scope ON public.compliance_durable_jobs USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_durable_jobs.scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_durable_jobs.scope));
CREATE TRIGGER c072_quota AFTER INSERT OR UPDATE ON public.compliance_durable_jobs FOR EACH ROW EXECUTE FUNCTION public.c072_bound_row();
ALTER TABLE public.compliance_durable_halts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_durable_halts FORCE ROW LEVEL SECURITY;
CREATE POLICY c072_bound_scope ON public.compliance_durable_halts USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_durable_halts.scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_durable_halts.scope));
CREATE TRIGGER c072_quota AFTER INSERT OR UPDATE ON public.compliance_durable_halts FOR EACH ROW EXECUTE FUNCTION public.c072_bound_row();
ALTER TABLE public.compliance_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_activations FORCE ROW LEVEL SECURITY;
CREATE POLICY c072_bound_scope ON public.compliance_activations USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_activations.scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_activations.scope));
CREATE TRIGGER c072_quota AFTER INSERT OR UPDATE ON public.compliance_activations FOR EACH ROW EXECUTE FUNCTION public.c072_bound_row();
ALTER TABLE public.compliance_impact_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_impact_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY c072_bound_scope ON public.compliance_impact_outbox USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_impact_outbox.scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=compliance_impact_outbox.scope));
CREATE TRIGGER c072_quota AFTER INSERT OR UPDATE ON public.compliance_impact_outbox FOR EACH ROW EXECUTE FUNCTION public.c072_bound_row();
`

var ErrC072Unavailable = errors.New("compliance durable work unavailable")
type C072ServiceIdentity interface{VerifyServiceIdentity(context.Context)error}
type C072Store struct { Identity C072ServiceIdentity; DB *sql.DB; Cipher *C071Cipher; Scope C064AuthorScope; PublicationScope string }
type C072Leader struct { Name, Owner string; Token uint64 }
type C072Job struct { ID, Kind, Owner string; Token uint64; Attempts int; Payload json.RawMessage }
type C072Activation struct { Before, After PublicationFence; Signed SignedManifest; ScheduledAt time.Time; Event ComplianceImpactEvent; Subscribers []string }
func c072Duration(d time.Duration)bool{return d>=time.Second && d<=5*time.Minute}
func(s *C072Store)ready(ctx context.Context)bool{return s!=nil&&s.DB!=nil&&ctx!=nil&&ctx.Err()==nil&&c051Scope(s.PublicationScope)&&(s.Identity==nil||s.Identity.VerifyServiceIdentity(ctx)==nil)}
func(s *C072Store)begin(ctx context.Context)(*sql.Tx,error){
 if !s.ready(ctx){return nil,ErrC072Unavailable};tx,e:=s.DB.BeginTx(ctx,nil);if e!=nil{return nil,ErrC072Unavailable}
 var primary bool;if tx.QueryRowContext(ctx,"SELECT NOT pg_is_in_recovery()").Scan(&primary)!=nil||!primary{tx.Rollback();return nil,ErrC072Unavailable};return tx,nil
}
func(s *C072Store)AcquireLeader(ctx context.Context,name,owner string,d time.Duration)(C072Leader,error){
 if !c051Scope(name)||!c051Scope(owner)||!c072Duration(d){return C072Leader{},ErrC072Unavailable}
 tx,e:=s.begin(ctx);if e!=nil{return C072Leader{},e};defer tx.Rollback();l:=C072Leader{Name:name,Owner:owner}
 e=tx.QueryRowContext(ctx,
 "INSERT INTO public.compliance_job_leaders AS l(scope,name,owner,token,expires_at) VALUES($1,$2,$3,1,clock_timestamp()+$4*interval '1 millisecond') ON CONFLICT(scope,name) DO UPDATE SET owner=EXCLUDED.owner,token=l.token+1,expires_at=EXCLUDED.expires_at WHERE l.expires_at<=clock_timestamp() AND l.token<9223372036854775807 RETURNING token",s.PublicationScope,name,owner,d.Milliseconds()).Scan(&l.Token)
 if e!=nil||tx.Commit()!=nil{return C072Leader{},ErrC072Unavailable};return l,nil
}
func(s *C072Store)leader(ctx context.Context,tx *sql.Tx,l C072Leader)error{
 if !c051Scope(l.Name)||!c051Scope(l.Owner)||l.Token==0||l.Token>9223372036854775807{return ErrC072Unavailable}
 var n uint64;e:=tx.QueryRowContext(ctx,"SELECT token FROM public.compliance_job_leaders WHERE scope=$1 AND name=$2 AND owner=$3 AND token=$4 AND expires_at>clock_timestamp() FOR UPDATE",s.PublicationScope,l.Name,l.Owner,l.Token).Scan(&n)
 if e!=nil{return ErrC072Unavailable};return nil
}
func(s *C072Store)RenewLeader(ctx context.Context,l C072Leader,d time.Duration)error{
 if !s.ready(ctx)||!c072Duration(d){return ErrC072Unavailable};tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback();if s.leader(ctx,tx,l)!=nil{return ErrC072Unavailable}
 r,e:=tx.ExecContext(ctx,"UPDATE public.compliance_job_leaders SET expires_at=clock_timestamp()+$1*interval '1 millisecond' WHERE scope=$2 AND name=$3 AND owner=$4 AND token=$5 AND expires_at>clock_timestamp()",d.Milliseconds(),s.PublicationScope,l.Name,l.Owner,l.Token);if e!=nil{return ErrC072Unavailable};n,_:=r.RowsAffected();if n!=1||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
// Payloads are encrypted and immutable by API. Enqueue never activates a policy.
func(s *C072Store)Enqueue(ctx context.Context,id,kind string,payload any,due time.Time,max int)error{
 if !s.ready(ctx)||s.Cipher==nil||!c051Scope(id)||(kind!="COLLECTION"&&kind!="ACTIVATION")||due.IsZero()||max<1||max>100{return ErrC072Unavailable}
 due=due.UTC().Truncate(time.Microsecond) // Canonical PostgreSQL schedule precision; preserves durable replay identity.
 plain,e:=json.Marshal(payload);if e!=nil||len(plain)>C071MaxPrivateBytes{return ErrC072Unavailable};raw,e:=s.Cipher.sealContext(ctx,plain,c071AAD("job/"+kind,s.Scope,id,0));if e!=nil{return ErrC072Unavailable}
 tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback()
 _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_durable_jobs(scope,id,kind,payload,fingerprint,state,max_attempts,scheduled_at,due_at) VALUES($1,$2,$3,$4,$5,'QUEUED',$6,$7,$7) ON CONFLICT(scope,id) DO NOTHING",s.PublicationScope,id,kind,string(raw),Digest(plain),max,due);if e!=nil{return ErrC072Unavailable}
 var fp,k string;var m int;var scheduled time.Time
 e=tx.QueryRowContext(ctx,"SELECT fingerprint,kind,max_attempts,scheduled_at FROM public.compliance_durable_jobs WHERE scope=$1 AND id=$2",s.PublicationScope,id).Scan(&fp,&k,&m,&scheduled)
 if e!=nil||fp!=Digest(plain)||k!=kind||m!=max||!scheduled.Equal(due)||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
func(s *C072Store)Claim(ctx context.Context,l C072Leader,kind string,d time.Duration)(C072Job,error){
 if !c072Duration(d)||l.Name!=kind||s==nil||s.Cipher==nil{return C072Job{},ErrC072Unavailable}
 tx,e:=s.begin(ctx);if e!=nil{return C072Job{},e};defer tx.Rollback();if s.leader(ctx,tx,l)!=nil{return C072Job{},ErrC072Unavailable}
 _,e=tx.ExecContext(ctx,"UPDATE public.compliance_durable_jobs SET state='DEAD' WHERE scope=$1 AND kind=$2 AND state='LEASED' AND lease_until<=clock_timestamp() AND attempts>=max_attempts",s.PublicationScope,kind);if e!=nil{return C072Job{},ErrC072Unavailable}
 j:=C072Job{Kind:kind,Owner:l.Owner};var raw []byte;var fp string
 e=tx.QueryRowContext(ctx,
 "WITH candidate AS (SELECT id FROM public.compliance_durable_jobs WHERE scope=$1 AND kind=$2 AND attempts<max_attempts AND token<9223372036854775807 AND due_at<=clock_timestamp() AND (state='QUEUED' OR (state='LEASED' AND lease_until<=clock_timestamp())) ORDER BY due_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE public.compliance_durable_jobs j SET state='LEASED',owner=$3,token=j.token+1,attempts=j.attempts+1,lease_until=clock_timestamp()+$4*interval '1 millisecond' FROM candidate c WHERE j.scope=$1 AND j.id=c.id RETURNING j.id,j.token,j.attempts,j.payload,j.fingerprint",s.PublicationScope,kind,l.Owner,d.Milliseconds()).Scan(&j.ID,&j.Token,&j.Attempts,&raw,&fp)
 if e!=nil{return C072Job{},ErrC072Unavailable};plain,e:=s.Cipher.openContext(ctx,raw,c071AAD("job/"+kind,s.Scope,j.ID,0));if e!=nil||Digest(plain)!=fp||tx.Commit()!=nil{return C072Job{},ErrC072Unavailable};j.Payload=plain;return j,nil
}
func(s *C072Store)job(ctx context.Context,tx *sql.Tx,l C072Leader,j C072Job)error{
 if l.Name!=j.Kind||l.Owner!=j.Owner||!c051Scope(j.ID)||j.Token==0||j.Token>9223372036854775807||s.leader(ctx,tx,l)!=nil{return ErrC072Unavailable}
 var fp string;e:=tx.QueryRowContext(ctx,"SELECT fingerprint FROM public.compliance_durable_jobs WHERE scope=$1 AND id=$2 AND kind=$3 AND state='LEASED' AND owner=$4 AND token=$5 AND attempts=$6 AND lease_until>clock_timestamp() FOR UPDATE",s.PublicationScope,j.ID,j.Kind,j.Owner,j.Token,j.Attempts).Scan(&fp)
 if e!=nil||fp!=Digest(j.Payload){return ErrC072Unavailable};return nil
}
func(s *C072Store)RenewJob(ctx context.Context,l C072Leader,j C072Job,d time.Duration)error{
 if !c072Duration(d){return ErrC072Unavailable};tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback();if s.job(ctx,tx,l,j)!=nil{return ErrC072Unavailable}
 _,e=tx.ExecContext(ctx,"UPDATE public.compliance_durable_jobs SET lease_until=clock_timestamp()+$1*interval '1 millisecond' WHERE scope=$2 AND id=$3",d.Milliseconds(),s.PublicationScope,j.ID);if e!=nil||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
func(s *C072Store)FinishJob(ctx context.Context,l C072Leader,j C072Job,success bool)error{
 if success&&j.Kind=="ACTIVATION"{return ErrC072Unavailable} // Activation completes only inside its publication transaction.
 tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback();if s.job(ctx,tx,l,j)!=nil{return ErrC072Unavailable}
 state:="COMPLETE";if !success{state="QUEUED"}
 _,e=tx.ExecContext(ctx,"UPDATE public.compliance_durable_jobs SET state=CASE WHEN $1='QUEUED' AND attempts>=max_attempts THEN 'DEAD' ELSE $1 END,due_at=clock_timestamp()+LEAST(1024,power(2,attempts))::int*interval '1 second',owner='',lease_until='-infinity' WHERE scope=$2 AND id=$3",state,s.PublicationScope,j.ID)
 if e!=nil||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
// Current re-reads primary halt state in the same statement as the fence.
func(s *C072Store)Load(ctx context.Context,scope string)(PublicationFence,error){
 if !s.ready(ctx)||scope!=s.PublicationScope{return PublicationFence{},ErrPublicationStale};var p PublicationFence
 e:=s.DB.QueryRowContext(ctx,"SELECT f.scope,f.sequence,f.revocation_epoch,f.policy_digest,f.dependency_digest,f.expires_at FROM public.compliance_publication_fences f WHERE f.scope=$1 AND NOT pg_is_in_recovery() AND NOT EXISTS(SELECT 1 FROM public.compliance_durable_halts h WHERE h.scope=f.scope)",scope).Scan(&p.Scope,&p.Sequence,&p.RevocationEpoch,&p.PolicyDigest,&p.DependencyDigest,&p.ExpiresAt)
 if e!=nil{return PublicationFence{},ErrPublicationStale};return p,nil
}
// Emergency halt locks the canonical fence, serializing with activation. No unhalt API exists.
func(s *C072Store)Halt(ctx context.Context,scope C064AuthorScope,actor string)error{
 if s==nil||scope!=s.Scope||!c051Scope(actor){return ErrC072Unavailable};tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback();var id string
 if tx.QueryRowContext(ctx,"SELECT scope FROM public.compliance_publication_fences WHERE scope=$1 FOR UPDATE",s.PublicationScope).Scan(&id)!=nil{return ErrC072Unavailable}
 _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_durable_halts(scope,actor) VALUES($1,$2) ON CONFLICT(scope) DO NOTHING",s.PublicationScope,actor)
 if e!=nil||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
// Activate requires both managed manifest validation and independent review approval
// on every attempt, including idempotent recovery after an unknown commit outcome.
func(s *C072Store)Activate(ctx context.Context,l C072Leader,j C072Job,a C072Activation,authority IndependentPublicationAuthority,control *PublicationControl,pub ed25519.PublicKey)error{
 if !s.ready(ctx)||j.Kind!="ACTIVATION"||authority==nil||control==nil||!VerifyComplianceImpact(a.Event,pub)||len(a.Subscribers)<1||len(a.Subscribers)>256{return ErrC072Unavailable}
 now:=time.Now().UTC();old,next:=a.Before,a.After;m:=a.Signed.Manifest
 if old.Scope!=s.PublicationScope||next.Scope!=old.Scope||!ValidPublicationFence(old,now)||!ValidPublicationFence(next,now)||next.Sequence<=old.Sequence||next.RevocationEpoch<old.RevocationEpoch||next.Sequence>9223372036854775807||next.RevocationEpoch>9223372036854775807||a.ScheduledAt.IsZero()||a.ScheduledAt.After(now)||
 m.Environment!="production"||m.Domain!=s.Scope.Domain||m.Jurisdiction!=s.Scope.Jurisdiction||old.Scope!=controlScope(m.Environment,m.Domain,m.Jurisdiction)||m.Sequence!=next.Sequence||m.PolicyDigest!=next.PolicyDigest||m.RevocationEpoch!=next.RevocationEpoch||next.ExpiresAt.After(m.EffectiveUntil)||next.ExpiresAt.After(m.ReviewExpiresAt)||control.VerifyScheduledManifest(a.Signed,now)!=nil||
 a.Event.Scope!=next.Scope||a.Event.Sequence!=next.Sequence||a.Event.PolicyDigest!=next.PolicyDigest||a.Event.RevocationEpoch!=next.RevocationEpoch||a.Event.IssuedAt.After(now)||authority.VerifyPublication(ctx,old,next)!=nil{return ErrC072Unavailable}
 seen:=map[string]bool{};for _,v:=range a.Subscribers{if !c051Scope(v)||seen[v]{return ErrC072Unavailable};seen[v]=true}
 payload,e:=json.Marshal(a);if e!=nil||Digest(payload)!=Digest(j.Payload){return ErrC072Unavailable};fp:=Digest(payload)
 tx,e:=s.begin(ctx);if e!=nil{return e};defer tx.Rollback()
 // Same lock order for halt and activation. Halt linearizes before or after commit.
 var current PublicationFence
 e=tx.QueryRowContext(ctx,"SELECT scope,sequence,revocation_epoch,policy_digest,dependency_digest,expires_at FROM public.compliance_publication_fences WHERE scope=$1 FOR UPDATE",old.Scope).Scan(&current.Scope,&current.Sequence,&current.RevocationEpoch,&current.PolicyDigest,&current.DependencyDigest,&current.ExpiresAt);if e!=nil{return ErrC072Unavailable}
 var halted bool;if tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM public.compliance_durable_halts WHERE scope=$1)",old.Scope).Scan(&halted)!=nil||halted{return ErrC072Unavailable}
 var saved string;e=tx.QueryRowContext(ctx,"SELECT fingerprint FROM public.compliance_activations WHERE scope=$1 AND id=$2",old.Scope,j.ID).Scan(&saved)
 if e==nil{if saved!=fp||s.leader(ctx,tx,l)!=nil||tx.Commit()!=nil{return ErrC072Unavailable};return nil};if e!=sql.ErrNoRows||current!=old||s.job(ctx,tx,l,j)!=nil{return ErrC072Unavailable}
 // Recheck external authority after locks; storage expiry is always database-clock enforced.
 if authority.VerifyPublication(ctx,old,next)!=nil||control.VerifyScheduledManifest(a.Signed,time.Now().UTC())!=nil{return ErrC072Unavailable}
 r,e:=tx.ExecContext(ctx,"UPDATE public.compliance_publication_fences SET sequence=$1,revocation_epoch=$2,policy_digest=$3,dependency_digest=$4,expires_at=$5 WHERE scope=$6 AND expires_at>clock_timestamp() AND $5>clock_timestamp()",next.Sequence,next.RevocationEpoch,next.PolicyDigest,next.DependencyDigest,next.ExpiresAt,next.Scope);if e!=nil{return ErrC072Unavailable};n,_:=r.RowsAffected();if n!=1{return ErrC072Unavailable}
 _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_activations(scope,id,fingerprint,sequence) VALUES($1,$2,$3,$4)",next.Scope,j.ID,fp,next.Sequence);if e!=nil{return ErrC072Unavailable}
 event,_:=json.Marshal(a.Event);for _,sub:=range a.Subscribers{if _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_impact_outbox(scope,event_id,subscriber,sequence,event) VALUES($1,$2,$3,$4,$5)",next.Scope,a.Event.EventID,sub,next.Sequence,string(event));e!=nil{return ErrC072Unavailable}}
 // Revalidate leases at final mutation: a paused worker cannot commit after expiry.
 r,e=tx.ExecContext(ctx,"UPDATE public.compliance_durable_jobs SET state='COMPLETE',owner='',lease_until='-infinity' WHERE scope=$1 AND id=$2 AND token=$3 AND owner=$4 AND state='LEASED' AND lease_until>clock_timestamp() AND EXISTS(SELECT 1 FROM public.compliance_job_leaders WHERE scope=$1 AND name=$5 AND owner=$4 AND token=$6 AND expires_at>clock_timestamp())",next.Scope,j.ID,j.Token,j.Owner,l.Name,l.Token)
 if e!=nil{return ErrC072Unavailable};n,_=r.RowsAffected();if n!=1||ctx.Err()!=nil||tx.Commit()!=nil{return ErrC072Unavailable};return nil
}
// Standalone publishing is deliberately unavailable: only Activate may add fan-out.
type C072Outbox struct { Store *C072Store; Owner string }
func(o C072Outbox)PublishImpact(context.Context,ComplianceImpactEvent,[]string)error{return ErrImpactUnavailable}
func(o C072Outbox)LeaseImpact(ctx context.Context,_ time.Time)(ComplianceOutboxItem,error){
 if o.Store==nil||!c051Scope(o.Owner){return ComplianceOutboxItem{},ErrImpactUnavailable};s:=o.Store;tx,e:=s.begin(ctx);if e!=nil{return ComplianceOutboxItem{},ErrImpactUnavailable};defer tx.Rollback()
 _,e=tx.ExecContext(ctx,"UPDATE public.compliance_impact_outbox SET dead_letter=TRUE WHERE scope=$1 AND attempts>=10 AND NOT acknowledged AND lease_until<=clock_timestamp()",s.PublicationScope);if e!=nil{return ComplianceOutboxItem{},ErrImpactUnavailable}
 var item ComplianceOutboxItem;var raw []byte;var attempts int
 e=tx.QueryRowContext(ctx,"WITH candidate AS (SELECT event_id,subscriber FROM public.compliance_impact_outbox o WHERE scope=$1 AND NOT acknowledged AND NOT dead_letter AND attempts<10 AND token<9223372036854775807 AND due_at<=clock_timestamp() AND lease_until<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.compliance_impact_outbox older WHERE older.scope=o.scope AND older.subscriber=o.subscriber AND older.sequence<o.sequence AND NOT older.acknowledged) ORDER BY sequence,subscriber FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE public.compliance_impact_outbox o SET owner=$2,token=o.token+1,attempts=o.attempts+1,lease_until=clock_timestamp()+interval '30 seconds' FROM candidate c WHERE o.scope=$1 AND o.event_id=c.event_id AND o.subscriber=c.subscriber RETURNING o.event,o.subscriber,o.attempts,o.due_at,o.token",s.PublicationScope,o.Owner).Scan(&raw,&item.Subscriber,&attempts,&item.NextAttempt,&item.LeaseToken)
 if e!=nil||json.Unmarshal(raw,&item.Event)!=nil||tx.Commit()!=nil{return ComplianceOutboxItem{},ErrImpactUnavailable};item.Attempts=uint32(attempts-1);return item,nil
}
func(o C072Outbox)FinishImpact(ctx context.Context,item ComplianceOutboxItem,success bool,_ time.Time,max uint32)error{
 if o.Store==nil||!c051Scope(o.Owner)||max<1||max>10||item.LeaseToken==0||item.Event.Scope!=o.Store.PublicationScope{return ErrImpactUnavailable};s:=o.Store;tx,e:=s.begin(ctx);if e!=nil{return ErrImpactUnavailable};defer tx.Rollback()
 r,e:=tx.ExecContext(ctx,"UPDATE public.compliance_impact_outbox SET acknowledged=$1,dead_letter=NOT $1 AND attempts>=$2,due_at=clock_timestamp()+LEAST(1024,power(2,attempts))::int*interval '1 second',owner='',lease_until='-infinity' WHERE scope=$3 AND event_id=$4 AND subscriber=$5 AND owner=$6 AND token=$7 AND attempts=$8 AND lease_until>clock_timestamp() AND NOT acknowledged AND NOT dead_letter AND event=$9::jsonb",success,max,s.PublicationScope,item.Event.EventID,item.Subscriber,o.Owner,item.LeaseToken,item.Attempts+1,string(c072JSON(item.Event)))
 if e!=nil{return ErrImpactUnavailable};n,_:=r.RowsAffected();if n!=1||tx.Commit()!=nil{return ErrImpactUnavailable};return nil
}
func c072JSON(v any)[]byte{b,_:=json.Marshal(v);return b}
var _ ComplianceOutboxStore = C072Outbox{}

func OpenC072ProductionRuntime(ctx context.Context,dsn string,scope C064AuthorScope,publicationScope string,c *C071Cipher,authority IndependentPublicationAuthority)(*ProductionPublicationRuntime,error){
 if authority==nil||!c051Scope(publicationScope){return nil,ErrC072Unavailable}
 stores,e:=OpenC071ProductionStores(ctx,dsn,scope,publicationScope,c);if e!=nil{return nil,ErrC072Unavailable}
 return &ProductionPublicationRuntime{Store:stores.Publication,Cache:&PublicationCache{},Publisher:authority,Durable:&C072Store{DB:stores.DB,Cipher:c,Scope:scope,PublicationScope:publicationScope}},nil
}
// Execute one collection job with a bounded handler. The collector persists its
// own source snapshot using its canonical adapter; this worker grants no approval.
func(s *C072Store)RunCollection(ctx context.Context,l C072Leader,handler func(context.Context,json.RawMessage)error)error{
 if handler==nil{return ErrC072Unavailable};j,e:=s.Claim(ctx,l,"COLLECTION",time.Minute);if e!=nil{return e}
 work,cancel:=context.WithTimeout(ctx,30*time.Second);defer cancel();e=handler(work,j.Payload)
 if ctx.Err()!=nil{return ErrC072Unavailable};if s.FinishJob(ctx,l,j,e==nil&&work.Err()==nil)!=nil||e!=nil||work.Err()!=nil{return ErrC072Unavailable};return nil
}
// Queue binds an operator-authenticated activation intent. Execution still needs
// fresh managed-manifest and independent reviewer authorization after leasing.
func(o C066Operations)QueueActivation(ctx context.Context,token,id string,a C072Activation)error{
 session,e:=o.authorize(ctx,token)
 if e!=nil||o.Runtime==nil||o.Runtime.Durable==nil||o.Runtime.Durable.Scope!=session.Scope||a.Before.Scope!=o.Runtime.Durable.PublicationScope||a.After.Scope!=a.Before.Scope||a.Signed.Manifest.Environment!="production"||a.Signed.Manifest.Domain!=session.Scope.Domain||a.Signed.Manifest.Jurisdiction!=session.Scope.Jurisdiction{return ErrC066Denied}
 fresh,e:=o.authorize(ctx,token);if e!=nil||fresh!=session{return ErrC066Denied}
 if o.Runtime.Durable.Enqueue(ctx,id,"ACTIVATION",a,a.ScheduledAt,10)!=nil{return ErrC066Denied};return nil
}
