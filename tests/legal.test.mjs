import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {syncSiteComponents} from '../scripts/site-components.mjs';
const root=resolve(import.meta.dirname,'..');
const documents=['index','privacy','rules','terms','consents','sources'];
const pages=['index.html','arena/index.html','atmosphere/index.html','tournaments/index.html','about/index.html','rental/index.html',...documents.map(name=>'legal/'+name+'.html')];
test('legal documents and footer links are present in every public page and production output',async()=>{
 const links=await readFile(resolve(root,'shared/legal-links.html'),'utf8');
 for(const page of pages){
  const html=await readFile(resolve(root,page),'utf8');
  assert.ok(html.includes(links.trim()),'shared legal links in '+page);
  assert.ok(html.includes('/legal/footer.css'),'footer stylesheet in '+page);
  assert.doesNotMatch(html,/\{\{(?:legal_links|home_current|arena_current|atmosphere_current|tournaments_current|about_current|rental_current)\}\}/);
  const output=await readFile(resolve(root,'public',page),'utf8');assert.equal(output,html,'current production page '+page);
 }
 for(const name of documents){
  const html=await readFile(resolve(root,'public/legal',name+'.html'),'utf8');
  assert.match(html,/<h1>/);assert.match(html,/не (?:предоставлен|сверен|указан|определен)/i);
  for(const [,href]of html.matchAll(/href="(\/(?!\/)[^"#?]*)(?:[?#][^"]*)?"/g)){
   const target=href==='/'?'index.html':href.endsWith('/')?href.slice(1)+'index.html':href.slice(1);
   if(['/arena','/admin'].includes(href))continue;
   assert.ok((await stat(resolve(root,'public',target))).isFile(),'valid local link '+href);
  }
 }
});
test('shared document generation is idempotent',async()=>{
 const before=await Promise.all(pages.map(page=>readFile(resolve(root,page),'utf8')));
 await syncSiteComponents();
 const after=await Promise.all(pages.map(page=>readFile(resolve(root,page),'utf8')));
 assert.deepEqual(after,before);
});
