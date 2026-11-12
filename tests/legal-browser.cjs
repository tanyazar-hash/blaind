const assert=require('node:assert/strict');
const {resolve}=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const {serve}=await import('../scripts/dev-server.mjs');
 const {defaultDocument,publicSnapshot}=await import('../server/defaults.js');
 const server=serve({root:resolve(__dirname,'../public')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of[320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],failed=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failed.push(r.url())});
   // Exercise static production files; original GLB renderers have their own regression suite.
   await page.route('**/model.js',r=>r.abort());
   await page.route('**/api/arena',r=>r.fulfill({json:publicSnapshot({version:1,document:defaultDocument()})}));
   for(const path of['/','/arena/','/tournaments/','/about/','/rental/','/atmosphere/','/legal/','/legal/privacy.html','/legal/rules.html','/legal/terms.html','/legal/consents.html','/legal/sources.html']){
    const response=await page.goto(base+path);assert.equal(response.status(),200,path);
    const nav=page.getByRole('navigation',{name:'Правовые документы',exact:true});
    assert.equal(await nav.locator('a').count(),6);
    await nav.scrollIntoViewIfNeeded();assert.equal(await nav.isVisible(),true);
    assert.match(await page.locator('.legal-footer').innerText(),/18\+/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' overflow '+width);
    if(path.startsWith('/legal')){
     assert.ok(await page.locator('main h1').isVisible());
     if(width===390){await page.locator('.menu').click();assert.equal(await page.locator('#site-mobile-nav').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#site-mobile-nav').isVisible(),false)}
     await nav.getByRole('link',{name:'Правила клуба',exact:true}).click();
     await page.waitForURL(base+'/legal/rules.html');
     assert.match(await page.locator('main').innerText(),/Обязательный депозит существует/);
    }
   }
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   if(width===390||width===1440){await page.goto(base+'/legal/');await page.screenshot({path:'/tmp/blaind-legal-'+width+'.png',fullPage:true});}
   if(width===1440){await page.emulateMedia({media:'print'});assert.equal(await page.locator('.site-header').isVisible(),false);assert.equal(await page.locator('.site-footer').isVisible(),false);}
   await page.close();
  }
  const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await page.goto(base+'/legal/privacy.html');assert.equal(await page.locator('h1').isVisible(),true);assert.equal(await page.locator('.legal-notice').isVisible(),true);assert.equal(await page.locator('.site-header .site-nav').isVisible(),true);await page.close();
  console.log('PASS production legal pages, legal links on every public page, 320/390/768/1440px, navigation, mobile menu, print and no-JS access; no local HTTP/page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);process.exitCode=1});
