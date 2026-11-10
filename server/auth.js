import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHmac} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const SESSION_SECONDS=8*60*60;
export function passwordHashIsValid(value){
  if(typeof value!=='string')return false;
  const p=value.split('$');
  return p.length===6&&p[0]==='scrypt'&&p[1]==='32768'&&p[2]==='8'&&p[3]==='1'&&
    /^[a-f0-9]{32}$/.test(p[4])&&/^[a-f0-9]{128}$/.test(p[5]);
}
export async function hashPassword(password){
  const salt=randomBytes(16).toString('hex');
  const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return ['scrypt',32768,8,1,salt,key.toString('hex')].join('$');
}
export async function verifyPassword(password,hash){
  if(!passwordHashIsValid(hash)||typeof password!=='string'||Buffer.byteLength(password)>1024)return false;
  const fields=hash.split('$');
  const actual=await scrypt(password,fields[4],64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(actual,Buffer.from(fields[5],'hex'));
}
export function constantEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const aa=Buffer.from(a),bb=Buffer.from(b);
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export const newToken=()=>randomBytes(32).toString('base64url');
export const tokenHash=(token,secret)=>createHmac('sha256',secret).update('session:'+token).digest('hex');
export const csrfToken=(token,secret)=>createHmac('sha256',secret).update('csrf:'+token).digest('base64url');
export const attemptKey=(ip,secret)=>createHmac('sha256',secret).update('login:'+ip).digest('hex');
export function cookieName(secure){return secure?'__Host-blaind_session':'blaind_session'}
export function readCookie(req,secure){
  const name=cookieName(secure);
  for(const part of String(req.headers.cookie||'').split(';')){
    const [key,...value]=part.trim().split('=');
    if(key===name){const token=value.join('=');return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null}
  }
  return null;
}
export function sessionCookie(token,secure,clear=false){
  return cookieName(secure)+'='+(clear?'':token)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+
    (clear?0:SESSION_SECONDS)+(secure?'; Secure':'');
}
