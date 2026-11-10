import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pgStore} from './pg-store.mjs';
import {serve} from '../scripts/dev-server.mjs';
import {createArenaBackend} from '../server/app.js';
import {authFixture,testPassword,adminId} from './auth-fixture.mjs';
test('PostgreSQL-backed Supabase Auth admission, CRUD, uploads, conflicts, restart persistence, logout and revocation',async()=>{
 const dir=await mkdtemp(tmpdir()+'/blaind-test-');const auth=authFixture();let store=await pgStore(dir,{identity:auth.identity}),server;const password=testPassword,env={NODE_ENV:'test'};
 let cookie='',csrf='',revision=1,base;
 async function start(){server=serve({backend:createArenaBackend({store,auth,env})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port}
 async function req(resource,method='GET',body,extra={}){const response=await fetch(base+'/api/admin?resource='+resource,{method,headers:{Origin:base,Cookie:cookie,'X-CSRF-Token':csrf,'If-Match':String(revision),...(body?{'Content-Type':Buffer.isBuffer(body)?'image/webp':'application/json'}:{}),...extra},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined});return {status:response.status,data:await response.json(),response}}
 try{await start();assert.equal((await req('snapshot')).status,401);assert.equal((await req('players','POST',{nickname:'x'})).status,401);
 assert.equal((await req('login','POST',{email:'admin@example.test',password:'incorrect'})).status,401);
 const login=await req('login','POST',{email:'admin@example.test',password});assert.equal(login.status,200);cookie=login.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.match(login.response.headers.get('set-cookie'),/HttpOnly/);csrf=login.data.csrfToken;
 const p={nickname:'Test champion',tournamentsPlayed:10,wins:5,points:99999};assert.equal((await req('players','POST',p,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await req('players','POST',p,{Origin:'https://attacker.invalid'})).status,403);
 let saved=await req('players','POST',p);assert.equal(saved.status,200);revision=saved.data.revision;const id=saved.data.document.players.at(-1).id;
 assert.equal((await req('players','PUT',{...p,id,points:10},{'If-Match':'1'})).status,409);
 assert.equal((await req('players','PUT',{...p,id,wins:11})).status,400);
 saved=await req('players','PUT',{...p,id,points:100000});assert.equal(saved.status,200);revision=saved.data.revision;
 assert.equal((await req('upload','POST',Buffer.from('<svg></svg>'))).status,400);
 const upload=await req('upload','POST',await readFile(new URL('../arena/images/golden-night.webp',import.meta.url)));assert.equal(upload.status,201);
 const t={title:'Test event',startsAt:'2026-12-01T19:00:00+07:00',description:'Test description',details:[{label:'Format',value:'Holdem'}],displayOrder:40,imageAlt:'Poster',...upload.data};saved=await req('tournaments','POST',t);assert.equal(saved.status,200);revision=saved.data.revision;const tid=saved.data.document.tournaments.at(-1).id;
 assert.equal((await req('upload','DELETE',upload.data)).status,409);
 const before=saved.data.document;
 const denied=await req('hero','PUT',{hero:{...before.hero,titleLine1:'Forbidden edit'},settings:before.settings});assert.equal(denied.status,404);
 const publicData=await(await fetch(base+'/api/arena')).json();assert.equal(publicData.hero.hero.titleLine1,before.hero.titleLine1);assert.equal(publicData.players.players.at(-1).points,100000);
 saved=await req('tournaments','PUT',{...saved.data.document.tournaments.find(t=>t.id===tid),status:'completed'});assert.equal(saved.status,200);assert.equal(saved.data.document.tournaments.find(t=>t.id===tid).status,'completed');revision=saved.data.revision;
 assert.equal((await req('tournaments','PUT',{...saved.data.document.tournaments.find(t=>t.id===tid),endsAt:'2020-01-01T00:00:00Z'})).status,400);
 await new Promise(resolve=>server.close(resolve));await store.db.close();store=await pgStore(dir,{identity:auth.identity});await start();assert.equal((await req('snapshot')).data.document.players.at(-1).id,id);
 saved=await req('tournaments','DELETE',{id:tid});assert.equal(saved.status,200);revision=saved.data.revision;await assert.rejects(readFile(dir+'/images/'+upload.data.imageStorageKey));
 saved=await req('players','DELETE',{id});assert.equal(saved.status,200);revision=saved.data.revision;
 const nonAdmin=await req('login','POST',{email:'visitor@example.test',password});assert.equal(nonAdmin.status,403);assert.equal(nonAdmin.response.headers.get('set-cookie'),null);
 await store.db.query('delete from arena_admins where user_id=$1',[adminId]);assert.equal((await req('snapshot')).status,403);
 await store.db.query('insert into arena_admins(user_id) values($1)',[adminId]);
 const oldCookie=cookie;const access=cookie.match(/blaind_access=([^;]+)/)[1];auth.expireAccess(access);
 const renewed=await req('session');assert.equal(renewed.status,200);assert.equal(renewed.data.authenticated,true);cookie=renewed.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.notEqual(cookie,oldCookie);
 assert.equal((await req('logout','POST')).status,200);cookie='';assert.equal((await req('snapshot')).status,401);

 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await store.db.close();await rm(dir,{recursive:true,force:true})}
});
test('missing schema keeps public demo but does not open editing',async()=>{
 const auth=authFixture(),store={readDocument:async()=>{const error=new Error('missing');error.code='DATABASE_NOT_INITIALIZED';throw error}};
 const server=serve({backend:createArenaBackend({store,auth,env:{NODE_ENV:'test'}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/api/admin')).status,401);const publicData=await(await fetch(base+'/api/arena')).json();assert.equal(publicData.revision,0);assert.equal(publicData.players.players.length,12)}finally{await new Promise(r=>server.close(r))}
});
