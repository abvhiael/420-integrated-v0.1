package main

import (
 "errors"
 "strconv"
 account "github.com/420integrated/420-integrated/services/420id"
)

// Explicitly select one transport. No fallback to paid SMTP or a different
// provider if the configured HTTPS provider rejects a message.
func configuredMailer(get func(string)string)(account.Mailer,error){
 switch get("AUTH420_MAIL_TRANSPORT"){
 case "resend-https":
  mail,e:=account.NewResendMailer(get("AUTH420_RESEND_API_KEY"),get("AUTH420_MAIL_FROM"))
  if e!=nil{return nil,errors.New("HTTPS email configuration rejected")};return mail,nil
 case "smtp":
  port,e:=strconv.Atoi(get("AUTH420_SMTP_PORT"))
  if e!=nil||port!=465{return nil,errors.New("Implicit TLS SMTP port 465 required")}
  mail,e:=account.NewSMTPMailer(get("AUTH420_SMTP_HOST"),port,get("AUTH420_SMTP_USERNAME"),get("AUTH420_SMTP_PASSWORD"),get("AUTH420_SMTP_FROM"))
  if e!=nil{return nil,errors.New("SMTP configuration rejected")};return mail,nil
 default:
  return nil,errors.New("AUTH420_MAIL_TRANSPORT must be resend-https or smtp")
 }
}
