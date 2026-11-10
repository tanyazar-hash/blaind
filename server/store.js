import {HttpError} from './errors.js';
export class SupabaseStore{
  constructor({url,key,fetchImpl=fetch}){
    this.url=url.replace(/\/$/,'');this.key=key;this.fetch=fetchImpl;
  }
  async request(path,{method='GET',json,body,headers={}}={}){
    const response=await this.fetch(this.url+path,{
      method,redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{apikey:this.key,Authorization:'Bearer '+this.key,...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},
      body:json!==undefined?JSON.stringify(json):body
    });
    if(!response.ok)throw new HttpError(503,'База данных временно недоступна. Попробуйте ещё раз.','STORAGE_UNAVAILABLE');
    if(response.status===204)return null;
    const raw=await response.text();return raw?JSON.parse(raw):null;
  }
  async readDocument(){
    const rows=await this.request('/rest/v1/arena_documents?id=eq.main&select=document,version');
    if(!rows?.length)throw new HttpError(503,'Сначала выполните начальную настройку базы.','DATABASE_NOT_INITIALIZED');
    return rows[0];
  }
  async saveDocument(document,version){
    const rows=await this.request('/rest/v1/arena_documents?id=eq.main&version=eq.'+version,{
      method:'PATCH',json:{document,version:version+1},headers:{Prefer:'return=representation'}
    });
    if(!rows?.length)throw new HttpError(409,'Данные изменились в другом окне. Ваш ввод сохранён на экране. Обновите данные перед повторным сохранением.','CONFLICT');
    return rows[0];
  }
  async consumeAttempt(key){return this.request('/rest/v1/rpc/arena_consume_login',{method:'POST',json:{p_key:key}})}
  async clearAttempts(key){await this.request('/rest/v1/arena_login_attempts?key=eq.'+key,{method:'DELETE'})}
  async createSession(session){
    await this.request('/rest/v1/arena_sessions',{method:'POST',json:session});
    await this.request('/rest/v1/arena_sessions?expires_at=lt.'+encodeURIComponent(new Date().toISOString()),{method:'DELETE'});
  }
  async getSession(hash){
    const rows=await this.request('/rest/v1/arena_sessions?token_hash=eq.'+hash+'&select=username,expires_at');
    return rows?.[0]||null;
  }
  async deleteSession(hash){await this.request('/rest/v1/arena_sessions?token_hash=eq.'+hash,{method:'DELETE'})}
  imageUrl(key){return this.url+'/storage/v1/object/public/arena-images/'+encodeURIComponent(key)}
  async uploadImage(key,bytes,mime){
    await this.request('/storage/v1/object/arena-images/'+encodeURIComponent(key),{method:'POST',body:bytes,
      headers:{'Content-Type':mime,'cache-control':'3600','x-upsert':'false'}});
    return {imageUrl:this.imageUrl(key),imageStorageKey:key};
  }
  async deleteImage(key){
    await this.request('/storage/v1/object/arena-images',{method:'DELETE',json:{prefixes:[key]}});
  }
}
