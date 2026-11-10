import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {pgStore} from './pg-store.mjs';
import {adminId,secondAdminId,visitorId} from './auth-fixture.mjs';
test('PostgreSQL RLS allows public content reads, denies visitors and self-enrollment, admits multiple admins',async()=>{
 const dir=await mkdtemp('/tmp/blaind-rls-'),store=await pgStore(dir);
 try{
  const original=await store.readDocument();assert.equal(original.document.players.length,12);
  await assert.rejects(store.query("update arena_documents set version=version+1"),/permission denied/);
  await assert.rejects(store.query('select * from arena_admins'),/permission denied/);
  const visitor=store.asUser(visitorId);assert.equal((await visitor.readDocument()).version,1);
  assert.equal((await visitor.query("update arena_documents set version=version+1 returning version")).rows.length,0);
  assert.equal((await visitor.query('select * from arena_admins')).rows.length,0);
  await assert.rejects(visitor.query('insert into arena_admins(user_id) values($1)',[visitorId]),/permission denied/);
  await assert.rejects(visitor.uploadImage('visitor.webp',Buffer.from('x')),/row-level security/);
  await assert.rejects(store.uploadImage('anonymous.webp',Buffer.from('x')),/permission denied/);
  for(const id of[adminId,secondAdminId]){
   const admin=store.asUser(id);assert.equal(await admin.isAdmin(id),true);assert.equal((await admin.query('select * from arena_admins')).rows.length,1);
   const current=await admin.readDocument();current.document.hero.description='Edited by '+id;await admin.saveDocument(current.document,current.version);
   await assert.rejects(admin.query('insert into arena_admins(user_id) values($1)',[visitorId]),/permission denied/);
   await assert.rejects(admin.query('delete from arena_documents'),/permission denied/);
  }
  const admin=store.asUser(adminId);await admin.uploadImage('admin.webp',Buffer.from('image'));
  assert.equal((await store.query("select name from storage.objects where bucket_id='arena-images'")).rows.length,1);
  assert.equal((await visitor.query("delete from storage.objects returning name")).rows.length,0);
  await assert.rejects(admin.query("update storage.objects set bucket_id='other'"),/row-level security/);
  await store.asUser(secondAdminId).deleteImage('admin.webp');
  assert.equal((await store.query('select name from storage.objects')).rows.length,0);
  await store.db.query('delete from arena_admins where user_id=$1',[adminId]);assert.equal(await admin.isAdmin(adminId),false);
  assert.equal((await admin.query("update arena_documents set version=version+1 returning version")).rows.length,0);
  // Initial seed remains idempotent after live edits; a re-deploy cannot reset content.
  await store.db.exec(await readFile(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
  assert.equal((await store.readDocument()).version,3);
 }finally{await store.db.close();await rm(dir,{recursive:true,force:true})}
});
