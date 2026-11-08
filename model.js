import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/three/addons/environments/RoomEnvironment.js';

// The uploaded GLB is retained intact. One scene and one model serve the whole page.
export async function createChip(container, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth <= 600 ? 1.5 : 2));
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
  const environment = pmrem.fromScene(room, .04);
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
    root = (await new GLTFLoader().loadAsync('./shakhmatnaya-figura.glb')).scene;
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

  // A transparent in-scene wordmark follows the actual mesh on both faces.
  const label = document.createElement('canvas');
  label.width = 1024; label.height = 768;
  const ctx = label.getContext('2d');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbb47e';
  ctx.font = '230px Georgia, serif'; ctx.fillText('Λ', 512, 310);
  ctx.font = '500 110px Arial, sans-serif'; ctx.fillText('BLΛIND', 512, 465);
  ctx.font = '23px Arial, sans-serif'; ctx.fillText('P R I V A T E   P O K E R   C L U B', 512, 560);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const material = new THREE.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: .05, roughness: .65, metalness: .25,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.425), material);
  const thickness = size.z * 3.9 / Math.max(size.x, size.y, size.z);
  logo.position.z = thickness / 2 + .012;
  pivot.add(logo);
  const reverseLogo = logo.clone();
  reverseLogo.position.z = -thickness / 2 - .012;
  reverseLogo.rotation.y = Math.PI;
  pivot.add(reverseLogo);
  let lastPose = { rx:20, ry:-28, rz:-21 };
  function draw(pose = lastPose) {
    lastPose = pose;
    pivot.rotation.set(
      THREE.MathUtils.degToRad(-pose.rx),
      THREE.MathUtils.degToRad(-pose.ry),
      THREE.MathUtils.degToRad(pose.rz)
    );
    renderer.render(scene, camera);
  }
  function resize() {
    const width = container.offsetWidth, height = container.offsetHeight;
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
  container.classList.add('model-loaded');
  return { draw, resize };
}
