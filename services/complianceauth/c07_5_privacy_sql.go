package complianceauth

// Migration eight appends privacy controls; it does not rewrite earlier SQL.
const c075PrivacySQL = `
CREATE TABLE public.compliance_privacy_roles (
 role_name NAME PRIMARY KEY, scope TEXT NOT NULL, tenant TEXT NOT NULL, domain TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 principal TEXT NOT NULL, capability TEXT NOT NULL CHECK(capability IN ('purge','hold','release','retire')),
 valid_until TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.compliance_retention_policies (
 scope TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('DRAFT','AUDIT','JOB')),
 version BIGINT NOT NULL CHECK(version>0), retain_days INTEGER NOT NULL CHECK(retain_days BETWEEN 1 AND 3650),
 approval_digest TEXT NOT NULL CHECK(char_length(approval_digest)=64),
 reviewer TEXT NOT NULL, owner TEXT NOT NULL CHECK(owner<>reviewer), valid_until TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(scope,kind,version)
);
CREATE TABLE public.compliance_legal_holds (
 scope TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('DRAFT','AUDIT','JOB','ALL')), ref TEXT NOT NULL,
 case_id TEXT NOT NULL, placed_by TEXT NOT NULL, released_by TEXT NOT NULL DEFAULT '',
 revision BIGINT NOT NULL DEFAULT 1 CHECK(revision IN (1,2)),
 placed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), released_at TIMESTAMPTZ,
 PRIMARY KEY(scope,kind,ref,case_id), CHECK((revision=1 AND released_at IS NULL AND released_by='') OR (revision=2 AND released_at IS NOT NULL AND released_by<>placed_by AND released_by<>''))
);
CREATE TABLE public.compliance_privacy_retired (
 scope TEXT NOT NULL, ref TEXT NOT NULL, revision BIGINT NOT NULL, retired_by TEXT NOT NULL,
 retired_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(scope,ref)
);
CREATE TABLE public.compliance_privacy_receipts (
 scope TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, policy_version BIGINT NOT NULL,
 actor TEXT NOT NULL, removed_rows BIGINT NOT NULL CHECK(removed_rows>0), removed_bytes BIGINT NOT NULL CHECK(removed_bytes>0),
 purged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(scope,kind,ref)
);
CREATE TABLE public.compliance_privacy_terminal (
 scope TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('AUDIT','JOB')), ref TEXT NOT NULL,
 closed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(scope,kind,ref)
);
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['compliance_privacy_roles','compliance_retention_policies','compliance_legal_holds','compliance_privacy_retired','compliance_privacy_receipts','compliance_privacy_terminal'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY c075_scope ON public.%I USING (scope IN (SELECT publication_scope FROM public.compliance_database_bindings WHERE role_name=current_user))',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE FUNCTION public.c075_role(cap TEXT, actor TEXT) RETURNS public.compliance_privacy_roles LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles;
BEGIN
 SELECT * INTO r FROM public.compliance_privacy_roles WHERE role_name=session_user AND capability=cap AND principal=actor AND valid_until>clock_timestamp();
 IF NOT FOUND OR pg_is_in_recovery() THEN RAISE EXCEPTION 'privacy authority unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.scope,420075));
 IF r.valid_until<=clock_timestamp() THEN RAISE EXCEPTION 'privacy authority expired'; END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.c075_role(TEXT,TEXT) FROM PUBLIC;
CREATE FUNCTION public.c075_identity() RETURNS public.compliance_privacy_roles LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles;
BEGIN
 SELECT * INTO r FROM public.compliance_privacy_roles WHERE role_name=session_user AND valid_until>clock_timestamp();
 IF NOT FOUND OR pg_is_in_recovery() THEN RAISE EXCEPTION 'privacy identity unavailable'; END IF; RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.c075_identity() FROM PUBLIC;
CREATE FUNCTION public.c075_hold(actor TEXT, k TEXT, obj TEXT, case_ref TEXT, expected BIGINT, releasing BOOLEAN) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles; n BIGINT;
BEGIN
 r:=public.c075_role(CASE WHEN releasing THEN 'release' ELSE 'hold' END,actor);
 IF k NOT IN ('DRAFT','AUDIT','JOB','ALL') OR char_length(obj) NOT BETWEEN 1 AND 128 OR char_length(case_ref) NOT BETWEEN 1 AND 128 OR (k='ALL' AND obj<>'scope') THEN RAISE EXCEPTION 'invalid hold'; END IF;
 IF EXISTS(SELECT 1 FROM public.compliance_privacy_receipts WHERE scope=r.scope AND kind=k AND ref=obj) THEN RAISE EXCEPTION 'record already purged'; END IF;
 IF NOT releasing THEN
  IF (SELECT count(*) FROM public.compliance_legal_holds WHERE scope=r.scope)>=100000 THEN RAISE EXCEPTION 'hold journal full'; END IF;
  IF expected<>0 THEN RAISE EXCEPTION 'stale hold'; END IF;
  INSERT INTO public.compliance_legal_holds(scope,kind,ref,case_id,placed_by) VALUES(r.scope,k,obj,case_ref,actor);
  RETURN 1;
 END IF;
 UPDATE public.compliance_legal_holds SET revision=2,released_at=clock_timestamp(),released_by=actor
 WHERE scope=r.scope AND kind=k AND ref=obj AND case_id=case_ref AND revision=expected AND revision=1 AND placed_by<>actor;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'hold release denied'; END IF; RETURN 2;
END $$;
REVOKE ALL ON FUNCTION public.c075_hold(TEXT,TEXT,TEXT,TEXT,BIGINT,BOOLEAN) FROM PUBLIC;
CREATE FUNCTION public.c075_retire(actor TEXT, obj TEXT, expected BIGINT) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles; rev BIGINT;
BEGIN
 r:=public.c075_role('retire',actor);
 IF char_length(obj) NOT BETWEEN 1 AND 128 OR expected<1 THEN RAISE EXCEPTION 'invalid retirement'; END IF;
 PERFORM 1 FROM public.compliance_publication_fences WHERE scope=r.scope FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'publication state unknown'; END IF;
 SELECT revision INTO rev FROM public.compliance_author_heads WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj FOR UPDATE;
 IF NOT FOUND OR rev<>expected OR EXISTS(SELECT 1 FROM public.compliance_publication_fences WHERE scope=r.scope AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'live or stale draft'; END IF;
 INSERT INTO public.compliance_privacy_retired(scope,ref,revision,retired_by) VALUES(r.scope,obj,rev,actor);
 RETURN rev;
END $$;
REVOKE ALL ON FUNCTION public.c075_retire(TEXT,TEXT,BIGINT) FROM PUBLIC;
CREATE FUNCTION public.c075_no_reuse() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s TEXT; obj TEXT; k TEXT;
BEGIN
 IF TG_TABLE_NAME='compliance_durable_jobs' THEN s:=NEW.scope;obj:=NEW.id;k:='JOB';
 ELSE
  SELECT publication_scope INTO s FROM public.compliance_database_bindings WHERE role_name=current_user;
  obj:=NEW.draft_id;k:='DRAFT';
 END IF;
 IF EXISTS(SELECT 1 FROM public.compliance_privacy_receipts WHERE scope=s AND kind=k AND ref=obj)
 OR (k='DRAFT' AND EXISTS(SELECT 1 FROM public.compliance_privacy_retired WHERE scope=s AND ref=obj)) THEN RAISE EXCEPTION 'privacy lifecycle closed'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.c075_no_reuse() FROM PUBLIC;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['compliance_author_heads','compliance_author_versions','compliance_review_heads','compliance_review_versions','compliance_durable_jobs'] LOOP
  EXECUTE format('CREATE TRIGGER c075_no_reuse BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.c075_no_reuse()',t);
 END LOOP;
END $$;
CREATE FUNCTION public.c075_terminal_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s TEXT; obj TEXT; k TEXT;
BEGIN
 IF TG_TABLE_NAME='compliance_durable_jobs' THEN
  IF NEW.state NOT IN ('COMPLETE','DEAD') THEN RETURN NEW; END IF;
  s:=NEW.scope;obj:=NEW.id;k:='JOB';
 ELSE
  SELECT publication_scope INTO s FROM public.compliance_database_bindings WHERE tenant=NEW.tenant AND domain=NEW.domain AND jurisdiction=NEW.jurisdiction LIMIT 1;
  obj:=NEW.id::text;k:='AUDIT';
 END IF;
 IF s IS NOT NULL THEN
  IF (SELECT count(*) FROM public.compliance_privacy_terminal WHERE scope=s)>=100000 AND NOT EXISTS(SELECT 1 FROM public.compliance_privacy_terminal WHERE scope=s AND kind=k AND ref=obj) THEN RAISE EXCEPTION 'retention inventory full'; END IF;
  INSERT INTO public.compliance_privacy_terminal AS t(scope,kind,ref) VALUES(s,k,obj)
  ON CONFLICT(scope,kind,ref) DO UPDATE SET closed_at=GREATEST(t.closed_at,EXCLUDED.closed_at);
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.c075_terminal_clock() FROM PUBLIC;
CREATE TRIGGER c075_terminal_job AFTER INSERT OR UPDATE ON public.compliance_durable_jobs FOR EACH ROW EXECUTE FUNCTION public.c075_terminal_clock();
CREATE TRIGGER c075_terminal_audit AFTER INSERT ON public.compliance_auditor_access FOR EACH ROW EXECUTE FUNCTION public.c075_terminal_clock();
INSERT INTO public.compliance_privacy_terminal(scope,kind,ref) SELECT scope,'JOB',id FROM public.compliance_durable_jobs WHERE state IN ('COMPLETE','DEAD');
CREATE FUNCTION public.c075_purge(actor TEXT, k TEXT, obj TEXT) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles; p public.compliance_retention_policies; latest TIMESTAMPTZ; n BIGINT; b BIGINT; job_state TEXT;
BEGIN
 r:=public.c075_role('purge',actor);
 IF k NOT IN ('DRAFT','AUDIT','JOB') OR char_length(obj) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'unsupported record owner'; END IF;
 SELECT * INTO p FROM public.compliance_retention_policies WHERE scope=r.scope AND kind=k ORDER BY version DESC LIMIT 1;
 IF NOT FOUND OR p.revoked OR p.valid_until<=clock_timestamp() THEN RAISE EXCEPTION 'retention approval unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.compliance_legal_holds WHERE scope=r.scope AND revision=1 AND ((kind=k AND ref=obj) OR kind='ALL')) THEN RAISE EXCEPTION 'legal hold'; END IF;
 SELECT removed_rows INTO n FROM public.compliance_privacy_receipts WHERE scope=r.scope AND kind=k AND ref=obj;
 IF FOUND THEN RETURN n; END IF;
 IF (SELECT count(*) FROM public.compliance_privacy_receipts WHERE scope=r.scope)>=100000 THEN RAISE EXCEPTION 'privacy journal full'; END IF;
 IF k='DRAFT' THEN
  PERFORM 1 FROM public.compliance_publication_fences WHERE scope=r.scope FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'publication state unknown'; END IF;
  PERFORM 1 FROM public.compliance_author_heads WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.compliance_privacy_retired WHERE scope=r.scope AND ref=obj)
  OR EXISTS(SELECT 1 FROM public.compliance_publication_fences WHERE scope=r.scope AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'draft not terminal'; END IF;
  SELECT max(created_at) INTO latest FROM (
   SELECT created_at FROM public.compliance_author_versions WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
   UNION ALL SELECT created_at FROM public.compliance_review_versions WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
  ) v;
  SELECT GREATEST(latest,retired_at) INTO latest FROM public.compliance_privacy_retired WHERE scope=r.scope AND ref=obj;
  SELECT sum(bytes),sum(rows) INTO b,n FROM (
   SELECT coalesce(sum(octet_length(to_jsonb(v)::text)),0) bytes,count(*) rows FROM public.compliance_author_versions v WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
   UNION ALL SELECT coalesce(sum(octet_length(to_jsonb(v)::text)),0),count(*) FROM public.compliance_review_versions v WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
   UNION ALL SELECT coalesce(sum(octet_length(to_jsonb(v)::text)),0),count(*) FROM public.compliance_author_heads v WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
   UNION ALL SELECT coalesce(sum(octet_length(to_jsonb(v)::text)),0),count(*) FROM public.compliance_review_heads v WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj
  ) amounts;
 ELSIF k='AUDIT' THEN
  SELECT occurred_at,octet_length(to_jsonb(v)::text) INTO latest,b FROM public.compliance_auditor_access v WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND id::text=obj FOR UPDATE;n:=1;
 ELSE
  SELECT scheduled_at,state,octet_length(to_jsonb(v)::text) INTO latest,job_state,b FROM public.compliance_durable_jobs v WHERE scope=r.scope AND id=obj FOR UPDATE;n:=1;
  IF job_state IS NULL OR job_state NOT IN ('COMPLETE','DEAD') THEN RAISE EXCEPTION 'work not terminal'; END IF;
 END IF;
 IF k IN ('AUDIT','JOB') THEN
  SELECT GREATEST(latest,closed_at) INTO latest FROM public.compliance_privacy_terminal WHERE scope=r.scope AND kind=k AND ref=obj;
  IF NOT FOUND THEN RAISE EXCEPTION 'trusted retention clock unavailable'; END IF;
 END IF;
 IF latest IS NULL OR latest+p.retain_days*interval '24 hours'>clock_timestamp() OR b IS NULL OR b<1 OR n<1 THEN RAISE EXCEPTION 'retention not due'; END IF;
 IF k='DRAFT' THEN
  DELETE FROM public.compliance_review_versions WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj;
  DELETE FROM public.compliance_review_heads WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj;
  DELETE FROM public.compliance_author_versions WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj;
  DELETE FROM public.compliance_author_heads WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND draft_id=obj;
 ELSIF k='AUDIT' THEN
  DELETE FROM public.compliance_auditor_access WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction AND id::text=obj;
 ELSE
  DELETE FROM public.compliance_durable_jobs WHERE scope=r.scope AND id=obj;
 END IF;
 UPDATE public.compliance_storage_usage SET stored_bytes=stored_bytes-b,stored_rows=stored_rows-n WHERE tenant=r.tenant AND domain=r.domain AND jurisdiction=r.jurisdiction;
 IF NOT FOUND THEN RAISE EXCEPTION 'quota accounting unavailable'; END IF;
 IF r.valid_until<=clock_timestamp() OR p.valid_until<=clock_timestamp() THEN RAISE EXCEPTION 'privacy authority expired'; END IF;
 INSERT INTO public.compliance_privacy_receipts(scope,kind,ref,policy_version,actor,removed_rows,removed_bytes) VALUES(r.scope,k,obj,p.version,actor,n,b);
 DELETE FROM public.compliance_privacy_terminal WHERE scope=r.scope AND kind=k AND ref=obj;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.c075_purge(TEXT,TEXT,TEXT) FROM PUBLIC;
CREATE FUNCTION public.c075_due(actor TEXT, batch INTEGER) RETURNS TABLE(kind TEXT,ref TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.compliance_privacy_roles;
BEGIN
 r:=public.c075_role('purge',actor);
 IF batch<1 OR batch>32 THEN RAISE EXCEPTION 'unbounded retention scan'; END IF;
 RETURN QUERY WITH policies AS (
  SELECT DISTINCT ON(p.kind) p.kind,p.retain_days,p.revoked,p.valid_until FROM public.compliance_retention_policies p WHERE p.scope=r.scope ORDER BY p.kind,p.version DESC
 ), candidates AS (
  SELECT 'DRAFT'::text k,v.ref,GREATEST(v.retired_at,(SELECT max(x.created_at) FROM public.compliance_author_versions x WHERE x.tenant=r.tenant AND x.domain=r.domain AND x.jurisdiction=r.jurisdiction AND x.draft_id=v.ref),(SELECT max(x.created_at) FROM public.compliance_review_versions x WHERE x.tenant=r.tenant AND x.domain=r.domain AND x.jurisdiction=r.jurisdiction AND x.draft_id=v.ref)) due
  FROM public.compliance_privacy_retired v WHERE v.scope=r.scope AND NOT EXISTS(SELECT 1 FROM public.compliance_publication_fences f WHERE f.scope=r.scope AND f.expires_at>clock_timestamp())
  UNION ALL
  SELECT t.kind,t.ref,t.closed_at FROM public.compliance_privacy_terminal t WHERE t.scope=r.scope AND (t.kind='AUDIT' OR EXISTS(SELECT 1 FROM public.compliance_durable_jobs j WHERE j.scope=r.scope AND j.id=t.ref AND j.state IN ('COMPLETE','DEAD')))
 ) SELECT c.k,c.ref FROM candidates c JOIN policies p ON p.kind=c.k
 WHERE NOT p.revoked AND p.valid_until>clock_timestamp() AND c.due+p.retain_days*interval '24 hours'<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM public.compliance_privacy_receipts z WHERE z.scope=r.scope AND z.kind=c.k AND z.ref=c.ref)
 AND NOT EXISTS(SELECT 1 FROM public.compliance_legal_holds h WHERE h.scope=r.scope AND h.revision=1 AND ((h.kind=c.k AND h.ref=c.ref) OR h.kind='ALL'))
 ORDER BY c.k,c.ref LIMIT batch;
END $$;
REVOKE ALL ON FUNCTION public.c075_due(TEXT,INTEGER) FROM PUBLIC;
`
