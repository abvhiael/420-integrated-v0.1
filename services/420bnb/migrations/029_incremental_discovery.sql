-- BNB-5.5 commit-ordered cross-property discovery journal, not provider acceptance.
CREATE TABLE bnb_discovery_clock (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 value bigint NOT NULL DEFAULT 0 CHECK(value>=0),
 epoch uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO bnb_discovery_clock(singleton) VALUES(true);
CREATE TABLE bnb_discovery_change (
 cursor bigint PRIMARY KEY CHECK(cursor>0),
 property_id uuid NOT NULL,
 revision bigint NOT NULL CHECK(revision>0),
 source_digest text NOT NULL,
 payload jsonb NOT NULL,
 UNIQUE(property_id,revision)
);
CREATE INDEX bnb_discovery_change_snapshot ON bnb_discovery_change(property_id,cursor DESC);
CREATE TABLE bnb_discovery_resync (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consumer text NOT NULL CHECK(consumer IN ('search','travel')),
 actor text NOT NULL,
 request_key text NOT NULL,
 epoch uuid NOT NULL,
 watermark bigint NOT NULL CHECK(watermark>=0),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '15 minutes',
 UNIQUE(consumer,actor,request_key)
);
CREATE FUNCTION bnb_append_discovery_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE position bigint; pid uuid; rev bigint; body jsonb; digest text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.revision=OLD.revision AND NEW.source_digest=OLD.source_digest
     AND NEW.payload=OLD.payload THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN
   pid:=OLD.property_id; rev:=OLD.revision+1;
   body:=jsonb_build_object('property_id',pid::text,'visible',false,
       'property_version',OLD.payload->'property_version');
   digest:=encode(sha256(convert_to(body::text,'UTF8')),'hex');
 ELSE
   pid:=NEW.property_id; rev:=NEW.revision; body:=NEW.payload; digest:=NEW.source_digest;
 END IF;
 -- Transactional row lock, not nextval: higher cursors cannot commit before lower ones.
 UPDATE bnb_discovery_clock SET value=value+1 WHERE singleton RETURNING value INTO position;
 INSERT INTO bnb_discovery_change(cursor,property_id,revision,source_digest,payload)
 VALUES(position,pid,rev,digest,body);
 RETURN NULL;
END $$;
-- Upgrade seeds existing current revisions deterministically, not fabricated history/receipts.
DO $$
DECLARE entry record; position bigint;
BEGIN
 FOR entry IN SELECT * FROM bnb_discovery_projection ORDER BY property_id LOOP
  UPDATE bnb_discovery_clock SET value=value+1 WHERE singleton RETURNING value INTO position;
  INSERT INTO bnb_discovery_change VALUES(position,entry.property_id,entry.revision,entry.source_digest,entry.payload);
 END LOOP;
END $$;
CREATE TRIGGER bnb_discovery_journal AFTER INSERT OR UPDATE OR DELETE ON bnb_discovery_projection
 FOR EACH ROW EXECUTE FUNCTION bnb_append_discovery_change();
