export class HttpError extends Error{
  constructor(status,message,code='REQUEST_FAILED'){super(message);this.status=status;this.code=code}
}
export const fail=(status,message,code)=>{throw new HttpError(status,message,code)};
