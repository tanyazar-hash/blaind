const assert=require('node:assert/strict');
const {mkdtemp,mkdir,rm}=require('node:fs/promises');
const {chromium}=require('playwright');
(async()=>{
 const {pgStore}=await import('./pg-store.mjs'),{authFixture}=await import('./auth-fixture.mjs'),{serve}=await import('../scripts/dev-server.mjs'),{createArenaBackend}=await import('../server/app.js');
 const dir=await mkdtemp('/tmp/blaind-site-'),auth=authFixture(),store=await pgStore(dir,{identity:auth.identity});
 const server=serve({backend:createArenaBackend({store,auth,env:{NODE_ENV:'test'}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 await mkdir('/tmp/blaind-unified',{recursive:true});const errors=[];
 try{
  for(const width of[1440,1024,768,600,390,320]){
   const geometries=[],headers=[],footers=[];
   for(const [path,name,hero]of[['/','home','.hero'],['/arena','arena','.arena-hero'],['/atmosphere/','atmosphere','.atm-hero']]){
    const p=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(name+': '+e.message));await p.goto(base+path);await p.evaluate(()=>document.fonts.ready);
    if(name==='arena')await p.waitForFunction(()=>document.getElementById('players-total').textContent==='12');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow '+width);
    const nav=p.locator('.site-header .site-nav');assert.deepEqual(await nav.locator('a').allTextContents(),['Главная','Арена','Атмосфера','Связаться']);assert.equal(await nav.locator('[aria-current=page]').count(),1);
    headers.push((await p.locator('.site-header').innerHTML()).replace(/ aria-current="page"/g,''));footers.push((await p.locator('.site-footer').innerHTML()).replace(/ aria-current="page"/g,''));
    geometries.push({head:await p.locator('.site-header').evaluate(n=>n.offsetHeight),hero:await p.locator(hero).evaluate(n=>n.offsetHeight)});
    assert.equal(await p.locator('body').innerText().then(s=>s.includes('BLΛIND')||s.includes('Новосибирск')),false);
    if(width<=600){await p.locator('.site-header .menu').click();assert.equal(await p.locator('#site-mobile-nav').isVisible(),true);await p.keyboard.press('Escape');assert.equal(await p.locator('.menu').getAttribute('aria-expanded'),'false')}
    if(width===1440||width===390)await p.screenshot({path:'/tmp/blaind-unified/'+name+'-'+width+'.png'});
    if(name==='home'){
     await p.locator('.model-loaded canvas').waitFor({state:'visible'});
     const model=await p.locator('.object-position').boundingBox(),copy=await p.locator('.hero-content').boundingBox();assert.ok(width>600||model.y+model.height<copy.y,'mobile hero chip avoids copy');
     await p.locator('#events').scrollIntoViewIfNeeded();for(const summary of await p.locator('details.event summary').all()){await summary.click();assert.equal(await summary.getAttribute('aria-expanded'),'true');assert.equal(await summary.locator('..').locator('p').isVisible(),true);await summary.click();assert.equal(await summary.getAttribute('aria-expanded'),'false')}
     assert.equal(await p.locator('#about a[href="/atmosphere/"]').count(),1);assert.equal(await p.locator('#events a[href="/arena/#tournaments"]').count(),1);
    }
    await p.locator('.site-footer').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.close();
   }
   assert.equal(new Set(geometries.map(g=>g.head)).size,1,'same header height '+width);assert.equal(new Set(geometries.map(g=>g.hero)).size,1,'same hero height '+width);
   assert.ok(headers.every(h=>h===headers[0]),'shared header markup');assert.ok(footers.every(f=>f===footers[0]),'shared footer markup');
  }
  const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/');await p.locator('.model-loaded canvas').waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelector('.object-arrival').dataset.state==='ready');
  await p.locator('#events').scrollIntoViewIfNeeded();const summary=p.locator('details.event summary').first();await summary.click();await p.waitForTimeout(450);assert.equal(await summary.getAttribute('aria-expanded'),'true');await summary.click();await p.waitForTimeout(450);assert.equal(await summary.locator('..').evaluate(n=>n.open),false);
  const before=await p.locator('.hero h1').evaluate(n=>getComputedStyle(n.querySelector('em')).fontStyle);assert.equal(before,'italic');
  await p.goto(base+'/atmosphere/');await p.locator('.atm-frame').first().click();await p.locator('#atm-viewer-image.is-loaded').waitFor();await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('atm-viewer').open);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS shared chrome, equal hero heights, 320–1440px, active links, menus, Cyrillic brand, chip spacing/drop, accordions and Atmosphere viewer.');
 }finally{await browser.close();await new Promise(r=>server.close(r));await store.db.close();await rm(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
