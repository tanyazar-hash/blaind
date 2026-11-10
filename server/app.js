import {randomUUID,createHmac} from 'node:crypto';
import {SupabaseStore} from './store.js';
import {supabaseConfig} from './config.js';
import {defaultDocument,publicSnapshot} from './defaults.js';
import {HttpError,fail} from './errors.js';
import {SupabaseAuth,constantEqual,newToken,cookies,sessionCookies} from './auth.js';
import {playerInput,tournamentInput,validId,imageKey,inspectImage,MAX_IMAGE_BYTES} from './validation.js';

async function bytes(req,limit){
  if(req.body!==undefined){
    const body=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
    if(body.length>limit)fail(413,'Слишком большой запрос.','BODY_SIZE');
    return body;
  }
  let size=0;const chunks=[];
  for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size<=limit)chunks.push(b)}
  if(size>limit)fail(413,'Слишком большой запрос.','BODY_SIZE');
  return Buffer.concat(chunks);
}
async function jsonBody(req){
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail(415,'Ожидаются данные JSON.','CONTENT_TYPE');
  try{
    const value=JSON.parse((await bytes(req,65536)).toString('utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Неверный запрос.','VALIDATION');
    return value;
  }catch(error){if(error instanceof HttpError)throw error;fail(400,'Неверный JSON.','VALIDATION')}
}
const references=document=>new Set([document.hero.backgroundImageStorageKey,...document.tournaments.map(t=>t.imageStorageKey)].filter(Boolean));
const proof=(key,session,secret)=>createHmac('sha256',secret).update('upload:'+session.hash+':'+key).digest('base64url');

export function createArenaBackend({store:providedStore,auth:providedAuth,env=process.env,now=()=>Date.now()}={}){
  const config=supabaseConfig(env);
  const publicStore=providedStore||new SupabaseStore(config);
  const auth=providedAuth||new SupabaseAuth(config);
  const secure=req=>!!env.VERCEL||env.NODE_ENV==='production'||!!req.socket?.encrypted;
  function origin(req){
    const automatic=(secure(req)?'https://':'http://')+req.headers.host;
    return new URL(env.APP_ORIGIN||automatic).origin;
  }
  function checkOrigin(req){
    if(req.headers.origin!==origin(req)||req.headers['sec-fetch-site']==='cross-site')fail(403,'Запрос отклонён. Обновите страницу и попробуйте снова.','CSRF');
  }
  function response(res,status,body,headers={}){
    res.statusCode=status;
    for(const [key,value] of Object.entries({
      'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
      'CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
      ...headers
    }))res.setHeader(key,value);
    res.end(body===null?'':JSON.stringify(body));
  }
  async function authorize(tokens){
    const store=publicStore.forUser(tokens.accessToken);
    if(!await store.isAdmin(tokens.user.id))fail(403,'Этот аккаунт не назначен администратором клуба.','FORBIDDEN');
    return {...tokens,store,username:tokens.user.email,hash:tokens.user.id};
  }
  async function session(req,res){
    let tokens=cookies(req,secure(req));
    if(!tokens.accessToken||!tokens.refreshToken||!tokens.csrf)fail(401,'Войдите в админ-панель.','UNAUTHORIZED');
    try{tokens.user=await auth.user(tokens.accessToken)}catch(error){
      if(error.status!==401)throw error;
      try{tokens={...await auth.refresh(tokens.refreshToken),csrf:tokens.csrf}}catch(refreshError){
        if(refreshError.status===401)sessionCookies(res,null,secure(req),true);
        throw refreshError;
      }
      sessionCookies(res,tokens,secure(req));
    }
    return authorize(tokens);
  }
  function csrf(req,s){checkOrigin(req);if(!constantEqual(req.headers['x-csrf-token'],s.csrf))fail(403,'Обновите страницу и повторите действие.','CSRF')}
  function expectedVersion(req,row){
    const value=String(req.headers['if-match']||'').replace(/^"|"$/g,'');
    if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))fail(428,'Сначала обновите данные страницы.','VERSION_REQUIRED');
    if(Number(value)!==row.version)fail(409,'Данные изменились в другом окне. Ваш ввод сохранён. Обновите данные перед повторным сохранением.','CONFLICT');
    return Number(value);
  }
  function verifyImage(fields,input,s,current){
    const key=fields.imageStorageKey;if(!key)return;
    if(fields.imageUrl!==s.store.imageUrl(key))fail(400,'Неверная ссылка на загруженный файл.','VALIDATION');
    if(!references(current).has(key)&&!constantEqual(input.uploadProof,proof(key,s,s.csrf)))fail(400,'Загрузите изображение заново.','IMAGE_PROOF');
  }
  async function cleanup(before,after,store){
    const removed=[...references(before)].filter(key=>!references(after).has(key));
    if(!removed.length)return;
    try{
      const latest=await store.readDocument();
      for(const key of removed)if(imageKey(key)&&!references(latest.document).has(key))await store.deleteImage(key);
    }catch{console.warn('Arena: unused image cleanup will need retry.')}
  }
  async function publicHandler(req,res){
    if(req.method!=='GET')fail(405,'Метод не поддерживается.','METHOD');
    let row;
    try{row=await publicStore.readDocument()}catch(error){
      if(error.code!=='DATABASE_NOT_INITIALIZED')throw error;
      row={version:0,document:defaultDocument()};
    }
    const etag='"'+row.version+'"';
    if(req.headers['if-none-match']===etag)return response(res,304,null,{ETag:etag});
    return response(res,200,publicSnapshot(row),{ETag:etag});
  }
  async function adminHandler(req,res){
    const resource=new URL(req.url,'http://local').searchParams.get('resource')||'snapshot';
    if(resource==='session'&&req.method==='GET'){
      try{const s=await session(req,res);return response(res,200,{authenticated:true,configured:true,username:s.username,csrfToken:s.csrf})}
      catch(error){if(error.status===401)return response(res,200,{authenticated:false,configured:true});throw error}
    }
    if(resource==='login'&&req.method==='POST'){
      checkOrigin(req);
      const body=await jsonBody(req);
      const tokens=await auth.signIn(body.email,body.password);
      let s;
      try{s=await authorize({...tokens,csrf:newToken()})}catch(error){
        try{await auth.logout(tokens.accessToken)}catch{}
        throw error;
      }
      sessionCookies(res,s,secure(req));
      return response(res,200,{authenticated:true,username:s.username,csrfToken:s.csrf});
    }
    const s=await session(req,res),store=s.store;
    if(resource==='snapshot'&&req.method==='GET'){
      const row=await store.readDocument();
      return response(res,200,{revision:row.version,document:row.document,username:s.username,csrfToken:s.csrf});
    }
    csrf(req,s);
    if(resource==='logout'&&req.method==='POST'){
      await auth.logout(s.accessToken);
      sessionCookies(res,null,secure(req),true);
      return response(res,200,{ok:true});
    }
    if(resource==='upload'&&req.method==='POST'){
      const body=await bytes(req,MAX_IMAGE_BYTES),image=inspectImage(body);
      const key=randomUUID()+'.'+image.ext;
      const uploaded=await store.uploadImage(key,body,image.mime);
      return response(res,201,{...uploaded,uploadProof:proof(key,s,s.csrf),width:image.width,height:image.height});
    }
    if(resource==='upload'&&req.method==='DELETE'){
      const input=await jsonBody(req),key=input.imageStorageKey;
      if(!imageKey(key)||!constantEqual(input.uploadProof,proof(key,s,s.csrf)))fail(400,'Неверный файл.','IMAGE_PROOF');
      const row=await store.readDocument();
      if(references(row.document).has(key))fail(409,'Изображение используется на сайте. Сначала сохраните его замену или удаление.','IMAGE_IN_USE');
      await store.deleteImage(key);return response(res,200,{ok:true});
    }
    if(!['players','tournaments','order'].includes(resource))fail(404,'Действие не найдено.','NOT_FOUND');
    if(!['POST','PUT','DELETE'].includes(req.method))fail(405,'Метод не поддерживается.','METHOD');
    const input=await jsonBody(req),row=await store.readDocument();
    const version=expectedVersion(req,row),document=structuredClone(row.document),at=new Date(now()).toISOString();
    if(resource==='order'&&req.method==='PUT'){
      const ids=input.ids;
      if(!Array.isArray(ids)||ids.length!==document.tournaments.length||new Set(ids).size!==ids.length||
        ids.some(id=>!document.tournaments.some(t=>t.id===id)))fail(400,'Проверьте порядок турниров.','VALIDATION');
      ids.forEach((id,index)=>{document.tournaments.find(t=>t.id===id).displayOrder=(index+1)*10});
      document.tournamentsUpdatedAt=at;
    }else if(['players','tournaments'].includes(resource)){
      const list=document[resource],id=input.id;
      if(req.method==='POST'){
        if(list.length>=(resource==='players'?5000:200))fail(400,'Достигнут лимит записей.','LIMIT');
        const generated=randomUUID();
        const value=resource==='players'?playerInput(input,generated):tournamentInput(input,generated);
        if(resource==='tournaments')verifyImage(value,input,s,row.document);
        list.push(value);
      }else{
        if(!validId(id))fail(400,'Неверная запись.','VALIDATION');
        const index=list.findIndex(item=>item.id===id);if(index<0)fail(404,'Запись уже удалена. Обновите данные.','NOT_FOUND');
        if(req.method==='DELETE')list.splice(index,1);
        else{
          const value=resource==='players'?playerInput(input,id):tournamentInput(input,id);
          if(resource==='tournaments')verifyImage(value,input,s,row.document);
          list[index]=value;
        }
      }
      document[resource==='players'?'ratingUpdatedAt':'tournamentsUpdatedAt']=at;
    }else fail(405,'Метод не поддерживается.','METHOD');
    const saved=await store.saveDocument(document,version);
    await cleanup(row.document,saved.document,store);
    return response(res,200,{revision:saved.version,document:saved.document});
  }
  return {
    public:async(req,res)=>{try{await publicHandler(req,res)}catch(error){response(res,error.status||503,{error:error.status?error.message:'Сервис временно недоступен.',code:error.code||'UNAVAILABLE'})}},
    admin:async(req,res)=>{try{await adminHandler(req,res)}catch(error){response(res,error.status||503,{error:error.status?error.message:'Сервис временно недоступен.',code:error.code||'UNAVAILABLE'})}}
  };
}
