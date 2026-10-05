package town420

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

	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
	"github.com/420integrated/420-integrated/town/projection"
)

const (
	APIVersion="v1"
	maxResponseBytes=2<<20
)

type RetryPolicy struct {
	MaxAttempts int
	BaseDelay time.Duration
	MaxDelay time.Duration
}

func DefaultRetryPolicy() RetryPolicy {
	return RetryPolicy{MaxAttempts:3,BaseDelay:100*time.Millisecond,MaxDelay:time.Second}
}

func (p RetryPolicy) Validate() error {
	if p.MaxAttempts<1 || p.MaxAttempts>5{return fmt.Errorf("max attempts must be between 1 and 5")}
	if p.BaseDelay<=0 || p.MaxDelay<=0 || p.BaseDelay>p.MaxDelay || p.MaxDelay>2*time.Second{return fmt.Errorf("invalid retry delays")}
	return nil
}

type Client struct {
	baseURL string
	http *http.Client
	token string
	retry RetryPolicy
	sleep func(context.Context,time.Duration) error
}

func New(baseURL string,timeout time.Duration,token string)(*Client,error){
	if timeout<=0{timeout=15*time.Second}
	return NewWithHTTPClient(baseURL,&http.Client{Timeout:timeout},token,DefaultRetryPolicy())
}

func NewWithHTTPClient(baseURL string,hc *http.Client,token string,retry RetryPolicy)(*Client,error){
	baseURL=strings.TrimRight(strings.TrimSpace(baseURL),"/")
	u,err:=url.Parse(baseURL)
	if err!=nil || u.Scheme=="" || u.Host==""{return nil,&Error{Kind:ErrorInvalidRequest,Detail:"invalid base URL",Err:err}}
	host:=u.Hostname()
	if u.Scheme!="https" && host!="127.0.0.1" && host!="localhost" && host!="::1"{return nil,&Error{Kind:ErrorInvalidRequest,Detail:"non-loopback SDK endpoint requires HTTPS"}}
	if hc==nil{return nil,&Error{Kind:ErrorInvalidRequest,Detail:"http client is required"}}
	if err:=retry.Validate();err!=nil{return nil,&Error{Kind:ErrorInvalidRequest,Detail:err.Error()}}
	c:=&Client{baseURL:baseURL,http:hc,token:strings.TrimSpace(token),retry:retry}
	c.sleep=func(ctx context.Context,d time.Duration)error{
		t:=time.NewTimer(d);defer t.Stop()
		select{case<-ctx.Done():return ctx.Err();case<-t.C:return nil}
	}
	return c,nil
}

type ListPostsResult struct {
	Canonical bool
	Items []projection.PostDocument
	NextCursor string
	Generation uint64
}

type CreatePostRequest struct {
	ID string
	ContentRef string
	SHA256 string
	Visibility model.Visibility
}

type CreateThreadRequest struct{ ID string }

type CreateCommentRequest struct {
	ID string
	ParentID string
	ContentRef string
	SHA256 string
}

func (c *Client) ListPublicPosts(ctx context.Context,community,cursor string,limit int)(ListPostsResult,error){
	var out ListPostsResult
	if strings.TrimSpace(community)==""{return out,invalid("community id is required")}
	if limit<1 || limit>200{return out,invalid("limit must be between 1 and 200")}
	q:=url.Values{};q.Set("limit",strconv.Itoa(limit));if cursor!=""{q.Set("cursor",cursor)}
	err:=c.do(ctx,http.MethodGet,"/v1/communities/"+url.PathEscape(community)+"/posts?"+q.Encode(),nil,"",&out)
	return out,err
}

func (c *Client) GetPost(ctx context.Context,id string)(content.Post,error){
	var out content.Post
	if strings.TrimSpace(id)==""{return out,invalid("post id is required")}
	err:=c.do(ctx,http.MethodGet,"/v1/posts/"+url.PathEscape(id),nil,"",&out)
	return out,err
}

func (c *Client) CreatePost(ctx context.Context,community string,req CreatePostRequest,idempotencyKey string)(content.Post,error){
	var out content.Post
	if strings.TrimSpace(community)==""{return out,invalid("community id is required")}
	err:=c.write(ctx,http.MethodPost,"/v1/communities/"+url.PathEscape(community)+"/posts",req,idempotencyKey,&out)
	return out,err
}

func (c *Client) CreateThread(ctx context.Context,post string,req CreateThreadRequest,idempotencyKey string)(content.Thread,error){
	var out content.Thread
	if strings.TrimSpace(post)==""{return out,invalid("post id is required")}
	err:=c.write(ctx,http.MethodPost,"/v1/posts/"+url.PathEscape(post)+"/threads",req,idempotencyKey,&out)
	return out,err
}

func (c *Client) CreateComment(ctx context.Context,thread string,req CreateCommentRequest,idempotencyKey string)(content.Comment,error){
	var out content.Comment
	if strings.TrimSpace(thread)==""{return out,invalid("thread id is required")}
	err:=c.write(ctx,http.MethodPost,"/v1/threads/"+url.PathEscape(thread)+"/comments",req,idempotencyKey,&out)
	return out,err
}

func (c *Client) VotePost(ctx context.Context,post string,value int8,idempotencyKey string)(content.Vote,error){
	var out content.Vote
	if strings.TrimSpace(post)=="" || (value!=1 && value!=-1){return out,invalid("valid post id and vote value are required")}
	err:=c.write(ctx,http.MethodPost,"/v1/posts/"+url.PathEscape(post)+"/votes",map[string]int8{"Value":value},idempotencyKey,&out)
	return out,err
}

func (c *Client) write(ctx context.Context,method,path string,body any,key string,out any)error{
	key=strings.TrimSpace(key)
	if key=="" || len(key)>256{return invalid("valid idempotency key is required")}
	if c.token==""{return &Error{Kind:ErrorUnauthorized,Detail:"bearer token is required for mutation"}}
	return c.do(ctx,method,path,body,key,out)
}

func (c *Client) do(ctx context.Context,method,path string,body any,key string,out any)error{
	if c==nil || c.http==nil{return &Error{Kind:ErrorTransport,Detail:"nil Town client"}}
	var payload []byte
	var err error
	if body!=nil{payload,err=json.Marshal(body);if err!=nil{return &Error{Kind:ErrorInvalidRequest,Detail:"encode request",Err:err}}}
	var last error
	for attempt:=1;attempt<=c.retry.MaxAttempts;attempt++{
		var reader io.Reader
		if payload!=nil{reader=bytes.NewReader(payload)}
		req,err:=http.NewRequestWithContext(ctx,method,c.baseURL+path,reader)
		if err!=nil{return &Error{Kind:ErrorTransport,Err:err}}
		req.Header.Set("Accept","application/json")
		if payload!=nil{req.Header.Set("Content-Type","application/json")}
		if c.token!=""{req.Header.Set("Authorization","Bearer "+c.token)}
		if key!=""{req.Header.Set("Idempotency-Key",key)}
		resp,err:=c.http.Do(req)
		if err!=nil{
			last=&Error{Kind:ErrorTransport,Err:err}
			if attempt<c.retry.MaxAttempts{if err:=c.sleep(ctx,c.delay(attempt));err!=nil{return &Error{Kind:ErrorTransport,Err:err}};continue}
			return last
		}
		if shouldRetry(resp.StatusCode) && attempt<c.retry.MaxAttempts{
			_,_=io.Copy(io.Discard,io.LimitReader(resp.Body,64<<10));resp.Body.Close()
			if err:=c.sleep(ctx,c.delay(attempt));err!=nil{return &Error{Kind:ErrorTransport,Err:err}}
			continue
		}
		if resp.StatusCode<200 || resp.StatusCode>=300{return decodeHTTPError(resp)}
		defer resp.Body.Close()
		if out==nil{return nil}
		dec:=json.NewDecoder(io.LimitReader(resp.Body,maxResponseBytes+1))
		if err:=dec.Decode(out);err!=nil{return &Error{Kind:ErrorDecode,Detail:"decode response",Err:err}}
		return nil
	}
	return last
}

func (c *Client) delay(attempt int)time.Duration{
	d:=c.retry.BaseDelay
	for i:=1;i<attempt;i++{d*=2;if d>=c.retry.MaxDelay{return c.retry.MaxDelay}}
	if d>c.retry.MaxDelay{return c.retry.MaxDelay}
	return d
}

func shouldRetry(status int)bool{
	switch status{case http.StatusTooManyRequests,http.StatusBadGateway,http.StatusServiceUnavailable,http.StatusGatewayTimeout:return true}
	return false
}

func decodeHTTPError(resp *http.Response)error{
	defer resp.Body.Close()
	payload,err:=io.ReadAll(io.LimitReader(resp.Body,64<<10))
	if err!=nil{return &Error{Kind:ErrorTransport,StatusCode:resp.StatusCode,Err:err}}
	var env struct{Error string}
	_ = json.Unmarshal(payload,&env)
	detail:=strings.TrimSpace(env.Error);if detail==""{detail=fmt.Sprintf("HTTP %d",resp.StatusCode)}
	kind:=ErrorTransport
	switch resp.StatusCode{
	case http.StatusBadRequest:kind=ErrorInvalidRequest
	case http.StatusUnauthorized:kind=ErrorUnauthorized
	case http.StatusForbidden:kind=ErrorForbidden
	case http.StatusNotFound:kind=ErrorNotFound
	case http.StatusConflict:kind=ErrorConflict
	case http.StatusTooManyRequests:kind=ErrorRateLimited
	case http.StatusBadGateway,http.StatusServiceUnavailable,http.StatusGatewayTimeout:kind=ErrorUnavailable
	}
	return &Error{Kind:kind,StatusCode:resp.StatusCode,Detail:detail}
}

func invalid(detail string)error{return &Error{Kind:ErrorInvalidRequest,Detail:detail}}
