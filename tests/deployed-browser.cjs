// Read-only post-deployment smoke test. No fixtures, credentials or database writes.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const pagesUrl=new URL(process.env.PAGES_URL);
 const vercelUrl=new URL(process.env.VERCEL_URL||'https://blaind-tanyazar-hashs-projects.vercel.app/');
 for(const url of [pagesUrl,vercelUrl])assert.equal(url.protocol,'https:');
 const target=process.env.DEPLOY_TARGET||'all';
 assert.ok(['all','pages','vercel'].includes(target),'DEPLOY_TARGET');
 const sites=target==='pages'?[[pagesUrl,'pages']]:target==='vercel'?[[vercelUrl,'vercel']]:[[pagesUrl,'pages'],[vercelUrl,'vercel']];
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_BUNDLED_CHROMIUM==='1'?{}:{executablePath:'/usr/bin/chromium'}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  for(const [base,kind] of sites){
   if(!base.pathname.endsWith('/'))base.pathname+='/';
   const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   // Wait for both independently deployed sites to serve the new directory links.
   let current=false;
   for(let attempt=0;attempt<12;attempt++){
    await page.goto(base.href,{waitUntil:'networkidle'});
    if(new URL(page.url()).hostname==='vercel.com'&&new URL(page.url()).pathname.startsWith('/login'))throw new Error('Vercel Deployment Protection requires SSO before the application loads. Make the configured production URL public in Vercel Project Settings > Deployment Protection, or configure a public production domain. Keep the application Supabase Auth and RLS enabled.');
    current=await page.locator('.site-nav a').evaluateAll((links,arena)=>links.some(a=>new URL(a.href).pathname===arena),base.pathname+'arena/');
    // The polished home must expose its keyboard entry, not an older cached build.
    current=current&&await page.locator('a.site-skip[href="#main-content"]').count()===1&&await page.locator('.direction-card').count()===3&&await page.locator('.legal-links a').count()===2;
    if(current)break;
    await page.waitForTimeout(5000);
   }
   assert.ok(current,'deployment has not served the current build: '+base.href);
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    for(const path of ['','arena/','tournaments/','rental/','legal/','legal/privacy.html']){
     const url=new URL(path,base).href,response=await page.goto(url);
     assert.equal(response.status(),200,url);await page.evaluate(()=>document.fonts.ready);
     assert.equal(await page.locator('h1').count(),1,url);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,url);
     const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.currentSrc&&img.loading!=='lazy'&&img.complete&&img.naturalWidth===0).map(img=>img.src));
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
     const reloaded=await page.reload();assert.equal(reloaded.status(),200,'reload '+url);
    }
   }
   if(kind==='pages'){
    const redirect=await context.request.get(new URL('admin/',base).href);
    assert.equal(redirect.status(),200);const html=await redirect.text();
    assert.match(html,/http-equiv="refresh"/);assert.ok(html.includes(new URL('admin/',vercelUrl).href),'static admin redirects to the configured backend');
    console.log('PASS deployed '+base.href+': all public/legal pages, reloads, desktop/mobile GLB, photos, fonts, live Supabase rating and admin redirect. Backend login is checked separately.');
   }else{
    await page.goto(new URL('admin/',base).href);
    if(new URL(page.url()).hostname==='vercel.com')throw new Error('Vercel Deployment Protection blocks the admin entry. The configured backend must be publicly reachable before Supabase application login.');
    await page.locator('#login-form [name=email]').waitFor();
    assert.equal(new URL(page.url()).origin,vercelUrl.origin,'administration stays on the secure backend');
    const session=await context.request.get(new URL('api/admin?resource=session',vercelUrl).href);
    assert.equal(session.status(),200);assert.equal((await session.json()).authenticated,false);
    console.log('PASS deployed '+base.href+': all public/legal pages, reloads, desktop/mobile GLB, photos, fonts, live rating and secure admin entry (no login or writes).');
   }
   assert.deepEqual(errors,[]);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);if(process.env.GITHUB_ACTIONS)console.error('::error::'+String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));process.exitCode=1});
