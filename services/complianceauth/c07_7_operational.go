package complianceauth

import (
 "context"
 "database/sql"
 "time"
)

// C077OperationalCollector reads authoritative operational tables from the
// primary. It cannot acknowledge an event or approve a policy. An empty table
// records a measured zero; an absent schema/role or unavailable DB fails closed.
type C077OperationalCollector struct {
 DB *sql.DB
 Recorder C077Recorder
 Now func()time.Time
}
func(c C077OperationalCollector) Sample(ctx context.Context,scope string) error {
 if ctx==nil||ctx.Err()!=nil||!c051Scope(scope)||c.DB==nil||c.Recorder==nil||c.Now==nil{return ErrC077Observation}
 var primary bool
 if e:=c.DB.QueryRowContext(ctx,`SELECT NOT pg_is_in_recovery()`).Scan(&primary);e!=nil||!primary{return ErrC077Observation}
 now:=c.Now().UTC()
 // Derive backlog from the latest revision and its latest independent review,
 // with the bounded publication-scope to author scope binding.
 const backlog=`SELECT count(*) FROM public.compliance_author_heads a
 JOIN public.compliance_database_bindings b ON b.tenant=a.tenant AND b.domain=a.domain AND b.jurisdiction=a.jurisdiction
 LEFT JOIN public.compliance_review_heads h ON h.tenant=a.tenant AND h.domain=a.domain AND h.jurisdiction=a.jurisdiction AND h.draft_id=a.draft_id
 LEFT JOIN public.compliance_review_versions v ON v.tenant=h.tenant AND v.domain=h.domain AND v.jurisdiction=h.jurisdiction AND v.draft_id=h.draft_id AND v.review_revision=h.review_revision
 WHERE b.publication_scope=$1 AND (h.review_revision IS NULL OR h.draft_revision<>a.revision OR v.state IS DISTINCT FROM 'APPROVED_CANDIDATE')`
 // Duplicate bindings must not inflate review backlog.
 const backlogDistinct=`SELECT count(*) FROM (
 SELECT DISTINCT a.tenant,a.domain,a.jurisdiction,a.draft_id FROM public.compliance_author_heads a
 JOIN public.compliance_database_bindings b ON b.tenant=a.tenant AND b.domain=a.domain AND b.jurisdiction=a.jurisdiction
 LEFT JOIN public.compliance_review_heads h ON h.tenant=a.tenant AND h.domain=a.domain AND h.jurisdiction=a.jurisdiction AND h.draft_id=a.draft_id
 LEFT JOIN public.compliance_review_versions v ON v.tenant=h.tenant AND v.domain=h.domain AND v.jurisdiction=h.jurisdiction AND v.draft_id=h.draft_id AND v.review_revision=h.review_revision
 WHERE b.publication_scope=$1 AND (h.review_revision IS NULL OR h.draft_revision<>a.revision OR v.state IS DISTINCT FROM 'APPROVED_CANDIDATE')
 ) pending`
 _=backlog // retained for query review; distinct version is authoritative.
 var backlogCount int64
 if e:=c.DB.QueryRowContext(ctx,backlogDistinct,scope).Scan(&backlogCount);e!=nil||backlogCount<0{return ErrC077Observation}
 metrics:=[]struct{metric C077Metric; query string}{
  {C077ActivationLag,`SELECT coalesce(max(greatest(0,extract(epoch FROM clock_timestamp()-due_at))),0)::double precision FROM public.compliance_durable_jobs WHERE scope=$1 AND kind='ACTIVATION' AND state IN ('QUEUED','LEASED','DEAD')`},
  {C077RevocationPropagation,`SELECT coalesce(max(greatest(0,extract(epoch FROM clock_timestamp()-due_at))),0)::double precision FROM public.compliance_impact_outbox WHERE scope=$1 AND NOT acknowledged`},
  {C077ConsumerAcknowledgments,`SELECT count(*)::double precision FROM public.compliance_impact_outbox WHERE scope=$1 AND NOT acknowledged`},
 }
 values:=map[C077Metric]float64{C077ReviewBacklog:float64(backlogCount)}
 for _,x:=range metrics{
  var v float64
  if e:=c.DB.QueryRowContext(ctx,x.query,scope).Scan(&v);e!=nil||!c077Finite(v)||v<0{return ErrC077Observation}
  values[x.metric]=v
 }
 for _,metric:=range []C077Metric{C077ReviewBacklog,C077ActivationLag,C077RevocationPropagation,C077ConsumerAcknowledgments}{
  if e:=c.Recorder.RecordC077(ctx,C077Observation{Metric:metric,Scope:scope,ObservedAt:now,Value:values[metric],Samples:1});e!=nil{return ErrC077Observation}
 }
 return nil
}
