package reputation420

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
	"github.com/420integrated/420-integrated/reputation/projection"
)

const (
	APIVersion = "v1"
	maxResponseBytes = 2 << 20
)

type Client struct {
	baseURL string
	http *http.Client
}

func New(baseURL string, timeout time.Duration) (*Client,error) {
	if timeout <= 0 { timeout = 15*time.Second }
	return NewWithHTTPClient(baseURL,&http.Client{Timeout:timeout})
}

func NewWithHTTPClient(baseURL string, hc *http.Client) (*Client,error) {
	baseURL=strings.TrimRight(strings.TrimSpace(baseURL),"/")
	u,err:=url.Parse(baseURL)
	if err!=nil || u.Scheme=="" || u.Host=="" {
		return nil,&Error{Kind:ErrorInvalidRequest,Detail:"invalid base URL",Err:err}
	}
	host:=u.Hostname()
	if u.Scheme!="https" && host!="127.0.0.1" && host!="localhost" && host!="::1" {
		return nil,&Error{Kind:ErrorInvalidRequest,Detail:"non-loopback SDK endpoint requires HTTPS"}
	}
	if hc==nil { return nil,&Error{Kind:ErrorInvalidRequest,Detail:"http client is required"} }
	return &Client{baseURL:baseURL,http:hc},nil
}

type SummaryResult struct {
	Summary model.ReputationSummary
	AverageRating float64
}

type ListReviewsResult struct {
	Items []model.Review
	Count int
}

type ListModerationResult struct {
	Items []model.ModerationRecord
	Count int
}

type CreateReviewRequest struct {
	ReviewID string
	Domain model.Domain
	Subject model.SubjectRef
	Reviewer model.SubjectRef
	Rating uint8
	BodyRef string
	AttachmentRefs []string
	Verification model.VerificationState
	InteractionKind string
	EvidenceRef string
}

type UpdateReviewRequest struct {
	Actor model.SubjectRef
	ExpectedVersion uint32
	Rating uint8
	BodyRef string
	AttachmentRefs []string
}

type ResponseRequest struct {
	Actor model.SubjectRef
	BodyRef string
	ExpectedVersion uint32
}

type ReportRequest struct {
	ModerationID string
	Actor model.SubjectRef
	Reason model.ModerationReason
	BodyRef string
}

type ModerateRequest struct {
	ModerationID string
	Actor model.SubjectRef
	Action model.ModerationAction
	Reason model.ModerationReason
	BodyRef string
	ParentID string
}

func (c *Client) Summary(ctx context.Context, domain model.Domain, subject model.SubjectRef)(SummaryResult,error){
	var out SummaryResult
	err:=c.get(ctx,reputationPath(domain,subject),&out)
	return out,err
}

func (c *Client) Projection(ctx context.Context, domain model.Domain, subject model.SubjectRef)(projection.Document,error){
	var out projection.Document
	err:=c.get(ctx,reputationPath(domain,subject)+"/projection",&out)
	return out,err
}

func (c *Client) GetReview(ctx context.Context,id string)(model.Review,error){
	var out model.Review
	if strings.TrimSpace(id)=="" { return out,invalid("review id is required") }
	err:=c.get(ctx,"/v1/reviews/"+url.PathEscape(strings.TrimSpace(id)),&out)
	return out,err
}

func (c *Client) ListReviews(ctx context.Context,domain model.Domain,subject model.SubjectRef,limit int)(ListReviewsResult,error){
	var out ListReviewsResult
	if !model.ValidDomain(domain) { return out,invalid("invalid reputation domain") }
	if err:=subject.Validate(); err!=nil { return out,invalid(err.Error()) }
	if limit<0 || limit>200 { return out,invalid("limit must be between 0 and 200") }
	path:="/v1/reviews/"+url.PathEscape(string(domain))+"/"+url.PathEscape(subject.Type)+"/"+url.PathEscape(subject.ID)
	if limit>0 { path+="?limit="+strconv.Itoa(limit) }
	err:=c.get(ctx,path,&out)
	return out,err
}

func (c *Client) CreateReview(ctx context.Context, req CreateReviewRequest, idempotencyKey string)(model.Review,error){
	var out model.Review
	body:=map[string]any{
		"reviewId":req.ReviewID,"domain":req.Domain,
		"subjectType":req.Subject.Type,"subjectId":req.Subject.ID,
		"reviewerType":req.Reviewer.Type,"reviewerId":req.Reviewer.ID,
		"rating":req.Rating,"bodyRef":req.BodyRef,"attachmentRefs":req.AttachmentRefs,
		"verification":req.Verification,"interactionKind":req.InteractionKind,"evidenceRef":req.EvidenceRef,
	}
	err:=c.write(ctx,http.MethodPost,"/v1/reviews",body,idempotencyKey,&out)
	return out,err
}

func (c *Client) UpdateReview(ctx context.Context,id string,req UpdateReviewRequest,idempotencyKey string)(model.Review,error){
	var out model.Review
	if strings.TrimSpace(id)=="" { return out,invalid("review id is required") }
	body:=map[string]any{
		"actorType":req.Actor.Type,"actorId":req.Actor.ID,"expectedVersion":req.ExpectedVersion,
		"rating":req.Rating,"bodyRef":req.BodyRef,"attachmentRefs":req.AttachmentRefs,
	}
	err:=c.write(ctx,http.MethodPatch,"/v1/reviews/"+url.PathEscape(strings.TrimSpace(id)),body,idempotencyKey,&out)
	return out,err
}

func (c *Client) GetResponse(ctx context.Context,reviewID string)(model.Response,error){
	var out model.Response
	if strings.TrimSpace(reviewID)=="" { return out,invalid("review id is required") }
	err:=c.get(ctx,"/v1/reviews/"+url.PathEscape(strings.TrimSpace(reviewID))+"/response",&out)
	return out,err
}

func (c *Client) CreateResponse(ctx context.Context,reviewID string,req ResponseRequest,idempotencyKey string)(model.Response,error){
	var out model.Response
	body:=map[string]any{"actorType":req.Actor.Type,"actorId":req.Actor.ID,"bodyRef":req.BodyRef}
	err:=c.write(ctx,http.MethodPost,reviewSubPath(reviewID,"response"),body,idempotencyKey,&out)
	return out,err
}

func (c *Client) UpdateResponse(ctx context.Context,reviewID string,req ResponseRequest,idempotencyKey string)(model.Response,error){
	var out model.Response
	body:=map[string]any{"actorType":req.Actor.Type,"actorId":req.Actor.ID,"bodyRef":req.BodyRef,"expectedVersion":req.ExpectedVersion}
	err:=c.write(ctx,http.MethodPatch,reviewSubPath(reviewID,"response"),body,idempotencyKey,&out)
	return out,err
}

func (c *Client) Report(ctx context.Context,reviewID string,req ReportRequest,idempotencyKey string)(model.ModerationRecord,error){
	var out model.ModerationRecord
	body:=map[string]any{"moderationId":req.ModerationID,"actorType":req.Actor.Type,"actorId":req.Actor.ID,"reason":req.Reason,"bodyRef":req.BodyRef}
	err:=c.write(ctx,http.MethodPost,reviewSubPath(reviewID,"report"),body,idempotencyKey,&out)
	return out,err
}

func (c *Client) Moderate(ctx context.Context,reviewID string,req ModerateRequest,idempotencyKey string)(model.ModerationRecord,error){
	var out model.ModerationRecord
	body:=map[string]any{"moderationId":req.ModerationID,"actorType":req.Actor.Type,"actorId":req.Actor.ID,"action":req.Action,"reason":req.Reason,"bodyRef":req.BodyRef,"parentId":req.ParentID}
	err:=c.write(ctx,http.MethodPost,reviewSubPath(reviewID,"moderation"),body,idempotencyKey,&out)
	return out,err
}

func (c *Client) ListModeration(ctx context.Context,reviewID string)(ListModerationResult,error){
	var out ListModerationResult
	err:=c.get(ctx,reviewSubPath(reviewID,"moderation"),&out)
	return out,err
}

func reputationPath(domain model.Domain,subject model.SubjectRef) string {
	return "/v1/reputation/"+url.PathEscape(string(domain))+"/"+url.PathEscape(subject.Type)+"/"+url.PathEscape(subject.ID)
}

func reviewSubPath(reviewID,suffix string) string {
	return "/v1/reviews/"+url.PathEscape(strings.TrimSpace(reviewID))+"/"+suffix
}

func (c *Client) get(ctx context.Context,path string,out any) error {
	return c.do(ctx,http.MethodGet,path,nil,"",out)
}

func (c *Client) write(ctx context.Context,method,path string,body any,idempotencyKey string,out any) error {
	if strings.TrimSpace(idempotencyKey)=="" { return invalid("idempotency key is required") }
	return c.do(ctx,method,path,body,idempotencyKey,out)
}

func (c *Client) do(ctx context.Context,method,path string,body any,idempotencyKey string,out any) error {
	if c==nil || c.http==nil { return &Error{Kind:ErrorTransport,Detail:"nil Reputation client"} }
	var reader io.Reader
	if body!=nil {
		payload,err:=json.Marshal(body)
		if err!=nil { return &Error{Kind:ErrorInvalidRequest,Detail:"encode request",Err:err} }
		reader=bytes.NewReader(payload)
	}
	req,err:=http.NewRequestWithContext(ctx,method,c.baseURL+path,reader)
	if err!=nil { return &Error{Kind:ErrorTransport,Err:err} }
	req.Header.Set("Accept","application/json")
	if body!=nil { req.Header.Set("Content-Type","application/json") }
	if idempotencyKey!="" { req.Header.Set("Idempotency-Key",idempotencyKey) }
	resp,err:=c.http.Do(req)
	if err!=nil { return &Error{Kind:ErrorTransport,Err:err} }
	defer resp.Body.Close()
	if resp.StatusCode<200 || resp.StatusCode>=300 { return decodeHTTPError(resp) }
	if out==nil { return nil }
	dec:=json.NewDecoder(io.LimitReader(resp.Body,maxResponseBytes+1))
	if err:=dec.Decode(out); err!=nil {
		return &Error{Kind:ErrorDecode,Detail:"decode response",Err:err}
	}
	return nil
}

func decodeHTTPError(resp *http.Response) error {
	payload,err:=io.ReadAll(io.LimitReader(resp.Body,64<<10))
	if err!=nil { return &Error{Kind:ErrorTransport,StatusCode:resp.StatusCode,Err:err} }
	var env struct{ Error string }
	_ = json.Unmarshal(payload,&env)
	detail:=strings.TrimSpace(env.Error)
	if detail=="" { detail=fmt.Sprintf("HTTP %d",resp.StatusCode) }
	kind:=ErrorTransport
	switch resp.StatusCode {
	case http.StatusBadRequest: kind=ErrorInvalidRequest
	case http.StatusUnauthorized,http.StatusForbidden: kind=ErrorUnauthorized
	case http.StatusNotFound: kind=ErrorNotFound
	case http.StatusConflict: kind=ErrorConflict
	case http.StatusTooManyRequests: kind=ErrorRateLimited
	case http.StatusBadGateway,http.StatusServiceUnavailable,http.StatusGatewayTimeout: kind=ErrorUnavailable
	}
	return &Error{Kind:kind,StatusCode:resp.StatusCode,Detail:detail}
}

func invalid(detail string) error { return &Error{Kind:ErrorInvalidRequest,Detail:detail} }
