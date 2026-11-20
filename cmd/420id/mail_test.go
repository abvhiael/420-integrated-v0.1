package main

import (
 "testing"
 account "github.com/420integrated/420-integrated/services/420id"
)
func TestConfiguredMailer(t *testing.T){
 env:=map[string]string{"AUTH420_MAIL_TRANSPORT":"resend-https","AUTH420_RESEND_API_KEY":"re_disposable_test_key_123456789","AUTH420_MAIL_FROM":"accounts@example.org"}
 get:=func(k string)string{return env[k]}
 m,e:=configuredMailer(get);if e!=nil{t.Fatal(e)};if _,ok:=m.(*account.ResendMailer);!ok{t.Fatal("not HTTPS")}
 delete(env,"AUTH420_RESEND_API_KEY")
 env["AUTH420_SMTP_HOST"]="smtp.example.org";env["AUTH420_SMTP_PORT"]="465";env["AUTH420_SMTP_USERNAME"]="user";env["AUTH420_SMTP_PASSWORD"]="test";env["AUTH420_SMTP_FROM"]="accounts@example.org"
 if _,e=configuredMailer(get);e==nil{t.Fatal("fell back to SMTP")}
 env["AUTH420_MAIL_TRANSPORT"]="smtp";m,e=configuredMailer(get);if e!=nil{t.Fatal(e)};if _,ok:=m.(*account.SMTPMailer);!ok{t.Fatal("not SMTP")}
 env["AUTH420_MAIL_TRANSPORT"]="";if _,e=configuredMailer(get);e==nil{t.Fatal("missing transport accepted")}
}
