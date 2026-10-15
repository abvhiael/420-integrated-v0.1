package complianceauth

import (
	"context"
	"errors"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"
)

func TestC064PostgreSQLDraftCASAndPersistence(t *testing.T) {
	dsn := os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
	if dsn == "" { t.Fatal("C06.4 requires real PostgreSQL qualification, not a skipped store test") }
	a, err := OpenPostgreSQLPublicationStore(dsn)
	if err != nil { t.Fatal(err) }
	defer a.DB.Close()
	b, err := OpenPostgreSQLPublicationStore(dsn)
	if err != nil { t.Fatal(err) }
	defer b.DB.Close()
	left, right := C064PostgreSQLDrafts{DB:a.DB}, C064PostgreSQLDrafts{DB:b.DB}
	ctx := context.Background()
	if err := left.Migrate(ctx); err != nil { t.Fatal(err) }
	if err := right.Migrate(ctx); err != nil { t.Fatal(err) }
	scope := C064AuthorScope{Tenant:"qualification-"+strconv.FormatInt(time.Now().UnixNano(),10),Domain:"delivery",Jurisdiction:"bc"}
	defer func() {
		_, _ = a.DB.ExecContext(ctx,"DELETE FROM compliance_author_versions WHERE tenant=$1",scope.Tenant)
		_, _ = a.DB.ExecContext(ctx,"DELETE FROM compliance_author_heads WHERE tenant=$1",scope.Tenant)
	}()
	now := time.Now().UTC()
	req := c064FixtureRequest()
	citations,digest,err := c064Resolve(ctx,c064TestSource{},c064FixtureScope,req.Citations,now)
	if err != nil {t.Fatal(err)}
	schema := req.Schema; schema.SourceDigest=digest
	first,err := left.Save(ctx,scope,"draft1","author-a",0,schema,citations,now)
	if err != nil || first.Revision!=1 {t.Fatal("initial persistent save",err)}
	if _,err:=right.Save(ctx,scope,"draft1","author-a",0,schema,citations,now);!errors.Is(err,ErrAuthorConflict) {t.Fatal("initial replay",err)}
	read,err:=right.Load(ctx,scope,"draft1","author-a",1)
	if err!=nil||read.DocumentDigest!=first.DocumentDigest {t.Fatal("independent connection persisted revision",err)}
	schema.Hours.EndLocal="18:00"
	var wg sync.WaitGroup
	var mu sync.Mutex
	winners:=0
	for i:=0;i<24;i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			store:=left;if i%2==0 {store=right}
			v,err:=store.Save(ctx,scope,"draft1","author-a",1,schema,citations,now)
			if err==nil {mu.Lock();winners++;mu.Unlock();if v.Revision!=2 {t.Error("invalid revision")}}
			if err!=nil&&!errors.Is(err,ErrAuthorConflict) {t.Error("CAS error",err)}
		}(i)
	}
	wg.Wait()
	if winners!=1 {t.Fatal("CAS winners",winners)}
	old,err:=left.Load(ctx,scope,"draft1","author-a",1)
	if err!=nil||old.Schema.Hours.EndLocal!="17:00"||old.DocumentDigest!=first.DocumentDigest {t.Fatal("immutable historical revision",err)}
	latest,err:=right.Load(ctx,scope,"draft1","author-a",0)
	if err!=nil||latest.Revision!=2 {t.Fatal("latest revision",err)}
	diff:=c064Comparison(old,latest)
	if len(diff.Changes)!=1||diff.Changes[0].Field!="Hours" {t.Fatal("persisted version comparison")}
	if _,err:=right.Load(ctx,scope,"draft1","other-author",1);err==nil {t.Fatal("other author read")}
	other:=scope;other.Tenant="other"
	if _,err:=right.Load(ctx,other,"draft1","author-a",1);err==nil {t.Fatal("cross-tenant read")}
	if _,err:=right.Save(ctx,scope,"draft1","other-author",2,schema,citations,now);!errors.Is(err,ErrAuthorDenied) {t.Fatal("cross-author mutation",err)}
	cancelled,cancel:=context.WithCancel(ctx);cancel()
	if _,err:=left.Save(cancelled,scope,"draft1","author-a",2,schema,citations,now);err==nil {t.Fatal("cancelled save")}
	// Persistent data integrity is checked on reads; corrupt private document
	// content cannot be silently served as a previously qualified revision.
	_,err=a.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document_digest=$1 WHERE tenant=$2 AND revision=1",Digest([]byte("corrupt")),scope.Tenant)
	if err!=nil {t.Fatal(err)}
	if _,err:=right.Load(ctx,scope,"draft1","author-a",1);!errors.Is(err,ErrUnavailable) {t.Fatal("corrupt document accepted",err)}
	if err:=b.DB.Close();err!=nil {t.Fatal(err)}
	if _,err:=right.Load(ctx,scope,"draft1","author-a",0);!errors.Is(err,ErrUnavailable) {t.Fatal("database outage not fail-closed",err)}
}
