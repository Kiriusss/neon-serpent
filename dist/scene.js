import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WORLD } from './engine.js';

const CELL = 1.35, W = WORLD.x * CELL, D = WORLD.z * CELL, H = WORLD.y * CELL;
const CENTER = new THREE.Vector3(0, H / 2 - .1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const toWorld = p => new THREE.Vector3((p.x - (WORLD.x - 1) / 2) * CELL, .7 + (p.y || 0) * CELL, (p.z - (WORLD.z - 1) / 2) * CELL);
function lines(points, color = 0x526a81, opacity = 1) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false }));
}
function label(text, color = '#a9baca', size = 1) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 256, 64); ctx.font = '600 27px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 128, 32);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })); sprite.scale.set(4 * size, size, 1); return sprite;
}

/** Physical lights, soft shadows and local effects. Intentionally no bloom pass. */
export class Arena {
  constructor(canvas, { onFailure = () => {} } = {}) {
    this.canvas = canvas; this.onFailure = onFailure; this.t = 0; this.menu = true; this.low = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.pointer = new THREE.Vector2();
    this.cameraIndex = 0; this.cameraLabel = '等轴'; this.azimuth = this.targetAzimuth = .64; this.elevation = this.targetElevation = .52;
    this.characterColor = new THREE.Color(0x94c5e3); this.foodMeshes = new Map(); this.enemyMeshes = new Map(); this.hazardMeshes = new Map();
    this.lastHead = new THREE.Vector3(); this.effectTimer = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x0b1220); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0x0b1220, 72, 140);
    this.camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 180);
    this.scene.add(new THREE.HemisphereLight(0xc8def5, 0x253343, 1.9));
    this.keyLight = new THREE.DirectionalLight(0xfff2dc, 3.1); this.keyLight.position.set(-14, 27, 19); this.keyLight.target.position.copy(CENTER); this.scene.add(this.keyLight.target, this.keyLight);
    this.keyLight.castShadow = true; this.keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.keyLight.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 75 });
    this.keyLight.shadow.bias = -.00035; this.keyLight.shadow.normalBias = .025; this.keyLight.shadow.radius = 3;
    const rim = new THREE.DirectionalLight(0x91b7ff, 1.65); rim.position.set(13, 10, -18); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xa6c9cd, .55); fill.position.set(-16, 4, -6); this.scene.add(fill);
    this.skillLight = new THREE.PointLight(0xb6d7ff, 0, 8, 2); this.scene.add(this.skillLight);
    this.createStage(); this.createSnake(); this.createObjects(); this.createEffects(); this.createBackground();
    this.fitCorners = [];
    for (const x of [-W / 2 - 1.8, W / 2 + 1.8]) for (const y of [-1.2, H + .7]) for (const z of [-D / 2 - 1.8, D / 2 + 1.8]) this.fitCorners.push(new THREE.Vector3(x, y, z));
    this.resizeHandler = () => this.resize(); window.addEventListener('resize', this.resizeHandler);
    this.contextLost = e => { e.preventDefault(); onFailure('图形设备暂时中断，请刷新页面恢复。'); };
    canvas.addEventListener('webglcontextlost', this.contextLost); this.resize();
  }

  createStage() {
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    const armor = new THREE.MeshStandardMaterial({ color: 0x25364b, metalness: .48, roughness: .42 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(W + 2, .85, D + 2, 2, .25), armor); body.position.y = -.8; body.receiveShadow = true; this.stage.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + .4, .16, D + .4), new THREE.MeshStandardMaterial({ color: 0x202f42, metalness: .18, roughness: .76 })); top.position.y = -.29; top.receiveShadow = true; this.stage.add(top);
    const grid = [];
    for (let i = 0; i <= WORLD.x; i++) { const x = i * CELL - W / 2; grid.push([x, -.195, -D / 2], [x, -.195, D / 2]); }
    for (let i = 0; i <= WORLD.z; i++) { const z = i * CELL - D / 2; grid.push([-W / 2, -.195, z], [W / 2, -.195, z]); }
    this.stage.add(lines(grid, 0x567086, .28));
    const frame = [], x = W / 2, z = D / 2;
    for (const y of [0, H]) frame.push([-x, y, -z], [x, y, -z], [x, y, -z], [x, y, z], [x, y, z], [-x, y, z], [-x, y, z], [-x, y, -z]);
    for (const a of [-x, x]) for (const b of [-z, z]) frame.push([a, 0, b], [a, H, b]);
    this.stage.add(lines(frame, 0x638099, .48));
    const marks = [];
    for (let y = 0; y < WORLD.y; y++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const height = .7 + y * CELL; marks.push([a * x, height, b * z], [a * (x - .6), height, b * z], [a * x, height, b * z], [a * x, height, b * (z - .6)]);
    }
    this.stage.add(lines(marks, 0x7d95aa, .52));
    const slice = [];
    for (let i = 0; i <= WORLD.x; i += 2) { const a = i * CELL - x; slice.push([a, 0, -z], [a, 0, z]); }
    for (let i = 0; i <= WORLD.z; i += 2) { const a = i * CELL - z; slice.push([-x, 0, a], [x, 0, a]); }
    this.layerGrid = lines(slice, 0x8ca3b8, .16); this.scene.add(this.layerGrid);
    this.layerOutline = lines([[-x, 0, -z], [x, 0, -z], [x, 0, -z], [x, 0, z], [x, 0, z], [-x, 0, z], [-x, 0, z], [-x, 0, -z]], 0x9dc7df, .72); this.scene.add(this.layerOutline);
    this.layerLabels = [];
    for (let i = 0; i < WORLD.y; i++) { const tag = label('L' + (i + 1), '#8199ae', .48); tag.position.set(-x - .65, .7 + i * CELL, z + .15); this.scene.add(tag); this.layerLabels.push(tag); }
    const arrows = [{ text: 'W / −Z', p: [0, .1, -z - 1.2], color: '#8baeb9' }, { text: 'S / +Z', p: [0, .1, z + 1.3], color: '#8baeb9' }, { text: 'A / −X', p: [-x - 1.7, .1, 0], color: '#bcadb4' }, { text: 'D / +X', p: [x + 1.7, .1, 0], color: '#bcadb4' }, { text: 'Q ↑ / E ↓', p: [x + .1, H + .45, -z], color: '#adc6ed' }];
    for (const arrow of arrows) { const tag = label(arrow.text, arrow.color, .62); tag.position.set(...arrow.p); this.scene.add(tag); }
    const trim = new THREE.MeshStandardMaterial({ color: 0x668198, metalness: .65, roughness: .3, emissive: 0x3a566c, emissiveIntensity: .12 });
    const bracketGeometry = new RoundedBoxGeometry(1.4, .24, 1.4, 1, .12), capGeometry = new THREE.BoxGeometry(.12, .08, .65), capMaterial = new THREE.MeshStandardMaterial({ color: 0xd3e2ec, roughness: .4 });
    for (const a of [-1, 1]) for (const b of [-1, 1]) { const bracket = new THREE.Mesh(bracketGeometry, trim); bracket.position.set(a * (x + .1), -.13, b * (z + .1)); this.stage.add(bracket); const cap = new THREE.Mesh(capGeometry, capMaterial); cap.position.set(a * (x + .1), .035, b * (z + .1)); this.stage.add(cap); }
    this.groundTarget = new THREE.Group(); this.scene.add(this.groundTarget);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.38, .47, 32), new THREE.MeshBasicMaterial({ color: 0xe6f2f6, side: THREE.DoubleSide, transparent: true, opacity: .72, depthWrite: false })); ring.rotation.x = -Math.PI / 2; this.groundTarget.add(ring);
    this.groundTarget.add(lines([[-.75, 0, 0], [-.5, 0, 0], [.5, 0, 0], [.75, 0, 0], [0, 0, -.75], [0, 0, -.5], [0, 0, .5], [0, 0, .75]], 0xc9dce7, .65));
    this.rangefinder = lines([[0, 0, 0], [0, 1, 0]], 0xa4c7d8, .42); this.scene.add(this.rangefinder);
  }

  createSnake() {
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x82a9c0, roughness: .35, metalness: .45, emissive: 0x142638, emissiveIntensity: .12 });
    this.trimMaterial = new THREE.MeshStandardMaterial({ color: 0xd2e4ef, roughness: .3, metalness: .5, emissive: 0x5e9dbb, emissiveIntensity: .16 });
    this.body = new THREE.InstancedMesh(new RoundedBoxGeometry(.98, .76, 1.24, 2, .17), this.bodyMaterial, 64);
    this.stripes = new THREE.InstancedMesh(new RoundedBoxGeometry(.18, .035, .78, 1, .01), this.trimMaterial, 64);
    for (const mesh of [this.body, this.stripes]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh); }
    this.head = new THREE.Group(); this.scene.add(this.head);
    const shell = new THREE.Mesh(new RoundedBoxGeometry(1.15, .88, 1.38, 3, .23), new THREE.MeshStandardMaterial({ color: 0xe5edf2, metalness: .4, roughness: .3 })); shell.castShadow = shell.receiveShadow = true; this.head.add(shell);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(1, .27, .16, 2, .06), new THREE.MeshStandardMaterial({ color: 0x102436, metalness: .3, roughness: .18 })); visor.position.set(0, .11, .65); this.head.add(visor);
    this.eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8f5ff, emissive: 0x7cb9e0, emissiveIntensity: .45, roughness: .3 });
    const eyeGeometry = new THREE.BoxGeometry(.18, .07, .05);
    for (const x of [-.29, .29]) { const eye = new THREE.Mesh(eyeGeometry, this.eyeMaterial); eye.position.set(x, .13, .75); this.head.add(eye); }
    const fin = new THREE.Mesh(new RoundedBoxGeometry(.16, .09, .66, 1, .03), this.trimMaterial); fin.position.set(0, .47, -.05); this.head.add(fin);
    this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.02, 1), new THREE.MeshBasicMaterial({ color: 0xa9cbef, wireframe: true, transparent: true, opacity: .15, depthWrite: false })); this.head.add(this.shieldMesh);
    this.dummy = new THREE.Object3D(); this.headQuaternion = new THREE.Quaternion().setFromUnitVectors(FORWARD, new THREE.Vector3(1, 0, 0)); this.targetQuaternion = new THREE.Quaternion();
  }

  createObjects() {
    this.foodGeometry = new THREE.OctahedronGeometry(.4, 0); this.foodCageGeometry = new THREE.TorusGeometry(.55, .027, 5, 24);
    this.foodMaterials = {
      normal: new THREE.MeshStandardMaterial({ color: 0xf7c86b, roughness: .3, metalness: .42, emissive: 0x6b4013, emissiveIntensity: .13 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffe09a, roughness: .24, metalness: .55, emissive: 0x654710, emissiveIntensity: .18 }),
      heal: new THREE.MeshStandardMaterial({ color: 0x88e1bd, roughness: .32, metalness: .3, emissive: 0x164c38, emissiveIntensity: .15 }),
      chrono: new THREE.MeshStandardMaterial({ color: 0xa7b6fa, roughness: .35, metalness: .4, emissive: 0x3b346f, emissiveIntensity: .1 }),
    };
    this.foodCageMaterial = new THREE.MeshStandardMaterial({ color: 0xbcb29a, roughness: .45, metalness: .65 });
    this.droneMaterial = new THREE.MeshStandardMaterial({ color: 0xc96768, roughness: .42, metalness: .35 }); this.droneTrim = new THREE.MeshStandardMaterial({ color: 0x333b4c, roughness: .4, metalness: .55 });
    this.droneEyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffd29c, emissive: 0xc44c21, emissiveIntensity: .4, roughness: .25 });
    this.droneGeometry = new THREE.OctahedronGeometry(.55, 0); this.wingGeometry = new THREE.BoxGeometry(.7, .12, .38); this.enemyEyeGeometry = new THREE.BoxGeometry(.22, .12, .08); this.bossRingGeometry = new THREE.TorusGeometry(.82, .065, 6, 36);
    this.hpMaterial = new THREE.SpriteMaterial({ color: 0xe48181, depthTest: false, depthWrite: false }); this.hpBackMaterial = new THREE.SpriteMaterial({ color: 0x1c293b, depthTest: false, depthWrite: false });
    this.obstacles = new THREE.InstancedMesh(new RoundedBoxGeometry(1.08, 1.08, 1.08, 1, .1), new THREE.MeshStandardMaterial({ color: 0x70515d, roughness: .7, metalness: .12 }), 256);
    this.obstacles.castShadow = this.obstacles.receiveShadow = true; this.obstacles.frustumCulled = false; this.scene.add(this.obstacles);
    this.shotGeometry = new THREE.BufferGeometry(); this.shotGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(200 * 6), 3)); this.shotGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(200 * 6), 3)); this.shotGeometry.setDrawRange(0, 0);
    this.shotLines = new THREE.LineSegments(this.shotGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .78, depthWrite: false })); this.shotLines.frustumCulled = false; this.scene.add(this.shotLines);
    this.hazardGeometry = new THREE.SphereGeometry(1, 12, 8); this.hazardRingGeometry = new THREE.TorusGeometry(1, .016, 4, 48);
    this.hazardMaterial = new THREE.MeshBasicMaterial({ color: 0xf08081, wireframe: true, transparent: true, opacity: .24, depthWrite: false }); this.hazardRingMaterial = new THREE.MeshBasicMaterial({ color: 0xffa39c, transparent: true, opacity: .75, depthWrite: false });
  }

  createEffects() {
    this.particles = Array.from({ length: 260 }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), color: new THREE.Color() })); this.particleCursor = 0;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.particles.length * 3), 3));
    this.particleMesh = new THREE.Points(geo, new THREE.PointsMaterial({ size: .13, vertexColors: true, transparent: true, opacity: .8, depthWrite: false })); this.particleMesh.frustumCulled = false; this.scene.add(this.particleMesh);
    this.ringGeometry = new THREE.RingGeometry(.92, 1, 48); this.ripples = [];
  }
  createBackground() {
    const positions = []; for (let i = 0; i < 170; i++) positions.push((Math.random() - .5) * 150, (Math.random() - .3) * 80, (Math.random() - .5) * 150);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7892ac, size: .045, transparent: true, opacity: .35, depthWrite: false })); this.scene.add(this.stars);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x101c2b, roughness: .95, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.8; floor.receiveShadow = true; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(15.1, 15.14, 100), new THREE.MeshBasicMaterial({ color: 0x385066, side: THREE.DoubleSide, transparent: true, opacity: .28 })); ring.rotation.x = -Math.PI / 2; ring.position.y = -2.77; this.scene.add(ring);
  }

  setMenu(value) { this.menu = !!value; }
  setCharacter(character) {
    if (!character) return; try { this.characterColor.set(character.color || 0x94c5e3); } catch { this.characterColor.set(0x94c5e3); }
    this.bodyMaterial.color.copy(this.characterColor).lerp(new THREE.Color(0x8093a5), .28); this.trimMaterial.color.copy(this.characterColor).lerp(new THREE.Color(0xffffff), .55); this.trimMaterial.emissive.copy(this.characterColor).multiplyScalar(.22); this.eyeMaterial.color.copy(this.characterColor).lerp(new THREE.Color(0xffffff), .4);
  }
  setQuality(low) { this.low = !!low; this.renderer.shadowMap.enabled = !this.low; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.low ? 1 : 1.7)); this.resize(); }
  cycleCamera() {
    this.cameraIndex = (this.cameraIndex + 1) % 3; const p = [{ name: '等轴', a: .64, e: .52 }, { name: '正面', a: 0, e: .16 }, { name: '俯视', a: 0, e: 1.48 }][this.cameraIndex]; this.cameraLabel = p.name; this.targetAzimuth = p.a; this.targetElevation = p.e; return this.cameraLabel;
  }
  orbit(dx, dy) { this.targetAzimuth -= dx * .007; this.targetElevation = THREE.MathUtils.clamp(this.targetElevation + dy * .006, .12, 1.48); this.cameraLabel = '自由'; }
  resize() { this.width = Math.max(1, this.canvas.clientWidth || innerWidth); this.height = Math.max(1, this.canvas.clientHeight || innerHeight); this.renderer.setSize(this.width, this.height, false); this.fitCamera(); }
  fitCamera() {
    if (!this.fitCorners) return;
    const w = this.width, h = this.height, mobile = w < 760;
    this.camera.position.set(Math.sin(this.azimuth) * Math.cos(this.elevation) * 48, Math.sin(this.elevation) * 48, Math.cos(this.azimuth) * Math.cos(this.elevation) * 48).add(CENTER); this.camera.lookAt(CENTER); this.camera.updateMatrixWorld();
    let left = mobile ? 10 : 240, right = mobile ? 10 : 215, top = mobile ? 180 : 105, bottom = mobile ? 180 : 110;
    if (this.menu) { left = mobile ? 8 : Math.min(w * .43, 620); right = mobile ? 8 : 32; top = mobile ? 85 : 90; bottom = mobile ? Math.max(h * .52, 280) : 85; }
    if (h - top - bottom < 170) { const scale = Math.max(.1, (h - 170) / (top + bottom)); top *= scale; bottom *= scale; }
    const safeW = Math.max(160, w - left - right), safeH = Math.max(170, h - top - bottom), centerX = left + safeW / 2, centerY = top + safeH / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const corner of this.fitCorners) { const p = corner.clone().applyMatrix4(this.camera.matrixWorldInverse); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const aspect = w / h, hh = Math.max((maxY - minY) / 2 / (safeH / h), (maxX - minX) / 2 / (safeW / w) / aspect) * 1.035, hw = hh * aspect;
    const ox = (minX + maxX) / 2 + hw * (1 - 2 * centerX / w), oy = (minY + maxY) / 2 + hh * (2 * centerY / h - 1);
    this.camera.left = -hw + ox; this.camera.right = hw + ox; this.camera.top = hh + oy; this.camera.bottom = -hh + oy; this.camera.updateProjectionMatrix();
  }

  makeFood(food) {
    const group = new THREE.Group(), mat = this.foodMaterials[food.type] || this.foodMaterials.normal;
    const core = new THREE.Mesh(this.foodGeometry, mat); core.castShadow = true; group.add(core);
    const cage = new THREE.Mesh(this.foodCageGeometry, this.foodCageMaterial); cage.rotation.x = Math.PI / 2; group.add(cage); group.position.copy(toWorld(food)); this.scene.add(group); return group;
  }
  makeEnemy(enemy, isBoss = false) {
    const group = new THREE.Group(); group.userData.isBoss = isBoss;
    const body = new THREE.Mesh(this.droneGeometry, this.droneMaterial); body.castShadow = body.receiveShadow = true; group.add(body);
    for (const side of [-1, 1]) { const wing = new THREE.Mesh(this.wingGeometry, this.droneTrim); wing.position.x = side * .63; wing.rotation.z = side * -.3; wing.castShadow = true; group.add(wing); }
    const eye = new THREE.Mesh(this.enemyEyeGeometry, this.droneEyeMaterial); eye.position.set(0, .05, .48); group.add(eye);
    const back = new THREE.Sprite(this.hpBackMaterial); back.scale.set(1.2, .085, 1); back.position.y = .95; group.add(back);
    const hp = new THREE.Sprite(this.hpMaterial); hp.scale.set(1.15, .06, 1); hp.position.set(0, .95, .015); hp.renderOrder = 5; group.add(hp); group.userData.hp = hp;
    if (isBoss) { group.scale.setScalar(2.2); const ring = new THREE.Mesh(this.bossRingGeometry, this.droneTrim); ring.rotation.x = .3; group.add(ring); group.userData.ring = ring; }
    else if (enemy.type === 'elite') group.scale.setScalar(1.3);
    group.position.copy(toWorld(enemy)); this.scene.add(group); return group;
  }
  makeHazard(hazard) {
    const group = new THREE.Group(); group.add(new THREE.Mesh(this.hazardGeometry, this.hazardMaterial));
    for (const axis of [0, 1, 2]) { const ring = new THREE.Mesh(this.hazardRingGeometry, this.hazardRingMaterial); if (axis === 1) ring.rotation.x = Math.PI / 2; if (axis === 2) ring.rotation.y = Math.PI / 2; group.add(ring); }
    this.scene.add(group); return group;
  }

  syncObjects(game, dt) {
    const food = this.menu ? [{ id: 'demo0', x: 3, y: 2, z: 4, type: 'normal' }, { id: 'demo1', x: 10, y: 5, z: 8, type: 'gold' }, { id: 'demo2', x: 9, y: 0, z: 2, type: 'heal' }] : game.food || [];
    const ids = new Set(food.map(f => f.id)); for (const [id, mesh] of this.foodMeshes) if (!ids.has(id)) { this.scene.remove(mesh); this.foodMeshes.delete(id); }
    for (const f of food) { let mesh = this.foodMeshes.get(f.id); if (!mesh) { mesh = this.makeFood(f); this.foodMeshes.set(f.id, mesh); } mesh.position.copy(toWorld(f)); if (!this.reduced) { mesh.children[0].rotation.y += dt * .7; mesh.children[0].rotation.z += dt * .25; mesh.children[1].rotation.z += dt * .2; } }
    const enemies = this.menu ? [] : [...(game.enemies || [])];
    if (!this.menu && game.boss && !enemies.some(e => e.id === game.boss.id || e.type === 'boss')) enemies.push({ ...game.boss, type: 'boss' });
    const enemyIds = new Set(enemies.map(e => e.id)); for (const [id, mesh] of this.enemyMeshes) if (!enemyIds.has(id)) { this.scene.remove(mesh); this.enemyMeshes.delete(id); }
    for (const e of enemies) {
      let mesh = this.enemyMeshes.get(e.id); if (!mesh) { mesh = this.makeEnemy(e, e.type === 'boss'); this.enemyMeshes.set(e.id, mesh); }
      mesh.position.lerp(toWorld(e), Math.min(1, dt * 10)); const ratio = THREE.MathUtils.clamp((e.hp || 0) / (e.maxHp || 1), 0, 1); mesh.userData.hp.scale.x = ratio * 1.15; mesh.userData.hp.position.x = -(1 - ratio) * .575;
      mesh.children[0].rotation.y += dt * .5; if (mesh.userData.ring) mesh.userData.ring.rotation.y += dt * .4;
    }
    const obstacles = this.menu ? [] : game.obstacles || [];
    if (obstacles.length > this.obstacles.instanceMatrix.count) { const old = this.obstacles; this.obstacles = new THREE.InstancedMesh(old.geometry, old.material, THREE.MathUtils.ceilPowerOfTwo(obstacles.length)); this.obstacles.frustumCulled = false; this.obstacles.castShadow = this.obstacles.receiveShadow = true; this.scene.remove(old); old.dispose(); this.scene.add(this.obstacles); }
    this.obstacles.count = obstacles.length;
    for (let i = 0; i < obstacles.length; i++) { this.dummy.position.copy(toWorld(obstacles[i])); this.dummy.quaternion.identity(); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.obstacles.setMatrixAt(i, this.dummy.matrix); } this.obstacles.instanceMatrix.needsUpdate = true;
    let shotCount = 0;
    for (const shot of this.menu ? [] : game.shots || []) {
      if (!shot.from || !shot.to || shotCount >= 200) continue;
      const a = toWorld(shot.from), b = toWorld(shot.to), color = new THREE.Color(shot.color || 0xc6e3ff), attr = this.shotGeometry.attributes;
      attr.position.setXYZ(shotCount * 2, a.x, a.y, a.z); attr.position.setXYZ(shotCount * 2 + 1, b.x, b.y, b.z); attr.color.setXYZ(shotCount * 2, color.r, color.g, color.b); attr.color.setXYZ(shotCount * 2 + 1, color.r, color.g, color.b); shotCount++;
    }
    this.shotGeometry.setDrawRange(0, shotCount * 2); this.shotGeometry.attributes.position.needsUpdate = this.shotGeometry.attributes.color.needsUpdate = true;
    const hazards = this.menu ? [] : game.hazards || [], hazardIds = new Set(hazards.map(h => h.id));
    for (const [id, mesh] of this.hazardMeshes) if (!hazardIds.has(id)) { this.scene.remove(mesh); this.hazardMeshes.delete(id); }
    for (const hazard of hazards) { let mesh = this.hazardMeshes.get(hazard.id); if (!mesh) { mesh = this.makeHazard(hazard); this.hazardMeshes.set(hazard.id, mesh); } mesh.position.copy(toWorld(hazard)); mesh.scale.setScalar(Math.max(.3, hazard.radius || 1) * CELL); const urgency = 1 - THREE.MathUtils.clamp((hazard.remaining || 0) / (hazard.duration || 1), 0, 1); mesh.children[0].visible = !this.reduced && Math.sin(this.t * (4 + urgency * 6)) > -.3; }
  }

  updateSnake(game, dt) {
    let points;
    if (this.menu) points = Array.from({ length: 36 }, (_, i) => { const a = this.t * .23 - i * .16; return new THREE.Vector3(Math.cos(a) * 5.1, 4.2 + Math.sin(a * .65) * 2.7, Math.sin(a) * 5.1); });
    else { const alpha = game.status === 'dead' || game.status === 'won' ? 1 : THREE.MathUtils.clamp(game.progress || 0, 0, 1); points = (game.snake || []).map((p, i) => { const old = game.previous?.[i] || game.previous?.at(-1) || p; const wrap = Math.abs(old.x - p.x) > 1 || Math.abs(old.y - p.y) > 1 || Math.abs(old.z - p.z) > 1; return wrap ? toWorld(p) : toWorld(old).lerp(toWorld(p), alpha); }); }
    if (!points.length) { this.head.visible = false; this.body.count = this.stripes.count = 0; return; }
    if (points.length > this.body.instanceMatrix.count) for (const name of ['body', 'stripes']) { const old = this[name], mesh = new THREE.InstancedMesh(old.geometry, old.material, THREE.MathUtils.ceilPowerOfTwo(points.length)); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; this.scene.remove(old); old.dispose(); this.scene.add(mesh); this[name] = mesh; }
    this.body.count = this.stripes.count = Math.max(0, points.length - 1); this.head.visible = true;
    const head = points[0]; this.lastHead.copy(head); const direction = head.clone().sub(points[1] || head);
    if (direction.lengthSq() < .001 || direction.length() > CELL * 2) { const map = { up: [0, 0, -1], down: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0], rise: [0, 1, 0], fall: [0, -1, 0] }; direction.set(...(map[game.direction] || [1, 0, 0])); }
    direction.normalize(); this.targetQuaternion.setFromUnitVectors(FORWARD, direction); this.headQuaternion.slerp(this.targetQuaternion, Math.min(1, dt * 18)); this.head.position.copy(head); this.head.quaternion.copy(this.headQuaternion);
    for (let i = 1; i < points.length; i++) {
      const p = points[i], facing = points[i - 1].clone().sub(points[i + 1] || p); if (facing.lengthSq() < .0001 || facing.length() > CELL * 3) facing.copy(direction); facing.normalize(); const taper = Math.min(1, .55 + (points.length - i) * .09);
      this.dummy.position.copy(p); this.dummy.quaternion.setFromUnitVectors(FORWARD, facing); this.dummy.scale.set(taper, taper, 1); this.dummy.updateMatrix(); this.body.setMatrixAt(i - 1, this.dummy.matrix); this.dummy.position.add(new THREE.Vector3(0, .4 * taper, 0).applyQuaternion(this.dummy.quaternion)); this.dummy.updateMatrix(); this.stripes.setMatrixAt(i - 1, this.dummy.matrix);
    }
    this.body.instanceMatrix.needsUpdate = this.stripes.instanceMatrix.needsUpdate = true; this.trimMaterial.emissiveIntensity = game.boosting && !this.menu ? .52 : .16;
    this.shieldMesh.visible = !this.menu && (game.shield || 0) > 0; this.shieldMesh.rotation.y += dt * .4;
    this.layerGrid.position.y = this.layerOutline.position.y = Math.max(.12, head.y - .6); this.groundTarget.position.set(head.x, -.17, head.z); this.rangefinder.position.set(head.x, -.12, head.z); this.rangefinder.scale.y = Math.max(.1, head.y + .12);
    const layer = THREE.MathUtils.clamp(Math.round((head.y - .7) / CELL), 0, WORLD.y - 1); for (let i = 0; i < this.layerLabels.length; i++) this.layerLabels[i].material.opacity = i === layer ? 1 : .36;
    this.layerGrid.visible = this.layerOutline.visible = this.groundTarget.visible = this.rangefinder.visible = !this.menu;
  }

  effect(name, data = {}) {
    const source = data.position || data.enemy || data.target || data, p = Number.isFinite(source.x) && Number.isFinite(source.z) ? toWorld(source) : this.lastHead.clone();
    const color = name === 'damage' ? 0xe7918f : name === 'eat' ? 0xeed095 : name === 'kill' ? 0xbecfe0 : this.characterColor, count = this.low ? 8 : name === 'skill' || name === 'won' ? 38 : 16;
    for (let i = 0; i < count; i++) { const particle = this.particles[this.particleCursor++ % this.particles.length]; particle.p.copy(p); particle.life = .35 + Math.random() * .45; particle.v.set(Math.random() - .5, Math.random() - .35, Math.random() - .5).normalize().multiplyScalar(name === 'skill' ? 4.5 : 2.3); particle.color.set(color); }
    if (['skill', 'eat', 'won'].includes(name)) { const mesh = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); mesh.rotation.x = -Math.PI / 2; mesh.position.copy(p); this.scene.add(mesh); this.ripples.push({ mesh, life: .65, skill: name !== 'eat' }); while (this.ripples.length > 5) { const old = this.ripples.shift(); this.scene.remove(old.mesh); old.mesh.material.dispose(); } }
    if (name === 'skill') { this.effectTimer = .35; this.skillLight.position.copy(p); this.skillLight.color.copy(this.characterColor); }
  }
  updateEffects(dt) {
    const attr = this.particleMesh.geometry.attributes;
    for (let i = 0; i < this.particles.length; i++) { const p = this.particles[i]; p.life -= dt; if (p.life > 0) { p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.max(0, 1 - dt * 2)); attr.position.setXYZ(i, p.p.x, p.p.y, p.p.z); const fade = Math.min(1, p.life * 2.5); attr.color.setXYZ(i, p.color.r * fade, p.color.g * fade, p.color.b * fade); } else attr.position.setXYZ(i, 0, -1000, 0); }
    attr.position.needsUpdate = attr.color.needsUpdate = true;
    for (let i = this.ripples.length - 1; i >= 0; i--) { const r = this.ripples[i]; r.life -= dt; r.mesh.scale.setScalar(.5 + (.65 - r.life) * (r.skill ? 7 : 3)); r.mesh.material.opacity = Math.max(0, r.life * .5); if (r.life <= 0) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.ripples.splice(i, 1); } }
    this.effectTimer = Math.max(0, this.effectTimer - dt); this.skillLight.intensity = this.effectTimer * 24;
  }
  render(dt, game) {
    dt = Math.min(Math.max(dt || 0, 0), .1); this.t += dt; const blend = this.reduced ? 1 : Math.min(1, dt * 8);
    this.azimuth = THREE.MathUtils.lerp(this.azimuth, this.targetAzimuth, blend); this.elevation = THREE.MathUtils.lerp(this.elevation, this.targetElevation, blend);
    this.fitCamera(); this.updateSnake(game, dt); this.syncObjects(game, dt); this.updateEffects(dt); this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    window.removeEventListener('resize', this.resizeHandler); this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set(), materials = new Set(), textures = new Set(); this.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) { materials.add(m); if (m.map) textures.add(m.map); } });
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose(); this.renderer.dispose();
  }
}
