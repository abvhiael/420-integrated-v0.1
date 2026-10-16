package complianceauth
import("bytes";"context";"crypto/ed25519";"crypto/rand";"crypto/tls";"crypto/x509";"crypto/x509/pkix";"encoding/json";"math/big";"net";"net/http";"net/http/httptest";"net/url";"os";"strings";"sync";"sync/atomic";"testing";"time")
type c073CertSource struct{mu sync.Mutex;cert tls.Certificate;fail bool;calls atomic.Int32}
func(s *c073CertSource)Certificate(ctx context.Context)(tls.Certificate,error){s.calls.Add(1);s.mu.Lock();defer s.mu.Unlock();if s.fail||ctx.Err()!=nil{return tls.Certificate{},ErrC073Unavailable};return s.cert,nil}
type c073Broker struct{mu sync.Mutex;config C073Config;roots *x509.CertPool;source *c073CertSource;server *httptest.Server;client *C073Client;generation,epoch uint64;active string;storage map[string][]byte;signing map[string]PublicationKeyState;private map[string]ed25519.PrivateKey;mode string;change func(*C073SecretRecord);dsn string;calls atomic.Int32;serial atomic.Int64;ca *x509.Certificate;caKey ed25519.PrivateKey}
func(f *c073Broker)cert(t *testing.T,identity string,client bool)tls.Certificate{t.Helper();pub,key,_:=ed25519.GenerateKey(rand.Reader);uri,_:=url.Parse(identity);now:=time.Now();template:=&x509.Certificate{SerialNumber:big.NewInt(f.serial.Add(1)),Subject:pkix.Name{CommonName:"C073 isolated TLS fixture"},NotBefore:now.Add(-time.Minute),NotAfter:now.Add(time.Hour),KeyUsage:x509.KeyUsageDigitalSignature,URIs:[]*url.URL{uri}}
 if client{template.ExtKeyUsage=[]x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}else{template.ExtKeyUsage=[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth};template.IPAddresses=[]net.IP{net.ParseIP("127.0.0.1")};template.DNSNames=[]string{"localhost"}}
 der,e:=x509.CreateCertificate(rand.Reader,template,f.ca,pub,f.caKey);if e!=nil{t.Fatal(e)};return tls.Certificate{Certificate:[][]byte{der},PrivateKey:key}
}
func c073Setup(t *testing.T)*c073Broker{t.Helper();pub,key,_:=ed25519.GenerateKey(rand.Reader);now:=time.Now();ca:=&x509.Certificate{SerialNumber:big.NewInt(1),Subject:pkix.Name{CommonName:"C073 fixture CA"},NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour),IsCA:true,BasicConstraintsValid:true,KeyUsage:x509.KeyUsageCertSign|x509.KeyUsageDigitalSignature};der,e:=x509.CreateCertificate(rand.Reader,ca,ca,pub,key);if e!=nil{t.Fatal(e)};parsed,_:=x509.ParseCertificate(der);roots:=x509.NewCertPool();roots.AddCert(parsed)
 f:=&c073Broker{roots:roots,ca:parsed,caKey:key,generation:1,epoch:1,active:"managed-1",storage:map[string][]byte{"storage-1":bytes.Repeat([]byte{7},32)},signing:map[string]PublicationKeyState{},private:map[string]ed25519.PrivateKey{}}
 f.config=C073Config{Issuer:"broker",Audience:"compliance-runtime",Environment:"production",ClientIdentity:"spiffe://compliance.fixture/production/tenant-a/delivery/BC/runtime",ServerIdentity:"spiffe://compliance.fixture/production/broker",ManifestAudience:"DOOBr",DatabaseHost:"localhost",Scope:C064AuthorScope{Tenant:"tenant-a",Domain:"delivery",Jurisdiction:"BC"},MinimumGeneration:1,Timeout:2*time.Second}
 f.source=&c073CertSource{cert:f.cert(t,f.config.ClientIdentity,true)};f.addSigning("managed-1")
 server:=httptest.NewUnstartedServer(http.HandlerFunc(f.serve));server.TLS=&tls.Config{MinVersion:tls.VersionTLS13,Certificates:[]tls.Certificate{f.cert(t,f.config.ServerIdentity,false)},ClientAuth:tls.RequireAndVerifyClientCert,ClientCAs:roots};server.StartTLS();f.server=server;t.Cleanup(server.Close);f.config.Origin=server.URL
 f.client,e=NewC073Client(f.config,roots,f.source);if e!=nil{t.Fatal(e)};t.Cleanup(f.client.Close);return f
}
func(f *c073Broker)addSigning(id string){pub,key,_:=ed25519.GenerateKey(rand.Reader);f.private[id]=key;f.signing[id]=PublicationKeyState{KeyID:id,Environment:f.config.Environment,Domain:f.config.Scope.Domain,Jurisdiction:f.config.Scope.Jurisdiction,Audience:f.config.ManifestAudience,PublicKey:pub,NotBefore:time.Now().Add(-time.Hour),NotAfter:time.Now().Add(time.Hour)}}
func(f *c073Broker)serve(w http.ResponseWriter,r *http.Request){f.calls.Add(1);f.mu.Lock();defer f.mu.Unlock()
 if r.TLS==nil||len(r.TLS.PeerCertificates)==0||len(r.TLS.PeerCertificates[0].URIs)!=1||r.TLS.PeerCertificates[0].URIs[0].String()!=f.config.ClientIdentity{w.WriteHeader(403);return}
 if f.mode=="outage"{w.WriteHeader(503);return};if f.mode=="redirect"{http.Redirect(w,r,"https://example.invalid/secret",302);return};if f.mode=="timeout"{select{case <-r.Context().Done():return;case <-time.After(50*time.Millisecond):}}
 w.Header().Set("Content-Type","application/json")
 if f.mode=="oversized"{w.Write([]byte(strings.Repeat("x",C071MaxPrivateBytes+1)));return}
 if r.URL.Path=="/v1/secrets"{var req struct{Nonce,Purpose,Audience,Environment,Workload string;Scope C064AuthorScope};if json.NewDecoder(r.Body).Decode(&req)!=nil{w.WriteHeader(400);return}
  record:=C073SecretRecord{Nonce:req.Nonce,Purpose:req.Purpose,Issuer:f.config.Issuer,Audience:f.config.Audience,Environment:f.config.Environment,Workload:f.config.ClientIdentity,Scope:f.config.Scope,Generation:f.generation,NotBefore:time.Now().Add(-time.Second),ExpiresAt:time.Now().Add(time.Minute)}
  switch req.Purpose{case "storage-encryption":record.ActiveKeyID="storage-1";if _,ok:=f.storage["storage-2"];ok{record.ActiveKeyID="storage-2"};record.StorageKeys=f.storage
   case "credential-token":record.Token=[]byte("disposable-issued-credential-token")
   case "database-credential":record.DatabaseDSN=f.dsn
   case "manifest-signing":record.ActiveKeyID=f.active;record.SigningKeys=f.signing;record.Token=[]byte("disposable-managed-signer-token");record.MinimumEpoch=f.epoch
  }
  if f.change!=nil{f.change(&record)};json.NewEncoder(w).Encode(record);if f.mode=="trailing"{w.Write([]byte("{}"))};return
 }
 if r.URL.Path=="/v1/sign"{var req struct{Nonce,KeyID,Digest string;Payload []byte;Generation uint64};if json.NewDecoder(r.Body).Decode(&req)!=nil||r.Header.Get("Authorization")!="Bearer disposable-managed-signer-token"||f.private[req.KeyID]==nil{w.WriteHeader(403);return}
  signature:=ed25519.Sign(f.private[req.KeyID],req.Payload);if f.mode=="forged-signature"{signature[0]^=1};if f.mode=="rotate-during-sign"{f.epoch++;f.generation++;k:=f.signing[req.KeyID];k.Compromised=true;f.signing[req.KeyID]=k}
  json.NewEncoder(w).Encode(struct{Nonce,KeyID,Digest string;Signature []byte;Generation uint64}{req.Nonce,req.KeyID,req.Digest,signature,req.Generation});return
 };w.WriteHeader(404)
}
func TestC073SecretBindingFreshnessAndTLS(t *testing.T){
 f:=c073Setup(t);ctx:=context.Background();if token,e:=f.client.Token(ctx,f.config.Audience);e!=nil||token==""{t.Fatal("verified mTLS token",e)};first:=f.source.calls.Load();if _,e:=f.client.Token(ctx,f.config.Audience);e!=nil||f.source.calls.Load()<=first{t.Fatal("client identity cached across requests",e)}
 cases:=map[string]func(*C073SecretRecord){"nonce":func(r *C073SecretRecord){r.Nonce="replayed"},"issuer":func(r *C073SecretRecord){r.Issuer="other"},"audience":func(r *C073SecretRecord){r.Audience="other"},"tenant":func(r *C073SecretRecord){r.Scope.Tenant="other"},"domain":func(r *C073SecretRecord){r.Scope.Domain="other"},"jurisdiction":func(r *C073SecretRecord){r.Scope.Jurisdiction="other"},"workload":func(r *C073SecretRecord){r.Workload="spiffe://other/workload"},"environment":func(r *C073SecretRecord){r.Environment="testnet"},"purpose":func(r *C073SecretRecord){r.Purpose="storage-encryption"},"revoked":func(r *C073SecretRecord){r.Revoked=true},"expired":func(r *C073SecretRecord){r.ExpiresAt=time.Now().Add(-time.Second)},"future":func(r *C073SecretRecord){r.NotBefore=time.Now().Add(time.Hour)},"unbounded":func(r *C073SecretRecord){r.ExpiresAt=time.Now().Add(time.Hour)},"generation":func(r *C073SecretRecord){r.Generation=0},"header_injection":func(r *C073SecretRecord){r.Token=[]byte("token-contains\r\n-injection")},"purpose_confusion":func(r *C073SecretRecord){r.StorageKeys=map[string][]byte{"bad":bytes.Repeat([]byte{1},32)}}}
 for name,change:=range cases{t.Run(name,func(t *testing.T){f.mu.Lock();f.change=change;f.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e==nil{t.Fatal("untrusted secret accepted")};f.mu.Lock();f.change=nil;f.mu.Unlock()})}
 for _,mode:=range []string{"outage","redirect","oversized","trailing"}{t.Run(mode,func(t *testing.T){f.mu.Lock();f.mode=mode;f.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e==nil{t.Fatal("bad broker response accepted")};f.mu.Lock();f.mode="";f.mu.Unlock()})}
 for _,which:=range []string{"server-identity","client-identity","untrusted-root","HTTP"}{t.Run(which,func(t *testing.T){cfg:=f.config;roots:=f.roots;if which=="server-identity"{cfg.ServerIdentity="spiffe://other/server"};if which=="client-identity"{cfg.ClientIdentity="spiffe://other/client"};if which=="untrusted-root"{roots=x509.NewCertPool()};if which=="HTTP"{cfg.Origin=strings.Replace(cfg.Origin,"https:","http:",1)};c,e:=NewC073Client(cfg,roots,f.source);if e==nil{defer c.Close();if _,e=c.Token(ctx,cfg.Audience);e==nil{t.Fatal("unauthenticated transport accepted")}}})}
 f.mu.Lock();f.generation=2;f.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e!=nil{t.Fatal(e)};f.mu.Lock();f.generation=1;f.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e==nil{t.Fatal("generation rollback accepted")}
 cancelled,cancel:=context.WithCancel(ctx);cancel();if _,e:=f.client.Token(cancelled,f.config.Audience);e==nil{t.Fatal("cancelled request")}
 if _,e:=f.client.Token(ctx,"other-audience");e==nil{t.Fatal("credential reused across audience")}
 f.source.mu.Lock();f.source.fail=true;f.source.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e==nil{t.Fatal("revoked certificate source accepted")}
}
func TestC073ManagedEncryptionRotation(t *testing.T){
 f:=c073Setup(t);ctx:=context.Background();cipher,e:=NewC073ManagedCipher(ctx,f.client);if e!=nil{t.Fatal(e)};aad:=c071AAD("author",f.config.Scope,"draft",1);plain:=[]byte("protected fixture payload")
 first,e:=cipher.sealContext(ctx,plain,aad);if e!=nil{t.Fatal(e)};f.mu.Lock();f.generation=2;f.storage["storage-2"]=bytes.Repeat([]byte{9},32);f.mu.Unlock()
 second,e:=cipher.sealContext(ctx,plain,aad);if e!=nil{t.Fatal(e)};var envelope c071Envelope;if json.Unmarshal(second,&envelope)!=nil||envelope.KeyID!="storage-2"{t.Fatal("rotation did not use active key")}
 if got,e:=cipher.openContext(ctx,first,aad);e!=nil||!bytes.Equal(got,plain){t.Fatal("historical key unavailable",e)}
 f.mu.Lock();f.generation=3;delete(f.storage,"storage-1");f.mu.Unlock();if _,e=cipher.openContext(ctx,first,aad);e==nil{t.Fatal("removed key remained cached")}
 if _,e=cipher.openContext(ctx,second,c071AAD("review",f.config.Scope,"draft",1));e==nil{t.Fatal("row binding bypass")}
 f.mu.Lock();f.mode="outage";f.mu.Unlock();if _,e=cipher.sealContext(ctx,plain,aad);e==nil{t.Fatal("cached key used on outage")};if _,e=cipher.openContext(ctx,second,aad);e==nil{t.Fatal("cached decrypt on outage")}
 if len(cipher.keys)!=0||cipher.active!=""{t.Fatal("managed cipher retained raw key ring")}
}
func TestC073ManagedSignerRotationAndRevocation(t *testing.T){
 f:=c073Setup(t);ctx:=context.Background();control:=NewPublicationControl();control.ExternalKeys=f.client;now:=time.Now().UTC()
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest([]byte("policy")),ReviewDigest:Digest([]byte("review")),Domain:f.config.Scope.Domain,Jurisdiction:f.config.Scope.Jurisdiction,Audience:f.config.ManifestAudience,Environment:f.config.Environment,KeyID:"managed-1",Sequence:1,RevocationEpoch:1,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 signed,e:=control.SignScheduledManifest(ctx,f.client,m,now);if e!=nil||control.VerifyScheduledManifest(signed,now)!=nil{t.Fatal("managed sign",e)}
 f.mu.Lock();f.addSigning("managed-2");f.active="managed-2";f.generation=2;f.epoch=2;f.mu.Unlock();if control.VerifyScheduledManifest(signed,time.Now())==nil{t.Fatal("stale signing epoch accepted")}
 m.KeyID="managed-2";m.RevocationEpoch=2;signed,e=control.SignScheduledManifest(ctx,f.client,m,time.Now());if e!=nil{t.Fatal("rotated sign",e)}
 bad:=m;bad.Domain="travel";if _,e=control.SignScheduledManifest(ctx,f.client,bad,time.Now());e==nil{t.Fatal("cross-domain signing")}
 payload,_:=canonical(m);f.mu.Lock();f.mode="forged-signature";f.mu.Unlock();if _,e=f.client.SignManifest(ctx,m.KeyID,payload);e==nil{t.Fatal("forged managed signature")}
 f.mu.Lock();f.mode="rotate-during-sign";f.mu.Unlock();if _,e=control.SignScheduledManifest(ctx,f.client,m,time.Now());e==nil{t.Fatal("revoked key used after signer return")}
 f.mu.Lock();f.mode="outage";f.mu.Unlock();if control.VerifyScheduledManifest(signed,time.Now())==nil{t.Fatal("key-state outage fallback")}
}
func TestC073CertificateRotationAndTimeout(t *testing.T){
 f:=c073Setup(t);ctx:=context.Background();if _,e:=f.client.Token(ctx,f.config.Audience);e!=nil{t.Fatal(e)};cert:=f.cert(t,f.config.ClientIdentity,true);f.source.mu.Lock();f.source.cert=cert;f.source.mu.Unlock();if _,e:=f.client.Token(ctx,f.config.Audience);e!=nil{t.Fatal("rotated client identity",e)}
 expired:=cert;leaf,_:=x509.ParseCertificate(cert.Certificate[0]);if c073Certificate(expired,f.config.ClientIdentity,leaf.NotAfter.Add(time.Second)){t.Fatal("expired client certificate")}
 leaf.NotBefore=time.Now().Add(-2*time.Minute);leaf.NotAfter=time.Now().Add(-time.Minute);expiredDER,e:=x509.CreateCertificate(rand.Reader,leaf,f.ca,leaf.PublicKey,f.caKey);if e!=nil{t.Fatal(e)};expired.Certificate=[][]byte{expiredDER};f.source.mu.Lock();f.source.cert=expired;f.source.mu.Unlock();if _,e=f.client.Token(ctx,f.config.Audience);e==nil{t.Fatal("expired certificate used by real transport")};f.source.mu.Lock();f.source.cert=cert;f.source.mu.Unlock()
 cfg:=f.config;cfg.Timeout=20*time.Millisecond;c,e:=NewC073Client(cfg,f.roots,f.source);if e!=nil{t.Fatal(e)};defer c.Close();f.mu.Lock();f.mode="timeout";f.mu.Unlock();if _,e=c.Token(ctx,cfg.Audience);e==nil{t.Fatal("broker timeout accepted")}
}
func TestC073ManagedProductionComposition(t *testing.T){
 db:=c072Setup(t);f:=c073Setup(t);ctx:=db.ctx;raw:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN");u,_:=url.Parse(raw);var name,role string
 if db.a.Durable.DB.QueryRowContext(ctx,"SELECT current_database(),current_user").Scan(&name,&role)!=nil{t.Fatal("runtime fixture identity")};u.Path="/"+name;u.User=url.UserPassword(role,"c072-disposable-fixture");f.mu.Lock();f.dsn=u.String();f.mu.Unlock()
 runtime,control,e:=OpenC073ProductionRuntime(ctx,f.client,db.authority);if e!=nil{t.Fatal("managed production open",e)};defer runtime.Close();if control.ExternalKeys==nil||runtime.Durable.Identity==nil{t.Fatal("missing managed authority composition")}
 if _,e=runtime.Current(ctx,db.initial,time.Now());e!=nil{t.Fatal(e)}
 due:=time.Now().Add(-time.Second) // Deliberately retain nanoseconds; PostgreSQL canonicalizes the persisted schedule.
 if e=runtime.Durable.Enqueue(ctx,"managed-job","COLLECTION",map[string]string{"source":"official"},due,2);e!=nil{t.Fatal("managed durable enqueue",e)}
 if e=runtime.Durable.Enqueue(ctx,"managed-job","COLLECTION",map[string]string{"source":"official"},due,2);e!=nil{t.Fatal("managed enqueue replay precision",e)}
 f.mu.Lock();f.mode="outage";f.mu.Unlock();if _,e=runtime.Current(ctx,db.initial,time.Now());e==nil{t.Fatal("live database bypassed identity outage")}
 if e=runtime.Durable.Enqueue(ctx,"outage-job","COLLECTION",map[string]string{"source":"official"},time.Now(),2);e==nil{t.Fatal("managed key outage bypass")}
 f.mu.Lock();f.mode="";f.mu.Unlock();if _,e=runtime.Current(ctx,db.initial,time.Now());e!=nil{t.Fatal("identity recovery",e)}
 t.Log("PASS: real mTLS broker + restricted verified-TLS PostgreSQL, managed encryption/signing composition, fresh identity read/write denial and recovery")
}
func TestC073DatabaseTLSOverridesDenied(t *testing.T){
 raw:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN");if raw==""{t.Fatal("mandatory PostgreSQL configuration")};u,_:=url.Parse(raw)
 for key,value:=range map[string]string{"host":"other-host","sslmode":"require","connect_timeout":"999","target_session_attrs":"read-only","service":"external","sslsni":"0"}{bad:=*u;q:=bad.Query();q.Set(key,value);bad.RawQuery=q.Encode();if ValidProductionDSN(bad.String())==nil{t.Fatal("unsafe DSN option",key)}}
 duplicate:=raw+"&sslmode=disable";if ValidProductionDSN(duplicate)==nil{t.Fatal("duplicate TLS option")}
}
