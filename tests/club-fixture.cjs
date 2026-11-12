const {resolve}=require('node:path');
exports.startSite=async(document)=>{
 const {serve}=await import('../scripts/dev-server.mjs'),{createArenaBackend}=await import('../server/app.js'),{defaultDocument}=await import('../server/defaults.js');
 const doc=document||defaultDocument();
 doc.tournaments.forEach((t,i)=>{t.startsAt=new Date(Date.now()+(i+1)*86400000).toISOString();t.endsAt=null;t.status='scheduled'});
 const server=serve({root:resolve(__dirname,'../public'),backend:createArenaBackend({store:{readDocument:async()=>({version:1,document:doc})}})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {base:'http://127.0.0.1:'+server.address().port,document:doc,close:()=>new Promise(r=>server.close(r))};
};
exports.browserOptions={...(process.env.PLAYWRIGHT_BUNDLED_CHROMIUM==='1'?{}:{executablePath:'/usr/bin/chromium'}),args:['--no-sandbox','--enable-unsafe-swiftshader']};
