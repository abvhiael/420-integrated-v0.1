package complianceauth

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

// C07.7 telemetry is kept out of adjudication/evidence storage. No sensitive
// payload, subject or reviewer IDs are accepted. Write privileges must belong
// only to the trusted collector role; read privileges to the operator role.
const C077TelemetrySQL = `
CREATE TABLE public.compliance_monitoring (
 scope TEXT NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 128),
 metric TEXT NOT NULL CHECK (metric IN
 ('source_freshness','review_backlog','decision_latency','evaluator_errors',
  'coverage_gaps','activation_lag','revocation_propagation','consumer_acknowledgments')),
 observed_at TIMESTAMPTZ NOT NULL,
 value DOUBLE PRECISION NOT NULL CHECK (value>=0 AND value<1e15),
 samples BIGINT NOT NULL CHECK (samples>0),
 failed BIGINT NOT NULL CHECK (failed>=0 AND failed<=samples),
 PRIMARY KEY(scope,metric)
);
REVOKE ALL ON public.compliance_monitoring FROM PUBLIC;
`
type C077SQLStore struct{ DB *sql.DB }

// RecordC077 is monotonic by observation time. It rejects stale/duplicate
// samples instead of rewriting a newer healthy reading with old evidence.
func(s C077SQLStore)RecordC077(ctx context.Context,o C077Observation)error{
 if s.DB==nil||ctx==nil||ctx.Err()!=nil||!c051Scope(o.Scope)||!c077Known(o.Metric)||
  o.ObservedAt.IsZero()||o.ObservedAt.After(time.Now().UTC().Add(time.Minute))||
  !c077Finite(o.Value)||o.Value<0||o.Samples==0||o.Samples>9223372036854775807||
  o.Failed>o.Samples{return ErrC077Observation}
 result,e:=s.DB.ExecContext(ctx,`INSERT INTO public.compliance_monitoring(scope,metric,observed_at,value,samples,failed)
 VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(scope,metric) DO UPDATE SET observed_at=EXCLUDED.observed_at,
 value=EXCLUDED.value,samples=EXCLUDED.samples,failed=EXCLUDED.failed
 WHERE public.compliance_monitoring.observed_at<EXCLUDED.observed_at`,
 o.Scope,string(o.Metric),o.ObservedAt,o.Value,int64(o.Samples),int64(o.Failed))
 if e!=nil{return errors.Join(ErrC077Observation,e)}
 affected,e:=result.RowsAffected()
 if e!=nil||affected!=1{return ErrC077Observation}
 return nil
}
func c077Known(metric C077Metric)bool{
 for _,m:=range c077Metrics{if m==metric{return true}}
 return false
}
func(s C077SQLStore)ReadC077(ctx context.Context,scope string)([]C077Observation,error){
 if s.DB==nil||ctx==nil||ctx.Err()!=nil||!c051Scope(scope){return nil,ErrC077Observation}
 rows,e:=s.DB.QueryContext(ctx,`SELECT metric,observed_at,value,samples,failed
 FROM public.compliance_monitoring WHERE scope=$1 ORDER BY metric`,scope)
 if e!=nil{return nil,ErrC077Observation};defer rows.Close()
 var result []C077Observation
 for rows.Next(){
  var o C077Observation;var metric string;var samples,failed int64
  if rows.Scan(&metric,&o.ObservedAt,&o.Value,&samples,&failed)!=nil||
   !c077Known(C077Metric(metric))||samples<=0||failed<0||failed>samples{return nil,ErrC077Observation}
  o.Scope=scope;o.Metric=C077Metric(metric);o.Samples=uint64(samples);o.Failed=uint64(failed)
  result=append(result,o)
  if len(result)>len(c077Metrics){return nil,ErrC077Observation}
 }
 if rows.Err()!=nil{return nil,ErrC077Observation}
 return result,nil
}
