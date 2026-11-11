import {syncSiteComponents} from './site-components.mjs';
import {cp,mkdir,rm,readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const excluded=name=>/^(tests|node_modules)$/.test(name)||/\.(md|py|d\.ts|test\.mjs|cjs)$/.test(name);
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
for(const name of ['index.html','design.css','experience.js','model.js','aces.html','aces.css','aces.js',
  'shakhmatnaya-figura.glb','blaind_four_separate_aces.glb','assets','vendor','arena','admin','atmosphere','shared','legal',...Array.from({length:7},(_,i)=>'atm'+(i+1)+'.jpg')]){
  await cp(join(root,name),join(destination,name),{recursive:true,filter:path=>!excluded(path.split('/').at(-1))});
}
console.log('Static production output ready in public/. Server code and environment files are excluded.');
