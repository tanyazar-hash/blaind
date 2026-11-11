import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/addons/environments/RoomEnvironment.js';
import {MeshoptDecoder} from './vendor/meshoptimizer/meshopt_decoder.module.js';
import models from './assets/models/manifest.js';

// Derived LODs preserve the original chip; the uploaded source is retained in Git.
export async function createChip(container, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  const constrained=navigator.connection?.saveData||navigator.deviceMemory<=4||navigator.hardwareConcurrency<=4;
  const mobile=innerWidth<=900||constrained;
  let pixelRatio=Math.min(devicePixelRatio,mobile?(constrained?1:1.25):1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  const canvas = renderer.domElement;
  canvas.className = 'model-canvas';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 50);
  camera.position.set(0, 0, 7);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const cube=new THREE.WebGLCubeRenderTarget(mobile?64:128,{type:THREE.HalfFloatType});
  new THREE.CubeCamera(.1,100,cube).update(renderer,room);
  const environment = pmrem.fromCubemap(cube.texture);
  cube.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffedcc, 0x171917, 1.3));
  const key = new THREE.DirectionalLight(0xffe3b5, 2);
  key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdcb571, 2.5);
  rim.position.set(4, 1, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(2, -3, 4); scene.add(fill);
  let root;
  try {
    root = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(mobile?models.mobile:models.desktop)).scene;
  } catch (error) {
    environment.dispose(); renderer.dispose();
    throw error;
  }
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  root.position.sub(bounds.getCenter(new THREE.Vector3()));
  const normalized = new THREE.Group();
  normalized.add(root);
  normalized.scale.setScalar(3.9 / Math.max(size.x, size.y, size.z));
  const pivot = new THREE.Group();
  pivot.add(normalized); scene.add(pivot);

  // The same reference-based Cyrillic logo is used in the header and on the GLB.
  const texture = await new THREE.TextureLoader().loadAsync('./assets/club-logo.svg');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: .05, roughness: .65, metalness: .25,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.075), material);
  const thickness = size.z * 3.9 / Math.max(size.x, size.y, size.z);
  logo.position.z = thickness / 2 + .012;
  pivot.add(logo);
  const reverseLogo = logo.clone();
  reverseLogo.position.z = -thickness / 2 - .012;
  reverseLogo.rotation.y = Math.PI;
  pivot.add(reverseLogo);
  let width=0,height=0,disposed=false;
  let lastPose = { rx:20, ry:-28, rz:-21 };
  function draw(pose = lastPose) {
    if(disposed)return;
    lastPose = pose;
    pivot.rotation.set(
      THREE.MathUtils.degToRad(-pose.rx),
      THREE.MathUtils.degToRad(-pose.ry),
      THREE.MathUtils.degToRad(pose.rz)
    );
    renderer.render(scene, camera);
    canvas.dataset.triangles=String(renderer.info.render.triangles);
  }
  function resize() {
    const nextWidth=container.offsetWidth,nextHeight=container.offsetHeight;
    if(nextWidth===width&&nextHeight===height)return;
    width=nextWidth;height=nextHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    container.classList.remove('model-loaded');
    onContextLost();
  });
  container.append(canvas);
  resize();
  function reduceQuality(){
    if(pixelRatio<=.9)return;
    pixelRatio=Math.max(.9,pixelRatio*.8);renderer.setPixelRatio(pixelRatio);draw();
  }
  function dispose(){
    if(disposed)return;disposed=true;
    scene.traverse(node=>{node.geometry?.dispose();if(node.material)for(const mat of Array.isArray(node.material)?node.material:[node.material]){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose()}});
    environment.dispose();renderer.dispose();canvas.remove();
  }
  canvas.dataset.lod=mobile?'mobile':'desktop';
  return { draw, resize, reduceQuality, dispose };
}
