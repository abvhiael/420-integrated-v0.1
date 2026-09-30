export class QuoteServiceError extends Error {
  constructor(code,message,{status=400,retryable=false}={}) {
    super(message);this.name='QuoteServiceError';this.code=code;this.status=status;this.retryable=retryable;
  }
}
export const fail=(code,message,options)=>{throw new QuoteServiceError(code,message,options);};
export function publicError(error){
  const known=error instanceof QuoteServiceError;
  return {
    status:known?error.status:500,
    body:{schema:'420-exchange-quote-error-v1',error:{
      code:known?error.code:'INTERNAL_ERROR',
      message:known?error.message:'quote service failure',
      retryable:known?error.retryable:false,
    }},
  };
}
