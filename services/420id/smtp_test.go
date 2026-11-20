package account

import (
 "bufio"
 "context"
 "crypto/ecdsa"
 "crypto/elliptic"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "crypto/x509/pkix"
 "encoding/base64"
 "fmt"
 "math/big"
 "strings"
 "testing"
 "time"
)

// Real socket and TLS handshake with a disposable local SMTP relay. No
// external relay or inbox is implied by this regression.
func TestSMTPTransportTLSAndDelivery(t *testing.T){
 key,e:=ecdsa.GenerateKey(elliptic.P256(),rand.Reader);if e!=nil{t.Fatal(e)}
 cert:=&x509.Certificate{SerialNumber:big.NewInt(42),Subject:pkix.Name{CommonName:"smtp.example.org"},DNSNames:[]string{"smtp.example.org"},NotBefore:time.Now().Add(-time.Hour),NotAfter:time.Now().Add(time.Hour),KeyUsage:x509.KeyUsageDigitalSignature,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
 der,e:=x509.CreateCertificate(rand.Reader,cert,cert,&key.PublicKey,key);if e!=nil{t.Fatal(e)}
 parsed,e:=x509.ParseCertificate(der);if e!=nil{t.Fatal(e)}
 roots:=x509.NewCertPool();roots.AddCert(parsed)
 listener,e:=tls.Listen("tcp","127.0.0.1:0",&tls.Config{Certificates:[]tls.Certificate{{Certificate:[][]byte{der},PrivateKey:key}},MinVersion:tls.VersionTLS12});if e!=nil{t.Fatal(e)};defer listener.Close()
 secret:=encodeBytes(mustRandom(t));messages:=make(chan string,1);serverErr:=make(chan error,1)
 go func(){
  conn,err:=listener.Accept();if err!=nil{serverErr<-err;return};defer conn.Close();_ = conn.SetDeadline(time.Now().Add(10*time.Second))
  reader:=bufio.NewReader(conn);send:=func(s string)error{_,err:=fmt.Fprint(conn,s+"\r\n");return err}
  if err=send("220 smtp.example.org ESMTP");err!=nil{serverErr<-err;return}
  var authenticated,mail,rcpt bool
  for {
   line,err:=reader.ReadString('\n');if err!=nil{serverErr<-err;return};line=strings.TrimSpace(line)
   switch{
   case strings.HasPrefix(line,"EHLO "):err=send("250-smtp.example.org\r\n250 AUTH PLAIN")
   case strings.HasPrefix(line,"AUTH PLAIN "):
    b,decodeErr:=base64.StdEncoding.DecodeString(strings.TrimPrefix(line,"AUTH PLAIN "))
    if decodeErr!=nil||string(b)!="\x00test-user\x00test-password"{serverErr<-fmt.Errorf("unexpected SMTP auth");return};authenticated=true;err=send("235 2.7.0 accepted")
   case line=="MAIL FROM:<sender@example.org>":mail=authenticated;err=send("250 2.1.0 OK")
   case line=="RCPT TO:<recipient@example.org>":rcpt=mail;err=send("250 2.1.5 OK")
   case line=="DATA":
    if !rcpt{serverErr<-fmt.Errorf("SMTP envelope was not authorized");return}
    if err=send("354 End with dot");err!=nil{serverErr<-err;return}
    var message strings.Builder
    for{part,err:=reader.ReadString('\n');if err!=nil{serverErr<-err;return};if part==".\r\n"{break};message.WriteString(part)}
    messages<-message.String();err=send("250 2.0.0 queued")
   case line=="QUIT":_ = send("221 closing");serverErr<-nil;return
   default:serverErr<-fmt.Errorf("unexpected SMTP command");return
   }
   if err!=nil{serverErr<-err;return}
  }
 }()
 mailer,e:=NewSMTPMailer("smtp.example.org",465,"test-user","test-password","sender@example.org");if e!=nil{t.Fatal(e)}
 mailer.address=listener.Addr().String();mailer.roots=roots
 ctx,cancel:=context.WithTimeout(context.Background(),15*time.Second);defer cancel()
 if e=mailer.SendVerification(ctx,"recipient@example.org",secret);e!=nil{t.Fatal(e)}
 select{case message:=<-messages:if !strings.Contains(message,"To: recipient@example.org\r\n")||!strings.Contains(message,secret)||strings.Contains(message,"test-password"){t.Fatal("invalid SMTP message")};case <-ctx.Done():t.Fatal("missing relay acceptance")}
 if e=<-serverErr;e!=nil{t.Fatal(e)}
 // A second relay with the same CA but wrong hostname must never receive auth.
 wrong,e:=tls.Listen("tcp","127.0.0.1:0",&tls.Config{Certificates:[]tls.Certificate{{Certificate:[][]byte{der},PrivateKey:key}}});if e!=nil{t.Fatal(e)};defer wrong.Close()
 handshake:=make(chan error,1)
 go func(){c,err:=wrong.Accept();if err==nil{defer c.Close();_ = c.SetDeadline(time.Now().Add(5*time.Second));err=c.(*tls.Conn).Handshake()};handshake<-err}()
 mailer.address=wrong.Addr().String();mailer.host="wrong.example.org"
 if e=mailer.SendVerification(ctx,"recipient@example.org",secret);e!=ErrUnavailable{t.Fatal("wrong hostname accepted",e)}
 select{case e=<-handshake:if e==nil{t.Fatal("unexpected successful TLS handshake")};case <-ctx.Done():t.Fatal("TLS check hung")}
}
