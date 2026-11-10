import {HttpError} from './errors.js';
export class SupabaseStore{
  constructor({url,key,token,fetchImpl=fetch}){
    this.url=url.replace(/\/$/,'');this.key=key;this.token=token;this.fetch=fetchImpl;
  }
  async request(path,{method='GET',json,body,headers={}}={}){
    const response=await this.fetch(this.url+path,{
      method,redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{apikey:this.key,...(this.token?{Authorization:'Bearer '+this.token}:{}),...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},
      body:json!==undefined?JSON.stringify(json):body
    });
    if(!response.ok){
      let code;try{code=(await response.json()).code}catch{}
      if(['PGRST205','42P01'].includes(code))throw new HttpError(503,'Примените настройку базы Supabase.','DATABASE_NOT_INITIALIZED');
      if(response.status===401)throw new HttpError(401,'Сессия завершилась. Войдите снова.','UNAUTHORIZED');
      if(response.status===403)throw new HttpError(403,'Изменять данные могут только администраторы клуба.','FORBIDDEN');
      throw new HttpError(503,'База данных временно недоступна. Попробуйте ещё раз.','STORAGE_UNAVAILABLE');
    }
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
  forUser(token){return new SupabaseStore({url:this.url,key:this.key,token,fetchImpl:this.fetch})}
  async isAdmin(userId){
    const rows=await this.request('/rest/v1/arena_admins?user_id=eq.'+encodeURIComponent(userId)+'&select=user_id');
    return rows?.length===1;
  }
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
