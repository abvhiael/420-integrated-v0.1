package account

import (
 "context"
 "crypto/tls"
 "net"
 "net/smtp"
 "strconv"
 "strings"
 "time"
)

// SMTPMailer uses implicit TLS with certificate/hostname validation, a fixed
// authenticated relay, a bounded deadline, and no plaintext fallback.
type SMTPMailer struct{host,address,user,password,from string}
func NewSMTPMailer(host string,port int,user,password,from string)(*SMTPMailer,error){
 clean,e:=normalizeEmail(from)
 if e!=nil||!validDomain(host)||port<1||port>65535||user==""||password==""||strings.ContainsAny(user+password,"\r\n\x00"){return nil,ErrInvalid}
 return &SMTPMailer{host,net.JoinHostPort(host,strconv.Itoa(port)),user,password,clean},nil
}
func (m *SMTPMailer) SendVerification(ctx context.Context,recipient,secret string)error{
 email,e:=normalizeEmail(recipient);if e!=nil{return e}
 if _,e=decodeToken(secret);e!=nil{return e}
 ctx,cancel:=context.WithTimeout(ctx,10*time.Second);defer cancel()
 d:=tls.Dialer{NetDialer:&net.Dialer{},Config:&tls.Config{ServerName:m.host,MinVersion:tls.VersionTLS12}}
 conn,e:=d.DialContext(ctx,"tcp",m.address);if e!=nil{return ErrUnavailable};defer conn.Close()
 deadline,_:=ctx.Deadline();if e=conn.SetDeadline(deadline);e!=nil{return ErrUnavailable}
 stop:=context.AfterFunc(ctx,func(){_ = conn.Close()});defer stop()
 client,e:=smtp.NewClient(conn,m.host);if e!=nil{return ErrUnavailable};defer client.Close()
 if e=client.Auth(smtp.PlainAuth("",m.user,m.password,m.host));e!=nil{return ErrUnavailable}
 if e=client.Mail(m.from);e!=nil{return ErrUnavailable}
 if e=client.Rcpt(email);e!=nil{return ErrUnavailable}
 writer,e:=client.Data();if e!=nil{return ErrUnavailable}
 message:="From: "+m.from+"\r\nTo: "+email+"\r\nSubject: Your 420ID sign-in code\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nEnter this one-time code in the browser where you requested it:\r\n\r\n"+secret+"\r\n\r\nIt expires in 10 minutes. Never share the code. If you did not request it, ignore this email.\r\n"
 if _,e=writer.Write([]byte(message));e!=nil{return ErrUnavailable}
 if e=writer.Close();e!=nil{return ErrUnavailable}
 // The DATA acceptance, not QUIT, determines successful submission.
 _=client.Quit()
 return nil
}
