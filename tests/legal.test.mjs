import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {syncSiteComponents} from '../scripts/site-components.mjs';
const root=resolve(import.meta.dirname,'..');
const pages=['index.html','arena/index.html','tournaments/index.html','about/index.html','rental/index.html','legal/index.html','legal/privacy.html'];
test('only two concise information pages are linked; removed gallery stays absent',async()=>{
 const links=await readFile(resolve(root,'shared/legal-links.html'),'utf8');
 assert.equal([...links.matchAll(/<a /g)].length,2);
 for(const page of pages){const html=await readFile(resolve(root,page),'utf8');assert.ok(html.includes(links.trim()),page);assert.doesNotMatch(html,/\{\{/);assert.equal(await readFile(resolve(root,'public',page),'utf8'),html);}
 const rules=await readFile(resolve(root,'public/legal/index.html'),'utf8');assert.match(rules,/Без денежных ставок/);assert.match(rules,/только для оплаты напитков и закусок/);assert.doesNotMatch(rules,/гарантированно закон|полностью закон/);
 await assert.rejects(access(resolve(root,'public/atmosphere/index.html')));
 for(const name of ['rules','terms','consents','sources'])assert.match(await readFile(resolve(root,'public/legal',name+'.html'),'utf8'),/http-equiv="refresh"/);
 for(const name of ['index','privacy']){const html=await readFile(resolve(root,'public/legal',name+'.html'),'utf8');for(const [,href]of html.matchAll(/href="(\/(?!\/)[^"#?]*)(?:[?#][^"]*)?"/g)){const target=href==='/'?'index.html':href.endsWith('/')?href.slice(1)+'index.html':href.slice(1);assert.ok((await stat(resolve(root,'public',target))).isFile(),href)}}
});
test('shared generation remains idempotent for the reduced pages',async()=>{const before=await Promise.all(pages.map(p=>readFile(resolve(root,p),'utf8')));await syncSiteComponents();assert.deepEqual(await Promise.all(pages.map(p=>readFile(resolve(root,p),'utf8'))),before)});
