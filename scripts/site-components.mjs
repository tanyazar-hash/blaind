import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function syncSiteComponents(){
 const templates=await Promise.all(['header','footer'].map(name=>readFile(resolve(root,'shared/'+name+'.html'),'utf8')));
 for(const [page,path]of[['home','index.html'],['arena','arena/index.html'],['atmosphere','atmosphere/index.html']]){
  const file=resolve(root,path);let html=await readFile(file,'utf8');
  for(const [i,name]of['header','footer'].entries()){
   const rendered=templates[i].replace(/\{\{(home|arena|atmosphere)_current\}\}/g,(_,value)=>value===page?'aria-current="page"':'');
   const start='<!-- site:'+name+' -->',end='<!-- /site:'+name+' -->';
   const pattern=new RegExp(start+'[\\s\\S]*?'+end);
   if(!pattern.test(html))throw new Error('Missing shared '+name+' marker in '+path);
   html=html.replace(pattern,start+'\n'+rendered+end);
  }
  if(html!==await readFile(file,'utf8'))await writeFile(file,html);
 }
}
