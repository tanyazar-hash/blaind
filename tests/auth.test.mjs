import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseAuth,sessionCookies,cookies} from '../server/auth.js';
import {SupabaseStore} from '../server/store.js';
const key='sb_publishable_test',user={id:'11111111-1111-4111-8111-111111111111',email:'admin@example.test'};
test('Supabase Auth uses password/refresh grants and never signs up visitors',async()=>{
 const calls=[];const auth=new SupabaseAuth({url:'https://example.supabase.co',key,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/user')?user:{access_token:'access-jwt',refresh_token:'refresh-token',user}),{status:200})}});
 const tokens=await auth.signIn(user.email,'test-password');assert.equal(tokens.user.id,user.id);await auth.user(tokens.accessToken);await auth.refresh(tokens.refreshToken);await auth.logout(tokens.accessToken);
 assert.deepEqual(calls.map(c=>c.url.split('/auth/v1/')[1]),['token?grant_type=password','user','token?grant_type=refresh_token','logout?scope=local']);
 assert.equal(calls[0].options.headers.apikey,key);assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[1].options.headers.Authorization,'Bearer access-jwt');assert.equal(calls[0].options.redirect,'error');
 assert.equal(JSON.parse(calls[2].options.body).refresh_token,'refresh-token');
});
test('secure HttpOnly cookies keep provider tokens out of client JavaScript',()=>{
 let values;const response={setHeader:(name,value)=>{assert.equal(name,'Set-Cookie');values=value}};
 sessionCookies(response,{accessToken:'access.jwt',refreshToken:'refresh_token',csrf:'csrf_token'},true);
 for(const value of values){assert.match(value,/^__Host-blaind_/);assert.match(value,/; HttpOnly; SameSite=Strict;/);assert.match(value,/; Secure$/)}
 const req={headers:{cookie:values.map(v=>v.split(';')[0]).join('; ')}};assert.deepEqual(cookies(req,true),{accessToken:'access.jwt',refreshToken:'refresh_token',csrf:'csrf_token'});
 sessionCookies(response,null,true,true);assert.ok(values.every(v=>v.includes('Max-Age=0')));
});
test('anonymous Supabase reads omit Authorization; scoped writes use the actual user JWT',async()=>{
 const calls=[],store=new SupabaseStore({url:'https://example.supabase.co',key,fetchImpl:async(url,options)=>{calls.push(options);return new Response(JSON.stringify([{document:{},version:1,user_id:user.id}]))}});
 await store.readDocument();await store.forUser('user.jwt').isAdmin(user.id);
 assert.equal(calls[0].headers.apikey,key);assert.equal(calls[0].headers.Authorization,undefined);assert.equal(calls[1].headers.Authorization,'Bearer user.jwt');
});
test('Auth errors stay generic and rate limiting is handled by Supabase Auth',async()=>{
 for(const [status,expected]of[[400,401],[401,401],[429,429],[500,503]]){
  const auth=new SupabaseAuth({url:'https://example.supabase.co',key,fetchImpl:async()=>new Response('private provider detail',{status})});
  await assert.rejects(auth.signIn(user.email,'test-password'),e=>e.status===expected&&!e.message.includes('private'));
 }
});
