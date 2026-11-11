const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.SITE_BASE_URL||'http://127.0.0.1:8020';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  for(const width of[390,1440,1920]){
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Text entrances are independent of the expensive software WebGL renderer.
   await page.route('**/model.js',route=>route.abort());
   const edges=[];
   for(const path of['/','/arena','/atmosphere/','/arena']){
    await page.goto(base+path,{waitUntil:'commit'});
    await page.waitForFunction(()=>document.querySelector('h1')?.getAnimations().some(a=>a.playState==='running'));
    assert.ok(await page.locator('h1').evaluate(n=>Number(getComputedStyle(n).opacity)<1),'entrance has visible intermediate frames');
    await page.locator('h1').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));
    edges.push(await page.locator('h1').evaluate(n=>n.getBoundingClientRect().x));
    if(path==='/arena')assert.doesNotMatch(await page.locator('body').innerText(),/демонстрационн/i);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    // The same document is reused by the back/forward cache.
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await page.waitForFunction(()=>document.querySelector('h1')?.getAnimations().some(a=>a.playState==='running'));
    await page.locator('h1').evaluate(n=>Promise.all(n.getAnimations().map(a=>a.finished)));
   }
   assert.ok(Math.max(...edges)-Math.min(...edges)<1,'matching first-screen left edges at '+width);
   if(width===1440){
    await page.locator('.site-header .site-nav a[href="/atmosphere/"]').click();
    await page.waitForURL('**/atmosphere/');
    await page.waitForFunction(()=>document.querySelector('h1')?.getAnimations().some(a=>a.playState==='running'));
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('h1')?.getAnimations().some(a=>a.playState==='running'));
    await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));
    await page.screenshot({path:'/tmp/blaind-entrance-arena.png'});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  const page=await browser.newPage({reducedMotion:'reduce'});
  for(const path of['/arena','/atmosphere/']){
   await page.goto(base+path,{waitUntil:'commit'});
   assert.equal(await page.locator('h1').evaluate(n=>getComputedStyle(n).opacity),'1');
   assert.equal(await page.locator('h1').evaluate(n=>n.getAnimations().length),0);
  }
  await page.close();console.log('PASS entrances on every visit and history restore, matching hero edges at 390/1440/1920px, no demo labels, reduced motion and no page errors.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
