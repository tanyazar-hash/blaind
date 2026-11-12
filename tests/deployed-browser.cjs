// Read-only post-deployment smoke test. No fixtures, credentials or database writes.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const pagesUrl=new URL(process.env.PAGES_URL);
 const vercelUrl=new URL(process.env.VERCEL_URL||'https://blaind-tanyazar-hashs-projects.vercel.app/');
 for(const url of [pagesUrl,vercelUrl])assert.equal(url.protocol,'https:');
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_BUNDLED_CHROMIUM==='1'?{}:{executablePath:'/usr/bin/chromium'}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  for(const base of [pagesUrl,vercelUrl]){
   if(!base.pathname.endsWith('/'))base.pathname+='/';
   const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Wait for both independently deployed sites to serve the new directory links.
   let current=false;
   for(let attempt=0;attempt<12;attempt++){
    await page.goto(base.href,{waitUntil:'networkidle'});
    current=await page.locator('.site-nav a').evaluateAll((links,arena)=>links.some(a=>new URL(a.href).pathname===arena),base.pathname+'arena/');
    if(current)break;
    await page.waitForTimeout(5000);
   }
   assert.ok(current,'deployment has not served the current build: '+base.href);
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    for(const path of ['','arena/','atmosphere/','legal/','legal/privacy.html','legal/rules.html','legal/terms.html','legal/consents.html','legal/sources.html']){
     const url=new URL(path,base).href,response=await page.goto(url);
     assert.equal(response.status(),200,url);await page.evaluate(()=>document.fonts.ready);
     assert.equal(await page.locator('h1').count(),1,url);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,url);
     const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.loading!=='lazy'&&img.complete&&img.naturalWidth===0).map(img=>img.src));
     assert.deepEqual(broken,[],url+' images');
     if(path===''){
      await page.locator('.model-loaded canvas').waitFor({state:'visible',timeout:60000});
      const fonts=await page.evaluate(()=>Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family));
      assert.ok(fonts.some(f=>f.includes('Manrope')),'Manrope font');assert.ok(fonts.some(f=>f.includes('Playfair')),'Playfair font');
     }
     if(path==='arena/'){
      await page.locator('#ranking-body tr').first().waitFor();
      assert.equal(await page.locator('#ranking-message').isVisible(),false,'live Supabase rating: '+url);
     }
     if(path==='atmosphere/'){
      for(const image of await page.locator('.atm-frame img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode())}
      await page.locator('.atm-frame').first().click();await page.locator('#atm-viewer-image.is-loaded').waitFor();await page.keyboard.press('Escape');
     }
     const reloaded=await page.reload();assert.equal(reloaded.status(),200,'reload '+url);
    }
   }
   await page.goto(new URL('admin/',base).href);
   await page.locator('#login-form [name=email]').waitFor();
   assert.equal(new URL(page.url()).origin,vercelUrl.origin,'administration stays on the secure backend');
   const session=await context.request.get(new URL('api/admin?resource=session',vercelUrl).href);
   assert.equal(session.status(),200);assert.equal((await session.json()).authenticated,false);
   assert.deepEqual(errors,[]);
   console.log('PASS deployed '+base.href+': all public/legal pages, reloads, desktop/mobile GLB, photos, fonts, live rating and secure admin entry (no login or writes).');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
