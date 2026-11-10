import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {defaultDocument} from '../server/defaults.js';
import {HttpError} from '../server/errors.js';
import {adminId,secondAdminId,visitorId} from './auth-fixture.mjs';
export async function pgStore(dir,{identity=()=>null}={}){
 const db=new PGlite(dir+'/db');await db.waitReady;
 const exists=await db.query("select to_regclass('public.arena_documents') as name");
 if(!exists.rows[0].name){
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create table auth.users(id uuid primary key,email text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
   alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;
   grant select on storage.objects to anon,authenticated;grant insert,update,delete on storage.objects to authenticated;`);
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[adminId,'admin@example.test',secondAdminId,'second@example.test',visitorId,'visitor@example.test']);
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
  await db.query('insert into arena_documents(id,document) values($1,$2)',['main',JSON.stringify(defaultDocument())]);
  await db.query('insert into arena_admins(user_id) values($1),($2)',[adminId,secondAdminId]);
 }
 await mkdir(dir+'/images',{recursive:true});
 function scoped(userId){
  const query=(sql,params=[])=>db.transaction(async tx=>{
   await tx.exec('set local role '+(userId?'authenticated':'anon'));
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[userId||'']);
   return tx.query(sql,params);
  });
  return {query,
   async readDocument(){const row=(await query("select document,version::int from arena_documents where id='main'")).rows[0];if(!row)throw new HttpError(503,'Нет начальных данных.','DATABASE_NOT_INITIALIZED');return row},
   async saveDocument(document,version){const rows=(await query("update arena_documents set document=$1,version=$2 where id='main' and version=$3 returning document,version::int",[JSON.stringify(document),version+1,version])).rows;if(!rows.length)throw new HttpError(409,'Конфликт версий','CONFLICT');return rows[0]},
   forUser(token){return scoped(identity(token))},
   async isAdmin(id){return (await query('select user_id from arena_admins where user_id=$1',[id])).rows.length===1},
   imageUrl(key){return '/test-images/'+key},
   async uploadImage(key,bytes){await query("insert into storage.objects(bucket_id,name) values('arena-images',$1)",[key]);await writeFile(dir+'/images/'+key,bytes);return {imageUrl:this.imageUrl(key),imageStorageKey:key}},
   async deleteImage(key){const rows=(await query("delete from storage.objects where bucket_id='arena-images' and name=$1 returning name",[key])).rows;if(rows.length)await unlink(dir+'/images/'+key).catch(()=>{})}
  };
 }
 return {...scoped(null),db,asUser:scoped};
}
