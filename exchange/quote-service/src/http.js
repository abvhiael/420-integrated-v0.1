import {createServer} from 'node:http';
import {publicError,QuoteServiceError} from './errors.js';
import {validateRequest} from './validation.js';
import {createFixedWindowRateLimiter} from './rate-limit.js';
import {createRedactedLogger} from './redaction.js';
import {HttpSecurityError,inspectRequestSecurity,preflight,responseSecurityHeaders} from '../../shared/http-security.mjs';

const json=(res,status,body,extra={},security={})=>{
  const payload=JSON.stringify(body);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',...responseSecurityHeaders(security),...extra});
  res.end(payload);
};

export function createQuoteHttpHandler({quoteEngine,maxBodyBytes=8192,maxResponseBytes=64*1024,rateLimit=createFixedWindowRateLimiter(),logger=createRedactedLogger(),allowedOrigins=[]}={}){
  if(typeof quoteEngine!=='function')throw new TypeError('quoteEngine required');
  return async (req,res)=>{
    const requestId=req.headers?.['x-request-id']?.slice?.(0,96)??null;
    let security={origin:null};
    try{
      if(preflight(req,res,{allowedOrigins,allowedMethods:'POST, OPTIONS'}))return;
      security=inspectRequestSecurity(req,{allowedOrigins});
      if(req.method!=='POST'||req.url!=='/executable-swap-quote')throw new QuoteServiceError('NOT_FOUND','quote endpoint not found',{status:404});
      const clientKey=String(req.socket?.remoteAddress??'anonymous');
      const budget=rateLimit({key:clientKey});
      if(!budget?.allowed)throw new QuoteServiceError('RATE_LIMITED','quote request rate limit exceeded',{status:429,retryable:true});
      const declared=Number(req.headers?.['content-length']??0);
      if(Number.isFinite(declared)&&declared>maxBodyBytes)throw new QuoteServiceError('REQUEST_TOO_LARGE','quote request exceeds size limit',{status:413});
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>maxBodyBytes)throw new QuoteServiceError('REQUEST_TOO_LARGE','quote request exceeds size limit',{status:413});chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new QuoteServiceError('MALFORMED_JSON','request body must be valid JSON',{status:400});}
      const request=validateRequest(body,{maxBodyBytes});
      const response=await quoteEngine(request);
      const encoded=JSON.stringify(response);
      if(Buffer.byteLength(encoded)>maxResponseBytes)throw new QuoteServiceError('RESPONSE_TOO_LARGE','quote response exceeds service limit',{status:503});
      logger.info('quote_issued',{requestId,account:request.account,tokenIn:request.tokenIn,tokenOut:request.tokenOut,amountInRaw:request.amountInRaw,quoteId:response.quoteId});
      return json(res,200,response,{'x-420-exchange-quote-schema':'1'},security);
    }catch(error){
      const normalized=error instanceof HttpSecurityError?new QuoteServiceError(error.code,error.message,{status:error.status}):error;
      const out=publicError(normalized);
      logger.warn('quote_rejected',{requestId,code:out.body.error.code,authorization:req.headers?.authorization,cookie:req.headers?.cookie});
      return json(res,out.status,out.body,{'x-420-exchange-quote-schema':'1'},security);
    }
  };
}
export function createQuoteHttpServer(options){return createServer(createQuoteHttpHandler(options));}
