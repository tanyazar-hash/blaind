const assert=require('node:assert/strict');
const http=require('node:http');
const {readFile,stat,readdir}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const {hostingConfig}=await import('../scripts/hosting.mjs');
 const {defaultDocument,publicSnapshot}=await import('../server/defaults.js');
 const {base,staticHosting,adminUrl}=hostingConfig();
 const root=resolve(__dirname,'../public'),document=defaultDocument();
 document.players[0].nickname='Hosting Live Player';
 document.settings.playersIsDemo=false;
 const row={version:42,document};
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.glb':'model/gltf-binary','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.json':'application/json'};
 const apiCalls=[];
 // Deliberately a directory-based static server: no Vercel rewrites or SPA fallback.
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://test');
   if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end('Outside deployment')}
   const path=url.pathname.slice(base.length);
   if(path.startsWith('api/')){
    apiCalls.push(path);
    if(!staticHosting&&path==='api/arena'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(publicSnapshot(row)))}
    res.writeHead(404);return res.end('No functions on this host');
   }
   let file=resolve(root,decodeURIComponent(path));
   if(file!==root&&!file.startsWith(root+sep))throw Error('Traversal');
   if((await stat(file)).isDirectory()){
    if(!url.pathname.endsWith('/')){res.writeHead(301,{Location:url.pathname+'/'+url.search});return res.end()}
    file=resolve(file,'index.html');
   }
   res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found')}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_BUNDLED_CHROMIUM==='1'?{}:{executablePath:'/usr/bin/chromium'}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[],bad=[],supabaseCalls=[],models=[],fonts=[];
 try{
  const context=await browser.newContext({reducedMotion:'reduce'});
  // Exercise both width-based LODs even on 2/4-core CI runners. The production
  // low-resource fallback intentionally selects the mobile LOD at every width.
  await context.addInitScript(()=>{
   Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});
   Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
  });
  // Deterministic upstream fixture; real service availability is checked separately.
  await context.route('https://*.supabase.co/rest/v1/arena_documents?**',async route=>{
   const req=route.request();supabaseCalls.push(req);
   assert.equal(req.method(),'GET');assert.match(req.headers().apikey,/^sb_publishable_/);
   assert.equal(req.headers().authorization,undefined);
   await route.fulfill({json:[row],headers:{'Access-Control-Allow-Origin':'*'}});
  });
  await context.route(adminUrl,route=>route.fulfill({contentType:'text/html',body:'<h1>Hosted secure administration</h1>'}));
  context.on('page',page=>{
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',response=>{
    if(response.url().startsWith(origin)&&response.status()>=400)bad.push(response.status()+' '+response.url());
    if(response.url().endsWith('.glb'))models.push(response.url());
    if(response.url().endsWith('.woff2'))fonts.push(response.url());
   });
  });
  const pages=['','arena/','tournaments/','rental/','legal/','legal/privacy.html'];
  for(const width of [1440,390]){
   for(const path of pages){
    const page=await context.newPage();await page.setViewportSize({width,height:900});
    const response=await page.goto(origin+base+path);assert.equal(response.status(),200,path);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1,path);
    const broken=await page.locator('img').evaluateAll(images=>images.filter(img=>img.currentSrc&&img.loading!=='lazy'&&img.complete&&img.naturalWidth===0).map(img=>img.src));
    assert.deepEqual(broken,[],path+' loaded images');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path+' overflow');
    const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.href));
    for(const link of links){
     const url=new URL(link);if(url.origin!==origin)continue;
     assert.ok(url.pathname.startsWith(base),'link escapes prefix: '+link);
     const linked=await context.request.get(link);assert.equal(linked.status(),200,link);
    }
    if(path===''){if(width>1100)await page.locator('.model-loaded canvas').waitFor({state:'visible',timeout:60000});else assert.equal(await page.locator('canvas').count(),0);}
    if(path==='arena/')await page.getByText('Hosting Live Player',{exact:true}).waitFor();
    await page.reload();assert.equal(await page.locator('h1').count(),1,'reload '+path);
    await page.close();
   }
  }
  for(const path of ['arena','tournaments','rental','legal','admin']){
   const response=await context.request.get(origin+base+path,{maxRedirects:0});assert.equal(response.status(),301,'directory redirect '+path);
  }
  assert.equal((await context.request.get(origin+base+'atmosphere/')).status(),404,'removed gallery is not published');
  assert.equal((await context.request.get(origin+base+'about/')).status(),404,'removed About page is not published');
  for(const name of ['rules','terms','consents','sources']){const alias=await context.newPage();await alias.goto(origin+base+'legal/'+name+'.html');await alias.waitForURL(name==='consents'?origin+base+'legal/privacy.html':origin+base+'legal/'+(name==='rules'?'#rules':name==='terms'?'#booking':''));await alias.close()}
  if(staticHosting){
   const page=await context.newPage();await page.goto(origin+base+'admin/');await page.waitForURL(adminUrl);await page.getByRole('heading',{name:'Hosted secure administration'}).waitFor();await page.close();
   assert.equal(apiCalls.length,0,'static site must never request server functions');
   assert.ok(supabaseCalls.length>0,'live anon RLS read must execute');
   // A real database/network failure must not silently display an old JSON rating.
   await context.unroute('https://*.supabase.co/rest/v1/arena_documents?**');
   await context.route('https://*.supabase.co/rest/v1/arena_documents?**',r=>r.fulfill({status:503,json:{code:'UPSTREAM_FAILURE'}}));
   const page2=await context.newPage();await page2.goto(origin+base+'arena/');await page2.locator('#ranking-message').waitFor({state:'visible'});assert.equal(await page2.getByText('Hosting Live Player',{exact:true}).count(),0);await page2.close();
  }else assert.ok(apiCalls.length>0,'same-origin API must execute');
  assert.ok(models.some(url=>url.includes('chip-desktop-')),'desktop GLB');
  assert.equal(models.some(url=>url.includes('chip-mobile-')),false,'mobile must not load a GLB');
  assert.ok(fonts.length>=3,'local WOFF2 fonts');
  const fallback=await context.newPage();await fallback.route('**/*.glb',route=>route.abort());await fallback.goto(origin+base);await fallback.locator('.fallback-visible .chip-fallback').waitFor({state:'visible'});await fallback.close();
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
  console.log(`PASS built ${base}: all public/legal pages and reloads, internal links, desktop GLB and mobile without 3D, fonts, photos, responsive layout, ${staticHosting?'live Supabase contract, failure state and hosted admin navigation':'same-origin API'}. Upstream responses used deterministic fixtures.`);
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(error=>{console.error(error);if(process.env.GITHUB_ACTIONS)console.error('::error::'+String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));process.exitCode=1});
