const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const base=process.env.ARENA_BASE_URL||'http://127.0.0.1:8010';
const players=JSON.parse(fs.readFileSync(path.join(root,'arena/data/players.json')));
const tournaments=JSON.parse(fs.readFileSync(path.join(root,'arena/data/tournaments.json')));
const output=process.env.ARENA_SCREENSHOTS||'/tmp/blaind-arena';
fs.mkdirSync(output,{recursive:true});
async function loaded(page){
 await page.goto(base+'/arena');
 await page.locator('#ranking-body tr').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.tournament-card').length===3);
 await page.evaluate(()=>document.fonts.ready);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
  const errors=[],consoleErrors=[],httpErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.url())});
  await loaded(page);await page.waitForTimeout(700);
  assert.equal(await page.locator('#ranking-body tr').count(),12);
  assert.equal(await page.locator('#ranking-body tr').first().locator('.player-name').innerText(),'NORD');
  assert.equal(await page.locator('#ranking-body .rank-top').count(),3);
  assert.match(await page.locator('#ranking-updated').innerText(),/10 ноября 2026/);
  assert.equal(await page.locator('#tournament-timezone').innerText(),'Новосибирск · UTC+7');
  assert.equal(await page.locator('.tournament-date span').first().innerText(),'19:00');
  assert.equal(await page.locator('input[type=file]').count(),0);
  await page.screenshot({path:path.join(output,'arena-hero-final.png')});

  await page.locator('.arena-actions a[href="#ranking"]').click();
  await page.waitForFunction(()=>Math.abs(document.getElementById('ranking').getBoundingClientRect().top)<40);
  await page.locator('#player-search').fill('  mIRa  ');
  assert.equal(await page.locator('#ranking-body tr').count(),1);
  assert.equal(await page.locator('#ranking-body tr').first().getAttribute('data-rank'),'2');
  assert.equal(await page.locator('#leaders-list .leader-name').first().innerText(),'NORD');
  await page.locator('#player-search').fill('no_such_player');
  assert.equal(await page.locator('#ranking-table-wrap').isVisible(),false);
  await page.locator('#ranking-message button').click();
  assert.equal(await page.locator('#ranking-body tr').count(),12);
  await page.locator('#ranking-sort').selectOption('wins');
  assert.equal(await page.locator('#ranking-body tr').first().locator('.player-name').innerText(),'Nero');
  assert.equal(await page.locator('#ranking-body tr').first().getAttribute('data-rank'),'4');
  assert.equal(await page.locator('th[data-sort="wins"]').getAttribute('aria-sort'),'descending');
  await page.locator('#ranking-sort').selectOption('tournamentsPlayed');
  assert.equal(await page.locator('#ranking-body tr').nth(2).locator('.player-name').innerText(),'RiverKing');
  await page.locator('#sort-direction').click();
  assert.equal(await page.locator('#ranking-body tr').first().locator('.player-name').innerText(),'Seven');
  await page.locator('[data-column-sort="points"]').click();
  assert.equal(await page.locator('#ranking-body tr').first().locator('.player-name').innerText(),'NORD');
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(output,'arena-rating-final.png')});
  console.log('PASS rating: points, search, empty results, wins, played, directions, global places, timezone');

  await page.evaluate(()=>scrollTo({top:document.getElementById('tournaments').offsetTop,behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelectorAll('.poster-trigger.has-image').length===3);
  await page.waitForTimeout(600);
  const toggle=page.locator('.details-toggle').first();
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  await page.waitForTimeout(300);assert.equal(await page.locator('.details-content').first().isVisible(),true);
  await toggle.click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.details-content').first().isVisible(),false);
  const poster=page.locator('.poster-trigger').first();
  await poster.click();assert.equal(await page.locator('#image-viewer').isVisible(),true);
  assert.equal(await page.locator('#viewer-title').innerText(),'Golden Night');
  await page.waitForFunction(()=>document.getElementById('viewer-image').naturalWidth===1200);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.getElementById('image-viewer').contains(document.activeElement)),true);
  await page.waitForTimeout(280);
  await page.screenshot({path:path.join(output,'arena-image-viewer.png')});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#image-viewer').isVisible(),false);
  assert.equal(await poster.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('image-open')),false);
  await page.evaluate(()=>scrollTo({top:document.getElementById('tournaments').offsetTop,behavior:'instant'}));
  await page.waitForTimeout(150);await page.screenshot({path:path.join(output,'arena-tournaments-final.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(httpErrors,[]);
  console.log('PASS tournaments: three posters, expandable details, full-size viewer, Escape, focus restoration; no console errors');
  await page.close();

  for(const [width,height] of [[1024,800],[768,1024],[600,900],[390,844],[320,700]]){
   const mobile=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   const errors=[];mobile.on('pageerror',e=>errors.push(e.message));
   await loaded(mobile);
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width<=600){
    await mobile.locator('.menu').click();
    assert.equal(await mobile.locator('.menu').getAttribute('aria-expanded'),'true');
    await mobile.locator('#arena-mobile-nav a[href="#ranking"]').click();
    assert.equal(await mobile.locator('.menu').getAttribute('aria-expanded'),'false');
   }
   await mobile.evaluate(()=>scrollTo({top:document.getElementById('ranking').offsetTop,behavior:'instant'}));
   await mobile.waitForTimeout(100);
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await mobile.locator('#ranking-body tr').first().locator('td').count(),5);
   for(const cell of await mobile.locator('#ranking-body tr').first().locator('td').all())assert.equal(await cell.isVisible(),true);
   await mobile.locator('#ranking-sort').selectOption('wins');
   assert.equal(await mobile.locator('#ranking-body tr').first().locator('.player-name').innerText(),'Nero');
   if(width===390){
    await mobile.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await mobile.screenshot({path:path.join(output,'arena-mobile-hero-final.png')});
    await mobile.evaluate(()=>scrollTo({top:document.getElementById('ranking').offsetTop,behavior:'instant'}));await mobile.screenshot({path:path.join(output,'arena-mobile-rating-final.png')});
   }
   await mobile.evaluate(()=>scrollTo({top:document.getElementById('tournaments').offsetTop,behavior:'instant'}));
   await mobile.locator('.poster-trigger.has-image').first().waitFor();
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===390)await mobile.screenshot({path:path.join(output,'arena-mobile-tournaments-final.png')});
   await mobile.locator('.poster-trigger').first().click();assert.equal(await mobile.locator('#image-viewer').isVisible(),true);
   await mobile.locator('#close-viewer').click();assert.equal(await mobile.locator('#image-viewer').isVisible(),false);
   assert.deepEqual(errors,[]);
   await mobile.close();
  }
  console.log('PASS responsive 320–1024px: all rating fields, mobile menu, images, reduced motion');

  const variants=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const imageData=structuredClone(tournaments);
  imageData.tournaments[0].imageUrl='./images/portrait-test.svg';imageData.tournaments[0].imageFit='contain';
  imageData.tournaments[0].title='<img src=x onerror=alert(1)> клуб';
  imageData.tournaments[1].imageUrl=null;
  imageData.tournaments[2].imageUrl='./images/missing-test.webp';
  await variants.route('**/data/tournaments.json',r=>r.fulfill({json:imageData}));
  await variants.route('**/images/portrait-test.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="#b99a65"/><circle cx="200" cy="400" r="80" fill="#101110"/></svg>'}));
  await variants.route('**/images/missing-test.webp',r=>r.fulfill({status:404,body:''}));
  await loaded(variants);
  await variants.evaluate(()=>scrollTo({top:document.getElementById('tournaments').offsetTop,behavior:'instant'}));
  await variants.locator('.poster-trigger.has-image').first().waitFor();
  assert.equal(await variants.locator('.tournament-card h3 img').count(),0);
  assert.equal(await variants.locator('.poster-trigger').nth(1).isDisabled(),true);
  await variants.locator('.tournament-card').nth(2).scrollIntoViewIfNeeded();await variants.waitForTimeout(200);
  assert.equal(await variants.locator('.poster-trigger').nth(2).isDisabled(),true);
  assert.equal(await variants.locator('.poster-trigger').first().locator(':scope > img').evaluate(el=>getComputedStyle(el).objectFit),'contain');
  await variants.locator('.poster-trigger').first().click();
  await variants.waitForFunction(()=>document.getElementById('viewer-image').naturalHeight===800);
  const imageBox=await variants.locator('#viewer-image').boundingBox();
  assert.ok(Math.abs(imageBox.width/imageBox.height-.5)<.02);
  assert.ok(imageBox.height<=844*.71);
  await variants.keyboard.press('Escape');await variants.close();
  console.log('PASS portrait image preserves proportions; missing/removed images fall back; titles render as text');

  const retry=await browser.newPage({reducedMotion:'reduce'});let attempts=0;
  await retry.route('**/data/players.json',r=>++attempts===1?r.fulfill({status:503,body:''}):r.fulfill({json:players}));
  await retry.goto(base+'/arena');
  await retry.locator('#ranking-message[role="alert"] button').waitFor();
  assert.equal(await retry.locator('#ranking-table-wrap').isVisible(),false);
  await retry.waitForFunction(()=>document.querySelectorAll('.tournament-card').length===3);
  await retry.locator('#ranking-message button').click();
  await retry.waitForFunction(()=>document.querySelectorAll('#ranking-body tr').length===12);
  assert.equal(attempts,2);await retry.close();

  const empty=await browser.newPage({reducedMotion:'reduce'});
  await empty.route('**/data/players.json',r=>r.fulfill({json:{...players,players:[]}}));
  await empty.route('**/data/tournaments.json',r=>r.fulfill({json:{...tournaments,tournaments:[]}}));
  await empty.goto(base+'/arena');
  await empty.waitForFunction(()=>document.getElementById('players-total').textContent==='0'&&document.getElementById('tournaments-total').textContent==='0');
  assert.match(await empty.locator('#ranking-message').innerText(),/пока пуст/);
  assert.match(await empty.locator('#tournaments-message').innerText(),/скоро появятся/);
  await empty.close();
  console.log('PASS independent loading failure/retry and empty collections');

  const navigation=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const fontCSS=fs.readFileSync(path.join(root,'arena/arena.css'),'utf8').split('\n').slice(0,3).join('\n').replaceAll('url("./fonts/','url("'+base+'/arena/fonts/');
  await navigation.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:fontCSS}));
  await navigation.goto(base+'/');
  assert.equal(await navigation.locator('header a[href="/arena"]').count(),2);
  await navigation.locator('header>nav:not(.mobile-nav) a[href="/arena"]').click();
  await navigation.waitForURL(/\/arena\/?$/);
  await navigation.locator('#ranking-body tr').first().waitFor();
  await navigation.setViewportSize({width:390,height:844});
  await navigation.goto(base+'/');
  await navigation.locator('.menu').click();
  await navigation.locator('#mobile-nav a[href="/arena"]').click();
  await navigation.waitForURL(/\/arena\/?$/);
  await navigation.locator('#ranking-body tr').first().waitFor();
  await navigation.close();
  console.log('PASS main-page desktop/mobile navigation into /arena');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
