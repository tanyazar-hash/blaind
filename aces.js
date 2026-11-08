import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from './vendor/three/addons/environments/RoomEnvironment.js';

const stage = document.getElementById('aces-stage');
const hero = document.querySelector('.aces-hero');
const chapters = [...document.querySelectorAll('.ace-chapter')];
const slots = chapters.map(section => section.querySelector('.card-slot'));
const links = [...document.querySelectorAll('.suit-nav a')];
const loading = document.getElementById('loading-label');
const replay = document.getElementById('replay');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const suits = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const W = 1.65, H = 2.31, INTRO_DURATION = 3.42;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t*t*t*(t*(t*6-15)+10);
};
const mix = (a, b, t) => a+(b-a)*t;
const up = new THREE.Vector3(), right = new THREE.Vector3(), toward = new THREE.Vector3();
const worldY = new THREE.Vector3(0,1,0), worldZ = new THREE.Vector3(0,0,1);
let renderer, camera, scene, floor, light, deck = [], current = [];
let width = innerWidth, height = innerHeight, viewHeight = 1, mobile = width <= 600;
let frame = 0, lastTime = 0, introElapsed = 0, ready = false, disposed = false, phase = '';

function roundedCard() {
  const w=W/2, h=H/2, r=.065;
  const shape = new THREE.Shape();
  shape.moveTo(-w+r,-h); shape.lineTo(w-r,-h);
  shape.quadraticCurveTo(w,-h,w,-h+r); shape.lineTo(w,h-r);
  shape.quadraticCurveTo(w,h,w-r,h); shape.lineTo(-w+r,h);
  shape.quadraticCurveTo(-w,h,-w,h-r); shape.lineTo(-w,-h+r);
  shape.quadraticCurveTo(-w,-h,-w+r,-h);
  return shape;
}

function faceMaterial(source, back) {
  const map = source.map;
  map.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshPhysicalMaterial({
    map, color:0xeee5d1, roughness:.68, metalness:.02, specularIntensity:back ? .40 : .12,
    clearcoat:back ? .16 : .025, clearcoatRoughness:.52,
    side:THREE.FrontSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1
  });
  // Only the warm gold ink receives a foil response. Paper and burgundy ink stay matte.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float inkChroma = max(0.0, diffuseColor.r - diffuseColor.b) / max(diffuseColor.r, .02);
      float goldInk = smoothstep(.30, .62, inkChroma) * step(diffuseColor.r * .45, diffuseColor.g);
      roughnessFactor = mix(.72, .35, goldInk);`
    ).replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      metalnessFactor = mix(.01, .60, goldInk);`
    );
  };
  material.customProgramCacheKey = () => 'blaind-gold-ink-v1';
  return material;
}

function buildDeck(gltf) {
  const shape = roundedCard();
  const faceGeometry = new THREE.ShapeGeometry(shape, 14);
  const positions = faceGeometry.attributes.position;
  const uv = faceGeometry.attributes.uv;
  for (let i=0;i<positions.count;i++) {
    uv.setXY(i,(positions.getX(i)+W/2)/W,1-(positions.getY(i)+H/2)/H);
  }
  const stockGeometry = new THREE.ExtrudeGeometry(shape,{
    depth:.008,bevelEnabled:true,bevelThickness:.0007,bevelSize:.001,bevelSegments:2,steps:1,curveSegments:14
  });
  stockGeometry.translate(0,0,-.004);
  const stockMaterial = new THREE.MeshPhysicalMaterial({
    color:0xd9cba9,roughness:.64,metalness:.08,clearcoat:.08
  });
  return suits.map(suit => {
    const prefix='ACE_'+suit;
    const front=gltf.scene.getObjectByName(prefix+'_ace_front');
    const back=gltf.scene.getObjectByName(prefix+'_ornate_black_gold_back');
    const stock=gltf.scene.getObjectByName(prefix+'_ivory_card_stock');
    if (!front?.isMesh || !back?.isMesh || !stock?.isMesh) throw new Error('Missing separate ace: '+suit);
    // Retain the three uploaded mesh parts and their original artwork, trim real corners,
    // and recenter the baked side-by-side coordinates into an independent card pivot.
    for (const [part,isBack] of [[front,false],[back,true]]) {
      part.material=faceMaterial(part.material,isBack);
      part.geometry=faceGeometry;
      part.position.set(0,0,isBack ? -.0054 : .0054);
      part.rotation.set(0,isBack ? Math.PI : 0,0);
      part.castShadow=true; part.receiveShadow=true;
    }
    stock.geometry=stockGeometry; stock.material=stockMaterial;
    stock.position.set(0,0,0); stock.rotation.set(0,0,0);
    stock.castShadow=true; stock.receiveShadow=true;
    const card=new THREE.Group();
    card.name=prefix; card.userData.suit=suit;
    card.add(stock,back,front); scene.add(card);
    return card;
  });
}

function point(x,y,depth=0) {
  return right.clone().multiplyScalar((x/width-.5)*viewHeight*width/height)
    .addScaledVector(up,(.5-y/height)*viewHeight).addScaledVector(toward,depth);
}
function facing(z=0,y=0,x=0) {
  return camera.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)));
}
function pose(position, quaternion, scale) { return {position,quaternion,scale}; }
function blend(a,b,t) {
  return pose(a.position.clone().lerp(b.position,t),a.quaternion.clone().slerp(b.quaternion,t),mix(a.scale,b.scale,t));
}
function heroLayout() {
  const rect=hero.getBoundingClientRect();
  const pixels=mobile ? Math.min(height*.23,width*.38) : Math.min(height*.30,width*.24);
  const scale=pixels/H*viewHeight/height;
  const center=point(width*(mobile ? .50 : .69),rect.top+(mobile ? Math.max(height*.62,440) : height*.57));
  const half=H*.5*scale;
  const pivot=center.clone().addScaledVector(up,-half);
  const flatCenter=pivot.clone().addScaledVector(worldZ,half);
  return {center,scale,pivot,flatCenter};
}
function fanPose(i,layout) {
  const s=layout.scale;
  const position=layout.center.clone()
    .addScaledVector(right,(i-1.5)*(mobile ? 1.14 : 1.18)*s)
    .addScaledVector(up,-Math.abs(i-1.5)*.11*s)
    .addScaledVector(toward,i*.035);
  return pose(position,facing((1.5-i)*.15,(i-1.5)*.018),s);
}
function introPose(i,layout) {
  const local=introElapsed-i*.24;
  const stand=smooth(1.68,2.44,introElapsed);
  const fan=smooth(2.44+i*.035,3.19+i*.035,introElapsed);
  const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,(i-1.5)*.018));
  const upright=facing((i-1.5)*.008);
  const rotation=flat.clone().slerp(upright,stand);
  const center=layout.pivot.clone()
    .add(new THREE.Vector3(0,H*.5*layout.scale,0).applyQuaternion(rotation))
    .addScaledVector(worldY,i*.017*layout.scale*(1-stand))
    .addScaledVector(toward,i*.017*layout.scale*stand);
  let lift=0;
  if (local<.48) {
    const q=clamp(local/.48);
    lift=9*(1-q*q);
  } else if (local<.64) {
    const q=(local-.48)/.16;
    lift=.065*4*q*(1-q);
  }
  if (introElapsed<1.68) center.addScaledVector(worldY,lift);
  return blend(pose(center,rotation,layout.scale),fanPose(i,layout),fan);
}
function waitingPose(i) {
  const pixels=mobile ? 62 : 100;
  return pose(
    point(width*(mobile ? .91 : .925)+(i-2)*3,height*(mobile ? .90 : .87)-(i-1)*4,(i+1)*.012),
    facing(-.12+i*.025,Math.PI),pixels/H*viewHeight/height
  );
}
function chapterPose(i) {
  const rect=slots[i].getBoundingClientRect();
  const rotation=facing(
    [ -.055,.06,-.05,.035 ][i],
    [ -.23,.20,-.21,.21 ][i],
    [ .035,-.025,.025,-.02 ][i]
  );
  return pose(point(rect.left+rect.width/2,rect.top+rect.height/2),rotation,rect.height/H*viewHeight/height);
}

function setPhase(next) {
  if (phase===next) return;
  phase=next; stage.dataset.phase=next;
  if (next==='ready') replay.disabled=false;
}
function updateNavigation() {
  let active=-1;
  chapters.forEach((chapter,i)=>{
    const rect=chapter.getBoundingClientRect();
    if(rect.top<=height*.4 && rect.bottom>height*.4)active=i;
  });
  links.forEach((link,i)=>{
    if(i===active)link.setAttribute('aria-current','step');
    else link.removeAttribute('aria-current');
  });
  document.body.dataset.activeSuit=active<0 ? 'collection' : suits[active].toLowerCase();
}
function schedule() { if (!frame && ready && !disposed) frame=requestAnimationFrame(render); }
function render(time) {
  frame=0;
  const dt=Math.max(.001,Math.min(.05,(time-(lastTime||time-16))/1000));
  lastTime=time;
  if (!reduced.matches && introElapsed<INTRO_DURATION) introElapsed=Math.min(INTRO_DURATION,introElapsed+dt);
  else if(reduced.matches) introElapsed=INTRO_DURATION;
  setPhase(introElapsed<1.34 ? 'falling' : introElapsed<1.68 ? 'stacked' : introElapsed<2.44 ? 'rising' : introElapsed<INTRO_DURATION ? 'revealing' : 'ready');
  const layout=heroLayout();
  const heroHeight=hero.offsetHeight;
  const depart=smooth(heroHeight*.08,heroHeight*.80,scrollY);
  const showIntro=(1-depart)*(introElapsed<INTRO_DURATION ? 1 : 0);
  let moving=false;
  const alpha=reduced.matches ? 1 : 1-Math.exp(-dt*12);
  deck.forEach((card,i)=>{
    const fan=fanPose(i,layout);
    const assigned=chapterPose(i);
    const release=i===0 ? depart : smooth(chapters[i].offsetTop-height*.85,chapters[i].offsetTop-height*.20,scrollY);
    let target=i===0 ? blend(fan,assigned,release) : blend(blend(fan,waitingPose(i),depart),assigned,release);
    if(showIntro>0)target=blend(target,introPose(i,layout),showIntro);
    chapters[i].dataset.cardState=release>.99 ? 'placed' : 'waiting';
    if(!current[i] || reduced.matches || introElapsed<INTRO_DURATION) current[i]=target;
    else {
      current[i].position.lerp(target.position,alpha);
      current[i].quaternion.slerp(target.quaternion,alpha);
      current[i].scale=mix(current[i].scale,target.scale,alpha);
      if(current[i].position.distanceToSquared(target.position)>.000002 ||
         current[i].quaternion.angleTo(target.quaternion)>.001 ||
         Math.abs(current[i].scale-target.scale)>.0003)moving=true;
      else current[i]=target;
    }
    card.position.copy(current[i].position);
    card.quaternion.copy(current[i].quaternion);
    card.scale.setScalar(current[i].scale);
  });
  floor.position.copy(layout.flatCenter).y-=.008;
  floor.material.opacity=.14*(1-smooth(1.68,2.44,introElapsed))*(1-depart);
  floor.visible=floor.material.opacity>.001;
  light.target.position.copy(layout.flatCenter);
  light.position.copy(layout.flatCenter).add(new THREE.Vector3(-3,7,5));
  updateNavigation();
  renderer.render(scene,camera);
  if(introElapsed<INTRO_DURATION || moving)schedule();
}
function resize() {
  width=innerWidth; height=innerHeight; mobile=width<=600;
  camera.aspect=width/height; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  camera.matrixWorld.extractBasis(right,up,toward);
  right.normalize(); up.normalize(); toward.normalize();
  viewHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.length();
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile ? 1.5 : 2));
  renderer.setSize(width,height,false);
  current=[];
  schedule();
}

function fallback(error) {
  console.warn('Ace collection unavailable.',error);
  disposed=true;
  if(frame)cancelAnimationFrame(frame);
  stage.dataset.phase='fallback';
  loading.classList.add('done');
  document.getElementById('aces-fallback').hidden=false;
  renderer?.domElement.remove();
  renderer?.dispose();
}
async function init() {
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.78;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.dataset.model='four-separate-aces';
  stage.append(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(32,1,.1,80);
  camera.position.set(0,6.8,11); camera.lookAt(0,0,0);
  resize();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.045);
  scene.environment=environment.texture; scene.environmentIntensity=.5;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffeed4,0x161a19,.8));
  light=new THREE.DirectionalLight(0xffe7c7,1.8);
  light.castShadow=true;
  light.shadow.mapSize.set(mobile ? 1024 : 2048,mobile ? 1024 : 2048);
  light.shadow.camera.left=-8;light.shadow.camera.right=8;
  light.shadow.camera.top=10;light.shadow.camera.bottom=-6;
  light.shadow.camera.near=.5;light.shadow.camera.far=22;
  light.shadow.normalBias=.014;light.shadow.bias=-.0002;light.shadow.radius=4;
  scene.add(light,light.target);
  const fill=new THREE.DirectionalLight(0xffffff,.4);fill.position.set(-5,3,6);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xd5b67b,.8);rim.position.set(5,4,-5);scene.add(rim);
  floor=new THREE.Mesh(new THREE.PlaneGeometry(7,5),new THREE.ShadowMaterial({opacity:.25}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const gltf=await new GLTFLoader().loadAsync('./blaind_four_separate_aces.glb');
  deck=buildDeck(gltf);
  renderer.domElement.dataset.cardCount=String(deck.length);
  introElapsed=reduced.matches || scrollY>height*.15 ? INTRO_DURATION : 0;
  ready=true; resize();
  loading.classList.add('done'); loading.textContent='Колода готова';
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback('context lost')});
  schedule();
}

replay.addEventListener('click',()=>{
  if(!ready||disposed)return;
  scrollTo({top:0,behavior:'instant'});
  introElapsed=reduced.matches ? INTRO_DURATION : 0;
  current=[];lastTime=0;replay.disabled=!reduced.matches;
  schedule();
});
window.addEventListener('scroll',schedule,{passive:true});
window.addEventListener('resize',()=>{if(ready)resize()},{passive:true});
window.addEventListener('pageshow',schedule);
document.addEventListener('visibilitychange',()=>{lastTime=0;if(!document.hidden)schedule()});
reduced.addEventListener('change',()=>{if(reduced.matches)introElapsed=INTRO_DURATION;current=[];schedule()});
init().catch(fallback);
