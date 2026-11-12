import {hostingConfig,prefixHtml,prefixCss,adminRedirect} from './hosting.mjs';
import {supabaseConfig} from '../server/config.js';
import {syncSiteComponents} from './site-components.mjs';
import {cp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {build,transform} from 'esbuild';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const hosting=hostingConfig();
const publicConfig=supabaseConfig(process.env);
const excluded=name=>/^(tests|node_modules)$/.test(name)||(/\.(md|py|d\.ts|test\.mjs|cjs)$/.test(name)&&!/^LICENSE\.md$/i.test(name));
for(const dir of ['api','server','admin','arena','atmosphere','shared']){
  async function check(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      if(entry.name==='node_modules'||entry.name==='fonts')continue;
      const path=join(folder,entry.name);
      if(entry.isDirectory())await check(path);
      else if(/\.(m?js|cjs)$/.test(entry.name))execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
      else if(entry.name.endsWith('.json'))JSON.parse(await readFile(path,'utf8'));
    }
  }
  await check(join(root,dir));
}
JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
await syncSiteComponents();
const destination=join(root,'public');
await rm(destination,{recursive:true,force:true});await mkdir(destination);
for(const name of ['index.html','design.css','experience.js','model.js',
  'assets','vendor','arena','admin','atmosphere','shared','legal','tournaments','about','rental',...Array.from({length:7},(_,i)=>'atm'+(i+1)+'.jpg')]){
  await cp(join(root,name),join(destination,name),{recursive:true,filter:path=>!excluded(path.split('/').at(-1))});
}
console.log('Static production output ready in public/. Server code and environment files are excluded.');

// Bundle ESM once, share common chunks, and minify only generated output.
await build({absWorkingDir:root,entryPoints:['experience.js','shared/site.js','arena/arena.js','atmosphere/atmosphere.js','admin/admin.js'],outdir:destination,outbase:root,bundle:true,splitting:true,format:'esm',target:['es2022'],minify:true,chunkNames:'assets/chunks/[name]-[hash]',legalComments:'external',define:{__SITE_BASE__:JSON.stringify(hosting.base),__STATIC_HOSTING__:JSON.stringify(hosting.staticHosting),__PUBLIC_SUPABASE_CONFIG__:JSON.stringify(publicConfig)},plugins:[{name:'web-root',setup(b){b.onResolve({filter:/^\/shared\//},args=>({path:resolve(root,'.'+args.path)}))}}]});
async function prepareOutput(folder){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);
  if(entry.isDirectory())await prepareOutput(path);
  else if(entry.name.endsWith('.html'))await writeFile(path,prefixHtml(await readFile(path,'utf8'),hosting.base));
  else if(entry.name.endsWith('.css'))await writeFile(path,(await transform(prefixCss(await readFile(path,'utf8'),hosting.base),{loader:'css',minify:true,target:'es2022'})).code);
 }
}
await prepareOutput(destination);
console.log('Browser bundles, shared chunks and minified styles ready.');

if(hosting.staticHosting)await writeFile(join(destination,'admin/index.html'),adminRedirect(hosting.adminUrl,hosting.base));
await writeFile(join(destination,'.nojekyll'),'');
console.log(`Hosting: ${hosting.base} (${hosting.staticHosting?'static + Supabase public reads; hosted secure admin':'same-origin Node API'})`);
