import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pgStore} from './pg-store.mjs';
import {serve} from '../scripts/dev-server.mjs';
import {createArenaBackend} from '../server/app.js';
import {hashPassword} from '../server/auth.js';
test('PostgreSQL-backed authorization, CRUD, uploads, conflicts, restart persistence, logout and throttling',async()=>{
 const dir=await mkdtemp(tmpdir()+'/blaind-test-');let store=await pgStore(dir),server;const password='test-only-password',env={NODE_ENV:'test',ADMIN_PASSWORD_HASH:await hashPassword(password),ADMIN_SESSION_SECRET:'test-session-secret-with-at-least-32-characters'};
 let cookie='',csrf='',revision=1,base;
 async function start(){server=serve({backend:createArenaBackend({store,env})});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port}
 async function req(resource,method='GET',body,extra={}){const response=await fetch(base+'/api/admin?resource='+resource,{method,headers:{Origin:base,Cookie:cookie,'X-CSRF-Token':csrf,'If-Match':String(revision),...(body?{'Content-Type':Buffer.isBuffer(body)?'image/webp':'application/json'}:{}),...extra},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined});return {status:response.status,data:await response.json(),response}}
 try{await start();assert.equal((await req('snapshot')).status,401);assert.equal((await req('players','POST',{nickname:'x'})).status,401);
 assert.equal((await req('login','POST',{username:'admin',password:'incorrect'})).status,401);
 const login=await req('login','POST',{username:'admin',password});assert.equal(login.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];assert.match(login.response.headers.get('set-cookie'),/HttpOnly/);csrf=login.data.csrfToken;
 const p={nickname:'Test champion',tournamentsPlayed:10,wins:5,points:99999};assert.equal((await req('players','POST',p,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await req('players','POST',p,{Origin:'https://attacker.invalid'})).status,403);
 let saved=await req('players','POST',p);assert.equal(saved.status,200);revision=saved.data.revision;const id=saved.data.document.players.at(-1).id;
 assert.equal((await req('players','PUT',{...p,id,points:10},{'If-Match':'1'})).status,409);
 assert.equal((await req('players','PUT',{...p,id,wins:11})).status,400);
 saved=await req('players','PUT',{...p,id,points:100000});assert.equal(saved.status,200);revision=saved.data.revision;
 assert.equal((await req('upload','POST',Buffer.from('<svg></svg>'))).status,400);
 const upload=await req('upload','POST',await readFile(new URL('../arena/images/golden-night.webp',import.meta.url)));assert.equal(upload.status,201);
 const t={title:'Test event',startsAt:'2026-12-01T19:00:00+07:00',description:'Test description',details:[{label:'Format',value:'Holdem'}],displayOrder:40,imageAlt:'Poster',...upload.data};saved=await req('tournaments','POST',t);assert.equal(saved.status,200);revision=saved.data.revision;const tid=saved.data.document.tournaments.at(-1).id;
 assert.equal((await req('upload','DELETE',upload.data)).status,409);
 const doc=saved.data.document;doc.hero.titleLine1='Тестовая арена';saved=await req('hero','PUT',{hero:doc.hero,settings:doc.settings});assert.equal(saved.status,200);revision=saved.data.revision;
 const publicData=await(await fetch(base+'/api/arena')).json();assert.equal(publicData.hero.hero.titleLine1,'Тестовая арена');assert.equal(publicData.players.players.at(-1).points,100000);
 await new Promise(resolve=>server.close(resolve));await store.db.close();store=await pgStore(dir);await start();assert.equal((await req('snapshot')).data.document.players.at(-1).id,id);
 saved=await req('tournaments','DELETE',{id:tid});assert.equal(saved.status,200);revision=saved.data.revision;await assert.rejects(readFile(dir+'/images/'+upload.data.imageStorageKey));
 saved=await req('players','DELETE',{id});assert.equal(saved.status,200);revision=saved.data.revision;
 assert.equal((await req('logout','POST')).status,200);assert.equal((await req('snapshot')).status,401);cookie='';for(let i=0;i<6;i++)assert.equal((await req('login','POST',{username:'admin',password:'wrong'})).status,401);assert.equal((await req('login','POST',{username:'admin',password})).status,429);
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await store.db.close();await rm(dir,{recursive:true,force:true})}
});
test('unconfigured admin fails closed while public demonstration remains available',async()=>{const server=serve({backend:createArenaBackend({env:{}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;try{const s=await(await fetch(base+'/api/admin?resource=session')).json();assert.equal(s.configured,false);assert.equal((await fetch(base+'/api/admin')).status,503);assert.equal((await fetch(base+'/api/arena')).status,200)}finally{await new Promise(r=>server.close(r))}});
