package town420

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
)

func TestClientRejectsInsecureRemoteEndpointAndInvalidRetry(t *testing.T){
	if _,err:=New("http://example.com",time.Second,"");err==nil{t.Fatal("expected insecure remote rejection")}
	_,err:=NewWithHTTPClient("http://127.0.0.1:1",&http.Client{}, "", RetryPolicy{MaxAttempts:6,BaseDelay:time.Millisecond,MaxDelay:time.Second})
	if err==nil{t.Fatal("expected retry bound rejection")}
}

func TestClientListAndGet(t *testing.T){
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		w.Header().Set("Content-Type","application/json")
		switch r.URL.Path{
		case "/v1/communities/community:1/posts":
			_ = json.NewEncoder(w).Encode(map[string]any{"canonical":false,"items":[]any{},"next_cursor":"cursor-2","generation":2})
		case "/v1/posts/post:1":
			_ = json.NewEncoder(w).Encode(content.Post{ID:"post:1",CommunityID:"community:1",AuthorID:"actor:alice",Visibility:model.VisibilityPublic,Revision:1,Status:content.StatusActive})
		default:http.NotFound(w,r)
		}
	}))
	defer server.Close()
	c,err:=New(server.URL,time.Second,"")
	if err!=nil{t.Fatal(err)}
	page,err:=c.ListPublicPosts(context.Background(),"community:1","",20)
	if err!=nil{t.Fatal(err)}
	if page.Canonical || page.Generation!=2 || page.NextCursor!="cursor-2"{t.Fatalf("page=%+v",page)}
	p,err:=c.GetPost(context.Background(),"post:1")
	if err!=nil || p.ID!="post:1"{t.Fatalf("post=%+v err=%v",p,err)}
}

func TestMutationCarriesBearerAndStableIdempotencyAcrossRetry(t *testing.T){
	var attempts atomic.Int32
	var keys []string
	var auths []string
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		keys=append(keys,r.Header.Get("Idempotency-Key"))
		auths=append(auths,r.Header.Get("Authorization"))
		if attempts.Add(1)==1{w.WriteHeader(http.StatusServiceUnavailable);return}
		w.Header().Set("Content-Type","application/json")
		_ = json.NewEncoder(w).Encode(content.Post{ID:"post:1",CommunityID:"community:1",AuthorID:"actor:alice",Visibility:model.VisibilityPublic,Revision:1,Status:content.StatusActive})
	}))
	defer server.Close()
	c,err:=NewWithHTTPClient(server.URL,&http.Client{Timeout:time.Second},"token",RetryPolicy{MaxAttempts:2,BaseDelay:time.Millisecond,MaxDelay:time.Millisecond})
	if err!=nil{t.Fatal(err)}
	c.sleep=func(context.Context,time.Duration)error{return nil}
	p,err:=c.CreatePost(context.Background(),"community:1",CreatePostRequest{ID:"post:1",ContentRef:"storage://1",SHA256:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Visibility:model.VisibilityPublic},"idem-1")
	if err!=nil{t.Fatal(err)}
	if p.ID!="post:1" || attempts.Load()!=2{t.Fatalf("post=%+v attempts=%d",p,attempts.Load())}
	if len(keys)!=2 || keys[0]!="idem-1" || keys[1]!="idem-1"{t.Fatalf("keys=%v",keys)}
	if auths[0]!="Bearer token" || auths[1]!="Bearer token"{t.Fatalf("auth=%v",auths)}
}

func TestClientDoesNotRetryNonRetryableConflict(t *testing.T){
	var attempts atomic.Int32
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		attempts.Add(1)
		w.Header().Set("Content-Type","application/json")
		w.WriteHeader(http.StatusConflict)
		_,_=w.Write([]byte("{\"error\":\"idempotency conflict\"}"))
	}))
	defer server.Close()
	c,err:=NewWithHTTPClient(server.URL,&http.Client{Timeout:time.Second},"token",RetryPolicy{MaxAttempts:3,BaseDelay:time.Millisecond,MaxDelay:time.Millisecond})
	if err!=nil{t.Fatal(err)}
	_,err=c.CreatePost(context.Background(),"community:1",CreatePostRequest{ID:"post:1",ContentRef:"r",SHA256:"a",Visibility:model.VisibilityPublic},"idem")
	var sdkErr *Error
	if !errors.As(err,&sdkErr) || sdkErr.Kind!=ErrorConflict{t.Fatalf("err=%v",err)}
	if attempts.Load()!=1{t.Fatalf("attempts=%d",attempts.Load())}
}

func TestClientRequiresTokenAndIdempotencyForWrites(t *testing.T){
	c,err:=New("http://127.0.0.1:1",time.Second,"")
	if err!=nil{t.Fatal(err)}
	if _,err:=c.CreatePost(context.Background(),"community:1",CreatePostRequest{},"idem");err==nil{t.Fatal("expected token requirement")}
	c.token="token"
	if _,err:=c.CreatePost(context.Background(),"community:1",CreatePostRequest{},"");err==nil{t.Fatal("expected idempotency requirement")}
}

func TestClientMapsRateLimitAfterRetryBudget(t *testing.T){
	var attempts atomic.Int32
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		attempts.Add(1);w.Header().Set("Content-Type","application/json");w.WriteHeader(http.StatusTooManyRequests);_,_=w.Write([]byte("{\"error\":\"slow down\"}"))
	}))
	defer server.Close()
	c,err:=NewWithHTTPClient(server.URL,&http.Client{Timeout:time.Second},"",RetryPolicy{MaxAttempts:2,BaseDelay:time.Millisecond,MaxDelay:time.Millisecond})
	if err!=nil{t.Fatal(err)}
	c.sleep=func(context.Context,time.Duration)error{return nil}
	_,err=c.GetPost(context.Background(),"post:1")
	var sdkErr *Error
	if !errors.As(err,&sdkErr) || sdkErr.Kind!=ErrorRateLimited{t.Fatalf("err=%v",err)}
	if attempts.Load()!=2{t.Fatalf("attempts=%d",attempts.Load())}
}
