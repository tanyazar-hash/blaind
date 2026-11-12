import test from 'node:test';
import assert from 'node:assert/strict';
import {hostingConfig,prefixHtml,prefixCss,adminRedirect} from '../scripts/hosting.mjs';

test('hosting configuration supports root, nested prefixes and HTTPS administration only',()=>{
 assert.equal(hostingConfig({}).base,'/');
 assert.equal(hostingConfig({SITE_BASE_PATH:'/blaind/',STATIC_HOSTING:'1'}).staticHosting,true);
 assert.equal(hostingConfig({SITE_BASE_PATH:'/sites/club/'}).base,'/sites/club/');
 for(const base of ['blaind','/blaind','//evil.test/','/../','/a?x/'])assert.throws(()=>hostingConfig({SITE_BASE_PATH:base}));
 for(const url of ['http://example.test/admin/','https://user:password@example.test/admin/','javascript:alert(1)'])assert.throws(()=>hostingConfig({HOSTED_ADMIN_URL:url}));
});
test('prefixing preserves external URLs, relative files and fragments',()=>{
 const html='<a href="/arena/#tournaments"><img src="/assets/logo.svg" srcset="/a.webp 1x, /b.webp 2x"></a><a data-full="/atmosphere/images/a.webp" href="#about"><a href="https://example.test/"><a href="//cdn.test/a"><img src="images/a.webp">';
 const result=prefixHtml(html,'/blaind/');
 assert.match(result,/href="\/blaind\/arena\/#tournaments"/);
 assert.ok(result.includes('data-full="/blaind/atmosphere/images/a.webp"'));
 assert.match(result,/srcset="\/blaind\/a.webp 1x, \/blaind\/b.webp 2x"/);
 for(const value of ['href="#about"','href="https://example.test/"','href="//cdn.test/a"','src="images/a.webp"'])assert.ok(result.includes(value));
 assert.equal(prefixHtml(html,'/'),html);
 assert.equal(prefixCss('a{src:url("/arena/fonts/a.woff2");background:url(../a.webp)}','/blaind/'),'a{src:url("/blaind/arena/fonts/a.woff2");background:url(../a.webp)}');
});
test('static administration uses top-level navigation and never accepts a password locally',()=>{
 const html=adminRedirect('https://backend.example/admin/','/blaind/');
 assert.match(html,/http-equiv="refresh"/);
 assert.match(html,/href="https:\/\/backend.example\/admin\/"/);
 assert.doesNotMatch(html,/<form|password|iframe|localStorage/);
});
