import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir,writeFile,unlink} from 'node:fs/promises';
import {defaultDocument} from '../server/defaults.js';
import {HttpError} from '../server/errors.js';
export async function pgStore(dir){
 const db=new PGlite(dir+'/db');await db.waitReady;
 const exists=await db.query("select to_regclass('public.arena_documents') as name");
 if(!exists.rows[0].name){await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])");await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));await db.query('insert into arena_documents(id,document) values($1,$2)',['main',JSON.stringify(defaultDocument())])}
 await mkdir(dir+'/images',{recursive:true});
 return {db,async readDocument(){return (await db.query("select document,version::int from arena_documents where id='main'")).rows[0]},async saveDocument(document,version){const rows=(await db.query("update arena_documents set document=$1,version=version+1 where id='main' and version=$2 returning document,version::int",[JSON.stringify(document),version])).rows;if(!rows.length)throw new HttpError(409,'Конфликт версий','CONFLICT');return rows[0]},async consumeAttempt(key){return(await db.query('select arena_consume_login($1) as result',[key])).rows[0].result},async clearAttempts(key){await db.query('delete from arena_login_attempts where key=$1',[key])},async createSession(s){await db.query('insert into arena_sessions(token_hash,username,expires_at) values($1,$2,$3)',[s.token_hash,s.username,s.expires_at])},async getSession(hash){return(await db.query('select username,expires_at::text from arena_sessions where token_hash=$1',[hash])).rows[0]},async deleteSession(hash){await db.query('delete from arena_sessions where token_hash=$1',[hash])},imageUrl(key){return '/test-images/'+key},async uploadImage(key,bytes){await writeFile(dir+'/images/'+key,bytes);return {imageUrl:this.imageUrl(key),imageStorageKey:key}},async deleteImage(key){await unlink(dir+'/images/'+key).catch(()=>{})}};
}
