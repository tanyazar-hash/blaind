const assert=require('node:assert/strict');
const{resolve}=require('node:path');const{writeFile}=require('node:fs/promises');
const{chromium}=require('playwright');
(async()=>{
 const{serve}=await import('../scripts/dev-server.mjs');const{defaultDocument,publicSnapshot}=await import('../server/defaults.js');
 const server=serve({root:resolve(__dirname,'../public')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  for(const[name,width,height,dpr]of[['Small Android',320,740,1],['Android',360,800,2],['iPhone 14 Pro',393,852,3],['iPhone 17',402,874,3],['Pixel',412,915,2.625],['Tablet',768,1024,2],['Landscape',844,390,2],['iPad landscape',1024,768,2],['Desktop',1440,900,1],['Wide desktop',1920,1080,1]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr,isMobile:width<768,hasTouch:width<1024,reducedMotion:'reduce'}),errors=[],bad=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url())});
   await page.route('**/api/arena',r=>r.fulfill({json:publicSnapshot({version:1,document:defaultDocument()})}));
   for(const path of['/','/arena/','/atmosphere/','/legal/','/legal/privacy.html','/admin/']){
    await page.goto(base+path);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' '+path+' overflow');
    if(path==='/'){
     await page.locator('.model-loaded canvas').waitFor({state:'visible',timeout:60000});
     const box=await page.locator('.object-position').boundingBox(),copy=await page.locator('.hero-content').boundingBox();
     if(width<=600){
      const available=await page.evaluate(()=>document.documentElement.clientWidth);
      assert.ok(Math.abs(box.x+box.width/2-available/2)<1,'centered '+name);
      assert.ok(box.y+box.height<copy.y,'chip above text '+name);
     }
     for(const id of['about','experience','events','contact']){
      await page.evaluate(id=>scrollTo({top:document.getElementById(id).offsetTop,behavior:'instant'}),id);
      await page.waitForFunction(id=>document.querySelector('.object-position').dataset.chapter===id,id);
      if(['experience','events'].includes(id)||width<=600&&id==='about')assert.equal(await page.locator('.object-position').evaluate(n=>getComputedStyle(n).visibility),'hidden','parked outside '+name+' '+id);
      if(id==='contact'){
       assert.match(await page.locator('.object-scene').evaluate(n=>n.style.clipPath),/inset/,'contact text clipping '+name);
       const chip=await page.locator('.object-position').boundingBox(),space=await page.locator('.final-object-space').boundingBox();
       assert.ok(chip.y>=space.y-1&&chip.y+chip.height<=space.y+space.height+1,'contact reserved space '+name);
      }
     }
     if(['iPhone 14 Pro','iPhone 17','Desktop'].includes(name)){
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.object-position').dataset.chapter==='top');
      await page.screenshot({path:'/tmp/blaind-optimized-'+name.replaceAll(' ','-')+'.png'});
     }
    }
    if(path==='/atmosphere/'){
     await page.locator('.atm-frame').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.atm-frame img').complete&&document.querySelector('.atm-frame img').naturalWidth>0);
     assert.match(await page.locator('.atm-frame img').first().evaluate(n=>n.currentSrc),/\.avif$/);
    }
    if(width<=760&&path==='/legal/'){
     await page.locator('.menu').click();assert.equal(await page.locator('#site-mobile-nav').isVisible(),true);await page.keyboard.press('Escape');
    }
    await page.locator('body').evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' footer '+path);
   }
   assert.deepEqual(errors,[],name+' page errors');assert.deepEqual(bad,[],name+' HTTP errors');
   results.push({device:name,viewport:[width,height],status:'passed'});await page.close();
  }
  // Cold-cache, CPU/network constrained real WebGL startup with absolute-time physics.
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:160000,uploadThroughput:70000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{window.metrics={cls:0};new PerformanceObserver(l=>{window.metrics.lcp=l.getEntries().at(-1).startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.metrics.cls+=e.value}).observe({type:'layout-shift',buffered:true})});
  const started=Date.now();await page.goto(base+'/');await page.locator('.model-loaded canvas').waitFor({state:'visible',timeout:90000});const loaded=Date.now();
  await page.waitForFunction(()=>document.querySelector('.object-arrival').dataset.state==='ready',{},{timeout:15000});
  const metrics=await page.evaluate(()=>({...window.metrics,decodedBytes:performance.getEntriesByType('resource').reduce((s,e)=>s+e.decodedBodySize,0),model:performance.getEntriesByType('resource').find(e=>e.name.endsWith('.glb'))?.decodedBodySize,lod:document.querySelector('canvas').dataset.lod,triangles:Number(document.querySelector('canvas').dataset.triangles)}));
  assert.equal(metrics.lod,'mobile');assert.ok(metrics.model<400000);assert.ok(metrics.decodedBytes<2000000);assert.ok(metrics.triangles<30000);assert.ok(metrics.cls<.1);assert.ok(Date.now()-loaded<15000,'physics finishes on slow frames');
  results.push({device:'4x CPU / 1.28 Mbps / 150ms latency',readyMs:Date.now()-started,animationMs:Date.now()-loaded,...metrics});await page.close();
  const fallback=await browser.newPage({viewport:{width:393,height:852}});await fallback.route('**/*.glb',r=>r.abort());await fallback.goto(base+'/');await fallback.locator('.fallback-visible .chip-fallback').waitFor({state:'visible'});await fallback.close();
  const removed=await fetch(base+'/aces.html');assert.equal(removed.status,404);
  await writeFile('/tmp/blaind-performance-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
