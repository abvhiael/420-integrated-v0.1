package httpapi

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
	"github.com/420integrated/420-integrated/reputation/service"
)

type fakeReviewService struct {
	created int
	updated int
	review model.Review
}

func (f *fakeReviewService) CreateReview(context.Context, service.CreateReviewInput, time.Time) (model.Review, error) {
	f.created++
	return f.review, nil
}
func (f *fakeReviewService) GetReview(context.Context, string) (model.Review, error) { return f.review, nil }
func (f *fakeReviewService) ListReviews(context.Context, model.Domain, model.SubjectRef) ([]model.Review, error) {
	return []model.Review{f.review}, nil
}
func (f *fakeReviewService) UpdateReview(context.Context, service.UpdateReviewInput, time.Time) (model.Review, error) {
	f.updated++
	return f.review, nil
}
func (f *fakeReviewService) CreateResponse(context.Context, service.CreateResponseInput, time.Time) (model.Response, error) {
	return model.Response{ReviewID:"review-1", Subject:f.review.Subject, Actor:f.review.Subject, BodyRef:"storage://response", Version:1, CreatedAt:f.review.CreatedAt, UpdatedAt:f.review.UpdatedAt}, nil
}
func (f *fakeReviewService) GetResponse(context.Context, string) (model.Response, error) {
	return model.Response{ReviewID:"review-1", Subject:f.review.Subject, Actor:f.review.Subject, BodyRef:"storage://response", Version:1, CreatedAt:f.review.CreatedAt, UpdatedAt:f.review.UpdatedAt}, nil
}
func (f *fakeReviewService) UpdateResponse(context.Context, service.UpdateResponseInput, time.Time) (model.Response, error) {
	return model.Response{ReviewID:"review-1", Subject:f.review.Subject, Actor:f.review.Subject, BodyRef:"storage://response-2", Version:2, CreatedAt:f.review.CreatedAt, UpdatedAt:f.review.UpdatedAt.Add(time.Minute)}, nil
}

func testReview() model.Review {
	now := time.Date(2026,9,18,3,0,0,0,time.UTC)
	return model.Review{
		ID:"review-1", Domain:model.DomainClassifieds,
		Subject:model.SubjectRef{Type:"PROFILE",ID:"seller-1"},
		Author:model.SubjectRef{Type:"PROFILE",ID:"buyer-1"},
		Rating:5, Verification:model.VerificationUnverified,
		Status:model.ReviewActive, Version:1, CreatedAt:now, UpdatedAt:now,
	}
}

func TestCreateRequiresIdempotencyAndReplays(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server, err := New(fake)
	if err != nil { t.Fatal(err) }
	body := []byte(`{"reviewId":"review-1","domain":"CLASSIFIEDS","subjectType":"PROFILE","subjectId":"seller-1","reviewerType":"PROFILE","reviewerId":"buyer-1","rating":5,"verification":"UNVERIFIED_OPINION"}`)

	req := httptest.NewRequest(http.MethodPost, "/v1/reviews", bytes.NewReader(body))
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest { t.Fatalf("code=%d",res.Code) }

	for i:=0;i<2;i++ {
		req = httptest.NewRequest(http.MethodPost, "/v1/reviews", bytes.NewReader(body))
		req.Header.Set("Idempotency-Key","idem-1")
		res = httptest.NewRecorder()
		server.Handler().ServeHTTP(res, req)
		if res.Code != http.StatusCreated { t.Fatalf("code=%d body=%s",res.Code,res.Body.String()) }
	}
	if fake.created != 1 { t.Fatalf("create calls=%d want=1",fake.created) }
}

func TestIdempotencyKeyCannotBeReusedForDifferentRequest(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server, _ := New(fake)
	first := []byte(`{"reviewId":"review-1","domain":"CLASSIFIEDS","subjectType":"PROFILE","subjectId":"seller-1","reviewerType":"PROFILE","reviewerId":"buyer-1","rating":5,"verification":"UNVERIFIED_OPINION"}`)
	second := []byte(`{"reviewId":"review-2","domain":"CLASSIFIEDS","subjectType":"PROFILE","subjectId":"seller-1","reviewerType":"PROFILE","reviewerId":"buyer-1","rating":4,"verification":"UNVERIFIED_OPINION"}`)
	for _, body := range [][]byte{first,second} {
		req := httptest.NewRequest(http.MethodPost,"/v1/reviews",bytes.NewReader(body))
		req.Header.Set("Idempotency-Key","same")
		res := httptest.NewRecorder()
		server.Handler().ServeHTTP(res,req)
		if bytes.Equal(body, second) && res.Code != http.StatusBadRequest { t.Fatalf("code=%d",res.Code) }
	}
}

func TestListAndGet(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server,_ := New(fake)
	req := httptest.NewRequest(http.MethodGet,"/v1/reviews/review-1",nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusOK { t.Fatalf("get code=%d",res.Code) }

	req = httptest.NewRequest(http.MethodGet,"/v1/reviews/CLASSIFIEDS/PROFILE/seller-1?limit=10",nil)
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusOK { t.Fatalf("list code=%d body=%s",res.Code,res.Body.String()) }
}

func TestUpdateRequiresIdempotency(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server,_ := New(fake)
	body := []byte(`{"actorType":"PROFILE","actorId":"buyer-1","expectedVersion":1,"rating":4}`)
	req := httptest.NewRequest(http.MethodPatch,"/v1/reviews/review-1",bytes.NewReader(body))
	req.Header.Set("Idempotency-Key","patch-1")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusOK { t.Fatalf("code=%d body=%s",res.Code,res.Body.String()) }
	if fake.updated != 1 { t.Fatalf("updates=%d",fake.updated) }
}

func TestStrictJSONRejectsUnknownFields(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server,_ := New(fake)
	body := []byte(`{"reviewId":"review-1","domain":"CLASSIFIEDS","subjectType":"PROFILE","subjectId":"seller-1","reviewerType":"PROFILE","reviewerId":"buyer-1","rating":5,"verification":"UNVERIFIED_OPINION","surprise":true}`)
	req := httptest.NewRequest(http.MethodPost,"/v1/reviews",bytes.NewReader(body))
	req.Header.Set("Idempotency-Key","strict")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusBadRequest { t.Fatalf("code=%d",res.Code) }
}


func TestResponseRoutesRequireIdempotencyOnWrites(t *testing.T) {
	fake := &fakeReviewService{review:testReview()}
	server,_ := New(fake)
	body := []byte(`{"actorType":"PROFILE","actorId":"seller-1","bodyRef":"storage://response"}`)
	req := httptest.NewRequest(http.MethodPost,"/v1/reviews/review-1/response",bytes.NewReader(body))
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusBadRequest { t.Fatalf("create response code=%d",res.Code) }

	req = httptest.NewRequest(http.MethodPost,"/v1/reviews/review-1/response",bytes.NewReader(body))
	req.Header.Set("Idempotency-Key","resp-1")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusCreated { t.Fatalf("create response code=%d body=%s",res.Code,res.Body.String()) }

	req = httptest.NewRequest(http.MethodGet,"/v1/reviews/review-1/response",nil)
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusOK { t.Fatalf("get response code=%d",res.Code) }

	update := []byte(`{"actorType":"PROFILE","actorId":"seller-1","bodyRef":"storage://response-2","expectedVersion":1}`)
	req = httptest.NewRequest(http.MethodPatch,"/v1/reviews/review-1/response",bytes.NewReader(update))
	req.Header.Set("Idempotency-Key","resp-2")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res,req)
	if res.Code != http.StatusOK { t.Fatalf("update response code=%d body=%s",res.Code,res.Body.String()) }
}
