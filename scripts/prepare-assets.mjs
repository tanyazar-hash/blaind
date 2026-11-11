// Rebuild derived assets only when their originals change; runtime needs no encoder.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,weld,simplify,prune,textureCompress,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';
import {mkdir,writeFile,readFile,readdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),folder=resolve(root,'assets/models');
await mkdir(folder,{recursive:true});
await Promise.all([MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const variants={};
for(const [name,ratio,error,size]of[['desktop',.22,.0005,1024],['mobile',.07,.0015,512]]){
 const doc=await io.read(resolve(root,'shakhmatnaya-figura.glb'));
 await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio,error}),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[size,size],quality:90,effort:90}),meshopt({encoder:MeshoptEncoder,level:'high'}));
 const bytes=await io.writeBinary(doc),hash=createHash('sha256').update(bytes).digest('hex').slice(0,12),file=`chip-${name}-${hash}.glb`;
 await writeFile(resolve(folder,file),bytes);variants[name]='/assets/models/'+file;
 console.log(name,bytes.byteLength,'bytes',doc.getRoot().listAccessors().filter(a=>a.getType()==='SCALAR').map(a=>a.getCount()/3),'triangles');
}
for(const file of await readdir(folder))if(file.endsWith('.glb')&&!Object.values(variants).some(path=>path.endsWith(file)))await rm(resolve(folder,file));
await writeFile(resolve(folder,'manifest.js'),'// Derived from the original club GLB; see scripts/prepare-assets.mjs.\nexport default '+JSON.stringify(variants,null,2)+';\n');
await mkdir(resolve(root,'vendor/meshoptimizer'),{recursive:true});
await copyFile(resolve(root,'node_modules/meshoptimizer/meshopt_decoder.module.js'),resolve(root,'vendor/meshoptimizer/meshopt_decoder.module.js'));
await copyFile(resolve(root,'node_modules/meshoptimizer/LICENSE.md'),resolve(root,'vendor/meshoptimizer/LICENSE.md'));
for(const file of await readdir(resolve(root,'atmosphere/images'))){
 if(!file.endsWith('.webp'))continue;
 const target=resolve(root,'atmosphere/images',file.replace('.webp','.avif'));
 await sharp(await readFile(resolve(root,'atmosphere/images',file))).avif({quality:65,effort:5}).toFile(target);
}
