package reputation420

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
	"github.com/420integrated/420-integrated/reputation/projection"
)

func TestClientRejectsInsecureRemoteEndpoint(t *testing.T) {
	if _,err:=New("http://example.com",time.Second); err==nil {
		t.Fatal("expected insecure remote endpoint rejection")
	}
	if _,err:=New("http://127.0.0.1:8080",time.Second); err!=nil {
		t.Fatalf("loopback http should be allowed: %v",err)
	}
}

func TestClientSummaryProjectionAndReviewRead(t *testing.T) {
	subject:=model.SubjectRef{Type:"PROFILE",ID:"seller-1"}
	id,_:=projection.StableID(model.DomainClassifieds,subject)
	now:=time.Date(2026,9,18,22,0,0,0,time.UTC)
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		w.Header().Set("Content-Type","application/json")
		switch r.URL.Path {
		case "/v1/reputation/CLASSIFIEDS/PROFILE/seller-1":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"summary":model.ReputationSummary{
					Domain:model.DomainClassifieds,Subject:subject,PolicyVersion:model.ReputationPolicyVersion,
					VisibleReviewCount:1,UnverifiedReviewCount:1,RatingDistribution:model.RatingDistribution{Five:1},UpdatedAt:now,
				},
				"averageRating":5,
			})
		case "/v1/reputation/CLASSIFIEDS/PROFILE/seller-1/projection":
			_ = json.NewEncoder(w).Encode(projection.Document{
				Schema:projection.SchemaVersion,ID:id,Domain:model.DomainClassifieds,Subject:subject,
				PolicyVersion:model.ReputationPolicyVersion,VisibleReviewCount:1,UnverifiedReviewCount:1,
				RatingDistribution:model.RatingDistribution{Five:1},AverageRating:5,UpdatedAt:now,
				Source:"420Reputation derived public projection",Authoritative:false,
			})
		case "/v1/reviews/review-1":
			_ = json.NewEncoder(w).Encode(model.Review{ID:"review-1",Domain:model.DomainClassifieds,Subject:subject})
		default:
			http.NotFound(w,r)
		}
	}))
	defer server.Close()

	client,err:=New(server.URL,time.Second)
	if err!=nil { t.Fatal(err) }
	summary,err:=client.Summary(context.Background(),model.DomainClassifieds,subject)
	if err!=nil { t.Fatal(err) }
	if summary.AverageRating!=5 || summary.Summary.PolicyVersion!=model.ReputationPolicyVersion { t.Fatalf("summary=%+v",summary) }
	doc,err:=client.Projection(context.Background(),model.DomainClassifieds,subject)
	if err!=nil { t.Fatal(err) }
	if doc.ID!=id || doc.Authoritative { t.Fatalf("projection=%+v",doc) }
	review,err:=client.GetReview(context.Background(),"review-1")
	if err!=nil { t.Fatal(err) }
	if review.ID!="review-1" { t.Fatalf("review=%+v",review) }
}

func TestClientWritesCarryIdempotencyAndTypedBody(t *testing.T) {
	var sawKey string
	var sawPath string
	var sawBody map[string]any
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		sawKey=r.Header.Get("Idempotency-Key")
		sawPath=r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&sawBody)
		w.Header().Set("Content-Type","application/json")
		_ = json.NewEncoder(w).Encode(model.Review{ID:"review-1"})
	}))
	defer server.Close()
	client,err:=New(server.URL,time.Second)
	if err!=nil { t.Fatal(err) }

	_,err=client.CreateReview(context.Background(),CreateReviewRequest{
		ReviewID:"review-1",Domain:model.DomainClassifieds,
		Subject:model.SubjectRef{Type:"PROFILE",ID:"seller-1"},
		Reviewer:model.SubjectRef{Type:"PROFILE",ID:"buyer-1"},
		Rating:5,Verification:model.VerificationUnverified,
	},"idem-1")
	if err!=nil { t.Fatal(err) }
	if sawKey!="idem-1" || sawPath!="/v1/reviews" { t.Fatalf("key=%q path=%q",sawKey,sawPath) }
	if sawBody["subjectId"]!="seller-1" || sawBody["reviewerId"]!="buyer-1" { t.Fatalf("body=%+v",sawBody) }

	if _,err:=client.CreateReview(context.Background(),CreateReviewRequest{},""); err==nil {
		t.Fatal("expected missing idempotency key rejection")
	}
}

func TestClientMapsHTTPError(t *testing.T) {
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		w.Header().Set("Content-Type","application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_,_ = w.Write([]byte(`{"error":"review creation rate limit exceeded"}`))
	}))
	defer server.Close()
	client,err:=New(server.URL,time.Second)
	if err!=nil { t.Fatal(err) }
	_,err=client.GetReview(context.Background(),"review-1")
	var sdkErr *Error
	if !errors.As(err,&sdkErr) { t.Fatalf("expected typed error, got %v",err) }
	if sdkErr.Kind!=ErrorRateLimited || !strings.Contains(sdkErr.Detail,"rate limit") {
		t.Fatalf("unexpected sdk error: %+v",sdkErr)
	}
}

func TestClientListBounds(t *testing.T) {
	client,err:=New("http://127.0.0.1:1",time.Second)
	if err!=nil { t.Fatal(err) }
	_,err=client.ListReviews(context.Background(),model.DomainClassifieds,model.SubjectRef{Type:"PROFILE",ID:"seller"},201)
	var sdkErr *Error
	if !errors.As(err,&sdkErr) || sdkErr.Kind!=ErrorInvalidRequest {
		t.Fatalf("expected invalid request, got %v",err)
	}
}
