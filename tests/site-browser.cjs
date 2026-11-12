const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startSite,browserOptions}=require('./club-fixture.cjs');
(async()=>{
 const {defaultDocument}=await import('../server/defaults.js');const doc=defaultDocument();
 doc.players=Array.from({length:21},(_,i)=>({id:'p'+(i+1),nickname:'Player'+(i+1),points:2100-i*100,wins:i%6,tournamentsPlayed:20}));
 const site=await startSite(doc),browser=await chromium.launch(browserOptions),errors=[],bad=[];
 try{
  for(const width of [320,390,600,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(site.base)&&r.status()>=400)bad.push(r.status()+' '+r.url())})});
   const page=await context.newPage();
   for(const path of ['/','/arena/','/tournaments/','/about/','/rental/','/legal/','/legal/privacy.html']){
    assert.equal((await page.goto(site.base+path)).status(),200,path);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('main h1').count(),1,path);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' '+path);
    assert.deepEqual(await page.locator('.site-header .site-nav a').allTextContents(),['Главная','Рейтинг','Турниры','О нас','Аренда столов','Связаться']);
    assert.equal(await page.locator('.legal-links a').count(),2);
    if(width<=1100){await page.locator('.menu').click();await page.keyboard.press('Tab');assert.equal(await page.locator('#site-mobile-nav').evaluate(n=>n.contains(document.activeElement)),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.menu').evaluate(n=>n===document.activeElement),true)}
    if(path==='/'){
     assert.equal(await page.locator('main>section').count(),2);assert.equal(await page.locator('.direction-card').count(),4);await page.locator('.model-loaded canvas').waitFor();
     const copy=await page.locator('.club-hero-copy').boundingBox(),chip=await page.locator('.chip-stage').boundingBox();assert.ok(width<=700?copy.y+copy.height<=chip.y+1:copy.x+copy.width<=chip.x+1,'chip has its own non-overlapping space');
     assert.match(await page.locator('main').innerText(),/18 лучших игроков/);assert.match(await page.locator('main').innerText(),/Без денежных ставок/);
    }
    if(path==='/arena/'){
     await page.waitForFunction(()=>document.querySelectorAll('#ranking-body tr').length===21);assert.equal(await page.locator('.rank-finalist').count(),18);assert.equal(await page.locator('.arena-hero').count(),0);assert.ok((await page.locator('h1').boundingBox()).y<180);
     await page.locator('#player-search').fill('Player19');assert.equal(await page.locator('#ranking-body tr').count(),1);assert.equal(await page.locator('.rank-finalist').count(),0);assert.equal(await page.locator('#ranking-body tr').getAttribute('data-rank'),'19');
     await page.locator('#clear-search').click();await page.locator('#ranking-sort').selectOption('wins');assert.equal(await page.locator('.rank-finalist').count(),18);assert.equal(await page.locator('#ranking-body tr').evaluateAll(rows=>rows.every(n=>n.classList.contains('rank-finalist')===(Number(n.dataset.rank)<=18))),true);
    }
    if(path==='/tournaments/'){
     await page.waitForFunction(()=>document.querySelectorAll('.tournament-card').length===3);assert.equal(await page.locator('#ranking').count(),0);
     for(const link of await page.locator('.tournament-signup').all())assert.equal(await link.getAttribute('href'),'https://t.me/asushedulebot');
    }
    if(path==='/about/'){assert.equal(await page.locator('a[href="/atmosphere/"]').count(),0);assert.equal(await page.locator('main picture').count(),3);for(const image of await page.locator('main picture img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode())}assert.equal(await page.locator('.about-wide img').evaluate(img=>img.naturalWidth>=img.clientWidth-2),true,'wide group photo declares its actual display width')}
    if(path==='/rental/'){
     assert.equal(await page.locator('.rental-card').count(),2);assert.match(await page.locator('.rental-card').first().innerText(),/700 ₽/);assert.match(await page.locator('.rental-card').last().innerText(),/500 ₽ с человека/);
     for(const link of await page.locator('.rental-card .btn').all())assert.equal(await link.getAttribute('href'),'https://t.me/asushedulebot');
     assert.equal(await page.locator('.rental-card picture,.rental-card img').count(),0);assert.equal(await page.locator('.rental-body>p:not(.rental-price)').count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/за час|₽\s*\/\s*час|предоплат/);
    }
   }
   assert.equal((await context.request.get(site.base+'/atmosphere/')).status(),404);
   await page.goto(site.base+'/arena/#tournaments');await page.waitForURL(site.base+'/tournaments/');await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);console.log('PASS simple five-page journey, six-link navigation, 320–1440px, 18 official rating places across search/sort, separate live schedule, official signup/booking contacts, three about photos, exact rental prices and legacy schedule link.');
 }finally{await browser.close();await site.close()}
})().catch(e=>{console.error(e);if(process.env.GITHUB_ACTIONS)console.error('::error::'+String(e.stack||e).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));process.exitCode=1});
