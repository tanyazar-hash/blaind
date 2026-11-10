import {randomBytes,timingSafeEqual} from 'node:crypto';
import {HttpError} from './errors.js';
export const SESSION_SECONDS=8*60*60;
export const newToken=()=>randomBytes(32).toString('base64url');
export function constantEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const aa=Buffer.from(a),bb=Buffer.from(b);
 return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
function cookieName(name,secure){return (secure?'__Host-':'')+'blaind_'+name}
export function cookies(req,secure){
 const values=new Map(String(req.headers.cookie||'').split(';').map(p=>{const at=p.indexOf('=');return [p.slice(0,at).trim(),p.slice(at+1)]}));
 const read=(name,max)=>{const value=values.get(cookieName(name,secure));return value&&value.length<=max&&/^[A-Za-z0-9._-]+$/.test(value)?value:null};
 return {accessToken:read('access',8192),refreshToken:read('refresh',1024),csrf:read('csrf',100)};
}
export function sessionCookies(res,session,secure,clear=false){
 const values={access:session?.accessToken,refresh:session?.refreshToken,csrf:session?.csrf};
 res.setHeader('Set-Cookie',Object.entries(values).map(([name,value])=>cookieName(name,secure)+'='+(clear?'':value)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(clear?0:SESSION_SECONDS)+(secure?'; Secure':'')));
}

// Supabase verifies passwords and access tokens; neither tokens nor passwords are returned to JS.
export class SupabaseAuth {
 constructor({url,key,fetchImpl=fetch}){this.url=url;this.key=key;this.fetch=fetchImpl}
 async request(path,{method='GET',body,token}={}){
  const response=await this.fetch(this.url+'/auth/v1/'+path,{method,redirect:'error',signal:AbortSignal.timeout(12000),headers:{apikey:this.key,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(!response.ok){
   if(response.status===429)throw new HttpError(429,'Слишком много попыток. Попробуйте позже.','RATE_LIMIT');
   if([400,401,403,422].includes(response.status))throw new HttpError(401,'Неверные данные входа или сессия завершилась.','UNAUTHORIZED');
   throw new HttpError(503,'Supabase Auth временно недоступен.','AUTH_UNAVAILABLE');
  }
  return response.status===204?null:response.json();
 }
 async signIn(email,password){
  if(typeof email!=='string'||email.length>254||!email.includes('@')||typeof password!=='string'||!password||Buffer.byteLength(password)>1024)throw new HttpError(400,'Укажите email и пароль администратора.','VALIDATION');
  return this.tokens(await this.request('token?grant_type=password',{method:'POST',body:{email:email.trim(),password}}));
 }
 tokens(result){
  if(!result.access_token||!result.refresh_token||!result.user?.id)throw new HttpError(503,'Supabase Auth вернул неполную сессию.','AUTH_UNAVAILABLE');
  return {accessToken:result.access_token,refreshToken:result.refresh_token,user:result.user};
 }
 async refresh(refreshToken){return this.tokens(await this.request('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}}))}
 async user(accessToken){return this.request('user',{token:accessToken})}
 async logout(accessToken){await this.request('logout?scope=local',{method:'POST',token:accessToken})}
}
