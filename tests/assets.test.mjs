import test from 'node:test';import assert from 'node:assert/strict';import{readFile,stat,access,readdir}from'node:fs/promises';import{resolve}from'node:path';import{createHash}from'node:crypto';
import models from '../assets/models/manifest.js';
const root=resolve(import.meta.dirname,'..');
test('original chip is intact; production uses compact, content-addressed LODs',async()=>{
 const original=await readFile(resolve(root,'shakhmatnaya-figura.glb'));assert.equal(original.byteLength,14928280);
 for(const[name,url]of Object.entries(models)){
  const bytes=await readFile(resolve(root,'public','.'+url));assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.ok(bytes.byteLength<(name==='mobile'?400000:900000));
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);assert.ok(url.includes(hash));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'));assert.ok(json.meshes.length);
 }
 await assert.rejects(access(resolve(root,'public/shakhmatnaya-figura.glb')));
});
test('test collection is removed from source and production',async()=>{
 for(const file of ['aces.html','aces.css','aces.js','blaind_four_separate_aces.glb'])for(const folder of[root,resolve(root,'public')])await assert.rejects(access(resolve(folder,file)));
});
test('all responsive AVIFs and WOFF2 fonts have working production counterparts',async()=>{
 for(const file of await readdir(resolve(root,'atmosphere/images')))if(file.endsWith('.webp')){
  const avif=file.replace('.webp','.avif');assert.ok((await stat(resolve(root,'public/atmosphere/images',avif))).size>0);
 }
 for(const name of ['manrope','playfair','playfair-italic'])assert.ok((await stat(resolve(root,'public/arena/fonts',name+'.woff2'))).size<(await stat(resolve(root,'arena/fonts',name+'.woff'))).size);
 assert.match(await readFile(resolve(root,'public/vendor/meshoptimizer/LICENSE.md'),'utf8'),/MIT License/);
 const chunk=(await readdir(resolve(root,'public/assets/chunks'))).find(n=>n.startsWith('model-')&&n.endsWith('.js'));assert.ok(chunk);
 assert.ok((await stat(resolve(root,'public/assets/chunks',chunk))).size<800000);
});
