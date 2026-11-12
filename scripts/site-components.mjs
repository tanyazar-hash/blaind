import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function syncSiteComponents(){
 const legalLinks=await readFile(resolve(root,'shared/legal-links.html'),'utf8');
 const documents=(await readdir(resolve(root,'legal'))).filter(name=>name.endsWith('.html')).map(name=>['legal','legal/'+name]);
 const templates=await Promise.all(['header','footer'].map(name=>readFile(resolve(root,'shared/'+name+'.html'),'utf8')));
 for(const [page,path]of[['home','index.html'],['arena','arena/index.html'],['tournaments','tournaments/index.html'],['about','about/index.html'],['rental','rental/index.html'],...documents]){
  const file=resolve(root,path);let html=await readFile(file,'utf8');
  for(const [i,name]of['header','footer'].entries()){
   const rendered=templates[i].replace('{{legal_links}}',legalLinks.trim()).replace(/\{\{(home|arena|atmosphere|tournaments|about|rental)_current\}\}/g,(_,value)=>value===page?'aria-current="page"':'');
   const start='<!-- site:'+name+' -->',end='<!-- /site:'+name+' -->';
   const pattern=new RegExp(start+'[\\s\\S]*?'+end);
   if(!pattern.test(html))throw new Error('Missing shared '+name+' marker in '+path);
   html=html.replace(pattern,start+'\n'+rendered+end);
  }
  if(!html.includes('href="/shared/club.css"'))html=html.replace('</head>','<link rel="stylesheet" href="/shared/club.css">\n</head>');
  if(!html.includes('href="/legal/footer.css"'))html=html.replace('</head>','<link rel="stylesheet" href="/legal/footer.css">\n</head>');
  if(html!==await readFile(file,'utf8'))await writeFile(file,html);
 }
}
