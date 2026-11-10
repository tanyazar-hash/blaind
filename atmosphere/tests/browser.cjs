const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const base=process.env.ATM_BASE_URL||'http://127.0.0.1:8030';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 await fs.mkdir('/tmp/blaind-atmosphere',{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],badResponses=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)badResponses.push(r.url())});
  await page.goto(base+'/atmosphere/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
  assert.equal(await page.locator('.atm-photo').count(),7);assert.equal((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim(),'АТМОСФЕРА BLΛIND');
  assert.equal(await page.locator('main > section').count(),5);
  const sources=await page.locator('main .atm-frame').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname));
  assert.deepEqual([...sources].sort(),Array.from({length:7},(_,i)=>'/atm'+(i+1)+'.jpg'));
  assert.equal(new Set(sources).size,7);
  assert.equal(await page.locator('.atm-hero img').count(),0);
  assert.equal(await page.locator('.atm-photo-1').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.atm-hero').getBoundingClientRect().bottom),true);
  await page.getByRole('heading',{name:'У каждой детали — своё значение.'}).count().then(count=>assert.equal(count,1));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-hero.png'});
  for(const photo of await page.locator('.atm-frame').all()){
   await photo.scrollIntoViewIfNeeded();await photo.locator('img').evaluate(img=>img.decode());
   await page.waitForTimeout(150);
  }
  await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-full.png',fullPage:true});
  await page.locator('#club-moments').scrollIntoViewIfNeeded();await page.waitForTimeout(1100);await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-gathering.png'});
  await page.locator('#space-title').scrollIntoViewIfNeeded();await page.waitForTimeout(1100);await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-space.png'});
  await page.locator('#people-title').scrollIntoViewIfNeeded();await page.waitForTimeout(1100);await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-people.png'});
  await page.locator('#finale').scrollIntoViewIfNeeded();await page.waitForTimeout(1100);await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-finale.png'});
  await page.locator('.atm-frame').first().locator('.atm-photo-open').click();await page.locator('#atm-viewer-image.is-loaded').waitFor();
  assert.equal(await page.locator('#atm-viewer-count').innerText(),'01 / 07');await page.screenshot({path:'/tmp/blaind-atmosphere/desktop-viewer.png'});
  await page.keyboard.press('ArrowLeft');await page.locator('#atm-viewer-image.is-loaded').waitFor();assert.equal(await page.locator('#atm-viewer-count').innerText(),'07 / 07');
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#atm-viewer-count').innerText(),'01 / 07');
  await page.locator('.atm-viewer-next').click();await page.locator('#atm-viewer-image.is-loaded').waitFor();assert.equal(await page.locator('#atm-viewer-count').innerText(),'02 / 07');
  const bounds=await page.locator('#atm-viewer-image').boundingBox();assert.ok(Math.abs(bounds.width/bounds.height-857/1280)<.01);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#atm-viewer').contains(document.activeElement)),true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#atm-viewer').open);assert.equal(await page.locator('.atm-frame').first().evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('atm-viewer-open')),false);
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  for(const width of[1024,768,600,390,320]){
   const mobile=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',hasTouch:width<=600});
   mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base+'/atmosphere/');await mobile.evaluate(()=>document.fonts.ready);
   assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No overflow at '+width);
   if(width===390)await mobile.screenshot({path:'/tmp/blaind-atmosphere/mobile-hero.png'});
   if(width<=600){await mobile.locator('.menu').click();assert.equal(await mobile.locator('#atm-mobile-nav').isVisible(),true);await mobile.keyboard.press('Escape');assert.equal(await mobile.locator('.menu').getAttribute('aria-expanded'),'false')}
   for(const photo of await mobile.locator('.atm-frame').all()){await photo.scrollIntoViewIfNeeded();await photo.locator('img').evaluate(img=>img.decode());assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   await mobile.locator('.atm-photo-3').scrollIntoViewIfNeeded();if(width===390)await mobile.screenshot({path:'/tmp/blaind-atmosphere/mobile-space.png'});
   await mobile.locator('.atm-frame').nth(2).click();await mobile.locator('#atm-viewer-image.is-loaded').waitFor();
   if(width===390){await mobile.screenshot({path:'/tmp/blaind-atmosphere/mobile-viewer.png'});await mobile.locator('.atm-viewer-image-wrap').dispatchEvent('pointerdown',{pointerType:'touch',clientX:300,clientY:300});await mobile.locator('.atm-viewer-image-wrap').dispatchEvent('pointerup',{pointerType:'touch',clientX:100,clientY:305});assert.equal(await mobile.locator('#atm-viewer-count').innerText(),'04 / 07')}
   await mobile.locator('.atm-viewer-close').click();await mobile.waitForFunction(()=>!document.querySelector('#atm-viewer').open);
   await mobile.locator('.atm-finale').scrollIntoViewIfNeeded();assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();
  }
  const noJS=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});await noJS.goto(base+'/atmosphere/');assert.equal(await noJS.locator('.atm-frame').count(),7);assert.equal(await noJS.locator('.atm-frame').first().isVisible(),true);assert.equal(await noJS.locator('#atm-mobile-nav').isVisible(),true);await noJS.locator('.atm-frame').first().locator('.atm-photo-open').click();await noJS.waitForURL('**/atm1.jpg');await noJS.close();
  const failure=await browser.newPage({reducedMotion:'reduce'});await failure.route('**/atmosphere/images/atm1-1280.webp',r=>r.fulfill({status:404,body:''}));await failure.goto(base+'/atmosphere/');await failure.locator('.atm-frame').first().locator('.atm-photo-open').click();await failure.locator('#atm-viewer-error').waitFor({state:'visible'});await failure.locator('.atm-viewer-next').click();await failure.locator('#atm-viewer-image.is-loaded').waitFor();await failure.keyboard.press('Escape');await failure.close();
  assert.deepEqual(errors,[]);console.log('PASS: seven photos; desktop/mobile 320–1440; full-size viewer, proportions, arrows, wraparound, swipe, Escape, focus, scroll unlock, reduced motion, no-JS originals, image failure recovery; text-only introduction and four story chapters with seven unique photographs.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
