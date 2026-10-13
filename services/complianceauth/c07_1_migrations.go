package complianceauth

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "github.com/lib/pq"
)

const c071HardeningSQL = `
CREATE TABLE public.compliance_database_bindings (
 role_name NAME PRIMARY KEY, tenant TEXT NOT NULL, domain TEXT NOT NULL,
 jurisdiction TEXT NOT NULL, publication_scope TEXT NOT NULL,
 CHECK(char_length(tenant) BETWEEN 1 AND 128 AND char_length(domain) BETWEEN 1 AND 128
 AND char_length(jurisdiction) BETWEEN 1 AND 128 AND char_length(publication_scope) BETWEEN 1 AND 256)
);
ALTER TABLE public.compliance_database_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_database_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY c071_own_binding ON public.compliance_database_bindings
 USING(role_name=current_user);
CREATE TABLE public.compliance_storage_usage (
 tenant TEXT NOT NULL, domain TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 stored_bytes BIGINT NOT NULL CHECK(stored_bytes BETWEEN 0 AND 67108864),
 stored_rows BIGINT NOT NULL CHECK(stored_rows BETWEEN 0 AND 100000),
 PRIMARY KEY(tenant,domain,jurisdiction)
);
INSERT INTO public.compliance_storage_usage
 SELECT tenant,domain,jurisdiction,sum(bytes),sum(rows) FROM (
 SELECT tenant,domain,jurisdiction,sum(octet_length(to_jsonb(v)::text)) AS bytes,count(*) AS rows FROM public.compliance_author_versions v GROUP BY tenant,domain,jurisdiction
 UNION ALL SELECT tenant,domain,jurisdiction,sum(octet_length(to_jsonb(v)::text)),count(*) FROM public.compliance_author_heads v GROUP BY tenant,domain,jurisdiction
 UNION ALL SELECT tenant,domain,jurisdiction,sum(octet_length(to_jsonb(v)::text)),count(*) FROM public.compliance_review_heads v GROUP BY tenant,domain,jurisdiction
 UNION ALL SELECT tenant,domain,jurisdiction,sum(octet_length(to_jsonb(v)::text)),count(*) FROM public.compliance_review_versions v GROUP BY tenant,domain,jurisdiction
 UNION ALL SELECT tenant,domain,jurisdiction,sum(octet_length(to_jsonb(v)::text)),count(*) FROM public.compliance_auditor_access v GROUP BY tenant,domain,jurisdiction
 ) records GROUP BY tenant,domain,jurisdiction;
CREATE FUNCTION public.c071_account_storage() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE bytes BIGINT;
BEGIN
 bytes:=octet_length(to_jsonb(NEW)::text);
 IF bytes>262144 THEN RAISE EXCEPTION 'protected storage row limit exceeded'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant<>OLD.tenant OR NEW.domain<>OLD.domain OR NEW.jurisdiction<>OLD.jurisdiction THEN RAISE EXCEPTION 'protected storage scope is immutable'; END IF;
  bytes:=bytes-octet_length(to_jsonb(OLD)::text);
  UPDATE public.compliance_storage_usage SET stored_bytes=stored_bytes+bytes WHERE tenant=NEW.tenant AND domain=NEW.domain AND jurisdiction=NEW.jurisdiction;
  IF NOT FOUND THEN RAISE EXCEPTION 'protected storage accounting missing'; END IF;
  RETURN NEW;
 END IF;
 INSERT INTO public.compliance_storage_usage AS u(tenant,domain,jurisdiction,stored_bytes,stored_rows)
 VALUES(NEW.tenant,NEW.domain,NEW.jurisdiction,bytes,1)
 ON CONFLICT(tenant,domain,jurisdiction) DO UPDATE
 SET stored_bytes=u.stored_bytes+EXCLUDED.stored_bytes,stored_rows=u.stored_rows+1;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.c071_account_storage() FROM PUBLIC;
ALTER TABLE public.compliance_author_versions ADD CONSTRAINT c071_author_encrypted
 CHECK(document ? 'v' AND document->>'v'='1' AND document ? 'kid' AND document ? 'nonce' AND document ? 'ciphertext' AND octet_length(document::text)<=262144);
ALTER TABLE public.compliance_review_versions ADD CONSTRAINT c071_review_encrypted
 CHECK(record ? 'v' AND record->>'v'='1' AND record ? 'kid' AND record ? 'nonce' AND record ? 'ciphertext' AND octet_length(record::text)<=262144);
ALTER TABLE public.compliance_auditor_access ADD CONSTRAINT c071_audit_encrypted
 CHECK(purpose::jsonb ? 'v' AND purpose::jsonb->>'v'='1' AND purpose::jsonb ? 'kid' AND purpose::jsonb ? 'nonce' AND purpose::jsonb ? 'ciphertext' AND octet_length(purpose)<=262144);
ALTER TABLE public.compliance_author_heads ADD CONSTRAINT c071_author_head_keys CHECK(char_length(draft_id) BETWEEN 1 AND 128 AND char_length(author_id) BETWEEN 1 AND 128);
ALTER TABLE public.compliance_author_versions ADD CONSTRAINT c071_author_version_keys CHECK(char_length(draft_id) BETWEEN 1 AND 128 AND char_length(author_id) BETWEEN 1 AND 128);
ALTER TABLE public.compliance_review_heads ADD CONSTRAINT c071_review_head_keys CHECK(char_length(draft_id) BETWEEN 1 AND 128);
ALTER TABLE public.compliance_review_versions ADD CONSTRAINT c071_review_version_keys CHECK(char_length(draft_id) BETWEEN 1 AND 128 AND char_length(reviewer_id) BETWEEN 1 AND 128 AND char_length(state) BETWEEN 1 AND 32);
ALTER TABLE public.compliance_auditor_access ADD CONSTRAINT c071_audit_keys CHECK(char_length(case_id) BETWEEN 1 AND 128 AND char_length(actor_id) BETWEEN 1 AND 128 AND char_length(evidence_id) BETWEEN 1 AND 128 AND result='EXPORTED_REDACTED');
ALTER TABLE public.compliance_publication_fences ADD CONSTRAINT c071_publication_key CHECK(char_length(scope) BETWEEN 1 AND 256);
CREATE INDEX c071_author_owner_history ON public.compliance_author_versions(tenant,domain,jurisdiction,author_id,created_at,draft_id,revision);
CREATE INDEX c071_review_queue ON public.compliance_review_versions(tenant,domain,jurisdiction,state,created_at,draft_id,review_revision);
CREATE INDEX c071_publication_expiry ON public.compliance_publication_fences(expires_at,scope);
`

// Migrations run on a dedicated administrator connection before traffic. A
// transaction/advisory lock gives exactly-once application and atomic rollback.
// Existing plaintext rows are encrypted in-place before constraints become valid.
func MigrateC071Database(ctx context.Context,db *sql.DB,c *C071Cipher)error{
 if ctx==nil||ctx.Err()!=nil||db==nil||c==nil{return ErrC071Storage}
 tx,err:=db.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelReadCommitted});if err!=nil{return ErrC071Storage};defer tx.Rollback()
 if _,err=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(420071)");err!=nil{return ErrC071Storage}
 if _,err=tx.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS public.compliance_schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL CHECK(char_length(checksum)=64), applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp())`);err!=nil{return ErrC071Storage}
 scripts:=[]string{PublicationSchemaSQL,C064AuthorSchemaSQL,C065ReviewSchemaSQL,C067AuditSchemaSQL,c071HardeningSQL,c072DurableSQL}
 var max int;if tx.QueryRowContext(ctx,"SELECT coalesce(max(version),0) FROM public.compliance_schema_migrations").Scan(&max)!=nil||max>len(scripts){return ErrC071Storage}
 for i,script:=range scripts{
  hash:=sha256.Sum256([]byte(script));digest:=hex.EncodeToString(hash[:]);var saved string
  err=tx.QueryRowContext(ctx,"SELECT checksum FROM public.compliance_schema_migrations WHERE version=$1",i+1).Scan(&saved)
  if err==nil{if saved!=digest{return ErrC071Storage};continue};if err!=sql.ErrNoRows{return ErrC071Storage}
  if i==4{if err=c071EncryptExisting(ctx,tx,c);err!=nil{return err}}
  if _,err=tx.ExecContext(ctx,script);err!=nil{return fmt.Errorf("%w: migration %d",ErrC071Storage,i+1)}
  if i==4{
   for _,table:=range []string{"compliance_author_heads","compliance_author_versions","compliance_review_heads","compliance_review_versions","compliance_auditor_access"}{
    q:=pq.QuoteIdentifier(table)
    statements:=[]string{"ALTER TABLE public."+q+" ENABLE ROW LEVEL SECURITY","ALTER TABLE public."+q+" FORCE ROW LEVEL SECURITY",
     "CREATE POLICY c071_bound_scope ON public."+q+` USING (EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.tenant=`+q+`.tenant AND b.domain=`+q+`.domain AND b.jurisdiction=`+q+`.jurisdiction)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.tenant=`+q+`.tenant AND b.domain=`+q+`.domain AND b.jurisdiction=`+q+`.jurisdiction))`,
     "ALTER TABLE public."+q+" ADD CONSTRAINT c071_scope_limits CHECK(char_length(tenant) BETWEEN 1 AND 128 AND char_length(domain) BETWEEN 1 AND 128 AND char_length(jurisdiction) BETWEEN 1 AND 128)"}
    for _,stmt:=range statements{if _,err=tx.ExecContext(ctx,stmt);err!=nil{return ErrC071Storage}}
   }
   for _,table:=range []string{"compliance_author_heads","compliance_author_versions","compliance_review_heads","compliance_review_versions","compliance_auditor_access"}{
    if _,err=tx.ExecContext(ctx,"CREATE TRIGGER c071_quota AFTER INSERT ON public."+pq.QuoteIdentifier(table)+" FOR EACH ROW EXECUTE FUNCTION public.c071_account_storage()");err!=nil{return ErrC071Storage}
   }
   for _,table:=range []string{"compliance_author_heads","compliance_review_heads"}{
    if _,err=tx.ExecContext(ctx,"CREATE TRIGGER c071_head_quota AFTER UPDATE ON public."+pq.QuoteIdentifier(table)+" FOR EACH ROW EXECUTE FUNCTION public.c071_account_storage()");err!=nil{return ErrC071Storage}
   }
   for _,stmt:=range []string{"ALTER TABLE public.compliance_publication_fences ENABLE ROW LEVEL SECURITY","ALTER TABLE public.compliance_publication_fences FORCE ROW LEVEL SECURITY",`CREATE POLICY c071_publication_scope ON public.compliance_publication_fences USING(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=scope)) WITH CHECK(EXISTS(SELECT 1 FROM public.compliance_database_bindings b WHERE b.role_name=current_user AND b.publication_scope=scope))`}{if _,err=tx.ExecContext(ctx,stmt);err!=nil{return ErrC071Storage}}
  }
  if _,err=tx.ExecContext(ctx,"INSERT INTO public.compliance_schema_migrations(version,checksum) VALUES($1,$2)",i+1,digest);err!=nil{return ErrC071Storage}
 }
 if err=tx.Commit();err!=nil{return ErrC071Storage};return nil
}
func c071EncryptExisting(ctx context.Context,tx *sql.Tx,c *C071Cipher)error{
 for _,table:=range []string{"compliance_author_versions","compliance_review_versions"}{
  column,revision,kind:="document","revision","author";if table=="compliance_review_versions"{column,revision,kind="record","review_revision","review"}
  draftRevision:=revision;if kind=="review"{draftRevision="draft_revision"}
  rows,err:=tx.QueryContext(ctx,"SELECT tenant,domain,jurisdiction,draft_id,"+revision+",document_digest,"+draftRevision+","+column+" FROM public."+table+" FOR UPDATE");if err!=nil{return ErrC071Storage}
  type item struct{s C064AuthorScope;id,digest string;rev,draftRev uint64;raw []byte};var batch []item;totalBytes:=0
  for rows.Next(){var x item;if rows.Scan(&x.s.Tenant,&x.s.Domain,&x.s.Jurisdiction,&x.id,&x.rev,&x.digest,&x.draftRev,&x.raw)!=nil{rows.Close();return ErrC071Storage};batch=append(batch,x);totalBytes+=len(x.raw);if len(batch)>100000||totalBytes>67108864{rows.Close();return ErrC071Storage}}
  err=rows.Err();rows.Close();if err!=nil{return ErrC071Storage}
  for _,x:=range batch{
   aad:=c071AAD(kind,x.s,x.id,x.rev);var e c071Envelope;_ = json.Unmarshal(x.raw,&e)
   plain:=x.raw
   if e.Version==1{plain,err=c.open(x.raw,aad);if err!=nil{return err}}
   if kind=="author"{
    var doc C064DraftVersion
    if json.Unmarshal(plain,&doc)!=nil||doc.Scope!=x.s||doc.ID!=x.id||doc.Revision!=x.rev||doc.DocumentDigest!=x.digest||doc.DocumentDigest!=c064DocumentDigest(doc.Schema,doc.Citations)||!c064SchemaValid(doc.Schema,x.id,x.s)||!c064ID.MatchString(doc.AuthorID){return ErrC071Storage}
   }else{
    var record C065ReviewRecord
    if json.Unmarshal(plain,&record)!=nil||record.Scope!=x.s||record.DraftID!=x.id||record.Revision!=x.draftRev||record.DocumentDigest!=x.digest||!digestValid(record.DocumentDigest)||!digestValid(record.ImpactDigest)||!c064ID.MatchString(record.ReviewerID)||record.At.IsZero()||!c065FindingsValid(record.Findings,record.ConflictIDs,record.State){return ErrC071Storage}
   }
   if e.Version==1{continue}
   encrypted,err:=c.seal(plain,aad);if err!=nil{return err}
   if _,err=tx.ExecContext(ctx,"UPDATE public."+table+" SET "+column+"=$1 WHERE tenant=$2 AND domain=$3 AND jurisdiction=$4 AND draft_id=$5 AND "+revision+"=$6",string(encrypted),x.s.Tenant,x.s.Domain,x.s.Jurisdiction,x.id,x.rev);err!=nil{return ErrC071Storage}
  }
 }
 rows,err:=tx.QueryContext(ctx,"SELECT id,tenant,domain,jurisdiction,case_id,actor_id,evidence_id,purpose FROM public.compliance_auditor_access FOR UPDATE");if err!=nil{return ErrC071Storage}
 type access struct{id int64;s C064AuthorScope;caseID,actor,evidence,purpose string};var batch []access;totalBytes:=0
 for rows.Next(){var x access;if rows.Scan(&x.id,&x.s.Tenant,&x.s.Domain,&x.s.Jurisdiction,&x.caseID,&x.actor,&x.evidence,&x.purpose)!=nil{rows.Close();return ErrC071Storage};batch=append(batch,x);totalBytes+=len(x.purpose);if len(batch)>100000||totalBytes>67108864{rows.Close();return ErrC071Storage}}
 err=rows.Err();rows.Close();if err!=nil{return ErrC071Storage}
 for _,x:=range batch{
  aad:=c071AAD("audit",x.s,x.caseID+"|"+x.actor+"|"+x.evidence,0);var e c071Envelope;_ =json.Unmarshal([]byte(x.purpose),&e)
  purpose:=x.purpose
  if e.Version==1{plain,openErr:=c.open([]byte(x.purpose),aad);if openErr!=nil||json.Unmarshal(plain,&purpose)!=nil{return ErrC071Storage}}
  if purpose!="LEGAL_AUDIT"&&purpose!="INCIDENT_REVIEW"&&purpose!="SOURCE_VERIFICATION"{return ErrC071Storage}
  if e.Version==1{continue}
  encrypted,err:=c071Encode(c,purpose,aad);if err!=nil{return err}
  if _,err=tx.ExecContext(ctx,"UPDATE public.compliance_auditor_access SET purpose=$1 WHERE id=$2",string(encrypted),x.id);err!=nil{return ErrC071Storage}
 }
 return nil
}

// Bind an already-provisioned runtime role. This never creates credentials or
// grants schema ownership, migration, delete, truncate, or revision-update power.
func BindC071RuntimeRole(ctx context.Context,db *sql.DB,role string,s C064AuthorScope,publicationScope string)error{
 if ctx==nil||ctx.Err()!=nil||db==nil||!c064ID.MatchString(role)||!c051Scope(s.Tenant)||!c051Scope(s.Domain)||!c051Scope(s.Jurisdiction)||publicationScope==""||len(publicationScope)>256{return ErrC071Storage}
 tx,err:=db.BeginTx(ctx,nil);if err!=nil{return ErrC071Storage};defer tx.Rollback()
 var unsafe bool
 if tx.QueryRowContext(ctx,"SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname=$1",role).Scan(&unsafe)!=nil||unsafe{return ErrC071Storage}
 _,err=tx.ExecContext(ctx,"INSERT INTO public.compliance_database_bindings(role_name,tenant,domain,jurisdiction,publication_scope) VALUES($1,$2,$3,$4,$5) ON CONFLICT(role_name) DO NOTHING",role,s.Tenant,s.Domain,s.Jurisdiction,publicationScope);if err!=nil{return ErrC071Storage}
 var conflicts int;if tx.QueryRowContext(ctx,"SELECT count(*) FROM public.compliance_database_bindings WHERE publication_scope=$1 AND (tenant<>$2 OR domain<>$3 OR jurisdiction<>$4)",publicationScope,s.Tenant,s.Domain,s.Jurisdiction).Scan(&conflicts)!=nil||conflicts!=0{return ErrC071Storage}
 var n int;if tx.QueryRowContext(ctx,"SELECT count(*) FROM public.compliance_database_bindings WHERE role_name=$1 AND tenant=$2 AND domain=$3 AND jurisdiction=$4 AND publication_scope=$5",role,s.Tenant,s.Domain,s.Jurisdiction,publicationScope).Scan(&n)!=nil||n!=1{return ErrC071Storage}
 q:=pq.QuoteIdentifier(role)
 for _,stmt:=range []string{
  "GRANT USAGE ON SCHEMA public TO "+q,
  "GRANT SELECT ON public.compliance_database_bindings,public.compliance_schema_migrations TO "+q,
  "GRANT SELECT,INSERT,UPDATE ON public.compliance_author_heads,public.compliance_review_heads,public.compliance_publication_fences TO "+q,
  "GRANT SELECT,INSERT ON public.compliance_author_versions,public.compliance_review_versions,public.compliance_auditor_access TO "+q,
  "GRANT SELECT,INSERT,UPDATE ON public.compliance_job_leaders,public.compliance_durable_jobs,public.compliance_impact_outbox TO "+q,
  "GRANT SELECT,INSERT ON public.compliance_durable_halts,public.compliance_activations TO "+q,
  "GRANT USAGE ON SEQUENCE public.compliance_auditor_access_id_seq TO "+q,
 }{if _,err=tx.ExecContext(ctx,stmt);err!=nil{return ErrC071Storage}}
 if err=tx.Commit();err!=nil{return ErrC071Storage};return nil
}
