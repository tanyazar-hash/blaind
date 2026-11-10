import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseStore} from '../server/store.js';
test('Supabase REST writes use atomic version filters and private authorization headers',async()=>{
 const calls=[],store=new SupabaseStore({url:'https://example.supabase.co',key:'sb_publishable_test',token:'user-jwt-test',fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([]),{status:200})}});
 await assert.rejects(store.saveDocument({hero:{}},3),e=>e.status===409);
 assert.match(calls[0].url,/version=eq.3$/);assert.equal(calls[0].options.method,'PATCH');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,'Bearer user-jwt-test');assert.equal(JSON.parse(calls[0].options.body).version,4);
});
test('Supabase upstream failures do not expose the response or credentials',async()=>{
 const store=new SupabaseStore({url:'https://example.supabase.co',key:'sb_publishable_test',token:'user-jwt-test',fetchImpl:async()=>new Response('private upstream detail',{status:500})});await assert.rejects(store.readDocument(),e=>e.status===503&&!e.message.includes('private'));
});
